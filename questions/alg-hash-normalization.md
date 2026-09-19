---
id: alg-hash-normalization
title: 유니코드 문자열을 rolling hash로 비교할 때 원문이 같아 보여도 먼저 정규화해야 하는 이유는 무엇인가요?
difficulty: 중하
category: 알고리즘
tags:
  - rolling hash
  - 유니코드
  - 비교 키
related:
  - unicode-normalization-identifiers
---
# 유니코드 문자열을 rolling hash로 비교할 때 원문이 같아 보여도 먼저 정규화해야 하는 이유는 무엇인가요?

## 구두 답변

rolling hash가 보는 것은 화면의 모양이 아니라 구현이 넘긴 code unit, code point 또는 byte sequence입니다. 그러므로 “사용자에게 같은 문자열로 보이면 같은 키”라는 정책을 선택했다면, hash 전에 모든 입력을 동일한 canonical representation으로 바꿔야 합니다. 예를 들어 하나의 U+00E9인 `é`와 `e` 뒤에 combining acute가 붙은 표현은 표시가 비슷해도 정규화 전 code point와 UTF-8 바이트가 다르므로 prefix hash가 달라질 수 있습니다. 반대로 byte identity가 요구사항이면 정규화하지 않는 것이 맞습니다.

정규화는 충돌을 해결하는 단계가 아니라 hash 입력의 동일성 계약을 정하는 단계입니다. 비교 정책이 정한 정규화 형식과 인코딩을 모든 요청에 같은 순서로 적용하고, 대소문자 접기나 locale 의존 변환을 쓴다면 그것도 명시된 변환으로 고정해야 합니다. 같은 화면 문자열이 요청마다 다른 형식으로 들어오면 캐시 키는 달라지고, 부분 문자열 위치를 반환할 때 canonical representation의 byte offset을 원문 화면의 사용자 문자 위치로 곧바로 사용할 수도 없습니다. 표시용 원문, 비교용 key, offset mapping을 별도 상태로 두는 이유입니다.

정규화된 bytes에서 hash가 같아져도 rolling collision 문제는 남습니다. exact 결과라면 길이와 canonical bytes를 다시 비교하고, hash는 후보를 줄이는 데 사용합니다. 즉 처리 순서는 “동일성 정책 결정 → 표현 변환 → hash 계산 → 필요 시 exact verification”이며, NFC라는 이름만 붙였다고 모든 언어 런타임의 offset·대소문자 동작이 같아지는 것은 아닙니다.

따라서 시스템 경계에서 `input -> canonical bytes -> prefix hash` 단계를 한 번 정하고, 저장할 때 사용한 canonical bytes와 조회 때 만든 bytes가 동일한지 확인해야 합니다. 예를 들어 hash만 저장하고 원문만 나중에 다른 정규화 형식으로 재인코딩하면 캐시 miss가 아니라 논리적으로 다른 키가 됩니다. 또한 정규화로 한 입력의 여러 code point가 결합되거나 분해될 수 있으므로, 검색 결과 offset을 UI에 표시할 때는 canonical index를 원문 범위로 변환하는 표를 유지해야 합니다. 이 부분은 rolling hash의 산술이 아니라 문자열 API의 별도 계약입니다.


## 득점 포인트

- 화면 glyph와 hash 입력 단위가 다르다는 결론을 먼저 제시합니다.
- U+00E9와 결합 문자 표현의 실제 입력 차이를 보여 줍니다.
- 정규화 형식·인코딩·대소문자 정책을 요청 간 일관되게 적용한다고 말합니다.
- canonical key와 표시 원문, offset mapping을 분리합니다.
- 표현 정규화 뒤에도 rolling collision과 exact verification이 남는다고 설명합니다.

## 감점 포인트

- 유니코드 문자열은 언제나 하나의 바이트 표현이라고 가정합니다.
- 화면에서 같아 보이면 hash도 같다고 말합니다.
- 정규화가 수학적 hash collision을 제거한다고 설명합니다.
- locale·대소문자 정책을 요청마다 바꿉니다.
- canonical byte offset을 사용자 문자 offset으로 자동 변환한다고 단정합니다.

## 더 파고들 거리

- 표시 원문과 canonical key 사이의 위치 매핑을 범위 배열로 둘지 grapheme 단위 구조로 둘지 무엇을 기준으로 결정하나요?
- 정규화 문서와 런타임의 문자열 인덱싱 규칙이 다를 때 어떤 부분을 별도 테스트해야 하나요?
