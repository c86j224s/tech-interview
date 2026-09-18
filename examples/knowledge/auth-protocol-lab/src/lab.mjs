import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { URL } from 'node:url';
import {
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  SignJWT,
} from 'jose';

export const LIMITS = Object.freeze({
  bodyBytes: 16 * 1024,
  codes: 128,
  pending: 32,
  refreshFamilies: 64,
  consumedRefreshHashes: 64,
  jwksKeys: 16,
  valueChars: 512,
  codeTtlMs: 60_000,
  pendingTtlMs: 60_000,
  refreshFamilyTtlMs: 24 * 60 * 60 * 1000,
  fetchTimeoutMs: 1_500,
  callbackTimeoutMs: 1_500,
});

const text = (value) => Buffer.from(value, 'utf8').toString('base64url');
const random = (bytes = 32) => randomBytes(bytes).toString('base64url');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isString = (value, max = LIMITS.valueChars) => typeof value === 'string' && value.length > 0 && value.length <= max;
const isPkceVerifier = (value) => typeof value === 'string' && value.length >= 43 && value.length <= 128 && /^[A-Za-z0-9._~-]+$/.test(value);
const pkceChallenge = (verifier) => {
  if (!isPkceVerifier(verifier)) throw new Error('invalid_code_verifier');
  return text(createHash('sha256').update(verifier, 'ascii').digest());
};
const safeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};
const json = (response, status, body) => {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
};
const httpError = (message, status = 400) => Object.assign(new Error(message), { status });
const readForm = async (request) => {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > LIMITS.bodyBytes) throw httpError('request body too large', 413);
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
};
const isLoopbackRedirect = (value) => {
  if (!isString(value)) return false;
  try {
    const url = new URL(value);
    const port = Number(url.port || 80);
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && port >= 1 && port <= 65_535 && url.pathname === '/callback' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
};
const exactEndpoint = (value, issuer, path) => {
  if (!isString(value)) return false;
  try {
    const endpoint = new URL(value);
    const trusted = new URL(issuer);
    return endpoint.origin === trusted.origin && endpoint.pathname === path && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash;
  } catch {
    return false;
  }
};
const fetchWithTimeout = async (input, init = {}, timeoutMs = LIMITS.fetchTimeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { redirect: 'manual', ...init, signal: controller.signal });
    const chunks = [];
    let length = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        length += chunk.byteLength;
        if (length > 64 * 1024) {
          controller.abort();
          throw new Error('response_too_large');
        }
        chunks.push(Buffer.from(chunk));
      }
    }
    const body = [204, 205, 304].includes(response.status) ? null : Buffer.concat(chunks);
    return new Response(body, { status: response.status, headers: response.headers });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('fetch_timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

export class MockIssuer {
  constructor({ clientId = 'local-client' } = {}) {
    this.clientId = clientId;
    this.codes = new Map();
    this.refreshFamilies = new Map();
    this.tokenOverrides = {};
    this.keys = new Map();
    this.currentKid = null;
    this.server = null;
    this.port = null;
    this.issuer = null;
  }

  async start() {
    await this.rotateKey();
    this.server = http.createServer((request, response) => {
      request.setTimeout(LIMITS.fetchTimeoutMs, () => request.destroy());
      void this.#route(request, response);
    });
    await new Promise((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.port = this.server.address().port;
    this.issuer = `http://127.0.0.1:${this.port}`;
    return this;
  }

  async stop() {
    if (!this.server) return;
    await new Promise((resolve, reject) => this.server.close((error) => error ? reject(error) : resolve()));
    this.server = null;
  }

  configuration() {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/authorize`,
      token_endpoint: `${this.issuer}/token`,
      jwks_uri: `${this.issuer}/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  async rotateKey() {
    if (this.keys.size >= LIMITS.jwksKeys) throw new Error('key_capacity');
    const generated = await generateKeyPair('RS256');
    const kid = `k-${random(8)}`;
    const jwk = await exportJWK(generated.publicKey);
    jwk.kid = kid;
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    jwk.key_ops = ['verify'];
    this.keys.set(kid, { ...generated, jwk });
    this.currentKid = kid;
    return kid;
  }

  retireKey(kid) {
    if (kid === this.currentKid) throw new Error('cannot retire current signing key');
    this.keys.delete(kid);
  }

  refreshState(refreshToken) {
    if (!isString(refreshToken)) return null;
    const candidate = sha256(refreshToken);
    for (const [familyId, family] of this.refreshFamilies) {
      if (safeEqual(family.currentHash, candidate)) return { familyId, version: family.version, current: true, consumed: false };
      if (family.consumedHashes.has(candidate)) return { familyId, version: family.version, current: false, consumed: true };
    }
    return null;
  }

  #pruneCodes(now = Date.now()) {
    for (const [code, entry] of this.codes) if (entry.used || entry.expiresAt <= now) this.codes.delete(code);
  }

  #prunePendingFamilies(now = Date.now()) {
    for (const [familyId, family] of this.refreshFamilies) {
      if (family.lastUsedAt + LIMITS.refreshFamilyTtlMs <= now) this.refreshFamilies.delete(familyId);
    }
  }

  async #route(request, response) {
    try {
      const requestUrl = new URL(request.url, this.issuer);
      if (request.method === 'GET' && requestUrl.pathname === '/.well-known/openid-configuration') {
        return json(response, 200, this.configuration());
      }
      if (request.method === 'GET' && requestUrl.pathname === '/jwks.json') {
        return json(response, 200, { keys: [...this.keys.values()].map(({ jwk }) => jwk) });
      }
      if (request.method === 'GET' && requestUrl.pathname === '/authorize') {
        return this.#authorize(requestUrl, response);
      }
      if (request.method === 'POST' && requestUrl.pathname === '/token') {
        await this.#token(request, response);
        return;
      }
      return json(response, 404, { error: 'not_found' });
    } catch (error) {
      if (!response.writableEnded && !response.destroyed) {
        json(response, error.status ?? 500, { error: error.status ? 'invalid_request' : 'server_error' });
      }
    }
  }

  #authorize(requestUrl, response) {
    const clientId = requestUrl.searchParams.get('client_id');
    const redirectUri = requestUrl.searchParams.get('redirect_uri');
    const codeChallenge = requestUrl.searchParams.get('code_challenge');
    const method = requestUrl.searchParams.get('code_challenge_method');
    const state = requestUrl.searchParams.get('state');
    const nonce = requestUrl.searchParams.get('nonce');
    if (clientId !== this.clientId || !isLoopbackRedirect(redirectUri) || !isString(codeChallenge, 256) || method !== 'S256' || !isString(state) || !isString(nonce)) {
      throw httpError('authorization request rejected');
    }
    this.#pruneCodes();
    if (this.codes.size >= LIMITS.codes) throw httpError('authorization server capacity', 503);
    const code = random(32);
    this.codes.set(code, {
      clientId,
      redirectUri,
      codeChallenge,
      nonce,
      expiresAt: Date.now() + LIMITS.codeTtlMs,
      used: false,
    });
    const callback = new URL(redirectUri);
    callback.searchParams.set('code', code);
    callback.searchParams.set('state', state);
    response.writeHead(302, { location: callback.toString(), 'cache-control': 'no-store' });
    response.end();
  }

  async #token(request, response) {
    const form = await readForm(request);
    if (form.get('grant_type') === 'authorization_code') {
      await this.#authorizationCode(form, response);
      return;
    }
    if (form.get('grant_type') === 'refresh_token') {
      await this.#refresh(form, response);
      return;
    }
    json(response, 400, { error: 'unsupported_grant_type' });
  }

  async #authorizationCode(form, response) {
    const codeValue = form.get('code');
    const code = isString(codeValue) ? this.codes.get(codeValue) : null;
    if (!code || code.used || code.expiresAt <= Date.now()) return json(response, 400, { error: 'invalid_grant' });
    if (code.clientId !== form.get('client_id') || code.redirectUri !== form.get('redirect_uri')) {
      return json(response, 400, { error: 'invalid_grant' });
    }
    const verifier = form.get('code_verifier');
    if (!isPkceVerifier(verifier) || !safeEqual(pkceChallenge(verifier), code.codeChallenge)) {
      return json(response, 400, { error: 'invalid_grant' });
    }
    code.used = true;
    const accessToken = random(32);
    const refreshToken = random(32);
    this.#prunePendingFamilies();
    if (this.refreshFamilies.size >= LIMITS.refreshFamilies) return json(response, 503, { error: 'temporarily_unavailable' });
    const familyId = random(12);
    this.refreshFamilies.set(familyId, {
      clientId: code.clientId,
      version: 1,
      currentHash: sha256(refreshToken),
      consumedHashes: new Set(),
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });
    const overrides = Object.fromEntries(
      Object.entries(this.tokenOverrides).filter(([, value]) => value !== undefined),
    );
    const idToken = await this.#signIdToken({
      clientId: code.clientId,
      nonce: code.nonce,
      ...overrides,
    });
    return json(response, 200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 60,
      refresh_token: refreshToken,
      id_token: idToken,
    });
  }

  async #refresh(form, response) {
    const supplied = form.get('refresh_token');
    const clientId = form.get('client_id');
    if (!isString(supplied) || !isString(clientId)) return json(response, 400, { error: 'invalid_grant' });
    this.#prunePendingFamilies();
    const suppliedHash = sha256(supplied);
    let matchedFamily = null;
    for (const family of this.refreshFamilies.values()) {
      if (family.consumedHashes.has(suppliedHash) && family.clientId === clientId) {
        family.revoked = true;
        return json(response, 400, { error: 'invalid_grant', error_description: 'refresh_reuse' });
      }
      if (safeEqual(family.currentHash, suppliedHash)) matchedFamily = family;
    }
    if (!matchedFamily || matchedFamily.revoked || matchedFamily.clientId !== clientId) return json(response, 400, { error: 'invalid_grant' });
    if (matchedFamily.consumedHashes.size >= LIMITS.consumedRefreshHashes) {
      matchedFamily.revoked = true;
      return json(response, 400, { error: 'invalid_grant', error_description: 'reauthentication_required' });
    }
    matchedFamily.consumedHashes.add(matchedFamily.currentHash);
    matchedFamily.version += 1;
    matchedFamily.lastUsedAt = Date.now();
    const next = random(32);
    matchedFamily.currentHash = sha256(next);
    return json(response, 200, {
      access_token: random(32),
      token_type: 'Bearer',
      expires_in: 60,
      refresh_token: next,
    });
  }

  async #signIdToken({ clientId, nonce, exp, iss, aud, omitClaims = [], sub = 'local-user', iat }) {
    const key = this.keys.get(this.currentKid);
    const now = Math.floor(Date.now() / 1000);
    const omitted = new Set(Array.isArray(omitClaims) ? omitClaims : []);
    const builder = new SignJWT({
      ...(omitted.has('sub') ? {} : { sub }),
      ...(omitted.has('nonce') ? {} : { nonce }),
    }).setProtectedHeader({ alg: 'RS256', kid: this.currentKid, typ: 'JWT' });
    if (!omitted.has('iss')) builder.setIssuer(iss ?? this.issuer);
    if (!omitted.has('aud')) builder.setAudience(aud ?? clientId);
    if (!omitted.has('iat')) builder.setIssuedAt(iat ?? now);
    if (!omitted.has('exp')) builder.setExpirationTime(exp ?? now + 60);
    return builder.sign(key.privateKey);
  }
}

