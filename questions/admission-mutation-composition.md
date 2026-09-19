---
id: admission-mutation-composition
title: 여러 mutating webhook의 순서와 reinvocation이 결과를 흔들지 않게 하려면 무엇을 고정해야 하나요?
difficulty: 중하
category: 인프라
tags:
  - admission
  - webhook
  - idempotency
related:
  - security-webhook-verification
---
# 여러 mutating webhook의 순서와 reinvocation이 결과를 흔들지 않게 하려면 무엇을 고정해야 하나요?

## 구두 답변
먼저 각 webhook의 field ownership과 합성 함수를 고정해야 합니다. 서로 다른 sidecar name이나 annotation key를 소유하면 A의 결과를 B가 읽어도 관리 영역이 겹치지 않습니다. 반대로 같은 annotation 값을 A와 B가 overwrite하면 설치 순서가 숨은 정책이 되므로 한 owner를 정하거나 값이 다를 때 conflict를 반환해야 합니다. `IfNeeded` 재호출에서는 이미 목표 상태인 webhook이 no-op이어야 하며, 이전 webhook이 만든 필드를 이유 없이 다시 바꾸면 결과가 고정되지 않습니다.

예를 들어 A가 namespace 기본값 `runAsNonRoot=true`를 넣고 B가 허용 목록을 검증한다고 하겠습니다. B는 A의 출력을 검증하되 같은 field에 다른 기본값을 쓰지 않아야 합니다. A→B와 B→A를 fixture로 비교하고 최종 JSON, 각 patch, 호출 횟수를 기록합니다. 순서가 본질적인 의존성이라면 “우연한 설치 순서”가 아니라 configuration과 테스트에 명시합니다. timeout budget도 호출 수와 재호출 가능성을 포함해야 합니다. timeout 2초 webhook 네 개를 단순히 8초라고 보장할 수는 없지만, 직렬 최악 경로와 API 요청 deadline 사이 여유를 실제 latency로 검증해야 합니다.

합성 검증에는 삭제와 충돌도 넣어야 합니다. A가 넣은 기본값을 B가 삭제하고 A가 reinvocation에서 다시 넣는다면 두 함수가 고정점에 도달하지 못합니다. 각 webhook이 허용하는 입력·출력 invariant를 표로 만들고, 두 순서의 반복 결과가 동일하지 않으면 순서 의존성을 명시적 단일 owner나 admission 거절로 바꿉니다.

이때 “순서를 고정한다”는 말은 서버가 우연히 A를 먼저 호출한다는 뜻이 아니라, 각 webhook의 match 범위와 ownership을 겹치지 않게 설계하고 최종 object invariant를 테스트한다는 뜻입니다. 예를 들어 A가 기본값을 추가한 뒤 B가 허용 목록 밖이면 거절하도록 하면, A의 patch가 B의 판단 입력이 되는 관계는 명시적입니다. B가 다시 A의 기본값을 삭제하는 식의 양방향 mutation은 충돌로 취급해야 합니다.

참고: https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- field ownership과 conflict 정책을 호출 순서보다 먼저 설계합니다.
- A→B와 B→A의 최종 object·patch 비교로 비결정성을 드러냅니다.
- timeout과 reinvocation을 합친 요청 예산을 측정 대상으로 둡니다.

## 감점 포인트
- webhook 설치 순서가 항상 안전한 최종 결과를 보장한다고 합니다.
- 같은 필드를 강제로 overwrite하는 것을 합성 해결책으로 제시합니다.
- 각 timeout만 더해 실제 API latency라고 단정합니다.

## 더 파고들 거리
- 같은 field owner를 이전할 때 기존 객체와 rollout을 어떻게 처리할까요?
- 외부 상태를 읽는 mutation의 dry-run 재현성을 어떻게 보장할까요?
