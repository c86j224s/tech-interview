---
id: "cache-readonly-sharing-versus-writes"
title: "여러 코어가 같은 cache line을 읽기만 합니다. 쓰기 무효화가 있는 공유와 비용이 어떻게 다른가요?"
difficulty: "중하"
category: "성능"
tags: ["캐시 라인","거짓 공유","스레드","심화 질문"]
related: ["cpu-cache-false-sharing","process-vs-thread"]
promotedFrom: {"id":"cpu-cache-false-sharing","prompt":"읽기 전용 공유 line도 쓰기 무효화와 같은 비용을 만들 수 있나요?"}
---

# 여러 코어가 같은 cache line을 읽기만 합니다. 쓰기 무효화가 있는 공유와 비용이 어떻게 다른가요?

## 구두 답변

여러 코어의 읽기 전용 공유는 쓰기 소유권 이동·무효화가 반복되는 경우와 다릅니다. 읽기도 cache miss·대역폭·NUMA 비용이 있지만 같은 line을 공유한다는 이유만으로 false sharing이라 하지 않습니다.

쓰기 카운터를 추가했을 때 coherence traffic이 늘어나는지 대조합니다. padding·작업 분할을 바꾸되 같은 총 연산량과 메모리 위치를 유지합니다. 하드웨어 카운터 하나로 원인을 확정하지 않고 프로파일·배치 변경·전체 성능을 함께 봅니다.

## 득점 포인트

- 여러 코어의 읽기 전용 공유는 쓰기 소유권 이동·무효화가 반복되는 경우와 다릅니다. 읽기도 cache miss·대역폭·NUMA 비용이 있지만 같은 line을 공유한다는 이유만으로 false sharing이라 하지 않습니다.
- 하드웨어 카운터 하나로 원인을 확정하지 않고 프로파일·배치 변경·전체 성능을 함께 봅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 여러 코어의 읽기 전용 공유는 쓰기 소유권 이동·무효화가 반복되는 경우와 다릅니다.

## 더 파고들 거리

- [기본 상황과 비교: 두 스레드가 서로 다른 카운터만 수정하는데 함께 실행하면 느려집니다. 데이터 경합이 없어도 이런 일이 생길 수 있으며, 어떻게 확인하고 줄이나요?](/tech-interview/questions/cpu-cache-false-sharing/)
