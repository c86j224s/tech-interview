---
id: sqlite-wal-checkpoint-mode
title: >-
  자동 checkpoint와 애플리케이션 checkpoint를 선택할 때 WAL 크기·foreground latency·reader 수명을
  어떻게 고려하나요?
difficulty: 중하
category: 인프라
tags:
  - SQLite
  - WAL
  - checkpoint
  - latency
related:
  - group-commit-checkpoint-tradeoff
---
# 자동 checkpoint와 애플리케이션 checkpoint를 선택할 때 WAL 크기·foreground latency·reader 수명을 어떻게 고려하나요?

## 구두 답변

자동 checkpoint는 WAL이 설정된 frame 임계에 도달할 때 동작하므로 운영 코드가 단순하지만, foreground write가 append와 page copy 비용을 함께 부담할 수 있습니다. 애플리케이션 checkpoint는 idle window나 maintenance worker로 I/O를 옮길 수 있지만 reader가 오래 열려 있으면 요청한 frame을 끝까지 처리하지 못하고, worker 실패·경합·재시도를 직접 운영해야 합니다. 자동을 끄는 것은 checkpoint 비용을 없애는 것이 아니라 비용의 시간과 소유자를 바꾸는 선택입니다.

임계가 설명용으로 1,000 page라고 하겠습니다. 요청 W가 page 1,000을 append한 순간 자동 checkpoint를 만나면 W의 latency에 copy 비용이 섞일 수 있습니다. 수동 정책으로 idle에 돌리면 W의 p99를 낮출 여지가 있지만, A가 오래된 snapshot을 잡고 있으면 `requested=1000, copied=100, remaining=900`처럼 partial 결과가 남습니다. 선택할 때 WAL 최대 크기·foreground p95/p99·checkpoint duration·oldest reader lifetime·남은 frame·disk 여유·재시작 시 recovery 시간을 함께 비교합니다. 너무 자주 부르면 I/O contention, 너무 늦게 부르면 WAL과 recovery 비용이 커집니다.

정책의 성공 조건도 “호출이 반환됨”이 아니라 workload에 맞춰 정합니다. foreground p99가 가장 중요하면 자동 checkpoint threshold를 낮추는 대신 maintenance 시간에 bounded passive checkpoint를 시도할 수 있고, 디스크 여유가 부족하면 partial 결과가 반복될 때 oldest reader를 경보로 올립니다. reader가 없는 실험에서는 requested frame과 copied frame이 일치하는지, reader를 추가한 실험에서는 남은 frame과 파일 크기가 어떻게 달라지는지 분리해 비교해야 합니다.

## 득점 포인트

- 자동은 foreground 경로에, 수동은 maintenance 경로에 비용을 배치한다는 차이를 설명합니다.
- 1,000 page 임계와 partial checkpoint trace를 제시하고 reader 수명을 조건으로 넣습니다.
- WAL 파일 크기만이 아니라 p99, 남은 frame, recovery 시간을 선택 기준으로 둡니다.

## 감점 포인트

- checkpoint를 자주 호출하면 항상 빨라진다고 말합니다.
- 수동 checkpoint가 WAL truncate와 완주를 보장한다고 가정합니다.
- 자동 checkpoint를 끄면 checkpoint I/O가 사라진다고 설명합니다.

## 더 파고들 거리

- reader가 긴 서비스에서 worker를 분리해도 해결되지 않는 경우의 관측 순서를 정리해 보세요.
- 파일 크기 축소와 crash recovery 시간 목표가 충돌할 때 각각 어떤 예산을 우선할지 결정해 보세요.
