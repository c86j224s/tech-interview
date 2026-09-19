---
id: dnssec-rrset-rrsig-validation
title: DNS 응답에 RRSIG가 붙어 있으면 resolver는 무엇을 검증하며 레코드 하나가 아니라 RRset을 보는 이유는 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - DNSSEC
  - RRSIG
  - RRset
  - 무결성
related: []
---
# DNS 응답에 RRSIG가 붙어 있으면 resolver는 무엇을 검증하며 레코드 하나가 아니라 RRset을 보는 이유는 무엇인가요?

## 구두 답변

resolver는 RRSIG가 덮는 RRset이 권위 zone의 검증 가능한 DNSKEY로 서명되었는지, 서명 기간과 covered type·owner·class가 응답 데이터와 맞는지를 확인합니다. RRset은 같은 이름·type·class의 레코드 집합이므로, A 레코드 두 개 중 하나가 바뀌거나 빠지면 원래 집합의 서명이 더 이상 맞지 않습니다. RRSIG 필드가 존재한다는 사실만으로 검증 성공이 되지는 않습니다.

예를 들어 `www.example A 192.0.2.10`과 `.11`이 하나의 RRset이었다가 중간자가 `.11`을 `.99`로 바꿨다고 하겠습니다. resolver는 두 주소가 포함된 현재 RRset을 canonical form으로 만들고 RRSIG를 검증하므로 실패합니다. 이렇게 집합 전체를 보는 이유는 DNS 응답의 의미가 단일 문자열이 아니라 같은 owner/type/class의 값 목록으로 정의되기 때문입니다.

또한 서명 검증은 confidentiality나 requester authorization을 제공하지 않습니다. trust anchor에서 DNSKEY chain이 인증되고 그 키가 RRSIG를 검증해야 provenance와 integrity를 말할 수 있습니다.


검증 입력에는 서명 알고리즘과 key tag, signer name, inception·expiration도 포함됩니다. 같은 `www.example A`라도 RRSIG가 다른 type을 covered한다고 표시하거나 현재 시각이 유효기간 밖이면 실패합니다. 반대로 TTL이 아직 남았다는 이유만으로 만료한 RRSIG를 되살릴 수는 없으므로 캐시 수명과 서명 수명을 별도 시계로 기록해야 합니다.
## 득점 포인트

- RRset의 구성 조건과 RRSIG의 covered RRset 검증을 설명합니다.
- 값 변경뿐 아니라 레코드 추가·삭제도 서명 입력을 바꾼다는 사례를 듭니다.
- 서명 존재와 서명 유효성, DNSSEC과 접근 권한을 구분합니다.

## 감점 포인트

- RRSIG 문자열이 있으면 응답을 신뢰한다고 합니다.
- RRset을 A 레코드 하나의 별칭처럼 설명합니다.
- DNSSEC 검증 성공을 암호화나 사용자 인증으로 확장합니다.

## 더 파고들 거리

- 부모 DS와 자식 DNSKEY가 이 RRSIG 검증 전에 어떤 chain을 만드는가요?
- RRSIG expiration과 RRset TTL이 각각 만료될 때 resolver 결과는 어떻게 달라지나요?
