---
id: endpointslice-publish-not-ready
title: >-
  publishNotReadyAddresses를 켠 Service의 EndpointSlice ready 값을 일반 readiness 결과처럼
  해석해도 되나요?
difficulty: 중하
category: 인프라
tags:
  - EndpointSlice
  - ready
  - serving
  - terminating
related:
  - headless-clusterip-selection-boundary
---
# publishNotReadyAddresses를 켠 Service의 EndpointSlice ready 값을 일반 readiness 결과처럼 해석해도 되나요?

## 구두 답변

그대로 읽으면 안 됩니다. `publishNotReadyAddresses=true`인 Service에서는 EndpointSlice의 `ready`가 일반 readiness probe의 “사용자 요청을 안전하게 처리할 준비”를 그대로 나타내지 않고 항상 true로 게시될 수 있습니다. 이 설정은 초기화 중인 cluster member의 주소를 peer discovery에 노출하는 용도와 맞습니다. 따라서 주소 발견과 serving health를 consumer별로 분리해야 합니다.

예를 들어 새 저장 서버가 12:00에 join 주소를 게시했지만 schema 초기화가 12:20에 끝난다고 하겠습니다. Slice에는 ready=true가 보일 수 있지만 일반 HTTP client가 곧바로 요청을 보내면 초기화 오류가 납니다. 반대로 이를 ready=false라고 보고 주소를 지우면 peer bootstrap이 막힙니다. discovery client는 join protocol을 확인하고 사용자 traffic 경로는 별도 health·readiness 계약을 적용합니다. Service port와 targetPort도 대조합니다.

따라서 “ready=false라서 주소가 없다”는 trace는 이 설정을 켠 Service에는 부적절합니다. 테스트에서는 Pod readiness 실패, Slice ready 값, discovery 성공, 실제 요청 성공을 각각 기록하고 publish 설정을 끈 별도 Service에서만 일반 ready=false 의미를 비교합니다. 이 작업에서는 cluster를 실행하지 않았으므로 관찰값은 검증 계획입니다. ready=true trace 뒤에는 discovery protocol의 join/leader 상태를 추가 조건으로 둡니다. 주소 게시가 곧 serving 허용이 아니므로 consumer가 port와 protocol을 잘못 선택하지 않도록 bootstrap 전용 Service와 사용자 traffic Service를 분리하는 방법도 검토합니다.

## 득점 포인트

- publishNotReadyAddresses에서 ready=true가 일반 readiness가 아닐 수 있음을 수정된 trace로 설명합니다.
- peer discovery와 사용자 traffic health를 분리합니다.

## 감점 포인트

- 이 설정에서도 ready=false를 주소 없음으로 해석합니다.
- 게시된 주소는 모든 client가 즉시 안전하게 호출할 수 있다고 합니다.

## 더 파고들 거리

- peer discovery port와 사용자 traffic port를 분리하면 어떤 health 계약이 필요한가요?
- publish 설정 변경 전후 기존 connection과 rollout을 어떻게 시험하나요?
