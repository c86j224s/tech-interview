---
id: kubernetes-admission-idempotency
title: Kubernetes admission webhook의 실패와 멱등성
topic: 인프라
summary: >-
  mutating·validating admission의 동기 호출 경로에서
  timeout·failurePolicy·reinvocation·sideEffects와 멱등 mutation의 경계를 설명합니다.
questionIds: []
prerequisites:
  - reconciliation
  - webhook-intake
related: []
reviewedAt: '2026-09-19'
---
# Kubernetes admission webhook의 실패와 멱등성

Kubernetes admission webhook은 API 서버가 객체를 저장하기 전 동기 경로에서 호출하는 확장 지점이다. 그러므로 일반적인 이벤트 소비자처럼 “나중에 한 번 처리한다”고 생각하면 안 된다. 호출 지연은 API 요청 지연이 되고, `Fail` 정책의 호출 장애는 저장 거절이 되며, mutating 응답은 뒤 webhook의 입력을 바꾼다. 이 장의 기준은 호출 횟수 자체가 아니라 같은 입력 상태가 반복 호출되어도 같은 객체로 수렴하는지, 실패 시 어떤 정책 누락을 허용하는지, dry-run이 외부 효과를 만들지 않는지를 분리해 확인하는 것이다.

## 처리 경로

대략적인 경계는 인증·인가, mutating admission, validating admission, 저장이다. mutating webhook은 patch로 객체를 바꿀 수 있고 validating webhook은 최종 객체의 허용 여부를 판단한다. 내장 플러그인과 여러 webhook의 세부 순서는 대상 apiserver 버전과 configuration에 따라 확인해야 하지만, validating이 먼저 실행되어 mutating 결과를 못 본다고 가정하는 것은 안전하지 않다. 공식 문서가 설명하는 기본 원칙은 mutating webhook이 validating webhook보다 먼저 평가된다는 점이다.

응답 `allowed:false`는 정상적인 AdmissionReview 거절이다. 이것은 호출 실패가 아니므로 `failurePolicy: Ignore`가 그 거절을 무시하게 만들지 않는다. 반대로 연결 실패, timeout, TLS 검증 실패, 잘못된 응답 형식 같은 invocation failure에는 failurePolicy가 적용된다. 이 둘을 한 “실패 응답”으로 합치면 장애 때의 정책을 잘못 계산한다.

## 장애정책

`timeoutSeconds`는 API 서버가 webhook 응답을 기다리는 한도이며, 읽은 공식 문서 기준 범위는 1~30초, 기본값은 10초다. `Fail`은 호출 장애 때 요청을 실패시키는 fail-closed이고, `Ignore`는 해당 webhook의 실패를 무시하고 다음 단계로 진행할 수 있는 fail-open이다. Ignore는 즉시 통과가 아니다. 2초 timeout을 기다린 뒤 무시할 수 있으므로 API 서버의 연결·직렬화·동시 대기 비용은 남는다.

보안 validating webhook이 privileged Pod를 차단해야 한다면 Ignore는 장애 시간 동안 정책 공백을 만든다. 반대로 단순 label 보정 webhook을 Fail로 두면 인증서 교체 중 일반 create까지 막힐 수 있다. 매칭 scope를 namespace와 operation으로 좁히고, 보호해야 할 policy는 Fail, 사후 controller로 보정 가능한 mutation은 제한된 Ignore를 검토한다. 이 선택은 “가용성 대 보안” 한 문장보다 장애 시 허용할 객체 종류, break-glass 승인, 사후 탐지 경로를 문서화해야 재현된다.

## 멱등 mutation

멱등 mutation은 현재 객체를 목표 상태 함수에 넣고 부족한 필드만 추가한다. sidecar 예에서 컨테이너 배열의 마지막에 무조건 append하면 재호출 때 두 개가 된다. 대신 소유 식별자 `audit-agent`, 기대 image·command·volume mount·label을 함께 검사한다. 모두 맞으면 빈 patch를 반환하고, 같은 이름에 다른 image가 있으면 추가로 두지 말고 정책 위반 또는 명시적 이전 절차로 보낸다. 관리하지 않는 컨테이너 순서와 필드는 보존해야 한다.

`reinvocationPolicy: IfNeeded`는 다른 mutation 때문에 다시 볼 필요가 있을 때 재호출될 수 있음을 뜻한다. “한 평가에서 단 한 번”을 전제하지 말아야 하며, 목표 상태가 이미 있으면 no-op이어야 한다. A가 sidecar를 넣고 B가 label을 넣는 구성에서 A가 label 부재를 이유로 매번 새 sidecar를 만들면 reinvocation이 비결정적이다. 필드 소유권과 충돌 규칙을 정하고, 순서가 바뀌어도 합성 결과가 같은지 검사한다.