export class LoopbackClient {
  constructor({ issuer, clientId = 'local-client', callbackTimeoutMs = LIMITS.callbackTimeoutMs } = {}) {
    this.trustedIssuer = issuer;
    this.clientId = clientId;
    this.callbackTimeoutMs = callbackTimeoutMs;
    this.discovery = null;
    this.jwks = new Map();
    this.pending = new Map();
    this.callbackServer = null;
    this.callbackResolve = null;
    this.refreshToken = null;
    this.lastIdToken = null;
  }

  async discover() {
    if (!isString(this.trustedIssuer)) throw new Error('issuer_invalid');
    const trusted = new URL(this.trustedIssuer);
    if (trusted.protocol !== 'http:' || trusted.hostname !== '127.0.0.1' || trusted.username || trusted.password) throw new Error('issuer_invalid');
    const response = await fetchWithTimeout(`${this.trustedIssuer}/.well-known/openid-configuration`);
    if (!response.ok) throw new Error('discovery_failed');
    const metadata = await response.json();
    if (!metadata || metadata.issuer !== this.trustedIssuer || !exactEndpoint(metadata.authorization_endpoint, this.trustedIssuer, '/authorize') || !exactEndpoint(metadata.token_endpoint, this.trustedIssuer, '/token') || !exactEndpoint(metadata.jwks_uri, this.trustedIssuer, '/jwks.json')) {
      throw new Error('issuer_mismatch');
    }
    if (!Array.isArray(metadata.code_challenge_methods_supported) || !metadata.code_challenge_methods_supported.includes('S256')) {
      throw new Error('pkce_unsupported');
    }
    this.discovery = metadata;
    await this.#refreshJwks();
    return metadata;
  }

