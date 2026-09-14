---
id: "context-switch-cache-counter"
title: "context switch와 cache miss가 함께 증가합니다. 두 지표 사이 인과를 어떤 대조 실험으로 확인하나요?"
difficulty: "중하"
category: "운영체제"
tags: ["컨텍스트 스위칭","스케줄러","스레드","심화 질문"]
related: ["context-switch-overhead","process-vs-thread","throughput-vs-latency"]
promotedFrom: {"id":"context-switch-overhead","prompt":"컨텍스트 스위치와 캐시 미스를 하드웨어 성능 카운터로 어떻게 연결할까요?"}
---

# context switch와 cache miss가 함께 증가합니다. 두 지표 사이 인과를 어떤 대조 실험으로 확인하나요?

## 구두 답변

두 지표가 함께 증가한 것은 상관관계이며 context switch가 miss를 만들었다는 단독 증거는 아닙니다. 작업 집합·코어 이동·메모리 배치·worker 수 중 하나씩 바꿔 비교합니다.

자발적 대기와 강제 선점, per-core 사용률·run queue·cache 이벤트를 연결합니다. 하드웨어 counter의 event 정의와 sampling 오차도 확인합니다. worker 감소로 miss가 줄어도 처리량이 더 나빠질 수 있어 사용자 지연과 전체 효율을 함께 판단합니다.

## 득점 포인트

- 두 지표가 함께 증가한 것은 상관관계이며 context switch가 miss를 만들었다는 단독 증거는 아닙니다. 작업 집합·코어 이동·메모리 배치·worker 수 중 하나씩 바꿔 비교합니다.
- worker 감소로 miss가 줄어도 처리량이 더 나빠질 수 있어 사용자 지연과 전체 효율을 함께 판단합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 두 지표가 함께 증가한 것은 상관관계이며 context switch가 miss를 만들었다는 단독 증거는 아닙니다.

## 더 파고들 거리

- [기본 상황과 비교: 서버의 컨텍스트 스위치 횟수가 늘었습니다. 정상적인 I/O 대기인지 과도한 스레드 경쟁인지 구분하려면 어떤 지표를 함께 봐야 하나요?](/tech-interview/questions/context-switch-overhead/)