## 합성 규칙

서로 다른 annotation key, sidecar name처럼 필드 영역을 분리하면 `B(A(x))`가 안정적이다. 반대로 A와 B가 같은 annotation 값을 overwrite하면 설치 순서가 숨은 policy가 된다. 한 owner만 쓰게 하거나, 값이 다를 때 명시적으로 거절해야 한다. 두 webhook이 서로의 결과를 읽는다면 결과가 새 필드를 계속 만들어내지 않는 고정점이 있어야 한다.

호출 비용도 합성 규칙의 일부다. 설명용으로 timeout 2초인 webhook 두 개가 직렬로 모두 만료되면 최소 대기 경로를 2+2=4초로 계산할 수 있다. 실제 latency는 병렬성, API deadline, DNS/TLS, reinvocation에 따라 달라져 이 계산을 보장값으로 쓰면 안 된다. 정상 p99와 장애시 동시 대기를 계측하여 timeout 총예산이 API 요청 deadline보다 작도록 한다.

## dry-run 경계

`dryRun` 요청은 객체 저장과 실제 변경을 하지 않는 미리보기다. 외부 티켓 POST, 메일 전송, 클라우드 리소스 생성은 dry-run의 의미를 깨므로 admission에서 수행하면 안 된다. `sideEffects: None` 또는 `NoneOnDryRun`은 API 서버가 webhook을 dry-run에 호출할 수 있는지 선언하는 계약이지, 코드 속 POST를 자동으로 막는 방화벽이 아니다. 선언과 실제 구현을 함께 검증해야 한다.

권장 구조는 admission을 결정적인 object validation·mutation으로 제한하고, 실제 외부 효과는 저장된 객체를 관찰하는 controller가 멱등 키로 수행하는 것이다. dry-run fixture에서 patch는 계산하되 외부 호출 카운터는 0이어야 한다. 실제 create 후 controller가 티켓을 한 번 만들고 죽었다면, 저장된 외부 ID나 idempotency key로 재시작 재처리 결과가 한 건에 수렴하는지 확인한다.

## 검증 절차

입력 fixture를 sidecar 없음, 이미 정상, 부분적으로만 존재, 같은 이름의 다른 image, 다른 webhook이 먼저 label을 붙인 상태로 나눈다. 각 fixture를 같은 webhook에 두 번 넣어 최종 JSON과 patch를 비교하고, dry-run flag를 넣어 외부 mock 호출이 0인지 기록한다. A→B와 B→A를 비교하고, 의도된 field conflict는 오류로 드러나는지 본다. invocation failure와 `allowed:false`를 각각 발생시켜 Ignore가 후자까지 통과시키지 않는지 확인한다.

운영에서는 webhook configuration의 매칭 범위, `timeoutSeconds`, failure count, latency p99, TLS 오류, reinvocation 횟수, mutation patch 크기를 함께 수집한다. 클러스터를 실행하지 않은 이 제안의 숫자는 설명용 계산이며 실제 apiserver 성능이나 외부 효과 성공을 측정한 결과가 아니다.

## 비용과 한계

Fail은 정책 보존을 위해 API 가용성을 희생하고, Ignore는 API 가용성을 위해 정책 공백을 희생한다. 멱등 patch는 중복 object 상태를 줄이지만 외부 transaction을 제공하지 않는다. controller로 효과를 옮기면 동기 경로는 짧아지는 대신 저장 후 지연, 재시도, 대사 책임이 생긴다. 또한 target Kubernetes 릴리스와 webhook configuration schema를 고정하지 않았으므로 세부 동작은 통합 전에 확인해야 한다.

## 참고자료

- https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/ — 2026-09-19에 읽을 수 있는 공식 문서 본문으로 mutating/validating 순서, `timeoutSeconds` 1~30초·기본 10초, invocation failure와 `allowed:false`, `sideEffects`, `reinvocationPolicy`를 대조했다.
- https://kubernetes.io/docs/reference/using-api/api-concepts/ — admission 자체의 근거가 아니라 API 응답·관찰 계약과 구분하기 위해 함께 확인했다.

```diagram
{"title":"Admission 경계","caption":"호출 장애와 정상 거절을 분리하고, mutation은 고정점으로 수렴시킨다.","rows":[[{"id":"request","label":"API 요청","detail":["인증·인가 이후"]}],[{"id":"mutate","label":"Mutating","detail":["결정적 patch"]}],[{"id":"validate","label":"Validating","detail":["allowed 판정"]}],[{"id":"store","label":"저장","detail":["dry-run은 제외"]}]],"edges":[{"from":"request","to":"mutate","label":"동기 호출"},{"from":"mutate","to":"validate","label":"최종 객체"},{"from":"validate","to":"store","label":"정상 허용"}]}
```
