---
id: webauthn-attestation-format
title: WebAuthn attestation의 fmt와 attStmt를 어떤 순서로 검증하나요?
difficulty: 중하
category: 보안
tags:
  - WebAuthn
  - attestation
  - 등록
related:
  - security-passkeys-origin
---
# WebAuthn attestation의 fmt와 attStmt를 어떤 순서로 검증하나요?

## 구두 답변

검증 순서는 공통 구조를 읽은 뒤 `fmt`별 계약을 적용하는 방식입니다. 먼저 attestationObject의 CBOR map에서 authenticator data와 attestation statement를 분리하고, authenticator data의 RP ID hash, flags, sign count, AAGUID, credential ID, credential public key를 파싱합니다. 동시에 clientDataJSON의 원문 hash를 계산해 challenge·origin·`webauthn.create`를 확인합니다. 그 다음 `fmt`가 구현된 형식인지 확인하고, 예를 들어 packed이라면 attStmt의 alg/ sig와 attestation key 또는 x5c 체인을 그 형식의 서명 입력에 대조합니다. none은 제조자 서명과 같은 증명을 제공한다고 해석하면 안 되고, 형식별 필수 필드가 없거나 추가 필드 타입이 틀리면 거절합니다.

가령 서명 자체는 맞지만 authenticator data의 RP ID hash가 다른 경우에는 attestation을 저장하지 않습니다. 반대로 CBOR parse와 signature verify가 모두 성공해도 trust store에 없는 인증서 체인이면 “서명 성공”과 “조직 정책 허용” 결과를 분리합니다. 결과 모델을 `parsed`, `originBound`, `rpBound`, `signatureValid`, `provenanceTrusted`, `stored`처럼 나누면 fmt 문자열만 보고 제조자와 보안 수준을 자동 신뢰하는 실수를 줄일 수 있습니다. UV 플래그는 사용자가 인증기에서 확인되었는지를 나타내는 별도 신호이고 attestation provenance가 아닙니다. 검증 라이브러리의 지원 fmt, 브라우저가 반환하는 실제 형식, metadata 정책은 선택한 버전에서 시험해야 하며 이 답변은 실행 결과를 주장하지 않습니다.

## 득점 포인트

- CBOR 파싱과 client data 검증 뒤 fmt별 attStmt 서명·키·체인 규칙을 적용합니다.
- 서명 성공·provenance 신뢰·정책 허용을 별도 결과로 저장합니다.
- packed·none 및 malformed 형식의 실패 경계를 예로 듭니다.

## 감점 포인트

- fmt 문자열만 보고 서명과 인증서 검증을 생략합니다.
- attestation 서명 성공을 제조자 신뢰나 UV 성공으로 확대합니다.

## 더 파고들 거리

- 검증 라이브러리의 지원하지 않는 fmt를 배포 전에 어떤 fixture로 찾겠습니까?
- 인증서 체인은 맞지만 trust store가 거부하는 결과를 어떻게 표시하겠습니까?
