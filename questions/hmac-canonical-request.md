---
id: hmac-canonical-request
title: 서명 검증자마다 JSON key 순서가 달라지면 HMAC을 어떻게 안정화하나요?
difficulty: 하
category: 보안
tags:
  - HMAC
  - canonicalization
  - 서명
related:
  - security-webhook-verification
---
# 서명 검증자마다 JSON key 순서가 달라지면 HMAC을 어떻게 안정화하나요?

## 구두 답변

JSON 객체의 의미가 같다는 이유로 HMAC이 같아지지는 않으므로, 먼저 서명 입력 바이트를 하나의 계약으로 고정하겠습니다. 공급자가 raw body를 서명한다면 middleware가 받은 바이트를 그대로 보존해 `HMAC(K, rawBody)`를 계산하고, 파싱한 객체를 재직렬화하지 않습니다. 송신자와 수신자가 각자 JSON을 만들 수밖에 없다면 키 정렬, 공백, 숫자와 문자열 escape, 유니코드, 중복 키 처리까지 정한 canonicalization을 구현하고 테스트 벡터를 공유해야 합니다.

예를 들어 `{"amount":100,"currency":"KRW"}`와 `{ "currency": "KRW", "amount": 100 }`은 애플리케이션 객체로는 같아 보여도 바이트가 다릅니다. canonical form을 `{"amount":100,"currency":"KRW"}`로 합의했다면 양쪽이 그 결과만 서명합니다. HTTP 메시지라면 body 외에 메서드·대상 URI·content-digest·event ID 중 어떤 요소를 포함할지도 signature base 계약에 넣습니다. RFC 9421처럼 covered component를 지정하는 방식과, 공급자가 정한 webhook 문자열 결합 방식은 혼용하지 않습니다.

검증 순서는 크기 제한과 원문 보존, 서명 형식 확인, canonical bytes 구성, HMAC 계산과 고정 길이 비교, 그 뒤 JSON 의미·시각·event ID 검사입니다. 공백만 바꾼 요청이 같은 서명으로 통과하면 raw body 계약이 지켜지지 않은 것이고, 키 순서만 바꾼 요청을 허용하려면 양쪽이 정말 canonical form을 적용했는지 확인해야 합니다. 검증을 위해 파싱한 객체를 로그에 남길 때도 비밀과 개인정보를 분리하겠습니다.


추가로 입력 경계를 숫자로 확인하겠습니다. raw body가 31바이트인 A와 34바이트인 B를 각각 digest하면 애플리케이션 객체가 같아도 서로 다른 서명 입력입니다. canonical 계약에서는 키 순서를 바꾼 두 입력이 동일한 UTF-8 바이트로 수렴해야 하지만 `1`, `1.0`, `1e0`을 같은 수로 볼지부터 정해야 합니다. 중복 키는 첫 값과 마지막 값의 선택이 parser마다 다르므로 거부합니다. 검증자는 canonicalization 뒤의 바이트를 로그에 남기지 않고 길이와 비밀 없는 digest만 기록합니다. 이렇게 해야 serializer를 교체하거나 프록시가 URI를 정규화할 때 어느 단계에서 signature base가 달라졌는지 찾을 수 있습니다. 서명된 timestamp와 event ID를 함께 넣어도 그것은 재생 정책이지 JSON canonicalization의 결과가 아니며, 원문 MAC이 성공한 뒤 별도 저장소의 중복 조건을 통과해야 업무 효과를 허용합니다.

## 득점 포인트

- raw body와 재직렬화된 JSON을 서명 입력으로 구분한다.
- canonicalization의 숫자·escape·중복 키 규칙을 테스트 벡터로 고정한다.
- 서명된 구성요소와 서명되지 않은 헤더를 구분한다.

## 감점 포인트

- JSON 의미가 같으면 원문 바이트도 같다고 단정한다.
- 키 정렬만 하고 숫자·유니코드·중복 키 규칙을 정하지 않는다.
- canonicalization이 재생·인가까지 해결한다고 말한다.

## 더 파고들 거리

- 프록시가 URI나 헤더를 바꿀 때 signature base를 어느 경계에서 재구성할까요?
- raw body 보존 middleware를 어떤 변조·크기 테스트로 검증할까요?
