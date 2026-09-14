---
id: behavioral-subtyping
title: 행동 치환·상속·조합의 실제 계약
topic: 설계
summary: 사전/사후조건·예외·외부 효과와 타입 variance를 구분하고 직사각형 반례·독립 변화 축·생성 중 언어별 virtual dispatch를 설명합니다.
questionIds: [solid-liskov, variance-behavioral-subtyping, inheritance-composition, constructor-virtual-dispatch-hazard]
---

# 행동 치환·상속·조합의 실제 계약

## 너비 5·높이 4를 설정했는데 면적이 16이 됩니다

부모 Rectangle이 두 크기를 독립적으로 바꿀 수 있다고 약속하면 `setWidth(5); setHeight(4)` 뒤 면적은 20이어야 합니다. Square가 각 setter에서 두 변을 같이 바꾸면 마지막에 4×4=16입니다. 수학적 포함 관계보다 변경 API의 관찰 가능한 계약이 문제입니다.

**리스코프 치환**은 부모를 쓰던 client에 자식을 넣어도 그 계약을 보존하는 조건입니다. 부모보다 입력 사전조건을 강화하거나 보장한 사후조건을 약화하면 안 됩니다. 예외·상태 변화·외부 호출 횟수·명시된 비블로킹 약속도 관찰 계약에 포함될 수 있습니다.

## 타입 Variance는 행동까지 모두 증명하지 않습니다

입력의 반공변·반환의 공변 관계를 만족해도 자식이 부모가 허용한 0을 거절하거나 두 번 결제하면 행동은 달라집니다. 구체 언어의 override·generic variance 지원과 일반 함수 타입 관계도 구분합니다. 타입 검사 통과를 상태·효과 보장의 증명으로 확대하지 않습니다.

| 부모 계약 | 치환 실패 예 |
| --- | --- |
| 음수가 아닌 입력 허용 | 자식은 양수만 허용 |
| 반환 목록 정렬 보장 | 자식은 정렬 안 됨 |
| 전송 한 번·불확정 오류 노출 | 자식이 재전송·오류 숨김 |
| 독립 크기 변경 | 한 setter가 다른 크기도 변경 |

단순히 느리다고 항상 치환 위반은 아닙니다. 부모가 지연 상한·비블로킹을 보장했는지 봅니다. 우연한 구현 세부를 모두 고정하면 대안 구현이 불가능해집니다. client가 의존해도 되는 최소 보장으로 계약 test를 만들고 모든 구현에 적용합니다.

## 독립적으로 바뀌는 책임은 조합할 수 있습니다

Email/SMS/Push×로깅×retry 정책을 상속 계층으로 만들면 조합마다 class가 늘어납니다. Notifier가 Channel·RetryPolicy·Logger를 받아 위임하면 변화 축을 분리할 수 있습니다. 그러나 timeout이 실제 수신 후일 수 있어 retry policy에는 확실한 미전송·불확정·멱등 key 계약이 필요합니다.

```diagram
{"title":"채널과 재시도와 관측을 독립적으로 조합합니다","caption":"화살표는 위임입니다. 조합이 자동으로 중복 전송이나 callback 수명을 해결하지는 않으며 각 협력 계약을 확인합니다.","rows":[[{"id":"notifier","label":"Notifier · 전송 흐름"}],[{"id":"channel","label":"Channel · 외부 전송"},{"id":"retry","label":"RetryPolicy · 실패 의미"}],[{"id":"log","label":"Logger · 안전한 관측"}]],"edges":[{"from":"notifier","to":"channel","label":"전송 위임"},{"from":"notifier","to":"retry","label":"재시도 판단"},{"from":"notifier","to":"log","label":"결과 기록"}]}
```

조합도 객체 생성·추적 비용·순환 callback·재진입 문제가 있습니다. 작은 고정 계층을 무조건 분해하지 않습니다. 상속은 공통 타입의 입력·상태·수명·호출 순서를 모든 자식이 자연스럽게 지킬 때 선택하고 단순 코드 재사용만으로 선택하지 않습니다. 읽기 전용 Shape와 별도 resize 역할로 나누면 Rectangle/Square의 불필요한 변경 계약 충돌을 줄일 수 있습니다.

## 생성 중 Virtual 호출은 언어마다 다릅니다

Java에서 Base 생성자가 override 가능한 `initialize()`를 호출하면 Derived override가 아직 자식 field initializer 실행 전의 기본값 0/null을 읽을 수 있습니다. C++에서는 Base 생성/소멸 단계의 virtual 호출이 아직/더 이상 존재하지 않는 Derived 단계로 같은 방식으로 dispatch되지 않습니다. 현재 생성·소멸 클래스 규칙을 따라야 하며 pure virtual 호출 같은 별도 위험을 피합니다.

두 언어를 하나의 “항상 자식 호출” 규칙으로 설명하지 않습니다. 생성 중 this escape·callback 등록·외부 공개를 피하고 완전히 만들어진 뒤 명시적 start나 factory로 초기화합니다. 이 경우 start 실패·부분 자원 회수와 중복 start도 계약에 포함합니다.

## 부모의 작은 변경이 자식의 숨은 전제를 깨는지 봅니다

template method를 유지한다면 확장 지점·호출 순서·예외 정리를 제한하고 문서화합니다. 모든 subtype에 부모의 유효 입력·예외·수명·효과 test를 적용합니다. 이 노트는 언어 계약과 설계 예시이며 생성 중 dispatch 예제를 이 작업에서 별도로 컴파일한 결과는 아닙니다.
