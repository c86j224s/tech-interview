---
id: game-inventory-definition-instance
title: 같은 검을 두 개 가진 inventory에서 item definition과 item instance를 왜 분리하나요?
difficulty: 중하
category: 게임 서버
tags:
  - inventory
  - item identity
  - instance
related:
  - db-unique-constraint-race
---
# 같은 검을 두 개 가진 inventory에서 item definition과 item instance를 왜 분리하나요?

## 구두 답변

definition과 instance를 나누는 이유는 “철검이라는 종류”와 “특정 계정이 가진 한 자루의 권리”가 서로 다른 수명과 불변식을 가지기 때문입니다. `item_definition(iron_sword)`에는 이름, icon, 기본 공격력, stack 가능 여부를 두고, `item_instance(i-101)`에는 owner, 강화, 내구도, 거래 이력, version을 둡니다. 같은 definition에서 `i-101`은 강화 3·내구도 70, `i-102`는 강화 7·내구도 20으로 공존할 수 있으며 거래 명령은 definition이 아니라 instance ID 하나를 지목합니다.

definition patch도 구분해야 합니다. 기본 공격력 설명이 10에서 11로 바뀌었다고 해서 instance의 강화 이력이나 소유권을 새로 만들지 않습니다. 반대로 장비가 획득 시점의 능력을 고정해야 한다면 instance에 snapshot/version을 저장하고, live definition 참조와 어느 쪽이 권위인지 명시합니다. definition ID만 저장하면 두 검의 내구도·귀속·거래 여부를 구분할 수 없어 한쪽만 거래하거나 duplication을 탐지하기 어렵습니다.

동시성에서는 owner/version 조건을 함께 씁니다. A가 `i-101, owner=P1, version=7`을 P2로 보내는 중 P1의 다른 거래가 먼저 version을 8로 만들면 첫 명령은 영향 row 0으로 실패하고 `conflict/already moved`를 반환해야 합니다. identity 분리만으로 이 경쟁이 막히지는 않으며 unique instance ID, 권한 검증, 원자 전이가 필요합니다. 포션처럼 개별 metadata가 없는 fungible item은 `(stack_id, definition_id, owner, quantity, version)`으로 저장할 수 있지만 stack도 고유 상태입니다. 입력에 있던 Unity URL은 404라 이 모델의 API 보장 근거로 쓰지 않았고, 실제 package 계약은 버전 고정 후 별도 검증합니다.

## 득점 포인트

- 공통 template과 개별 소유 상태의 필드를 분리한다.
- 강화·내구도·거래 이력·owner/version이 definition ID만으로 표현되지 않는다고 설명한다.
- fungible stack도 수량·ID·version과 서버 권한이 필요하다고 한다.

## 감점 포인트

- 같은 definition이면 모든 검의 상태를 하나로 합쳐도 된다고 말한다.
- 클라이언트가 보낸 instance owner를 검증 없이 신뢰한다.
- item identity 분리만으로 동시 거래 duplication까지 자동 방지된다고 주장한다.

## 더 파고들 거리

- definition 패치로 기본 능력이 변할 때 기존 instance와 snapshot을 어떻게 처리할까요?
- 고유 item과 stackable item을 거래 원장에서 어떤 공통 command로 표현할까요?
- 삭제된 instance ID 재사용을 막기 위해 generation이 언제 필요한가요?
