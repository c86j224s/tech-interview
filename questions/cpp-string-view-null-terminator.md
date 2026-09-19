---
id: cpp-string-view-null-terminator
title: 문자열 일부의 string_view.data()를 C 문자열 함수에 넘기면 어떤 경계를 잃나요?
difficulty: 중하
category: 언어·런타임
tags:
  - C++
  - string_view
  - C-string
  - null-terminator
related:
  - cpp-object-lifetime-aliasing
  - cpp-coroutine-frame-lifetime
---
# 문자열 일부의 string_view.data()를 C 문자열 함수에 넘기면 어떤 경계를 잃나요?

## 구두 답변

`string_view`의 논리 범위는 `(data, size)`지만 `data()`만 C API에 넘기면 `size` 경계를 잃습니다. `"prefix|payload|tail"`에서 offset 7, length 7인 view는 `payload`를 뜻하지만, `%s`나 `strlen`은 그 길이를 모르므로 뒤의 `|tail`까지 읽고 원본의 null에서 멈출 수 있습니다. 접근 가능한 null이 없다면 종료를 찾으려고 view 밖을 읽어 undefined behavior가 됩니다. 이것은 “조금 긴 출력”일 수도 있는 문제가 아니라, 원본 저장소 상태에 따라 UB가 되는 계약 위반입니다. 길이 기반 API에는 두 인자를 함께 전달하고, null 종료만 받는 API에는 `std::string owned(part); owned.c_str()`로 경계를 복사합니다.

예를 들어 `std::string source="prefix|payload|tail"; std::string_view part(source.data()+7,7);`에서 part.size()는 7이지만 part.data()부터 null까지는 payload와 tail을 포함합니다. 이 예에서는 source가 살아 있고 전체 string이 null 종료되어 있어 과도한 출력이 발생하는 경로를 설명할 수 있습니다. 그러나 길이 7의 배열에 null을 넣지 않은 경우라면 strlen의 반환값을 예상 숫자로 쓰면 안 됩니다. 정의되지 않은 읽기를 실행하여 보여 주는 대신 길이 계약 위반으로 진단해야 합니다.

`write(fd, part.data(), part.size())`처럼 길이를 받는 API도 partial write·오류 처리와 원본 수명은 따로 지켜야 합니다. `printf("%.*s", length, part.data())`는 길이 제한을 줄 수 있지만 int 범위 변환과 내장 null에서의 중단 의미가 있어 임의 바이너리 전송과 같지 않습니다. C API가 포인터를 호출 뒤까지 보관한다면 지역 owned.c_str()도 충분하지 않습니다. 데이터를 어디까지 읽고 언제까지 보관하는지 두 축을 확인한 뒤, 필요한 범위와 수명을 가진 소유 객체를 선택하겠습니다.

## 득점 포인트

- `data`와 `size`를 함께 전달해야 view 경계가 보존된다는 점을 수치 예제로 설명합니다.
- 원본 뒤에 null이 우연히 있는 overread와 null이 없어지는 UB를 구분합니다.
- 길이 기반 API와 C 문자열 API의 안전한 변환을 나눕니다.

## 감점 포인트

- 모든 `data()`가 자동으로 null-terminated라고 말합니다.
- C 함수가 string_view의 `size`를 알아서 읽는다고 가정합니다.
- 한 실행에서 원하는 출력이 나왔으므로 UB가 안전하다고 결론냅니다.

## 더 파고들 거리

- `span<const char>`를 C API에 전달할 때 string_view와 달리 확인해야 하는 계약은 무엇인가요?
- 복사 없이 null 종료를 만족시킬 수 있는 원본 조건과 불가능한 조건을 어떻게 판별하나요?
