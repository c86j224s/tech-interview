---
id: ecs-archetype-sparse-set-structural-changes
title: ECS Archetype·Sparse Set 구조 변경
topic: 게임 서버
summary: >-
  ECS에서 컴포넌트 조합별 archetype과 sparse set의 저장·조회 특성을 비교하고, 런타임 add/remove가 엔티티
  이동·참조 무효화·구조 변경 비용으로 이어지는 경계를 설명합니다.
questionIds: []
prerequisites:
  - cacheline-layout
  - dynamic-array
  - spatial-candidates
related:
  - spatial-candidates
  - cacheline-layout
  - dynamic-array
reviewedAt: '2026-09-19'
---
# ECS Archetype·Sparse Set 구조 변경

ECS의 구조적 변경은 컴포넌트 필드 하나를 객체 안에 덧붙이는 일이 아닙니다. 엔티티가 어떤 컴포넌트 집합에 속하는지 바뀌므로, 저장 구조의 행과 인덱스의 의미가 함께 바뀝니다. `Position`만 가진 엔티티가 `Health`를 얻는 순간을 생각해 보겠습니다. archetype 방식에서는 `Position` 열만 있는 저장소의 행을 `Position`과 `Health` 열이 함께 있는 다른 저장소의 행으로 옮깁니다. sparse set 방식에서는 대개 새 컴포넌트의 dense 배열에 값을 넣고, sparse 인덱스와 entity 위치 정보를 갱신합니다. 둘 다 “상태 필드 대입”보다 넓은 작업이며, 순회 중 실행하면 반복자의 안정성과 외부 핸들의 수명까지 검토해야 합니다.

이 글에서 말하는 ECS는 특정 엔진의 내부 구현을 그대로 약속하지 않습니다. Unity Entities 1.0 문서는 동일한 컴포넌트 타입 집합을 가진 엔티티가 archetype을 공유하고, 타입 집합을 바꾸는 작업에서 엔티티가 새 archetype으로 이동한다고 설명합니다. chunk 크기나 API 이름은 엔진별 계약이므로 일반 원리와 구분합니다. archetype의 열 저장과 sparse set의 dense/sparse 매핑은 서로 다른 선택이지만, 공통된 핵심은 **구조 변경의 선형 비용과 핸들 무효화 가능성을 데이터 모델의 일부로 취급하는 것**입니다.

## 컴포넌트 집합과 저장 행

archetype은 컴포넌트 종류의 집합을 저장 레이아웃의 서명(signature)으로 사용하는 구조입니다. `Position`만 있는 집합 `{P}`와 `Position, Health` 집합 `{P,H}`는 각각 별도 archetype입니다. `Velocity`까지 있으면 `{P,H,V}`가 또 다른 서명이 됩니다. 같은 archetype 안에서는 component column이 병렬로 놓이고, 한 행의 entity ID와 `Position`, `Health` 값이 같은 행 번호를 공유합니다. 실제 배치가 chunk 배열인지 페이지인지, 한 chunk의 용량이 얼마인지는 구현마다 다르지만, “열의 같은 위치가 같은 entity를 가리킨다”는 불변식은 이 방식의 핵심입니다.

따라서 add의 중간 상태를 다음처럼 추적할 수 있습니다.

```text
기존: A({Position})
  entity[3] = 10, Position[3] = (4, 8)

add Health(100) 요청
  대상 서명 = {Position, Health}
  새 행 = Position' = (4, 8), Health' = 100
  A에서 entity[3] 제거
  새 archetype의 dense 행과 entity 위치 갱신

이후: B({Position, Health})
  entity[0] = 10, Position[0] = (4, 8), Health[0] = 100
```

