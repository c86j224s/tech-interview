---
id: dnssec-no-confidentiality
title: DNSSEC 검증이 성공한 DNS 응답을 전송 중 비밀이라고 말할 수 없는 이유는 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - DNSSEC
  - 암호화
  - 기밀성
  - 보안 범위
related:
  - dns-cache-layer-expiry-test
---
# DNSSEC 검증이 성공한 DNS 응답을 전송 중 비밀이라고 말할 수 없는 이유는 무엇인가요?

## 구두 답변

DNSSEC은 RRset의 출처와 무결성, 그리고 NSEC를 이용한 부재 증명을 위한 서명 체계이지 질의와 응답을 암호화하거나 requester 권한을 검사하는 프로토콜이 아니기 때문입니다. DNSSEC가 붙은 A 레코드가 변조되지 않았다는 사실을 검증해도 네트워크 관찰자는 어떤 이름을 조회했는지 볼 수 있습니다. 질의 기밀성이 필요하면 DNS over TLS나 DNS over HTTPS 같은 전송·질의 보호를 별도로 검토해야 합니다.

또한 서명된 공개 레코드를 읽을 수 있는지와 특정 사용자가 애플리케이션 자원에 접근할 수 있는지는 다른 문제입니다. DNSSEC validation success는 TLS certificate validation과도 동일하지 않습니다. resolver가 어느 trust anchor와 chain을 사용했는지, stub이 그 결과를 어떻게 신뢰하는지 별도 경계로 기록하겠습니다.

DNSSEC은 DoS 방어도 제공하지 않습니다. 큰 signed response나 검증 비용이 운영 부하를 만들 수 있으므로, “서명했으니 모든 DNS 보안이 해결됐다”가 아니라 origin authentication이라는 정확한 범위를 말해야 합니다.


예를 들어 resolver가 서명된 `A 192.0.2.10`을 반환해도 관찰자는 질의 이름과 응답 크기를 볼 수 있고, 사용자가 그 주소의 HTTPS 자원에 접근할 권한이 생기는 것도 아닙니다. DoT·DoH는 stub에서 recursive resolver까지의 전송 관찰 경계를 줄일 수 있지만, 응답 데이터의 zone 서명이 올바른지 판단하는 DNSSEC의 역할을 대신하지 않습니다.
## 득점 포인트

- DNSSEC의 integrity·provenance와 confidentiality·authorization을 분리합니다.
- DoT/DoH가 보호하는 전송 관찰 경계와 DNSSEC을 같은 기능으로 섞지 않습니다.
- DNSSEC 검증 성공이 TLS나 애플리케이션 접근 권한을 대신하지 않음을 사례로 설명합니다.

## 감점 포인트

- RRSIG가 있으므로 질의 이름도 숨겨진다고 합니다.
- DNSSEC가 특정 사용자만 레코드를 읽게 만든다고 합니다.
- DNSSEC을 켜면 DDoS가 방어된다고 단정합니다.

## 더 파고들 거리

- recursive resolver에서 검증하고 stub이 결과만 받을 때 신뢰 경계를 어떻게 설정하나요?
- DNSSEC 서명과 DoT/DoH를 함께 사용할 때 각각의 실패를 어떤 로그로 구분하나요?
