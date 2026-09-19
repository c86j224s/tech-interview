---
id: admission-reinvocation-idempotence
title: mutating webhook이 sidecar를 추가할 때 reinvocation에도 하나만 남기려면 어떤 멱등 조건이 필요한가요?
difficulty: 중하
category: 인프라
tags:
  - admission
  - webhook
  - idempotency
related:
  - security-webhook-verification
---
# mutating webhook이 sidecar를 추가할 때 reinvocation에도 하나만 남기려면 어떤 멱등 조건이 필요한가요?

## 구두 답변
결론은 sidecar를 “배열의 마지막 요소”가 아니라 안정된 소유 키와 전체 목표 상태로 식별하고, 목표 상태이면 빈 patch를 반환하는 것입니다. admission webhook은 exactly-once 호출 경로가 아니므로 `reinvocationPolicy: IfNeeded`나 다른 mutation 뒤 재호출을 정상 입력으로 봐야 합니다. `audit-agent`라는 이름, 기대 image와 command, volume mount, 정책 label을 함께 검사합니다. 모두 맞으면 no-op이고, 이름은 같지만 image가 다르면 두 번째 sidecar를 추가하지 않고 거절하거나 소유권 이전 절차를 요구합니다.

예를 들어 첫 입력에 `containers=[app]`, label 없음이 오면 patch는 sidecar와 mount, label을 추가합니다. 다음 호출의 입력이 `containers=[app,audit-agent]`이고 B가 label만 추가했다면 A는 이미 자신이 원하는 sidecar가 있다는 사실을 확인해 같은 결과를 반환해야 합니다. 반대로 같은 이름에 `image=v1`이 있는데 정책은 `v2`라면 “없다”고 판단하면 안 됩니다. 자동 overwrite는 다른 owner의 변경을 파괴할 수 있으므로 명시적 conflict가 더 안전합니다. 관리하지 않는 app 컨테이너 순서와 필드는 보존하고, 임의 suffix나 매 호출 재정렬을 피합니다.

소유권 판정은 webhook 내부 자료구조만의 문제가 아니라 API 객체의 최종 의미를 보존하는 규칙이어야 합니다. 예를 들어 label은 맞지만 volume mount의 readOnly나 command가 다르면 “이미 있다”로 끝내지 않고 부분 상태로 분류합니다. 부분 상태를 자동 보정할지 거절할지는 owner가 다른 manager와 충돌하지 않는다는 계약이 있어야 합니다. patch 전후의 컨테이너 수, sidecar 이름 집합, 소유 label 집합을 로그로 남기면 reinvocation 때 수렴 여부를 수치로 확인할 수 있습니다.

참고: https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- sidecar 식별자를 이름 하나가 아닌 name·image·command·mount·label의 소유 계약으로 설명합니다.
- 이미 목표 상태인 재호출이 빈 patch가 되어야 하는 이유를 입력과 결과로 보여 줍니다.
- 같은 이름의 다른 image를 추가하지 않고 conflict로 처리하는 경계를 제시합니다.

## 감점 포인트
- webhook이 한 요청에 반드시 한 번만 호출된다고 가정합니다.
- 배열 끝에 무조건 append하거나 다른 webhook의 필드를 덮어씁니다.
- 이름만 보고 image·volume·label 불일치를 정상 상태로 처리합니다.

## 더 파고들 거리
- 부분적으로 sidecar가 있는 객체에서 patch를 원자적으로 구성하려면 어떻게 할까요?
- 두 webhook이 같은 annotation을 소유하려 할 때 합성 규칙을 어떻게 고정할까요?
