---
id: crd-conversion-webhook-outage
title: conversion webhook이 중단된 동안 구버전 GET과 신버전 UPDATE는 어떤 경로에서 실패할 수 있나요?
difficulty: 중하
category: 인프라
tags:
  - CRD
  - versioning
  - conversion
related:
  - api-backward-compatibility
---
# conversion webhook이 중단된 동안 구버전 GET과 신버전 UPDATE는 어떤 경로에서 실패할 수 있나요?

## 구두 답변
conversion webhook이 필요한 요청 경로에서 API 서버가 webhook에 도달하지 못하면 GET·LIST·UPDATE가 timeout 또는 오류로 끝날 수 있습니다. storage가 v1이고 client가 v1beta1 GET을 보냈다면 저장 표현을 v1beta1로 변환해야 하므로 호출이 필요할 수 있습니다. v1beta1 UPDATE는 요청을 storage 표현으로 바꾸는 경로와 저장 후 응답 표현으로 되돌리는 경로가 모두 관련될 수 있습니다. LIST는 여러 객체를 묶어 변환하므로 단일 GET 성공이 모든 조합의 성공을 보장하지 않습니다.

장애 분석은 먼저 `spec.conversion.strategy`, storage version, 요청 version을 표로 고정합니다. `None` 전략으로 schema가 동일한 직접 경로라면 webhook down과 무관할 수 있지만, schema가 다른데 None을 사용하면 장애 이전부터 의미가 틀릴 수 있습니다. Webhook 전략이면 ConversionReview version, Service port 443, endpoint·TLS, API 서버에서의 reachability와 timeout을 확인합니다. GET·LIST·CREATE·UPDATE를 섞지 않고 각각 status code와 apiserver log를 기록해야 합니다.

timeout이 났다고 객체가 반드시 저장되지 않았다고 단정해서도 안 됩니다. 네트워크 응답 유실과 실제 write 상태가 다를 수 있으므로 resourceVersion과 재조회로 확인하고, webhook 복구 후에는 양방향 round-trip과 identity 보존을 검사합니다. 재시도하는 controller가 중복 외부 부수 효과를 내지 않는지도 봅니다. 이 설명은 실제 outage를 실행한 결과가 아니라 conversion 호출 경계에 대한 source-based 모델이며, 특정 Kubernetes patch release의 모든 최적화 경로를 보증하지 않습니다.

## 득점 포인트
- 요청 표현→storage 표현→응답 표현의 동기 변환 지점을 GET과 UPDATE에 적용합니다.
- None과 Webhook, GET·LIST·UPDATE의 경계를 조건부로 구분합니다.
- timeout, write 상태, retry 부수 효과를 별도 증거로 확인합니다.

## 감점 포인트
- webhook이 down이면 변환 불필요한 모든 API 요청도 항상 실패한다고 말하면 과장입니다.
- conversion webhook을 admission webhook의 mutation·validation 호출과 같은 의미로 설명하면 안 됩니다.
- timeout 응답만으로 write가 전혀 반영되지 않았다고 확정하면 안 됩니다.

## 더 파고들 거리
- ConversionReview 객체 순서와 identity metadata 보호 조건을 version 조합별 fixture로 검사합니다.
- 복구 후 재시도에서 resourceVersion 충돌과 idempotent 외부 작업을 어떻게 구분할지 설계합니다.
