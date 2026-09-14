---
id: "cross-boundary-combat-authority"
title: "서로 다른 공간 서버의 두 캐릭터가 공격합니다. 기준 틱·상태 snapshot·피해 확정 owner를 어떻게 정하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["공간 분할","소유권 이전","펜싱","심화 질문"]
related: ["world-partition-handoff","multiagent-cell-reservation","distributed-lock-fencing"]
promotedFrom: {"id":"world-partition-handoff","prompt":"경계 양쪽 캐릭터의 공격·충돌 판정을 어느 owner가 맡을지 epoch와 함께 어떻게 정하나요?"}
---

# 서로 다른 공간 서버의 두 캐릭터가 공격합니다. 기준 틱·상태 snapshot·피해 확정 owner를 어떻게 정하나요?

## 구두 답변

교차 경계 이벤트의 기준 틱·대상 상태 snapshot과 피해를 확정할 owner를 하나로 정합니다. 두 서버가 각자 현재 상태를 읽고 독립 성공하면 중복·모순 결과가 생길 수 있습니다.

handoff epoch·공격 ID·원장과 과거 hitbox 이력을 연결합니다. 관찰 복제본은 쓰기 권위가 아닙니다. 지연·경계 이동·서버 종료·늦은 공격에서 한 번의 확정과 공정성을 검사합니다.

## 득점 포인트

- 교차 경계 이벤트의 기준 틱·대상 상태 snapshot과 피해를 확정할 owner를 하나로 정합니다. 두 서버가 각자 현재 상태를 읽고 독립 성공하면 중복·모순 결과가 생길 수 있습니다.
- 지연·경계 이동·서버 종료·늦은 공격에서 한 번의 확정과 공정성을 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 교차 경계 이벤트의 기준 틱·대상 상태 snapshot과 피해를 확정할 owner를 하나로 정합니다.

## 더 파고들 거리

- [기본 상황과 비교: 공간 서버 경계를 넘는 캐릭터의 소유권을 중복 처리와 늦은 입력 없이 이전하려면 어떤 전환점을 두어야 하나요?](/tech-interview/questions/world-partition-handoff/)
