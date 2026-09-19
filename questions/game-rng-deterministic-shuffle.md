---
id: game-rng-deterministic-shuffle
title: 같은 entity 목록에 난수 순서를 적용할 때 먼저 목록 순서를 정규화해야 하는 이유는 무엇인가요?
difficulty: 중하
category: 게임 서버
tags:
  - game
  - mechanism
related:
  - algorithm-fisher-yates-shuffle
---
# 같은 entity 목록에 난수 순서를 적용할 때 먼저 목록 순서를 정규화해야 하는 이유는 무엇인가요?

## 구두 답변
같은 Fisher–Yates draw라도 입력 배열 순서가 다르면 최종 entity가 달라집니다. 서버 A가 stable key `[1,2,3,4]`, 서버 B가 map 순서 `[3,1,4,2]`를 넣고 같은 swap index를 적용하면 결과 target이 달라집니다. 따라서 entity ID와 generation으로 정렬하고 같은 lifecycle snapshot인지 확인한 뒤 shuffle합니다. 이것은 Fisher–Yates의 균등성 증명과 별개의 replay 계약입니다. stable sort가 삭제·생성 시점 차이를 고치지는 않으므로 목록 checksum과 lifecycle event도 비교해야 합니다. 무작위 comparator sort는 입력 순서를 안정화하지도, 균등 permutation을 보장하지도 않습니다.


정렬 key는 ID 하나만으로 충분하지 않을 수 있습니다. 서버에서 entity 17이 삭제되고 새 entity 17이 생성되면 숫자 ID는 같지만 generation이 다르므로 `(id,generation)`을 key로 사용해야 합니다. 후보 수집 시점도 tick snapshot으로 고정하여 A가 네 개, B가 세 개를 섞는 상황을 먼저 실패로 보고 shuffle 결과만 비교하지 않습니다. 정상화 뒤에는 동일 draw index trace와 최종 배열을 함께 기록하면 입력 순서 문제와 RNG state 문제를 분리할 수 있습니다. 이 검사는 셔플 함수보다 먼저 후보 집합을 만드는 query의 deterministic ordering 계약을 검증하는 단계입니다. 셔플 전 후보 집합의 checksum이 다르면 RNG를 바꿔도 같은 replay가 될 수 없습니다.
 생성 순서가 다른 상태를 셔플 함수 내부에서 보정하려 하면 draw 소비와 대상 선택이 이미 어긋난 뒤이므로, 후보 query 단계에서 실패를 검출하는 편이 원인 추적 비용도 낮습니다.

## 득점 포인트
- RNG draw와 입력 sequence를 구분한다.
- stable ID·generation으로 정렬한다.
- lifecycle checksum을 같이 비교한다.
- 알고리즘 균등성과 replay 결정성을 나눈다.

## 감점 포인트
- 어떤 map 순서에서도 같다고 한다.
- stable sort가 lifecycle을 고친다고 한다.
- random comparator를 셔플로 쓴다.
- 기존 Fisher–Yates 일반론만 반복한다.

## 더 파고들 거리
- ID 재사용 게임에서 generation trace는?
- 병렬 후보 merge 순서를 어떻게 고정할까요?