여기서 새 행 번호가 0이라는 보장은 없습니다. 새 archetype의 빈 슬롯과 삭제 정책에 따라 달라집니다. 중요한 점은 entity 10이 예전 `A`의 3번 행에 더 이상 없다는 사실입니다. Unity 문서가 설명하는 것처럼 타입 집합이 바뀌면 해당 집합에 맞는 archetype으로 이동하며, 이동이 잦으면 비용이 생깁니다. 초기화하지 않은 새 컴포넌트 값, 복사할 수 없는 외부 자원, 기본 생성 정책은 엔진 또는 애플리케이션 계약으로 별도 명시해야 합니다.

## Archetype 열 저장과 Sparse Set 매핑

sparse set은 보통 entity ID를 sparse 배열의 인덱스로 보고, 실제 데이터는 조밀한 dense 배열에 둡니다. `sparse[id]`는 dense 위치를 가리키고, `dense[pos]`는 entity ID를 저장합니다. 컴포넌트 값 배열도 `values[pos]`처럼 같은 dense 위치를 사용합니다. 예를 들어 dense가 `[7, 10, 13]`이고 `sparse[10]=1`이면 entity 10의 값은 `values[1]`입니다. 이 구조는 존재 여부 확인과 dense 순회를 빠르게 만들지만, ID 공간이 매우 크고 듬성듬성하면 sparse 배열의 메모리 비용을 따져야 합니다.

삭제는 흔히 swap-remove로 처리합니다. entity 10이 위치 1에서 삭제될 때 마지막 entity 13을 1번으로 이동하고, `dense=[7,13]`, `values=[value7,value13]`, `sparse[13]=1`로 고칩니다. 이전에 13의 dense 위치를 보관하던 외부 참조는 그대로 두면 잘못된 행을 가리킵니다. archetype도 compact chunk를 위해 마지막 entity를 빈 칸으로 옮길 수 있으므로 “archetype이면 행이 안정적”이라고 가정할 수 없습니다. 어떤 저장 방식을 택하든 외부에는 주소 대신 안정적인 논리 핸들과 검증 절차를 제공하는 편이 안전합니다.

```diagram
{"title":"구조 서명이 저장 이동을 결정합니다","caption":"컴포넌트 집합이 달라지면 같은 entity라도 새 저장 행을 사용합니다. sparse set은 dense 위치와 역매핑을 함께 고칩니다.","rows":[[{"id":"sig","label":"컴포넌트 서명","detail":["{Position} → {Position, Health}"]}],[{"id":"arch","label":"Archetype 열 이동","detail":["Position 복사 · Health 초기화"]},{"id":"sparse","label":"Sparse·dense 갱신","detail":["ID ↔ dense 위치"]}],[{"id":"handle","label":"핸들 검증","detail":["generation · 현재 위치"]}]],"edges":[{"from":"sig","to":"arch","label":"새 column 집합"},{"from":"sig","to":"sparse","label":"컴포넌트 저장소"},{"from":"arch","to":"handle","label":"위치 변경"},{"from":"sparse","to":"handle","label":"역매핑 변경"}]}
```

## Add·Remove의 이동 비용

add는 기존 column에 한 칸을 늘리는 연산이 아닙니다. 대상 archetype을 찾거나 새로 만들고, 새 행을 확보한 뒤 기존 컴포넌트의 값을 옮기며, 새 컴포넌트의 기본값 또는 명령 값을 기록합니다. remove는 반대 archetype으로 옮기면서 제거한 값은 버립니다. 컴포넌트가 많고 값이 크면 이동 바이트가 커집니다. 예를 들어 64바이트짜리 `Transform`, 32바이트짜리 `InventoryView`, 16바이트짜리 `Flags`를 가진 entity 10만 개 중 하나의 tag를 자주 토글한다면, tag 자체는 1비트처럼 보여도 archetype 간 이동은 전체 행에 가까운 복사와 인덱스 갱신을 유발할 수 있습니다. 이 수치는 설명용 계산이며 특정 엔진의 실제 복사량을 측정한 결과가 아닙니다.

