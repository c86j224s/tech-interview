---
id: game-ecs-archetype-move-on-add
title: ECS에서 실행 중 컴포넌트를 추가할 때 엔티티 데이터는 어디로 이동하나요?
difficulty: 중하
category: 게임 서버
tags:
  - ECS
  - archetype
  - 구조 변경
related:
  - cpu-cache-false-sharing
  - dynamic-array-amortized
---
# ECS에서 실행 중 컴포넌트를 추가할 때 엔티티 데이터는 어디로 이동하나요?

## 구두 답변

`add`는 기존 행에 필드 하나를 덧붙이는 대입이 아니라 컴포넌트 집합이 달라진 새 저장 레이아웃으로 엔티티를 이주시키는 구조 변경입니다. `{Position}`의 entity 10이 `Position=(4,8)`인 상태에서 `Health=100`을 추가하면 `{Position,Health}` archetype을 찾거나 만들고 새 행에 Position을 복사하고 Health를 초기화한 뒤 이전 행을 제거합니다. 구현이 현재 위치를 추적한다면 이때 archetype·row lookup도 갱신합니다. 이전 row나 포인터는 안정 handle이 아닙니다.

compact 제거라면 빈 칸을 마지막 entity가 메우므로 다른 entity의 위치도 바뀝니다. `A=[10,11,12]`에서 10을 옮기고 12가 0번을 채우면 12의 역매핑도 고쳐야 합니다. 새 component의 기본값, 복사 정책, chunk 용량은 엔진 계약입니다. 저는 hot iteration 중 즉시 add하지 않고 phase 경계에서 적용하며 Position 보존, Health 초기화, query 소속과 stale handle 거부를 검사합니다.

추가 값이 명령으로 제공되는 경우에도 복사 대상과 초기화 대상을 구분합니다. Position을 새 행에 옮긴 뒤 Health를 100으로 쓰기 전에 새 archetype의 capacity 부족으로 chunk가 바뀌는지, 복사 중 실패하면 이전 행을 보존하고 lookup을 롤백하는지를 확인해야 합니다. 즉 구조 변경은 자료 복사와 메타데이터 갱신이 원자적으로 보이는 경계까지 포함합니다.

 적용 경계는 트랜잭션처럼 설계합니다. 새 행 쓰기와 이전 행 제거 사이에 예외가 나면 두 저장소가 같은 entity를 보거나 어느 쪽도 가리키지 않는 상태가 되므로, 임시 위치를 표시하고 성공 후 lookup을 publish합니다. 이 순서는 엔진 내부 구현을 단정하는 것이 아니라 애플리케이션이 보장해야 할 관찰 가능한 불변식입니다.

## 득점 포인트

- 컴포넌트 집합 변경이 archetype 이주와 기존 값 보존을 요구함을 설명합니다.
- swap-remove로 함께 이동한 엔티티의 역매핑까지 갱신합니다.

## 감점 포인트

- 기존 row 포인터가 이주 뒤에도 유효하다고 가정합니다.
- 새 행 초기화 전 lookup을 공개해 부분 상태를 보이게 합니다.

## 더 파고들 거리

- 새 컴포넌트의 생성자가 실패하면 이전 엔티티 상태를 어떻게 유지할까요?
- 태그 추가 대신 enable bit를 사용하면 어떤 이주 비용과 조회 조건이 달라질까요?
