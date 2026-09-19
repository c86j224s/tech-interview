---
id: cpp-concept-short-circuit
title: requires 절의 왼쪽 조건이 false일 때 오른쪽의 잘못된 타입 표현식은 어떻게 다뤄지나요?
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - concepts
  - requires
  - short-circuit
related:
  - cpp-move-semantics
---
# requires 절의 왼쪽 조건이 false일 때 오른쪽의 잘못된 타입 표현식은 어떻게 다뤄지나요?

## 구두 답변

constraint의 `&&`와 `||`는 왼쪽 결과에 따라 오른쪽 constraint를 검사하지 않는 short-circuit 경계를 제공합니다. 먼저 안전한 존재 조건을 검사한 뒤, 그 전제가 있을 때만 후속 표현식을 요구할 수 있습니다.

```cpp
template<class T>
concept HasValueTypeAndSize =
  requires { typename T::value_type; } &&
  requires(T const& x) { x.size(); };
```

`T=int`에서는 첫 type requirement가 false라 오른쪽의 dependent requirement를 평가하지 않는 경로가 됩니다. 이것은 오른쪽에 임의의 파서 오류나 비의존 오류를 넣어도 안전하다는 뜻이 아닙니다. 괄호 오류, 비의존적으로 잘못된 이름, 즉시 문맥 밖의 오류는 constraint short-circuit 전에 프로그램을 깨뜨릴 수 있습니다. `int`에서의 dependent 실패를 hard error라고 단정하지 않고, “왼쪽 false로 후보 제약이 false가 된다”라고 설명하는 것이 정확합니다.

상태를 세 입력으로 나누면 명확합니다. int는 value_type 요구에서 false이므로 size 검사를 건너뜁니다. value_type만 있는 타입은 첫 조건이 true이고 두 번째 조건이 false입니다. 두 멤버가 모두 있는 타입은 전체 조건이 true가 되어 함수 후보가 될 수 있지만 실제 overload 선택과 본문 생성은 그다음 단계입니다. 컴파일 성공 여부만 보지 않고 어느 제약에서 후보가 제외되는지를 읽어야 합니다.

이 규칙은 실행 중 if의 단락 평가와 비슷해 보이지만 템플릿 치환과 제약 만족 단계의 규칙입니다. 존재 검사를 뒤로 옮겨 `sizeof(typename T::value_type)`부터 계산하면 다른 오류 경로를 만들 수 있습니다. 또한 일반 함수로 bool 값을 계산해 반환하는 것과 constraint의 논리식을 정규화하는 것은 동일하지 않습니다. 공통 조건은 명명한 concept으로 재사용해 atomic constraint의 출처를 유지하고, 의미상 더 강해 보이는 수식이 자동으로 subsume될 것이라는 가정은 피하겠습니다.

## 득점 포인트

- 왼쪽 존재 조건이 오른쪽 substitution의 전제가 되는 실제 concept을 제시합니다.
- dependent substitution failure와 비의존 문법·이름 오류를 구분합니다.
- 단계별 named concept이 진단과 재사용성을 개선하는 이유를 말합니다.

## 감점 포인트

- short-circuit가 모든 종류의 오류를 무조건 숨긴다고 설명합니다.
- 이를 런타임 `if`의 실행 제어와 동일시합니다.
- `int`에서 어떤 compiler도 항상 같은 hard-error 문구를 낸다고 단정합니다.

## 더 파고들 거리

- type requirement와 nested requirement를 각각 전제 검사와 semantic 조건 중 어디에 배치할까요?
- `||`로 두 API 모양을 허용할 때 두 분기의 반환 타입과 공통 semantic contract는 어떻게 문서화하나요?