태그를 component로 둘지 값 필드로 둘지는 구조 변경 빈도와 query 의미로 판단합니다. `Dead`가 거의 한 번 붙고 제거되지 않는다면 archetype 이동을 감수하고 query에서 제외하는 편이 명확할 수 있습니다. 반대로 매 tick `Selected`, `Hovered`, `Targeted`가 뒤집히면 빈번한 이동보다 값 필드·별도 sparse set·비트마스크가 나을 수 있습니다. 다만 값 필드로 숨기면 query가 매번 조건을 검사하고, 별도 저장소로 빼면 join 비용과 수명 동기화가 생깁니다. “태그는 항상 archetype으로” 같은 규칙을 먼저 두면 hot path의 변경 빈도를 놓치게 됩니다.

## 핸들·세대·참조 수명

entity ID만으로는 현재 객체를 식별할 수 없습니다. 삭제 후 ID를 재사용하면 이전 packet이나 지연된 worker 결과가 새 entity를 가리킬 수 있기 때문입니다. 일반적인 핸들은 `(index, generation)`처럼 구성하고, 저장소의 현재 generation과 일치할 때만 접근을 허용합니다. entity 7을 삭제하며 generation을 2에서 3으로 올렸다면 `(7,2)`는 거부되고 `(7,3)`만 현재 객체로 인정됩니다. 이 검사는 논리적 stale을 막지만 이미 해제된 메모리를 안전하게 읽게 해 주지는 않습니다. pointer를 들고 있는 reader는 epoch, reference count, job 완료 대기 같은 별도 수명 계약이 필요합니다.

archetype 이동 뒤 핸들이 entity의 새 행 위치를 다시 찾게 하거나, entity 레코드가 현재 archetype과 row를 가리키도록 갱신합니다. sparse set도 sparse 역매핑이 진실의 원천이 되도록 하고 dense 행을 직접 저장한 외부 index를 신뢰하지 않습니다. 비동기 명령은 ID와 generation, 대상 world 또는 shard version을 함께 담아 적용 시 다시 검증해야 합니다. generation을 확인한 뒤에도 다른 thread가 삭제할 수 있는 설계라면 검증과 접근을 원자적 수명 보호 안에서 수행해야 합니다.

## 순회 중 구조 변경과 Command Buffer

query가 `Position`을 가진 행을 차례로 읽는 동안 첫 entity에 `Health`를 add하면 그 entity가 다른 archetype으로 빠집니다. 현재 chunk의 마지막 행이 빈 자리를 메우는 swap-remove까지 발생하면 다음 인덱스를 건너뛰거나 이미 처리한 entity를 다시 읽을 수 있습니다. sparse set 역시 dense swap-remove로 순서와 위치가 바뀝니다. 그래서 hot iteration에서는 읽기 집합을 고정하고 `Add(entity, Health)`, `Remove(entity, Stunned)` 같은 명령을 buffer에 기록한 뒤 phase 경계에서 적용하는 방식이 흔합니다.

deferred 적용은 무조건 안전한 것이 아닙니다. 명령이 오래 쌓이면 같은 tick에 붙어야 할 효과가 다음 tick으로 늦어지고, 명령 순서가 worker 완료 순서에 따라 달라지면 replay가 달라집니다. buffer 항목에는 발행 tick, 발행 순번, entity generation, 명령 종류, 값 초기화를 넣고, 적용 시 현재 상태와 충돌하는 명령을 정의된 정책으로 거부하거나 합칩니다. 예를 들어 같은 entity에 `Add Dead` 다음 `Remove Dead`가 쌓였을 때 마지막 승리인지, 먼저 add를 적용한 뒤 remove하는지 규칙을 고정해야 합니다.

## Query 폭발과 저장 방식 선택

