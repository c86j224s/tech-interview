---
id: webauthn-registration-challenge
title: WebAuthn credential 등록에서 challenge와 RP ID를 어떻게 연결하나요?
difficulty: 중하
category: 보안
tags:
  - WebAuthn
  - 등록
  - RP ID
related:
  - security-passkeys-origin
---
# WebAuthn credential 등록에서 challenge와 RP ID를 어떻게 연결하나요?

## 구두 답변

등록 시작 endpoint는 현재 로그인한 계정, 일회성 challenge, 허용 origin, RP ID, 만료 시각을 서버의 registration transaction에 저장하고 `publicKey` 옵션을 반환합니다. 브라우저가 `navigator.credentials.create()`에 성공해도 서버가 믿는 값은 응답의 원문 `clientDataJSON`과 `attestationObject`입니다. 먼저 client data의 type이 `webauthn.create`인지, challenge를 base64url decode했을 때 저장한 값과 같은지, origin이 배포 설정의 허용 목록에 있는지 확인합니다. 이어 authenticator data의 앞 32바이트 RP ID hash가 서버가 선택한 RP ID의 SHA-256과 같은지, 등록 플래그와 credential data가 파싱되는지 검사합니다. RP ID는 `https://login.example.com`이라는 origin 문자열 전체가 아니라 허용된 도메인 문맥이므로 request의 Host나 Origin을 기대값으로 즉석 생성하지 않습니다.

예를 들어 공격자가 evil.example에서 얻은 create 응답을 우리 endpoint에 보내면 challenge가 우리 transaction 값과 다르거나 origin과 RP ID hash 중 하나가 맞지 않아 저장 전에 거절됩니다. 모든 검증이 끝난 뒤에만 credential ID·공개키·AAGUID를 현재 세션의 계정에 원자적으로 연결하고, challenge는 성공 시 소비해 재전송을 막습니다. 요청 body의 user ID를 계정 선택에 쓰지 않고 현재 재인증된 세션과 연결하는 것도 같은 경계입니다. 등록과 assertion 로그인은 모두 challenge를 쓰지만 create 응답은 attestation과 새 공개키를 포함하므로 같은 parser로 처리하지 않습니다. 테스트는 만료·재사용 challenge, 다른 origin, 다른 RP ID, 중복 credential ID와 malformed CBOR를 각각 실패시키고, 실제 브라우저·인증기 실행 여부는 별도 환경 검증으로 남깁니다.

## 득점 포인트

- registration transaction에 challenge·origin·RP ID·계정을 저장하고 원문 client data와 대조합니다.
- RP ID hash와 account binding을 credential 저장 전에 검증합니다.
- challenge 일회성 소비와 다른 origin·재전송 테스트를 구체화합니다.

## 감점 포인트

- 브라우저 success나 credential ID 신규성만 확인합니다.
- request Host·Origin을 기대 검증값으로 즉석 신뢰합니다.

## 더 파고들 거리

- 등록과 assertion의 응답 구조 차이를 parser 경계로 어떻게 두겠습니까?
- 동기화 credential에서 counter와 계정 연결을 어떻게 취급하겠습니까?
