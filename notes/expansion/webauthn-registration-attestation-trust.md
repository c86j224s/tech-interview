---
id: webauthn-registration-attestation-trust
title: WebAuthn 등록·attestation 신뢰
topic: 보안
summary: >-
  credential 생성 시 challenge·RP·attestation 형식과 AAGUID 신뢰 정책을 로그인 assertion 검증과
  분리합니다.
questionIds: []
prerequisites:
  - passkey-binding
related:
  - passkey-binding
  - authentication
reviewedAt: '2026-09-19'
---
# WebAuthn 등록·attestation 신뢰

## 등록 ceremony와 로그인 ceremony의 분리

WebAuthn 등록은 사용자가 이미 계정에 접근할 수 있는 상태에서 새 credential 공개키를 계정에 추가하는 ceremony입니다. 로그인 assertion은 기존 credential이 그 계정의 challenge에 응답했는지 확인하지만, 등록은 새 credential의 소유권과 사이트 문맥을 확인한 뒤 저장할 계정까지 결정해야 합니다. `navigator.credentials.create()`가 브라우저에서 성공했다는 UI 결과는 서버 검증의 대체물이 아닙니다.

서버는 등록 시도에 무작위 challenge, 기대 origin, RP ID, 등록할 계정, 만료 시각, 사용자 확인 요구를 저장합니다. 응답의 `clientDataJSON`, `attestationObject`, credential ID를 받아 저장된 시도와 비교하고, 검증이 모두 끝난 뒤에만 공개키와 credential 메타데이터를 계정에 연결합니다. 요청 body의 user handle이나 표시 이름을 계정 식별자로 그대로 신뢰하면 다른 계정에 credential을 붙일 수 있습니다.

## Challenge·origin·RP ID 연결

`clientDataJSON`에는 ceremony type과 challenge, origin이 들어가고, `authenticatorData`에는 RP ID hash와 플래그가 들어갑니다. 서버는 JSON 객체를 다시 직렬화한 값이 아니라 브라우저가 전달한 원문 바이트의 해시를 검증 입력에 사용해야 합니다. 등록에서는 type이 `webauthn.create`인지, challenge가 이 등록 거래의 값인지, origin이 배포 설정의 허용 목록에 있는지 확인합니다.

RP ID는 `https://login.example.com` 같은 origin 전체와 다른 개념입니다. 일반 웹에서는 RP ID가 origin의 유효 도메인 범위와 관계를 가져야 하며, 서버는 `rpIdHash = SHA-256(rpId)`가 authenticator data의 값과 일치하는지 검사합니다. 개발용 localhost와 운영 도메인을 한 허용 목록으로 대충 합치거나, request의 Host·Origin 헤더로 기대값을 즉석에서 만들면 공격자가 검증 기준을 바꿀 수 있습니다.

## AttestationObject의 내부 구조

등록 응답의 `attestationObject`는 CBOR로 인코딩된 구조이며, authenticator data와 attestation statement을 담습니다. authenticator data에는 RP ID hash, flags, sign count, 등록 시 credential data가 포함되고, credential data에는 AAGUID, credential ID length와 credential public key가 포함됩니다. 구현은 이 구조를 직접 부분 파싱하기보다 WebAuthn 검증 라이브러리의 표준 parser와 버전 계약을 사용하고, 저장할 필드와 원문 보관 여부를 개인정보 정책과 함께 정합니다.

attestation statement은 인증기가 새 공개키를 만들었다는 사실을 더 넓은 provenance 정보와 묶을 수 있습니다. 그러나 모든 등록이 제조자 인증서를 제공하는 것은 아니며, privacy-preserving 방식이나 `none` 형식이 선택될 수도 있습니다. 따라서 “attestationObject가 존재한다”와 “신뢰 가능한 제조자 provenance가 검증됐다”를 같은 boolean으로 저장하지 않습니다.

```diagram
{"title":"등록 응답은 문맥·공개키·신뢰 정책을 순서대로 통과합니다","caption":"등록 성공은 브라우저의 create() 성공이 아니라 challenge와 RP 문맥, attestation 형식, 계정 연결 정책을 모두 통과한 뒤에 결정됩니다.","rows":[[{"id":"attempt","label":"서버 등록 시도","detail":["challenge · origin","RP ID · account"]}],[{"id":"response","label":"create() 응답","detail":["clientDataJSON","attestationObject"]}],[{"id":"parse","label":"authenticator data 파싱","detail":["rpIdHash · flags","AAGUID · public key"]},{"id":"format","label":"fmt·attStmt 검증","detail":["형식별 서명·인증서"]}],[{"id":"policy","label":"등록 신뢰 정책","detail":["AAGUID · UV 요구","계정 연결 조건"]}],[{"id":"store","label":"credential 저장","detail":["검증 후 원자 연결"]}]],"edges":[{"from":"attempt","to":"response","label":"challenge 발급"},{"from":"response","to":"parse","label":"CBOR 해석"},{"from":"response","to":"format","label":"attestation 검증"},{"from":"parse","to":"policy","label":"RP 문맥·키 입력"},{"from":"format","to":"policy","label":"provenance 입력"},{"from":"policy","to":"store","label":"허용 시 연결"}]}
```

## fmt·attStmt 검증 순서

