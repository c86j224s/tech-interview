import test from 'node:test';
import assert from 'node:assert/strict';
import { MockIssuer, LoopbackClient, pkceChallenge, LIMITS } from '../src/lab.mjs';

async function withIssuer(run) {
  const issuer = await new MockIssuer().start();
  try {
    return await run(issuer);
  } finally {
    await issuer.stop();
  }
}

async function login(issuer, options = {}) {
  const client = new LoopbackClient({ issuer: issuer.issuer });
  await client.discover();
  const result = await client.login(options);
  return { client, result };
}

function decodeHeader(token) {
  return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
}

test('S256 PKCE uses base64url SHA-256 without padding', () => {
  assert.equal(
    pkceChallenge('abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
    'zwBxoIOtPkc0nS4_vIltB6DVBYCzNcN-OX1Akb-OcTs',
  );
  assert.throws(() => pkceChallenge('short'), /invalid_code_verifier/);
  assert.throws(() => pkceChallenge('a'.repeat(129)), /invalid_code_verifier/);
});

test('authorization code flow validates state, PKCE, nonce, issuer, audience, expiry, and required claims', async () => {
  await withIssuer(async (issuer) => {
    const { result } = await login(issuer);
    assert.equal(result.claims.iss, issuer.issuer);
    assert.equal(result.claims.aud, 'local-client');
    assert.equal(result.claims.nonce.length > 0, true);
    assert.equal(typeof result.claims.exp, 'number');
    assert.equal(typeof result.claims.iat, 'number');
    assert.equal(typeof result.claims.sub, 'string');

    await assert.rejects(() => login(issuer, { tamperState: true }), /state_mismatch/);
    await assert.rejects(() => login(issuer, { tamperVerifier: true }), /token_exchange_400/);

    issuer.tokenOverrides.nonce = 'wrong-nonce';
    await assert.rejects(() => login(issuer), /nonce_mismatch/);
    issuer.tokenOverrides.nonce = undefined;

    issuer.tokenOverrides.aud = 'other-client';
    await assert.rejects(() => login(issuer), { code: "ERR_JWT_CLAIM_VALIDATION_FAILED", claim: "aud" });
    issuer.tokenOverrides.aud = undefined;

    issuer.tokenOverrides.exp = Math.floor(Date.now() / 1000) - 60;
    await assert.rejects(() => login(issuer), /JWTExpired/);
    issuer.tokenOverrides.exp = undefined;

    issuer.tokenOverrides.omitClaims = ['exp'];
    await assert.rejects(() => login(issuer), { code: "ERR_JWT_CLAIM_VALIDATION_FAILED", claim: "exp" });
    issuer.tokenOverrides.omitClaims = undefined;
  });
});

test('authorization code is single-use and binds client and exact redirect context', async () => {
  await withIssuer(async (issuer) => {
    const client = new LoopbackClient({ issuer: issuer.issuer });
    await client.discover();
    const verifier = 'a'.repeat(48);
    const challenge = pkceChallenge(verifier);
    const redirectUri = 'http://127.0.0.1:9/callback';
    const authorization = new URL(issuer.configuration().authorization_endpoint);
    authorization.search = new URLSearchParams({
      response_type: 'code', client_id: 'local-client', redirect_uri: redirectUri,
      code_challenge: challenge, code_challenge_method: 'S256', state: 's', nonce: 'n',
    }).toString();
    const response = await fetch(authorization, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const location = new URL(response.headers.get('location'));
    const code = location.searchParams.get('code');
    const body = new URLSearchParams({
      grant_type: 'authorization_code', code, client_id: 'local-client',
      redirect_uri: redirectUri, code_verifier: verifier,
    });
    const first = await fetch(issuer.configuration().token_endpoint, { method: 'POST', body });
    assert.equal(first.status, 200);
    const second = await fetch(issuer.configuration().token_endpoint, { method: 'POST', body });
    assert.equal(second.status, 400);
    assert.equal((await second.json()).error, 'invalid_grant');

    const secondAuth = await fetch(authorization, { redirect: 'manual' });
    const secondCode = new URL(secondAuth.headers.get('location')).searchParams.get('code');
    const wrongRedirect = new URLSearchParams({ ...Object.fromEntries(body), code: secondCode, redirect_uri: 'http://127.0.0.1:10/callback' });
    const mismatch = await fetch(issuer.configuration().token_endpoint, { method: 'POST', body: wrongRedirect });
    assert.equal(mismatch.status, 400);
  });
});

test('refresh tokens rotate, bind to client, and reject duplicate replay', async () => {
  await withIssuer(async (issuer) => {
    const { client, result } = await login(issuer);
    const old = result.refreshToken;
    const next = await client.refresh();
    assert.notEqual(next.refresh_token, old);

    const wrongClient = await fetch(issuer.configuration().token_endpoint, {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: next.refresh_token, client_id: 'other-client' }),
    });
    assert.equal(wrongClient.status, 400);

    const replay = await fetch(issuer.configuration().token_endpoint, {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: old, client_id: 'local-client' }),
    });
    assert.equal(replay.status, 400);
    assert.equal((await replay.json()).error_description, 'refresh_reuse');
    await assert.rejects(() => client.refresh(), /refresh_failed_400/);
  });
});

