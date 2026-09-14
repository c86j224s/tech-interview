---
id: "rewind-window-abuse-limits"
title: "클라이언트의 추정 지연이 급변합니다. rewind 범위를 무한히 늘리지 않고 입력 시각을 어떻게 검증하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["지연 보정","rewind","피격 판정","심화 질문"]
related: ["lag-compensation-rewind","authoritative-server-input"]
promotedFrom: {"id":"lag-compensation-rewind","prompt":"rewind 허용 시간이 급격히 변하는 클라이언트의 입력을 어떤 정책과 감사 지표로 제한하나요?"}
---

# 클라이언트의 추정 지연이 급변합니다. rewind 범위를 무한히 늘리지 않고 입력 시각을 어떻게 검증하나요?

## 구두 답변

서버 관측 RTT·수신 시각·입력 sequence와 허용 rewind 상한을 함께 사용합니다. client가 보낸 timestamp를 그대로 과거 판정 권한으로 주지 않습니다.

급격한 변화·미래 시각·반복 상한 접근을 기록하고 입력을 거절하거나 제한된 시각으로 처리하는 정책을 둡니다. 정상 고지연 사용자의 피해와 엄폐 후 피격을 비교하며 현재 상태를 과거 snapshot으로 덮지 않습니다.

## 득점 포인트

- 서버 관측 RTT·수신 시각·입력 sequence와 허용 rewind 상한을 함께 사용합니다. client가 보낸 timestamp를 그대로 과거 판정 권한으로 주지 않습니다.
- 정상 고지연 사용자의 피해와 엄폐 후 피격을 비교하며 현재 상태를 과거 snapshot으로 덮지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 서버 관측 RTT·수신 시각·입력 sequence와 허용 rewind 상한을 함께 사용합니다.

## 더 파고들 거리

- [기본 상황과 비교: 지연된 공격 입력을 서버가 과거 위치로 되감아 판정할 때 어떤 시간·충돌·공정성 한계가 생기나요?](/tech-interview/questions/lag-compensation-rewind/)
