---
id: crd-pruning-conversion-loss
title: unknown field가 version별 schema에서 pruning되는지 conversion 손실인지 어떻게 구분하나요?
difficulty: 중하
category: 인프라
tags:
  - CRD
  - versioning
  - conversion
related:
  - api-backward-compatibility
---
# unknown field가 version별 schema에서 pruning되는지 conversion 손실인지 어떻게 구분하나요?

## 구두 답변
unknown field가 사라진 결과만 보고 pruning인지 conversion 손실인지 결정하지 않습니다. 같은 JSON에 `spec.debug=true`를 넣고 요청 직후 응답, 요청 version GET, 다른 served version GET, 재저장 뒤 GET을 따로 비교합니다. 요청 직후부터 사라지면 그 version의 structural OpenAPI schema와 pruning 조건을 먼저 의심합니다. 요청 version에서는 보이지만 다른 version에서만 사라지면 대상 schema가 그 표현을 담지 못했거나 webhook mapping이 누락된 경로를 조사합니다. UPDATE·migration 뒤에만 사라지면 재저장 단계의 schema·defaulting·webhook을 추가로 봅니다.

`conversion.strategy: None`은 schema가 실질적으로 같고 apiVersion 문자열을 바꾸는 정도의 계약입니다. v1beta1의 `hostPort: "web:80"`를 v1의 `host: web`, `port: 80`으로 나누는 의미 변환은 None으로 해결되지 않고 webhook mapping이 필요합니다. 반대로 unknown 보존·pruning은 CRD schema와 preserve-unknown-fields 조건에 의존하므로 “CRD는 항상 삭제” 또는 “항상 보존”이라고 말할 수 없습니다. 정확한 판정에는 CRD YAML과 API server 버전을 고정한 fixture가 필요합니다.

검증 표에는 입력의 field presence, 각 version 응답, write 전후 UID·spec·default 값을 기록하고 `resourceVersion`, `apiVersion`, managedFields처럼 정상적으로 변하는 서버 metadata는 별도 비교 규칙으로 둡니다. 이 환경에서는 cluster를 실행하지 않았으므로 특정 field의 실제 pruning 결과를 주장하지 않습니다. 단계별 관찰 없이 응답 하나만 읽는 것이 가장 큰 실패 원인입니다.

## 득점 포인트
- 요청 직후·다른 version GET·재저장 후의 관찰 시점으로 원인을 분리합니다.
- None의 동일 schema 전제와 webhook의 의미 mapping 필요성을 예로 설명합니다.
- server metadata 변화와 spec 의미·UID 보존을 다른 비교 대상으로 둡니다.

## 감점 포인트
- 응답에서 필드가 없으면 무조건 webhook이 버렸다고 말하면 단계 증거가 없습니다.
- 모든 unknown field가 항상 보존되거나 항상 pruning된다고 단정하면 schema 조건을 무시합니다.
- YAML byte 차이를 곧바로 의미 손실로 판정하면 정상 metadata 변화를 오탐합니다.

## 더 파고들 거리
- structural schema와 preserve-unknown-fields 조합을 작은 fixture로 만들어 각 단계의 field presence를 비교합니다.
- defaulting이 round-trip에서 새 값처럼 보일 때 의도한 default와 변환 누락을 기대값으로 분리합니다.