test('response loss leaves the client on consumed predecessor and does not roll server back', async () => {
  await withIssuer(async (issuer) => {
    const { client } = await login(issuer);
    const predecessor = client.refreshToken;
    await assert.rejects(() => client.refresh({ dropResponse: true }), /refresh_response_lost/);
    await assert.rejects(() => client.refresh(), /refresh_failed_400/);
    const state = issuer.refreshState(predecessor);
    assert.equal(state.consumed, true);
    assert.equal(state.current, false);
  });
});

test('JWKS rollover refreshes on a new kid while cached old keys remain valid', async () => {
  await withIssuer(async (issuer) => {
    const { client, result: oldResult } = await login(issuer);
    const oldToken = client.lastIdToken;
    const oldHeader = decodeHeader(oldToken);
    const oldNonce = oldResult.claims.nonce;
    const newKid = await issuer.rotateKey();
    const fresh = await client.login();
    const freshHeader = decodeHeader(client.lastIdToken);
    assert.equal(freshHeader.kid, newKid);
    assert.notEqual(freshHeader.kid, oldHeader.kid);
    assert.equal(fresh.claims.iss, issuer.issuer);

    issuer.retireKey(oldHeader.kid);
    const cachedOldClaims = await client.verifyIdToken(oldToken, oldNonce);
    assert.equal(cachedOldClaims.sub, 'local-user');

    const unknownHeader = { ...freshHeader, kid: 'k-does-not-exist' };
    const freshParts = client.lastIdToken.split('.');
    const unknownKidToken = `${Buffer.from(JSON.stringify(unknownHeader)).toString('base64url')}.${freshParts[1]}.${freshParts[2]}`;
    await assert.rejects(() => client.verifyIdToken(unknownKidToken, fresh.claims.nonce), /unknown_kid/);
  });
});

test('callback accepts only GET /callback and always has a deadline', async () => {
  await withIssuer(async (issuer) => {
    const client = new LoopbackClient({ issuer: issuer.issuer, callbackTimeoutMs: 30 });
    const callback = await client.openCallbackForTest();
    callback.result.catch(() => {});
    const wrongPath = await fetch(`${callback.redirectUri}/extra`);
    assert.equal(wrongPath.status, 404);
    const wrongMethod = await fetch(callback.redirectUri, { method: 'POST' });
    assert.equal(wrongMethod.status, 404);
    await assert.rejects(() => callback.result, /callback_timeout/);
    await client.closeCallbackForTest();
  });
});

test('hostile request bodies are bounded and malformed tokens are rejected before crypto', async () => {
  await withIssuer(async (issuer) => {
    const oversized = await fetch(issuer.configuration().token_endpoint, {
      method: 'POST',
      body: 'x'.repeat(LIMITS.bodyBytes + 1),
    });
    assert.equal(oversized.status, 413);

    const client = new LoopbackClient({ issuer: issuer.issuer });
    await client.discover();
    await assert.rejects(() => client.verifyIdToken('not-a-jwt', 'nonce'), /invalid_token_header/);
  });
});
