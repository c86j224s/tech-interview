---
id: cpp-return-move-nrvo
title: '지역 객체를 반환할 때 std::move를 붙이면 오히려 복사 생략을 방해할 수 있나요?'
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - NRVO
  - 'std::move'
related:
  - cpp-move-semantics
---
# 지역 객체를 반환할 때 std::move를 붙이면 오히려 복사 생략을 방해할 수 있나요?

## 구두 답변

네. 일반적인 값 반환에서 `return std::move(local);`은 NRVO를 보장하는 장치가 아니라, 오히려 NRVO 후보였던 표현식을 xvalue로 바꾸는 선택입니다. `return local;`은 이름 있는 자동 저장 기간 객체를 그대로 반환하므로 NRVO를 시도할 수 있고, 생략되지 않더라도 반환 규칙의 암시적 이동 또는 복사 후보가 남습니다. `std::move(local)`은 “이 객체의 rvalue 표현식”이 되어 반환 객체와 같은 저장 위치로 합치는 NRVO 형태에서 벗어나므로 이동 생성자를 요구하는 경로가 분명해집니다.

```cpp
Buffer make() {
    Buffer local;
    return local;             // NRVO 선택 가능
}
Buffer make_moved() {
    Buffer local;
    return std::move(local);  // NRVO 대상이 아니며 이동 경로
}
```

이동 생성자가 삭제됐거나 접근 불가능하면 두 번째 함수가 컴파일되지 않을 수 있습니다. 이동 생성자가 있더라도 성능이 자동으로 좋아지는 것은 아닙니다. 이동 자체의 비용, `noexcept`, 내부 버퍼의 소유권 이전을 부담하고 NRVO로 없앨 수 있었던 생성자 호출을 남길 수 있습니다. 지역 객체 반환에서는 먼저 `return local;`을 유지하고, 명시적 cast가 꼭 필요한 변환이나 overload 선택이 있을 때만 이유를 기록하겠습니다.

판단은 생성자 로그만으로 하지 않고 표준 모드, 반환 타입, 객체의 자동 저장 기간, 복사·이동 생성자의 접근성까지 확인해야 합니다. 실제 실행 결과를 이 답변의 언어 보장으로 확대하지 않습니다.

## 득점 포인트

- `return local;`은 NRVO 후보이지만 `return std::move(local);`은 xvalue로 바뀌어 NRVO 후보에서 벗어난다는 표현식 차이를 설명합니다.
- 명시적 이동이 이동 생성자 호출과 비용을 남길 수 있으며, `noexcept`와 삭제·접근성까지 컴파일 경계로 연결합니다.

## 감점 포인트

- `std::move`를 붙이면 항상 더 빠르고 복사 생략이 보장된다고 말하면 안 됩니다.
- `return local;`의 생략 실패 가능성을 무시하고 복사·이동 생성자를 모두 삭제한 타입도 항상 컴파일된다고 하면 안 됩니다.

## 더 파고들 거리

- 이동 생성자에 로그를 넣은 타입에서 NRVO 선택과 명시적 xvalue 반환의 관찰 차이를 빌드 옵션별로 비교해 보세요.
- 반환 타입이 지역 타입과 다르고 변환 생성자가 필요한 경우 `std::move`가 overload 선택을 어떻게 바꾸는지 확인해 보세요.
