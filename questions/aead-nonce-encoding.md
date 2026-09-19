---
id: aead-nonce-encoding
title: nonce와 AAD를 JSON으로 저장할 때 어떤 바이트 계약을 고정해야 하나요?
difficulty: 중하
category: 보안
tags:
  - AEAD
  - 직렬화
  - canonicalization
related:
  - serialization-json-numbers
---
# nonce와 AAD를 JSON으로 저장할 때 어떤 바이트 계약을 고정해야 하나요?

## 구두 답변

고정할 것은 JSON의 의미가 아니라 암호화와 복호화가 만드는 정확한 bytes입니다. 필드명, UTF-8 인코딩, nonce·ciphertext의 binary 표현(base64url인지 hex인지), 길이·tag 경계, 숫자 타입과 표현, AAD 필드 순서와 schema version을 명시합니다. 암호화 시 `tenant=t1,purpose=invoice`를 특정 순서로 만들었다면 복호화도 같은 canonical serializer를 써야 합니다.

한 구현이 `{"tenant":"t1","purpose":"invoice"}`를 AAD로 만들고 다른 구현이 key 순서를 바꾸면 객체는 같아 보여도 tag가 실패합니다. 숫자 `1`, `1.0`, 큰 정수의 문자열화도 같습니다. canonical JSON이나 길이 prefix가 붙은 고정 binary encoding을 선택하고 test vector로 언어·라이브러리 교체 때 bytes를 비교합니다.

저장 레코드에는 algorithm/version, key ID, nonce, ciphertext+tag, AAD 재구성 메타데이터를 둡니다. nonce가 AEAD에 의해 내부 인증된다고 해서 포맷의 transport 표현을 생략할 수 있는 것은 아닙니다. RFC 5116은 encoding을 정하지 않으므로 canonicalization은 애플리케이션 계약입니다. open 실패 시 JSON 의미를 근거로 fallback하지 않습니다.

바이트 계약은 여러 언어가 참여할 때 특히 중요합니다. JavaScript의 숫자와 다른 언어의 정수 타입이 다르면 큰 정수나 `1.0`이 서로 다른 표현으로 변할 수 있고, base64와 base64url은 패딩 규칙도 다를 수 있습니다. 그래서 포맷 버전과 알고리즘 식별자를 먼저 읽고, 허용된 길이와 문자 집합을 확인한 뒤 bytes를 복원합니다. 구 버전 serializer를 계속 읽어야 한다면 버전별 test vector를 유지하고, 새 레코드는 새 규칙으로만 쓰는 이행 기간을 둡니다.

## 득점 포인트

- 입력이 바이트라는 점과 canonical serialization 필요성을 연결한다.
- binary 표현·길이·문자 인코딩·숫자·필드 순서를 명시한다.
- test vector로 구현 간 AAD bytes와 실패를 검증한다.

## 감점 포인트

- JSON 의미가 같으면 tag가 같다고 단정한다.
- nonce·ciphertext 인코딩과 길이 경계를 정하지 않는다.

## 더 파고들 거리

- canonical JSON과 binary encoding의 디버깅·호환성 비용을 비교하라.
- 구 포맷 read와 새 AAD 계약 write를 함께 운영하는 순서는 무엇인가?
