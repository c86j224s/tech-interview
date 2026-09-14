---
id: "collision-layer-index-update"
title: "충돌 레이어가 실행 중 바뀝니다. broad phase의 필터와 위치 인덱스가 같은 상태를 보게 하려면 어떻게 하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["충돌","broad phase","공간 인덱스","심화 질문"]
related: ["collision-broad-narrow-phase"]
promotedFrom: {"id":"collision-broad-narrow-phase","prompt":"충돌 레이어를 broad phase에서 제외할 때 동적 레이어 변경을 어떻게 인덱스에 반영하나요?"}
---

# 충돌 레이어가 실행 중 바뀝니다. broad phase의 필터와 위치 인덱스가 같은 상태를 보게 하려면 어떻게 하나요?

## 구두 답변

레이어 필터를 broad phase에서 적용한다면 레이어 변경은 후보 집합의 변경 사건입니다. 위치가 그대로라는 이유로 인덱스 갱신을 생략하면 새로 충돌해야 할 쌍을 놓칠 수 있습니다.

같은 틱 snapshot의 위치·형상·활성·레이어를 읽거나 변경 중 보수적으로 양쪽 후보를 유지합니다. 최종 좁은 단계에서도 현재 유효한 정책과 객체 세대를 확인합니다. 레이어 전환·삭제·재생성·동시 이동을 기준 전수 검사와 대조합니다.

## 득점 포인트

- 레이어 필터를 broad phase에서 적용한다면 레이어 변경은 후보 집합의 변경 사건입니다. 위치가 그대로라는 이유로 인덱스 갱신을 생략하면 새로 충돌해야 할 쌍을 놓칠 수 있습니다.
- 레이어 전환·삭제·재생성·동시 이동을 기준 전수 검사와 대조합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 레이어 필터를 broad phase에서 적용한다면 레이어 변경은 후보 집합의 변경 사건입니다.

## 더 파고들 거리

- [기본 상황과 비교: 많은 캐릭터의 충돌을 검사하려 합니다. 충돌 후보를 먼저 추리는 broad phase와 실제 형상을 검사하는 narrow phase를 왜 나누나요?](/tech-interview/questions/collision-broad-narrow-phase/)
