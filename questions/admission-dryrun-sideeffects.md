---
id: admission-dryrun-sideeffects
title: dry-run 요청에서 외부 티켓을 만들면 왜 잘못이며 sideEffects를 어떻게 검증하나요?
difficulty: 중하
category: 인프라
tags:
  - admission
  - webhook
  - idempotency
related:
  - security-webhook-verification
---
# dry-run 요청에서 외부 티켓을 만들면 왜 잘못이며 sideEffects를 어떻게 검증하나요?

## 구두 답변
dry-run은 실제 객체 저장과 변경을 하지 않고 결과를 미리 보는 요청이므로, admission webhook이 외부 티켓을 생성하면 요청의 비변경 의미와 외부 상태가 어긋납니다. 티켓 POST, 메일, 클라우드 리소스 생성은 dry-run에서 실행하면 안 됩니다. `sideEffects: None`은 호출 자체에 부수 효과가 없다는 선언이고 `NoneOnDryRun`은 dry-run에서는 효과를 내지 않는다는 선언입니다. 둘 다 코드 속 외부 POST를 자동으로 차단하지 않으므로 선언과 구현을 함께 검증해야 합니다.

안전한 흐름은 admission을 결정적 object validation·mutation으로 제한하고, 실제 외부 효과는 저장 후 controller가 수행하게 하는 것입니다. dry-run create에서는 sidecar patch를 계산할 수 있지만 외부 호출 카운터는 0이어야 합니다. 실제 create가 저장된 뒤 controller가 idempotency key `pod-uid/ticket-type`로 티켓을 만들고, controller가 직후 죽어 재시작해도 같은 key로 한 건에 수렴해야 합니다. “admission 성공”은 API object가 다음 단계로 갔다는 뜻이지 티켓 commit까지 완료했다는 transaction이 아닙니다. 외부 읽기가 꼭 필요하다면 dry-run에서는 읽기 전용으로 제한하고 stale·timeout을 API deadline에 포함합니다.

검증은 요청 한 번의 카운터뿐 아니라 dry-run 뒤 실제 create를 했을 때도 비교해야 합니다. 두 요청이 같은 object 입력에 대해 같은 patch와 validation 결과를 내고, 외부 mock에는 dry-run 0회, 실제 저장 후 controller 1개의 멱등 작업만 보여야 합니다. 외부 호출을 admission 응답 전에 수행하는 코드는 응답 실패와 효과 성공이 분리되는 보상 불가능한 상태를 만들므로 구조적으로 제거합니다.

참고: https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- sideEffects 선언과 실제 코드의 외부 효과를 별개의 검증 대상으로 둡니다.
- dry-run 0회, 실제 저장 후 controller 1건이라는 호출 수 trace를 설명합니다.
- admission과 저장 후 controller의 transaction 경계를 분명히 합니다.

## 감점 포인트
- dry-run은 webhook이 호출되지 않는다고 합니다.
- `None` 선언만 하면 외부 POST가 안전해진다고 주장합니다.
- admission 응답을 외부 티켓 commit의 성공으로 설명합니다.

## 더 파고들 거리
- controller가 티켓 생성 전에 죽었을 때 idempotency key로 어떻게 복구할까요?
- 외부 읽기 결과가 mutation을 바꾸지 않게 어떤 입력 snapshot을 고정할까요?
