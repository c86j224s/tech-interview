---
id: http-compression-cache-variant
title: 같은 URL의 응답을 gzip과 identity로 각각 캐시한다면 어떤 요청 조건과 validator를 함께 구분해야 하나요?
difficulty: 중하
category: 네트워크
tags:
  - HTTP
  - 압축
  - Vary
  - 캐시
  - ETag
related:
  - http-cache-vary
  - http-strong-weak-etag
---
# 같은 URL의 응답을 gzip과 identity로 각각 캐시한다면 어떤 요청 조건과 validator를 함께 구분해야 하나요?

## 구두 답변

핵심은 `Accept-Encoding: gzip`을 “반드시 gzip을 달라”는 명령으로 해석하지 않으면서도, origin의 representation 선택이 그 필드에 의존한다면 cache가 그 조건을 보존하는 것입니다. 그때 응답에는 보통 `Vary: Accept-Encoding`을 두고, cache는 HTTP field matching 규칙에 따라 현재 요청과 저장 variant를 비교해야 합니다. 실제 선택된 coding은 응답의 `Content-Encoding`으로 확인합니다. gzip body와 identity body의 bytes가 다르면 strong ETag를 무조건 공유하지 않고, 실제 validator 비교 계약을 encoding별로 정합니다.

예를 들어 A가 `Accept-Encoding: gzip`으로 `/report`를 요청하고 origin이 420-byte gzip representation을 선택했다고 하겠습니다. B가 identity를 선호하는 요청을 했을 때 CDN이 A의 저장 body를 그대로 주면 B가 해석하지 못할 수 있습니다. 반대로 A도 identity를 받을 수 있습니다. RFC 9110은 identity가 허용될 수 있고 서버가 사용 가능한 coding을 선택하지 않으면 unencoded response를 보낼 수 있다고 설명하므로, 요청에 gzip이 적혔다는 사실만으로 응답 coding을 예측하지 않습니다.

`Vary`는 cache variant 분리 메타데이터이지 사용자별 인가 장치가 아닙니다. warm cache에서 두 요청의 `Content-Encoding`, body bytes, ETag, hit/miss를 함께 관찰해야 합니다. ETag가 논리 자원 버전만 표현하는지 실제 representation bytes를 표현하는지는 서버의 strong/weak validator 계약에 따라 결정합니다.

## 득점 포인트

- `Vary: Accept-Encoding`을 “요청 field가 representation 선택에 참여했다”는 의미로 설명하고 gzip 응답을 강제하는 헤더로 말하지 않습니다.
- 실제 응답의 `Content-Encoding`과 저장 variant를 비교해 gzip client도 identity를 받을 수 있는 조건을 설명합니다.
- gzip·identity의 서로 다른 bytes와 strong ETag, weak comparison의 관계를 구분합니다.

## 감점 포인트

- 요청에 `gzip`이 있으면 origin이 반드시 gzip 응답을 해야 한다고 단정합니다.
- URL이 같으니 cache가 encoding과 무관하게 한 body를 재사용해도 된다고 합니다.
- Vary가 사용자 권한·세션 격리까지 해결하거나 ETag 문자열만 같으면 strong equal이라고 설명합니다.

## 더 파고들 거리

- qvalue와 wildcard가 섞인 `Accept-Encoding`을 CDN이 normalize할 때 실제 field matching과 cache hit cardinality를 어떻게 측정하나요?
- 원본과 CDN이 서로 다른 compression level로 body를 다시 만들면 strong ETag를 유지할지 weak validator로 낮출지 어떤 비교 계약을 세우나요?
