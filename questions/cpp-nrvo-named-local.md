---
id: cpp-nrvo-named-local
title: 'return local과 return T{}의 복사 생략 보장은 왜 다르나요?'
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - NRVO
  - 값 범주
related:
  - cpp-move-semantics
---
# return local과 return T{}의 복사 생략 보장은 왜 다르나요?

## 구두 답변

`return T{};`와 `return local;`은 반환 시점의 객체 상태가 다르기 때문에 보장도 다릅니다. `T{}`는 C++17 이후 목적지에서 직접 구성될 수 있는 prvalue 값 계산입니다. 반면 `local`은 함수 안에서 이미 만들어진 이름 있는 자동 저장 기간 객체이고, 이를 반환 객체와 동일한 객체로 합치는 선택이 NRVO입니다. NRVO가 선택되면 추가 생성이 없어질 수 있지만, 표준이 모든 구현에서 NRVO를 강제하는 것은 아닙니다.

```cpp
T direct() { return T{}; }
T named()  { T local; return local; }
```

`T x = direct();`는 같은 타입의 prvalue 직접 구성 경로입니다. `T y = named();`는 `local`과 반환 객체를 합칠지 먼저 결정하고, 생략되지 않으면 복사 또는 반환 문맥의 암시적 이동 생성자를 요구합니다. 따라서 복사·이동 생성자를 모두 삭제한 타입은 `direct`에서는 가능해도 `named`에서 이식 가능한 성공을 보장할 수 없습니다. `if (ok) return first; return second;`처럼 서로 다른 local을 반환하는 경우에는 더더욱 NRVO에 설계를 걸면 안 됩니다.

`-fno-elide-constructors`는 생략 선택을 관찰하는 실험 옵션이지 보장 규칙 자체를 바꾸는 근거가 아닙니다. 실무에서는 값 반환에 먼저 `return local;`을 쓰고, 비복사 타입이 필요하면 직접 prvalue 경로와 표준 버전을 명확히 구분하겠습니다.

## 득점 포인트

- prvalue 반환은 C++17의 직접 목적지 구성이고, 이름 있는 지역 반환은 선택적 NRVO라는 두 객체 모델을 구분합니다.
- NRVO가 선택되지 않은 경로에서 복사 또는 암시적 이동 생성자가 필요하므로 삭제된 생성자와 컴파일 가능성을 연결합니다.

## 감점 포인트

- C++17이라는 이유만으로 `return local;`이 항상 복사 생략된다고 말하면 안 됩니다.
- `-fno-elide-constructors`의 실험 결과를 표준이 NRVO를 금지하거나 보장한다는 증거로 사용하면 안 됩니다.

## 더 파고들 거리

- 반환 경로가 두 개이고 각각 다른 local을 반환할 때 NRVO 후보와 생성자 요구가 어떻게 달라지는지 작은 예제로 비교해 보세요.
- C++14와 C++17에서 동일한 `return T{};` 코드의 의미와 삭제된 생성자 결과를 별도 빌드로 확인해 보세요.
