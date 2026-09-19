---
id: aead-tag-failure
title: AEAD 태그 검증이 실패했을 때 평문을 일부라도 사용해도 되나요?
difficulty: 하
category: 보안
tags:
  - AEAD
  - 무결성
  - 복호화
related:
  - security-deserialization
---
# AEAD 태그 검증이 실패했을 때 평문을 일부라도 사용해도 되나요?

## 구두 답변

사용하면 안 됩니다. AEAD open의 성공 결과만 authenticated plaintext이고 태그 실패는 ciphertext·nonce·AAD를 신뢰할 수 없다는 뜻입니다. RFC 5116은 복호화를 plaintext 또는 `FAIL`로 정의하고 길이 오류에서도 부분 데이터를 반환하지 말라고 합니다. 예외를 무시하고 buffer 앞부분을 parser나 명령 처리기에 넘기면 변조 입력을 내부 상태로 승격시킵니다.

저장 blob의 한 바이트가 바뀌어 open이 실패하면 상태 변경 없이 인증 실패로 끝내고, plaintext를 로그나 fallback 파일에 남기지 않습니다. 외부 응답은 상세한 key·AAD·tag 차이를 숨기고 내부에는 object ID, key version, 실패 분류, trace ID 정도만 남깁니다. schema parsing과 자원 인가는 open 성공 뒤에만 실행합니다.

라이브러리 내부 임시 buffer가 있는 것과 애플리케이션이 사용 가능한 것은 다릅니다. wrapper가 `Result<Plaintext, AuthError>`처럼 성공과 실패를 분리하고 실패 경로에서 객체 생성·cache write·외부 호출을 하지 않게 합니다. 부분 복구가 필요하면 chunk별 인증 같은 별도 포맷을 설계해야 합니다.

이 원칙은 오류 처리 순서뿐 아니라 메모리 소유권에도 적용됩니다. 복호화 wrapper가 실패한 buffer를 호출자에게 반환하지 않고, 상위 계층은 성공한 immutable 값만 받도록 API를 좁히는 편이 안전합니다. 재시도할 때도 같은 변조 ciphertext를 무한히 제출하지 않도록 횟수와 입력 크기를 제한하며, 실패를 복구 명령으로 해석하지 않습니다. 데이터 손상과 공격을 구분하기 위해 저장 시점의 checksum을 추가할 수는 있지만 checksum이 AEAD tag를 대신하지는 않습니다.

상태 추적은 `received → decoded → open pending → open success/fail → parsed → side effect`처럼 분리합니다. ciphertext를 받았다는 사실만으로 `decoded` 상태에 둘 수 있지만, `open fail`이면 `parsed`나 `cache write`로 전이하지 않고 실패 레코드에는 원문 대신 object ID와 원인 분류만 남깁니다. 스트리밍 저장이 필요하다면 전체 메시지 태그 하나로 앞부분을 먼저 쓰는 구현을 partial recovery라고 부르면 안 됩니다. chunk마다 독립 태그와 순서·전체 길이 인증을 갖춘 별도 포맷이어야 하며, 그렇지 않으면 끝에서 태그가 실패했을 때 이미 실행된 부수 효과를 되돌릴 수 없습니다.

## 득점 포인트

- FAIL을 인증된 평문과 분리하고 실패 경로에 부수 효과가 없게 한다.
- schema parsing·인가·명령 실행을 open 성공 뒤로 둔다.
- 부분 데이터가 필요하면 chunk 인증을 별도 계약으로 둔다.

## 감점 포인트

- 복호화 함수가 buffer를 반환했다는 이유로 태그 실패 전 내용을 사용한다.
- 예외를 무시하고 평문 fallback을 실행한다.

## 더 파고들 거리

- 실패 로그에 어떤 식별자를 남겨 원문·key를 숨기면서 추적할 것인가?
- AEAD chunking에서 순서와 전체 길이는 어디에 인증할 것인가?
