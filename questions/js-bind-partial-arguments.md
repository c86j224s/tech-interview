---
id: "js-bind-partial-arguments"
title: "bind로 this와 앞 인자를 고정했습니다. callback 호출자가 전달한 인자는 어떤 순서로 함수에 도착하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript","this","strict mode","bind","심화 질문"]
related: ["js-this-binding","js-arrow-this"]
promotedFrom: {"id":"js-this-binding","prompt":"bind로 앞쪽 인자를 고정하면 callback API의 나머지 인자는 어떻게 받나요?"}
---

# bind로 this와 앞 인자를 고정했습니다. callback 호출자가 전달한 인자는 어떤 순서로 함수에 도착하나요?

## 구두 답변

bind의 미리 지정한 인자 뒤에 실제 호출 시 인자가 붙습니다. this 고정과 부분 적용을 분리해 이해하고 callback API가 넘기는 event·index 등의 추가 값이 의도한 자리에 오는지 확인합니다.

새 bind 함수는 원래 함수와 정체성이 달라 listener 제거에 같은 참조가 필요합니다. arrow의 this는 bind로 바꿀 수 없는 등 함수 종류별 계약을 구분합니다. 잘못 고정한 인자가 권한·대상 혼동을 만들지 않게 테스트합니다.

## 득점 포인트

- bind의 미리 지정한 인자 뒤에 실제 호출 시 인자가 붙습니다. this 고정과 부분 적용을 분리해 이해하고 callback API가 넘기는 event·index 등의 추가 값이 의도한 자리에 오는지 확인합니다.
- 잘못 고정한 인자가 권한·대상 혼동을 만들지 않게 테스트합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: bind의 미리 지정한 인자 뒤에 실제 호출 시 인자가 붙습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체 메서드를 변수에 담아 호출했더니 this가 달라집니다. strict 환경에서 왜 실패하며 어떻게 고정하나요?](/tech-interview/questions/js-this-binding/)
