---
id: "go-full-slice-capacity-boundary"
title: "full slice expression으로 cap을 줄였습니다. append 격리와 기존 원소 수정의 공유는 어떻게 다른가요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","슬라이스","메모리","심화 질문"]
related: ["go-slice-backing-array","go-interface-typed-nil","goroutine-lifecycle-and-leaks"]
promotedFrom: {"id":"go-slice-backing-array","prompt":"full slice expression으로 cap을 제한해도 직접 원소 수정이 공유되는 이유는 무엇인가요?"}
---

# full slice expression으로 cap을 줄였습니다. append 격리와 기존 원소 수정의 공유는 어떻게 다른가요?

## 구두 답변

a[:len:len]처럼 cap을 제한하면 append가 공유 여유를 덮는 것을 줄일 수 있지만 기존 원소는 같은 backing array를 참조합니다. b[0] 변경은 여전히 a[0]에 보일 수 있습니다.

독립 원소 데이터가 필요하면 새 slice를 할당해 copy합니다. 원소가 포인터·map·slice이면 그 내부 공유는 별도입니다. cap 제한 전후 append·직접 수정·재할당·여러 고루틴의 접근을 구분해 검사합니다.

## 득점 포인트

- a[:len:len]처럼 cap을 제한하면 append가 공유 여유를 덮는 것을 줄일 수 있지만 기존 원소는 같은 backing array를 참조합니다. b[0] 변경은 여전히 a[0]에 보일 수 있습니다.
- cap 제한 전후 append·직접 수정·재할당·여러 고루틴의 접근을 구분해 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: a[:len:len]처럼 cap을 제한하면 append가 공유 여유를 덮는 것을 줄일 수 있지만 기존 원소는 같은 backing array를 참조합니다.

## 더 파고들 거리

- [기본 상황과 비교: Go 슬라이스를 다른 변수에 대입한 뒤 복사본의 원소를 바꿨더니 원본도 바뀝니다. 어떤 저장 공간을 공유하며 독립된 복사본은 어떻게 만드나요?](/tech-interview/questions/go-slice-backing-array/)
