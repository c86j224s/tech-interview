---
id: "false-sharing-evidence-experiment"
title: "cache miss 지표가 높습니다. 이것만으로 false sharing을 확정할 수 없으며 어떤 배치 비교가 필요한가요?"
difficulty: "중하"
category: "성능"
tags: ["캐시 라인","거짓 공유","스레드","심화 질문"]
related: ["cpu-cache-false-sharing","process-vs-thread"]
promotedFrom: {"id":"cpu-cache-false-sharing","prompt":"하드웨어 성능 카운터가 거짓 공유를 직접 증명하지 못하는 이유는 무엇인가요?"}
---

# cache miss 지표가 높습니다. 이것만으로 false sharing을 확정할 수 없으며 어떤 배치 비교가 필요한가요?

## 구두 답변

false sharing은 독립적인 데이터가 같은 coherence 단위를 공유하며 쓰기 때문에 서로 무효화하는 경우입니다. cache miss는 용량·충돌·원격 메모리 등 여러 이유로 생기므로 하나의 counter로 확정할 수 없습니다.

카운터 분리·padding·스레드 배치를 바꾸고 같은 연산량에서 coherence traffic·실행 시간·메모리 비용을 비교합니다. padding이 working set을 늘리는 역효과도 측정합니다. 정확성 레이스가 없는지와 성능상의 line 경쟁은 별도로 검사합니다.

## 득점 포인트

- false sharing은 독립적인 데이터가 같은 coherence 단위를 공유하며 쓰기 때문에 서로 무효화하는 경우입니다. cache miss는 용량·충돌·원격 메모리 등 여러 이유로 생기므로 하나의 counter로 확정할 수 없습니다.
- 정확성 레이스가 없는지와 성능상의 line 경쟁은 별도로 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: false sharing은 독립적인 데이터가 같은 coherence 단위를 공유하며 쓰기 때문에 서로 무효화하는 경우입니다.

## 더 파고들 거리

- [기본 상황과 비교: 두 스레드가 서로 다른 카운터만 수정하는데 함께 실행하면 느려집니다. 데이터 경합이 없어도 이런 일이 생길 수 있으며, 어떻게 확인하고 줄이나요?](/tech-interview/questions/cpu-cache-false-sharing/)
