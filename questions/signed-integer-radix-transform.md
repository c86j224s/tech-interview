---
id: "signed-integer-radix-transform"
title: "음수 정수를 바이트 기반 기수 정렬에 넣습니다. 숫자 순서를 보존하는 unsigned 키는 어떻게 만드나요?"
difficulty: "중하"
category: "알고리즘"
tags: ["계수 정렬","기수 정렬","정렬","심화 질문"]
related: ["counting-radix-sort","sorting-stability"]
promotedFrom: {"id":"counting-radix-sort","prompt":"음수 정수를 정렬 순서가 맞는 unsigned 바이트 키로 변환하는 원리를 말해 보세요."}
---

# 음수 정수를 바이트 기반 기수 정렬에 넣습니다. 숫자 순서를 보존하는 unsigned 키는 어떻게 만드나요?

## 구두 답변

고정 폭 2의 보수 signed 정수라면 부호 비트를 뒤집은 unsigned 표현을 숫자 순서 키로 사용할 수 있습니다. 음수가 unsigned의 큰 값으로 해석되는 기본 순서를 보정하는 것입니다.

byte pass의 순서·endianness를 명시하고 최소·최대·0·음수 1을 기준 정렬과 비교합니다. 부호 있는 overflow를 일으키는 산술 변환은 피합니다. 문자열·부동소수점·가변 폭 정수에는 같은 변환을 그대로 적용할 수 없습니다.

## 득점 포인트

- 고정 폭 2의 보수 signed 정수라면 부호 비트를 뒤집은 unsigned 표현을 숫자 순서 키로 사용할 수 있습니다. 음수가 unsigned의 큰 값으로 해석되는 기본 순서를 보정하는 것입니다.
- 문자열·부동소수점·가변 폭 정수에는 같은 변환을 그대로 적용할 수 없습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 고정 폭 2의 보수 signed 정수라면 부호 비트를 뒤집은 unsigned 표현을 숫자 순서 키로 사용할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 대량의 정수 키를 정렬하려는데 값의 범위와 자릿수를 알고 있습니다. 계수 정렬이나 기수 정렬이 비교 정렬보다 유리한지 무엇을 기준으로 판단하나요?](/tech-interview/questions/counting-radix-sort/)