  async login(options = {}) {
    if (this.loginActive) throw new Error('login_in_progress');
    this.loginActive = true;
    try { return await this.#login(options); }
    finally { this.loginActive = false; }
  }

  async #login({ tamperState = false, tamperVerifier = false } = {}) {
    if (!this.discovery) await this.discover();
    const callback = await this.#openCallback();
    callback.result.catch(() => {});
    const verifier = random(48);
    const nonce = random(24);
    const state = random(24);
    this.#prunePending();
    if (this.pending.size >= LIMITS.pending) {
      await this.#closeCallback();
      throw new Error('pending_capacity');
    }
    this.pending.set(state, {
      verifier,
      nonce,
      redirectUri: callback.redirectUri,
      expiresAt: Date.now() + LIMITS.pendingTtlMs,
      used: false,
    });
    try {
      const authorization = new URL(this.discovery.authorization_endpoint);
      authorization.search = new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        redirect_uri: callback.redirectUri,
        scope: 'openid profile',
        state,
        nonce,
        code_challenge: pkceChallenge(verifier),
        code_challenge_method: 'S256',
      }).toString();
      const authorizationResponse = await fetchWithTimeout(authorization, { redirect: 'manual' });
      if (authorizationResponse.status !== 302) throw new Error('authorization_failed');
      const redirectLocation = authorizationResponse.headers.get('location');
      let location;
      try {
        location = new URL(redirectLocation);
      } catch {
        throw new Error('authorization_failed');
      }
      if (location.origin + location.pathname !== callback.redirectUri || !isLoopbackRedirect(callback.redirectUri)) {
        throw new Error('authorization_failed');
      }
      if (tamperState) location.searchParams.set('state', random(24));
      const callbackResponse = await fetchWithTimeout(location);
      if (!callbackResponse.ok) throw new Error('callback_failed');
      const result = await callback.result;
      const returnedState = result.searchParams.get('state');
      const attempt = this.pending.get(returnedState);
      if (!attempt || attempt.used || attempt.expiresAt <= Date.now()) throw new Error('state_mismatch');
      attempt.used = true;
      this.pending.delete(returnedState);
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: result.searchParams.get('code') ?? '',
        client_id: this.clientId,
        redirect_uri: attempt.redirectUri,
        code_verifier: tamperVerifier ? random(48) : attempt.verifier,
      });
      const tokenResponse = await fetchWithTimeout(this.discovery.token_endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!tokenResponse.ok) throw new Error(`token_exchange_${tokenResponse.status}`);
      const tokens = await tokenResponse.json();
      if (!isString(tokens.id_token, 16 * 1024) || !isString(tokens.access_token) || !isString(tokens.refresh_token)) throw new Error('token_response_invalid');
      const claims = await this.verifyIdToken(tokens.id_token, attempt.nonce);
      this.refreshToken = tokens.refresh_token;
      this.lastIdToken = tokens.id_token;
      return { claims, accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
    } finally {
      this.pending.delete(state);
      await this.#closeCallback();
    }
  }

  async verifyIdToken(token, expectedNonce) {
    if (!isString(token, 16 * 1024) || !isString(expectedNonce)) throw new Error('invalid_token_input');
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('invalid_token_header');
    let protectedHeader;
    try {
      protectedHeader = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    } catch {
      throw new Error('invalid_token_header');
    }
    if (!protectedHeader || protectedHeader.alg !== 'RS256' || !isString(protectedHeader.kid, 128) || protectedHeader.typ !== 'JWT') throw new Error('invalid_token_header');
    let key = this.jwks.get(protectedHeader.kid);
    if (!key) {
      await this.#refreshJwks();
      key = this.jwks.get(protectedHeader.kid);
    }
    if (!key) throw new Error('unknown_kid');
    const verified = await jwtVerify(token, key, {
      issuer: this.trustedIssuer,
      audience: this.clientId,
      algorithms: ['RS256'],
      requiredClaims: ['iss', 'aud', 'exp', 'iat', 'nonce', 'sub'],
      clockTolerance: 5,
    });
    const payload = verified.payload;
    if (typeof payload.iss !== 'string' || payload.iss !== this.trustedIssuer) throw new Error('issuer_mismatch');
    if (!(typeof payload.aud === 'string' || (Array.isArray(payload.aud) && payload.aud.every((value) => typeof value === 'string')))) throw new Error('audience_invalid');
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) throw new Error('expiry_invalid');
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > Math.floor(Date.now() / 1000) + 5) throw new Error('issued_at_invalid');
    if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, expectedNonce)) throw new Error('nonce_mismatch');
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('subject_missing');
    return payload;
  }

  async refresh({ dropResponse = false } = {}) {
    if (!this.refreshToken) throw new Error('refresh_token_missing');
    if (!this.discovery) throw new Error('discovery_missing');
    const submitted = this.refreshToken;
    const response = await fetchWithTimeout(this.discovery.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: submitted, client_id: this.clientId }),
    });
    if (dropResponse) {
      this.refreshToken = submitted;
      throw new Error('refresh_response_lost');
    }
    if (!response.ok) throw new Error(`refresh_failed_${response.status}`);
    const tokens = await response.json();
    if (!isString(tokens.refresh_token) || !isString(tokens.access_token)) throw new Error('refresh_response_invalid');
    this.refreshToken = tokens.refresh_token;
    return tokens;
  }

  async openCallbackForTest() {
    return this.#openCallback();
  }

  async closeCallbackForTest() {
    await this.#closeCallback();
  }

  #prunePending(now = Date.now()) {
    for (const [state, attempt] of this.pending) if (attempt.used || attempt.expiresAt <= now) this.pending.delete(state);
  }

  async #refreshJwks() {
    const response = await fetchWithTimeout(this.discovery.jwks_uri);
    if (!response.ok) throw new Error('jwks_fetch_failed');
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.keys) || payload.keys.length > LIMITS.jwksKeys) throw new Error('jwks_invalid');
    const next = new Map();
    for (const jwk of payload.keys) {
      if (!jwk || jwk.kty !== 'RSA' || jwk.alg !== 'RS256' || jwk.use !== 'sig' || !isString(jwk.kid, 128) || next.has(jwk.kid)) throw new Error('jwks_invalid');
      next.set(jwk.kid, await importJWK(jwk, 'RS256'));
    }
    this.jwks = next;
  }

  async #openCallback() {
    this.callbackServer = http.createServer((request, response) => {
      let address;
      try {
        address = new URL(request.url, 'http://127.0.0.1');
      } catch {
        response.writeHead(400); response.end(); return;
      }
      if (request.method !== 'GET' || address.pathname !== '/callback') {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('not found');
        return;
      }
      if (!this.callbackResolve) {
        response.writeHead(409); response.end(); return;
      }
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      response.end('callback received');
      this.callbackResolve(address);
      this.callbackResolve = null;
    });
    await new Promise((resolve) => this.callbackServer.listen(0, '127.0.0.1', resolve));
    const port = this.callbackServer.address().port;
    const redirectUri = `http://127.0.0.1:${port}/callback`;
    let resolveResult;
    let rejectResult;
    let timer;
    const result = new Promise((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
      timer = setTimeout(() => {
        this.callbackResolve = null;
        reject(new Error('callback_timeout'));
      }, this.callbackTimeoutMs);
    });
    this.callbackTimer = timer;
    this.callbackResolve = (address) => {
      clearTimeout(timer);
      resolveResult(address);
    };
    this.callbackReject = (error) => {
      clearTimeout(timer);
      rejectResult(error);
    };
    return { redirectUri, result };
  }

  async #closeCallback() {
    clearTimeout(this.callbackTimer);
    this.callbackResolve = null;
    if (!this.callbackServer) return;
    const server = this.callbackServer;
    this.callbackServer = null;
    await new Promise((resolve, reject) => server.close((error) => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve()));
  }
}

export { pkceChallenge };
