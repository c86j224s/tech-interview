---
id: "trace-links-batch-causality"
title: "여러 요청의 이벤트를 하나의 배치로 처리합니다. trace parent 하나로 표현할 수 없는 인과는 어떻게 연결하나요?"
difficulty: "중하"
category: "성능"
tags: ["분산 추적","관측","지연","심화 질문"]
related: ["distributed-tracing-boundaries","throughput-vs-latency"]
promotedFrom: {"id":"distributed-tracing-boundaries","prompt":"배치 메시지가 여러 원인 요청에서 왔을 때 trace parent를 어떻게 표현할까요?"}
---

# 여러 요청의 이벤트를 하나의 배치로 처리합니다. trace parent 하나로 표현할 수 없는 인과는 어떻게 연결하나요?

## 구두 답변

한 배치가 여러 원인 요청을 합친다면 하나의 parent만 정하면 나머지 인과를 잃습니다. 배치 실행 span과 원래 producer span 사이에 trace link를 기록하는 방식을 사용할 수 있습니다.

link 수·메타데이터 크기와 sampling 정책을 제한하고 메시지 ID로 원문 이력을 찾을 수 있게 합니다. 재전달·배치 재구성에서 같은 효과와 시도를 구분합니다. 서로 다른 서버 벽시각보다 ID·링크가 인과의 중요한 근거입니다.

## 득점 포인트

- 한 배치가 여러 원인 요청을 합친다면 하나의 parent만 정하면 나머지 인과를 잃습니다. 배치 실행 span과 원래 producer span 사이에 trace link를 기록하는 방식을 사용할 수 있습니다.
- 서로 다른 서버 벽시각보다 ID·링크가 인과의 중요한 근거입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 한 배치가 여러 원인 요청을 합친다면 하나의 parent만 정하면 나머지 인과를 잃습니다.

## 더 파고들 거리

- [기본 상황과 비교: 사용자 요청이 여러 서비스와 DB를 거치며 느려집니다. 분산 추적으로 어느 구간의 실행이나 대기가 원인인지 어떻게 찾나요?](/tech-interview/questions/distributed-tracing-boundaries/)
