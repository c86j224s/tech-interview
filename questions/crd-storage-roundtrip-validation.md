---
id: crd-storage-roundtrip-validation
title: storage migration 뒤 객체 의미를 보존했는지 어떤 검증으로 확인하나요?
difficulty: 중하
category: 인프라
tags:
  - CRD
  - versioning
  - conversion
related:
  - api-backward-compatibility
---
# storage migration 뒤 객체 의미를 보존했는지 어떤 검증으로 확인하나요?

## 구두 답변
migration 검증의 기준은 YAML 문자열 동일성이 아니라 identity와 업무 의미의 보존입니다. fixture에 name·namespace·UID, 여러 spec 필드, status, labels·annotations, 빈 값·생략 값·default 대상, version별 필드 변환을 넣습니다. v1beta1→v1→v1beta1 round-trip에서 name·namespace·UID, 수량·단위·enum·필드 presence가 계약대로 돌아오는지 비교합니다. `resourceVersion`, managedFields, apiVersion은 정상적인 서버 변화이므로 고정 equality에서 분리하고 허용 변화 규칙을 명시합니다.

예를 들어 v1beta1의 `hostPort: "web:80"`를 v1의 `host: web`, `port: 80`으로 변환한다면 역변환의 의미가 동일해야 합니다. 잘못된 포트나 누락 입력을 조용히 default로 바꾸면 round-trip이 문자열상 그럴듯해도 의미가 손상될 수 있으므로 오류 정책을 fixture에 넣습니다. migration 전후 객체 수와 UID 집합, generation, spec의 단위·열거값, status의 controller 재계산을 각각 비교해 저장 변환과 reconcile 효과를 분리합니다.

GET 하나나 storage flag만으로 완료를 선언하지 않습니다. 일부만 재저장된 혼합 상태에서 list·update·controller reconcile을 수행하고 `status.storedVersions`와 샘플 객체의 저장 경로를 대조합니다. migration 실패와 재시도 뒤에도 old served version과 webhook을 유지할 수 있어야 rollback 관찰이 가능합니다. 실제 cluster migration은 실행하지 않았으므로 fixture와 비교 규칙은 검증 설계이며 특정 도구의 성공 결과가 아닙니다.

## 득점 포인트
- byte equality, identity equality, semantic equality, 정상 server metadata 변화를 분리합니다.
- 양방향 변환 fixture에 단위·default·unknown·status·잘못된 입력을 포함합니다.
- 객체 수·UID·storedVersions·혼합 상태와 list/update까지 migration 판단에 넣습니다.

## 감점 포인트
- YAML 문자열이 달라지면 무조건 의미가 손상됐다고 판정하면 안 됩니다.
- resourceVersion이 바뀐 것만으로 migration 실패를 선언하면 정상 write 효과를 오판합니다.
- CRD storage flag와 GET 한 번으로 모든 객체의 재작성 완료를 선언하면 안 됩니다.

## 더 파고들 거리
- status를 spec과 같은 불변 값으로 비교할 때 controller 재계산을 어떻게 분리할지 정합니다.
- 부분 migration 중 rollback에서 old served version, conversion webhook, client retry를 어떤 순서로 유지할지 설계합니다.
