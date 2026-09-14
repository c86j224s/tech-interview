---
id: "trace-clock-skew-duration"
title: "서버 시계가 어긋나 자식 span이 부모보다 먼저 시작한 것처럼 보입니다. duration과 인과를 어떻게 해석하나요?"
difficulty: "중하"
category: "성능"
tags: ["분산 추적","관측","지연","심화 질문"]
related: ["distributed-tracing-boundaries","throughput-vs-latency"]
promotedFrom: {"id":"distributed-tracing-boundaries","prompt":"서버 시계 오차가 분산 span duration과 인과 해석에 미치는 영향은 무엇인가요?"}
---

# 서버 시계가 어긋나 자식 span이 부모보다 먼저 시작한 것처럼 보입니다. duration과 인과를 어떻게 해석하나요?

## 구두 답변

span duration은 가능하면 해당 프로세스의 단조 경과로 재고 cross-host 시간 배치는 오차가 있음을 인정합니다. 부모·자식 ID와 메시지 인과가 실제 순서 판단의 근거입니다.

서버 시계 동기화는 품질을 높이지만 완전 일치가 아닙니다. 음수처럼 보이는 간격을 자동 0으로 바꾸어 원인을 숨기지 않습니다. request queue·network·실행 시간의 분해와 샘플링 누락을 표시하고 clock jump 테스트를 수행합니다.

## 득점 포인트

- span duration은 가능하면 해당 프로세스의 단조 경과로 재고 cross-host 시간 배치는 오차가 있음을 인정합니다. 부모·자식 ID와 메시지 인과가 실제 순서 판단의 근거입니다.
- request queue·network·실행 시간의 분해와 샘플링 누락을 표시하고 clock jump 테스트를 수행합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: span duration은 가능하면 해당 프로세스의 단조 경과로 재고 cross-host 시간 배치는 오차가 있음을 인정합니다.

## 더 파고들 거리

- [기본 상황과 비교: 사용자 요청이 여러 서비스와 DB를 거치며 느려집니다. 분산 추적으로 어느 구간의 실행이나 대기가 원인인지 어떻게 찾나요?](/tech-interview/questions/distributed-tracing-boundaries/)
