---
id: cpp-string-view-temporary
title: '임시 std::string으로 만든 string_view를 저장하면 왜 길이와 주소가 있어도 안전하지 않나요?'
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - string_view
  - lifetime
  - borrowed-view
related:
  - cpp-object-lifetime-aliasing
  - cpp-coroutine-frame-lifetime
---
# 임시 std::string으로 만든 string_view를 저장하면 왜 길이와 주소가 있어도 안전하지 않나요?

## 구두 답변

`std::string_view`는 `(pointer, length)`를 저장하는 non-owning view라 원본 `std::string`의 수명을 연장하지 않습니다. `std::string_view view = std::string("abc");`에서 full-expression이 끝나면 임시 string이 파괴되고, view의 숫자 필드는 남아도 문자를 소유한 객체는 사라집니다. `size()`가 3을 반환하거나 debugger에서 주소가 살아 보이는 것은 역참조가 정의된다는 증거가 아닙니다. 안전한 선택은 소유 string 반환, 호출자 소유 string을 즉시 소비, 원본이 살아 있을 때 `std::string(view)`로 복사해 장기 보관하는 것입니다. callback과 async task에 view를 캡처할 때도 원본의 lifetime과 재할당을 함께 검토해야 합니다.

중요한 것은 복사하는 시점입니다. 이미 임시 string이 파괴되어 view가 dangling인 뒤에 `std::string(view)`를 호출하면 복사도 유효하지 않은 메모리를 읽으므로 해결책이 아닙니다. 원본이 살아 있는 동안 새 소유 문자열을 만들어야 합니다. `void consume(std::string_view)`가 참조를 보관하지 않고 동기적으로만 읽는다면 `consume(std::string("abc"))`는 임시가 호출을 포함한 full-expression 끝까지 살아 있어 사용할 수 있지만, consume이 view를 전역 캐시나 지연 callback에 저장하면 그 이후는 안전하지 않습니다.

상태로 쓰면 t0에 임시 버퍼 생성, t1에 view 구성, t2에 동기 함수가 길이 3 범위를 읽음, t3에 임시 파괴입니다. t4의 지연 작업은 같은 view를 사용하면 안 됩니다. SSO로 문자가 string 객체 안에 있든 heap에 있든 이 수명 규칙은 같습니다. 저는 읽기 전용 매개변수에는 view를 허용하되 저장 API는 소유 문자열을 받도록 구분하고, 경고·정적 분석과 소유 그래프를 확인합니다. 우연히 원래 문자열이 출력되거나 sanitizer가 잡지 못한 실행은 정의된 동작의 증거가 아닙니다.

## 득점 포인트

- 주소·길이 필드와 원본 object lifetime을 분리합니다.
- full-expression 종료, 지역 string 반환, async capture를 각각 반례로 듭니다.
- 즉시 소비·소유 반환·명시적 복사의 선택 기준을 설명합니다.

## 감점 포인트

- string_view가 임시 string lifetime을 연장한다고 말합니다.
- 포인터와 길이가 남으면 메모리를 읽어도 안전하다고 결론냅니다.
- sanitizer가 한 번 검출하지 못한 것을 defined behavior의 증거로 사용합니다.

## 더 파고들 거리

- SSO 여부와 무관하게 string_view lifetime 오류를 어떻게 재현하지 않고 검증할 수 있나요?
- view를 매개변수로만 허용하고 반환·cache·task 저장을 어렵게 만드는 API는 어떻게 설계하나요?
