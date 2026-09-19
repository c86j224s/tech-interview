---
id: dnssec-nsec-denial
title: 존재하지 않는 DNS 이름에 DNSSEC 검증을 적용할 때 NSEC는 무엇을 증명하나요?
difficulty: 중하
category: 네트워크
tags:
  - DNSSEC
  - NSEC
  - NXDOMAIN
  - denial of existence
related:
  - dns-negative-caching
---
# 존재하지 않는 DNS 이름에 DNSSEC 검증을 적용할 때 NSEC는 무엇을 증명하나요?

## 구두 답변

서명된 NSEC는 zone의 canonical 이름 순서에서 다음 이름으로 이어지는 구간과 기존 이름의 record type 목록을 보여 주므로, 요청한 이름이나 유형이 없다는 사실을 authenticated denial로 검증하게 합니다. 단순 NXDOMAIN 문자열이나 resolver cache hit는 누가 그 응답을 만들었는지 증명하지 않습니다.

예를 들어 `alpha.example` 다음이 `omega.example`인 NSEC가 있고 요청한 `beta.example`가 그 사이에 있다면, NSEC와 그 RRSIG가 검증될 때 beta라는 이름이 zone에 없다는 결론을 만들 수 있습니다. 이름 자체는 존재하지만 NSEC type bitmap에 AAAA가 없다면 “이름 부재”가 아니라 “AAAA type 부재”인 NODATA 상황을 따로 판단합니다.

NSEC는 부재를 증명하는 대신 zone의 이름과 type 정보를 노출할 수 있습니다. 따라서 DNSSEC validation과 negative caching은 같은 주제가 아닙니다. NSEC 서명이 맞아도 resolver가 그 결과를 얼마 동안 캐시할지는 TTL과 DNS cache 정책으로 별도 결정합니다.


검증 순서도 중요합니다. 먼저 NSEC 자체와 그 RRSIG가 trust chain에 연결되는지 확인하고, 그다음 요청 이름이 NSEC가 표시한 canonical 빈 구간에 들어가는지 또는 존재하는 이름의 type bitmap에 요청 type이 없는지를 판정합니다. 서명되지 않은 NXDOMAIN만 보고 부재를 확정하면 중간자가 만든 음성 응답을 authenticated denial로 오인할 수 있습니다.
## 득점 포인트

- 이름 부재 NXDOMAIN과 기존 이름의 type 부재 NODATA를 구분합니다.
- NSEC의 canonical 순서·범위와 RRSIG 검증을 연결합니다.
- authenticated denial과 일반 negative cache 저장을 별도 계층으로 설명합니다.

## 감점 포인트

- NXDOMAIN status만 있으면 암호학적 부재 증명이라고 합니다.
- NSEC가 존재하지 않는 모든 이름을 개별 레코드로 나열한다고 설명합니다.
- NSEC 검증 성공이 negative cache의 만료 정책까지 정한다고 합니다.

## 더 파고들 거리

- NSEC chain이 zone 이름 열거를 유발하는 이유와 운영상 완화 선택은 무엇인가요?
- signed denial과 NXDOMAIN subtree caching을 어떤 검증 단계로 분리하나요?
