---
id: admission-failure-policy-timeout
title: >-
  admission webhook timeout에서 failurePolicy Ignore와 Fail은 어떤 정책 공백·가용성 비용을 각각
  만드나요?
difficulty: 중하
category: 인프라
tags:
  - admission
  - webhook
  - idempotency
related:
  - security-webhook-verification
---
# admission webhook timeout에서 failurePolicy Ignore와 Fail은 어떤 정책 공백·가용성 비용을 각각 만드나요?

## 구두 답변
`Fail`과 `Ignore`는 호출 장애에 대한 정책 선택이지 정상적인 정책 거절을 뒤집는 스위치가 아닙니다. 연결 실패, timeout, TLS 오류, non-2xx 또는 malformed response 같은 invocation failure에서 `Fail`은 요청을 거절하고 `Ignore`는 해당 webhook 결과를 건너뛰고 계속 진행할 수 있습니다. 그러나 webhook이 유효한 AdmissionReview로 `allowed:false`를 반환하면 그것은 정상 거절이므로 `Ignore`가 허용으로 바꾸지 않습니다. 읽은 Kubernetes 공식 문서 기준 `timeoutSeconds` 범위는 1~30초, 기본값은 10초입니다.

예를 들어 보안 webhook이 privileged Pod를 차단하는데 10초 timeout 뒤 Ignore를 쓰면 그 10초 동안 API 요청은 기다린 뒤 검사를 빠뜨린 객체가 저장될 수 있습니다. Fail이면 같은 장애에서 API 쓰기가 거절되지만 정책 공백은 줄어듭니다. 반대로 단순 label mutation을 Fail로 묶으면 인증서 교체 때 무관한 create까지 막힐 수 있습니다. 직렬로 2초 timeout webhook 두 개가 모두 만료되는 설명용 경로는 2+2=4초지만, 실제 시간은 병렬성·deadline·재호출·동시 요청으로 측정해야 합니다. Ignore를 선택하려면 매칭 범위를 좁히고 audit와 사후 controller 보정 경로를 준비합니다.

정상 거절과 장애 거절을 관찰 지표에서도 나눠야 합니다. `allowed:false`는 정책 위반 카운터로, timeout·TLS·malformed response는 webhook availability 카운터로 기록해야 Ignore가 정책 공백을 만들었는지 판단할 수 있습니다. 또한 대상 webhook이 실제로 매칭되는 resource와 namespace를 먼저 좁혀야 하며, 전역 wildcard에 Fail을 두면 장애 반경이 불필요하게 커집니다.

참고: https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- invocation failure와 `allowed:false`를 분리해 failurePolicy가 적용되는 범위를 정확히 말합니다.
- 1~30초·기본 10초와 timeout 대기 비용을 정책 공백과 연결합니다.
- 보안 검증과 편의 mutation을 같은 기본값으로 처리하지 않는 선택 기준을 제시합니다.

## 감점 포인트
- Ignore면 timeout 자체가 없어져 즉시 통과한다고 합니다.
- 정상적인 allowed:false까지 failurePolicy가 무시한다고 설명합니다.
- Fail이 외부 webhook의 효과를 rollback한다고 주장합니다.

## 더 파고들 거리
- webhook 정상 p99와 apiserver deadline으로 timeout을 어떻게 예산화할까요?
- Ignore 동안 저장된 객체를 사후 탐지할 때 controller 책임을 어디까지 둘까요?
