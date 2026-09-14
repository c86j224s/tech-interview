---
id: "dns-cache-layer-expiry-test"
title: "DNS TTL을 줄였는데 일부 앱의 주소가 바뀌지 않습니다. resolver·OS·런타임 캐시를 어떻게 나눠 시험하나요?"
difficulty: "중하"
category: "네트워크"
tags: ["DNS","캐시","장애 전환","심화 질문"]
related: ["dns-cache-failover","http-connection-pool"]
promotedFrom: {"id":"dns-cache-failover","prompt":"리졸버·운영체제·런타임의 DNS 캐시 만료를 실제 클라이언트에서 어떻게 검증할까요?"}
---

# DNS TTL을 줄였는데 일부 앱의 주소가 바뀌지 않습니다. resolver·OS·런타임 캐시를 어떻게 나눠 시험하나요?

## 구두 답변

authoritative 응답과 재귀 resolver·OS·런타임·앱 cache의 관측을 각각 기록합니다. TTL 변경은 이미 cache된 값의 남은 수명을 항상 소급 단축하지 않습니다.

실제 사용 client에서 이름 조회·connection 생성·기존 풀 재사용을 분리해 시험합니다. NXDOMAIN·실패 cache도 확인합니다. 새 IP가 조회돼도 기존 연결이 옛 서버에 남을 수 있으므로 DNS 검증만으로 이전 서버 종료를 승인하지 않습니다.

## 득점 포인트

- authoritative 응답과 재귀 resolver·OS·런타임·앱 cache의 관측을 각각 기록합니다. TTL 변경은 이미 cache된 값의 남은 수명을 항상 소급 단축하지 않습니다.
- 새 IP가 조회돼도 기존 연결이 옛 서버에 남을 수 있으므로 DNS 검증만으로 이전 서버 종료를 승인하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: authoritative 응답과 재귀 resolver·OS·런타임·앱 cache의 관측을 각각 기록합니다.

## 더 파고들 거리

- [기본 상황과 비교: DNS를 새 서버 주소로 바꿨는데 일부 클라이언트는 계속 이전 서버에 접속합니다. 왜 그렇고 언제 이전 서버를 내려도 되나요?](/tech-interview/questions/dns-cache-failover/)