먼저 CBOR 객체가 요구된 필드 구조를 갖는지 파싱하고, `fmt`가 구현이 지원하는 형식인지 확인합니다. 그다음 형식별 `attStmt` 필드를 사용해 서명 입력, attestation public key 또는 x5c 인증서 체인을 검증합니다. `packed`, `tpm`, `android-key`, `android-safetynet`, `fido-u2f`, `none`처럼 형식마다 필요한 필드와 신뢰 모델이 다르므로, `fmt` 문자열만 확인하고 공통 서명 코드로 처리하면 안 됩니다. 이 문서에서 특정 라이브러리의 지원 목록이나 브라우저별 동작을 최신이라고 단정하지 않습니다.

서명 검증이 성공해도 attestation이 곧 사용자 인증 강도나 피싱 저항을 보장하지는 않습니다. 등록한 공개키의 RP 문맥이 맞아야 하고, 서버가 새 credential을 정확한 계정에 연결해야 합니다. 또한 사용자 확인(UV)과 attestation은 서로 다른 신호입니다. UV는 인증기에서 사용자가 확인됐다는 플래그이고, attestation은 인증기·credential provenance를 설명하는 증명입니다. 기업 기기 정책에는 두 조건을 따로 표현해야 합니다.

## AAGUID와 신뢰 목록

AAGUID는 인증기 모델 또는 계열을 식별하는 값으로 활용할 수 있지만, 이것만으로 credential의 사용자 계정 소유권을 결정하지는 않습니다. 허용 목록을 운영하려면 AAGUID, metadata 출처, metadata 버전, 상태 변화, 폐기 사유, 새 모델 승인 절차를 별도 저장합니다. 새 모델이 추가됐다는 이유로 기존 등록 credential의 로그인 정책까지 자동 변경할지, 등록 때만 엄격히 할지를 분리합니다.

일반 서비스는 provenance 수집의 privacy·지원 비용 때문에 attestation을 선택적으로 받거나 `none`을 허용할 수 있습니다. 반면 관리형 기기만 허용하는 조직은 승인된 AAGUID와 attestation 결과를 등록 정책에 둘 수 있습니다. 다만 AAGUID metadata를 가져오지 못했다고 모든 기존 로그인 또는 모든 신규 등록을 즉시 허용하는 fail-open은 위험합니다. metadata 장애 시 신규 등록 보류, 기존 credential 허용, 제한된 관리자 승인 등 정책을 사전에 정해야 합니다.

## Discoverable credential과 계정 연결

resident/discoverable credential은 인증 시 사용자 이름을 먼저 입력하지 않고도 인증기에서 자격을 선택하는 흐름을 지원합니다. 이 특성은 사용자 경험과 복구 동선을 바꿀 수 있지만, 등록 서버가 credential ID와 user handle을 어느 계정에 연결했는지 확인해야 한다는 원칙은 사라지지 않습니다. 계정에 새 자격을 추가하는 작업에는 현재 세션의 인증 강도, 최근 재인증, 알림과 철회 경계를 적용합니다.

동기화된 패스키는 여러 장치에 나타날 수 있어 sign counter를 모든 자격에서 단조 증가한다고 가정하는 정책이 맞지 않을 수 있습니다. counter, backup eligibility, backup state와 UV 플래그는 각각 별도 신호로 저장하고, 하나의 감소나 부재만으로 사용자를 영구 차단하지 않습니다. 실제 오류 대응은 목표 브라우저와 인증기 조합에서 관찰해 결정합니다.

## 등록 정책 선택과 실패 복구

보안 정책을 “attestation 필수”라는 한 문장으로 끝내지 말고 자산 위협과 비용으로 나눕니다. 기기 provenance가 접근 허용 조건이면 허용된 형식과 신뢰 anchor를 운영해야 하고, 일반 소비자 로그인이라면 개인정보 노출과 호환성 비용이 더 클 수 있습니다. 어떤 경우든 challenge·origin·RP ID·서명 검증은 attestation 선택 여부와 무관하게 필요합니다.

검증 시험은 정상 등록, 다른 origin, 다른 RP ID, 만료·재사용 challenge, malformed CBOR, `fmt`와 attStmt 불일치, 서명 변조, 이미 사용 중인 credential ID, 다른 계정의 등록 시도를 각각 분리합니다. 예상 결과는 “서명 자체가 맞다”가 아니라 저장된 등록 시도와 서버의 신뢰 정책까지 맞아야 credential이 연결되는 것입니다. 이 노트의 설명은 WebAuthn Level 3 문서와 기존 패스키 노트를 근거로 하며 실제 브라우저·인증기 실행 결과가 아닙니다.

## 참고 자료와 확인하지 않은 범위

주요 근거는 [Web Authentication API Level 3](https://www.w3.org/TR/webauthn-3/)의 registration, authenticator data, attestation statement, RP ID 관련 설명입니다. 기존 연결 문맥은 [패스키의 사이트 바인딩과 서버 검증](/tech-interview/notes/passkey-binding/)에서 assertion 검증과 구분했습니다. WebAuthn 표준 문서가 정하는 프로토콜과 별개로 브라우저·인증기별 지원, 기업 metadata 서비스의 폐기 정책, 선택한 검증 라이브러리의 fmt 지원 범위는 배포 전에 확인해야 합니다.
