---
id: hmac-key-purpose-separation
title: 같은 HMAC 비밀을 webhook과 session 서명에 재사용하면 왜 안 되나요?
difficulty: 하
category: 보안
tags:
  - HMAC
  - 키 분리
  - 키 용도
related:
  - secret-key-rotation
---
# 같은 HMAC 비밀을 webhook과 session 서명에 재사용하면 왜 안 되나요?

## 구두 답변

같은 HMAC 비밀을 webhook과 session 서명에 재사용하지 않겠습니다. 두 경계의 메시지 형식과 검증 코드가 달라지면 한 프로토콜의 태그가 다른 프로토콜에서 해석될 가능성이 생기고, 어느 한 검증자나 로그·설정이 침해됐을 때 두 자격 체계를 동시에 회수해야 하기 때문입니다. 문제는 HMAC 알고리즘 이름이 같다는 데 있지 않고, 동일한 비밀이 서로 다른 의미의 발급 권한을 묶는 데 있습니다.

저장소에서 `hmac/webhook/v1`과 `hmac/session/v1`을 별도 secret과 접근 권한으로 관리하겠습니다. 공통 root에서 파생한다면 `KDF(root, "webhook-v1")`와 `KDF(root, "session-v1")`처럼 context, 길이, 인코딩을 고정하고 한 파생키가 다른 용도로 검증되지 않게 합니다. payload 앞에 `webhook-v1` 문자열만 붙이는 domain separation은 메시지 구분에는 도움을 줄 수 있지만, 두 검증자가 같은 root 비밀을 읽는 접근·회수 범위까지 분리하지는 않습니다.

구체적으로 webhook 검증 서비스가 노출되어 키를 교체해야 할 때 session 서명까지 즉시 무효화할 필요가 없어야 합니다. webhook 키만 새 버전으로 중첩 교체하고, session 키의 검증자·발급자와 만료 정책은 독립적으로 유지할 수 있어야 합니다. `kid`는 공개 식별자일 뿐 비밀이 아니므로 그 값으로 키를 자동 다운로드하거나 기본키를 추측하지 않습니다. 키 분리가 저장 권한, 감사, 회수와 함께 설계되지 않았다면 이름만 나눈 셈입니다.


상태를 놓고 보면 차이가 분명합니다. webhook 검증기가 침해되어 `K_webhook`이 유출된 경우 공격자는 외부 이벤트 MAC을 만들 수 있지만 `K_session`을 읽지 못해야 합니다. 두 키를 같은 secret으로 두었다면 동일한 사건이 session 위조·전역 로그아웃·대규모 회수로 커집니다. 독립 secret은 저장 항목·IAM·감사·폐기 버전이 각각 생기고 관리 비용이 늘지만 blast radius가 줄어듭니다. 공통 root를 쓴다면 파생 함수, context 문자열, 출력 길이와 입력 인코딩을 고정하고 root 자체를 애플리케이션에 노출하지 않습니다. 다만 payload 앞에 `webhook-v1`을 붙이는 것만으로는 검증 서비스가 같은 root를 읽는 권한 문제가 해결되지 않습니다. 실제 선택은 독립 키를 기본으로 하고, KDF를 택할 때는 root 접근 주체와 폐기 절차까지 확인하는 것입니다.

## 득점 포인트

- 용도별 키의 저장·접근·회수 범위를 분리한다.
- KDF context와 메시지 domain을 구분하고 알고리즘 이름만 바꾸는 해결책을 배제한다.
- webhook 키 침해 시 session 자격까지 영향받는지 blast radius를 설명한다.

## 감점 포인트

- 키 ID를 비밀처럼 숨기면 key separation이 된다고 한다.
- payload prefix 하나만 붙이면 별도 secret과 권한이 필요 없다고 한다.

## 더 파고들 거리

- 파생 root를 하나의 서비스 계정이 모두 읽는다면 실제 분리가 유지될까요?
- 정상 교체와 유출 시 즉시 폐기의 순서를 용도별로 어떻게 다르게 둘까요?