archetype 수 자체는 성능 결론이 아닙니다. 서명 수, 각 archetype의 entity 수, query가 매칭하는 서명 수, chunk가 비어 있는 정도, add/remove 이동 바이트와 p99를 같이 봐야 합니다. 조건부 component 조합이 2의 n승으로 늘고 대부분의 archetype에 entity가 몇 개뿐이면 query가 많은 작은 구간을 훑으며 locality를 잃을 수 있습니다. 반대로 수가 많아도 큰 archetype 몇 개에 집중되고 query cache가 잘 맞으면 비용이 작을 수 있습니다.

sparse set은 component별 존재 여부와 dense 순회를 독립적으로 관리하기 쉬워 조합이 희소하거나 component를 동적으로 붙였다 떼는 경우 유리할 수 있습니다. 여러 component를 동시에 읽는 시스템은 여러 dense 배열을 ID로 join해야 하므로 branch와 lookup이 늘어납니다. archetype은 함께 처리하는 component가 한 chunk에 정렬되어 query가 빠를 수 있지만, 조합이 지나치게 세분화되면 이동과 query 매칭 관리 비용이 커집니다. 기준은 “어느 방식이 빠른가”가 아니라 대표 장면에서 query p99, 이동 p99, 메모리, stale 오류율이 어떤 계약을 만족하는가입니다.

## 실패 사례와 검증 경계

첫째, add를 일반 필드 대입으로 처리해 현재 iterator의 row를 계속 사용하면 누락·중복이 생깁니다. 둘째, dense 행 번호나 포인터를 stable handle처럼 외부에 공개하면 swap-remove와 archetype 이동 뒤 잘못된 entity를 읽습니다. 셋째, generation 검사를 논리 수명 보호와 메모리 안전성으로 혼동하면 삭제 직후 pointer를 읽는 오류가 남습니다. 넷째, command buffer를 도입하고도 적용 순번을 worker 완료 순서에 맡기면 결정성이 좋아지지 않습니다.

검증은 작은 저장소에서 전수 상태와 인덱스를 비교하는 방식으로 시작합니다. entity 10에 `Health`를 add한 뒤 Position 값이 보존되고 새 값이 초기화되는지, remove 뒤 다른 entity가 이동했을 때 역매핑이 맞는지 확인합니다. 이어 query 순회 중 add/remove를 buffer와 즉시 적용으로 각각 실행해 처리된 ID 집합을 비교합니다. 삭제 후 ID 재사용에서는 `(id, oldGeneration)` 명령이 거부되고 새 generation 명령만 적용되는지 확인합니다. 실제 엔진을 이 환경에서 실행한 것은 아니므로 위 절차와 숫자는 설명용 검증 계획입니다.

## 비용·운영 지표와 참고자료

운영에서는 archetype 수와 entity 분포, query별 매칭 archetype 수, tick당 구조 변경 수, 이동한 component bytes, 명령 buffer 길이와 적용 지연, stale 명령 비율, generation 거부 수를 기록합니다. 평균 이동 시간이 낮아도 전투 시작 순간 p99가 튀면 batch 경계를 재설계해야 합니다. 구조 변경을 금지하는 것이 목적이 아니라, hot read loop와 mutation을 분리하고 지연·순서·수명을 관측 가능한 계약으로 만드는 것이 목적입니다.

참고한 Unity Entities 1.0 archetype 문서는 component-type 집합별 archetype, 타입 집합 변경 시 relocation, column 배열과 compact storage를 설명합니다. 다만 정확한 package revision은 입력에서 고정되지 않았고, 엔진별 scheduling·command buffer·generation 구현은 문서가 보장하지 않습니다. 따라서 본문은 공식 문서가 직접 말한 archetype 원리와 일반 ECS 자료구조 추론을 구분하며, 특정 엔진 API의 동작으로 확대하지 않습니다.

### 참고 경로

- [https://docs.unity.cn/Packages/com.unity.entities@1.0/manual/concepts-archetypes.html](https://docs.unity.cn/Packages/com.unity.entities@1.0/manual/concepts-archetypes.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
