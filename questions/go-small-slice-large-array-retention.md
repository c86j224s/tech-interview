---
id: "go-small-slice-large-array-retention"
title: "큰 배열의 일부만 슬라이스로 보관합니다. 작은 길이가 큰 backing array를 붙잡는 문제를 어떻게 찾고 줄이나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","슬라이스","메모리","심화 질문"]
related: ["go-slice-backing-array","go-interface-typed-nil","goroutine-lifecycle-and-leaks"]
promotedFrom: {"id":"go-slice-backing-array","prompt":"작은 슬라이스가 큰 배열을 붙잡는 보유 경로를 heap profile에서 어떻게 찾을까요?"}
---

# 큰 배열의 일부만 슬라이스로 보관합니다. 작은 길이가 큰 backing array를 붙잡는 문제를 어떻게 찾고 줄이나요?

## 구두 답변

작은 slice는 길이가 작아도 backing array 전체를 참조해 큰 배열 회수를 막을 수 있습니다. 필요한 부분을 새 작은 배열로 복사하면 큰 저장소와 수명을 분리할 수 있습니다.

copy 비용과 이후 보유 기간을 비교하고 포인터 원소를 가진 slice의 삭제 뒤 참조 제거도 확인합니다. heap profile의 보유 경로와 RSS를 나눠 보며 cap을 줄이는 것만으로 backing array가 작아진다고 생각하지 않습니다.

## 득점 포인트

- 작은 slice는 길이가 작아도 backing array 전체를 참조해 큰 배열 회수를 막을 수 있습니다. 필요한 부분을 새 작은 배열로 복사하면 큰 저장소와 수명을 분리할 수 있습니다.
- heap profile의 보유 경로와 RSS를 나눠 보며 cap을 줄이는 것만으로 backing array가 작아진다고 생각하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 작은 slice는 길이가 작아도 backing array 전체를 참조해 큰 배열 회수를 막을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: Go 슬라이스를 다른 변수에 대입한 뒤 복사본의 원소를 바꿨더니 원본도 바뀝니다. 어떤 저장 공간을 공유하며 독립된 복사본은 어떻게 만드나요?](/tech-interview/questions/go-slice-backing-array/)
