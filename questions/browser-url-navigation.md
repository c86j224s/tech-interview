---
id: browser-url-navigation
title: "브라우저 주소창에 HTTPS 상품 페이지 주소를 입력했습니다. 이름 조회와 서버 연결부터 화면 표시까지 어떤 과정을 거치며, 캐시가 있으면 무엇이 생략될 수 있나요?"
answerMinutes: 5
followups: [{"id":"tls-certificate-validation","prompt":"TCP 연결은 성공했지만 TLS 인증서 hostname이 맞지 않으면 waterfall과 브라우저 오류에서 어느 경계를 확인하나요?"},{"id":"browser-rendering-layout","prompt":"응답 HTML은 빠르게 도착했는데 layout과 paint가 늦다면 네트워크 완료 이후 어떤 비용을 분리해서 보나요?"},{"id":"dns-cache-failover","prompt":"DNS 주소를 바꾼 뒤에도 일부 사용자가 이전 서버에 연결할 때 캐시된 답과 기존 연결을 어떻게 구분하나요?"}]
difficulty: 중하
category: 웹
tags: ["브라우저","URL","DNS","TCP","TLS"]
related: ["dns-cache-failover","tls-certificate-validation","browser-rendering-layout"]
---

# 브라우저 주소창에 HTTPS 상품 페이지 주소를 입력했습니다. 이름 조회와 서버 연결부터 화면 표시까지 어떤 과정을 거치며, 캐시가 있으면 무엇이 생략될 수 있나요?

## 구두 답변

HTTPS 상품 페이지 탐색은 URL 파싱, 이름 해석, 전송 연결, TLS 서버 인증, HTTP 요청·응답, HTML과 리소스 렌더링으로 나누어 설명하는 것이 정확합니다. 캐시와 기존 연결이 있으면 일부 단계가 생략되거나 짧아질 수 있고, 리다이렉트·인증·서브리소스 요청으로 여러 번 반복될 수 있습니다. 프래그먼트는 보통 서버로 보내지지 않고 문서 내부 위치 이동에 사용되므로 요청 대상과 구분합니다.

### 이름과 연결을 준비합니다

브라우저는 입력 문자열을 scheme·host·port·path·query·fragment로 파싱합니다. host가 있으면 브라우저·OS·런타임·리졸버의 DNS 캐시를 확인하고 필요할 때 IP 주소를 질의합니다. DNS가 끝났다고 HTML 요청이 바로 시작되는 것은 아닙니다. 일반적인 HTTPS over TCP에서는 목적지 포트에 TCP 연결을 만들고, TLS handshake에서 암호화 키를 협상하며 인증서의 체인·호스트 이름·기간 등을 검증합니다. DNS는 맞지만 TCP가 차단될 수 있고, TCP는 연결됐지만 TLS 이름 불일치로 실패할 수도 있어 각 경계를 따로 진단합니다. HTTP/3는 QUIC을 사용하므로 TCP 3-way handshake라는 동일 순서를 적용하지 않겠습니다.

### HTTP와 화면 구성을 분리합니다

연결 뒤 브라우저는 HTTP 요청을 보내고 서버·proxy·cache의 응답을 받습니다. 301/302 같은 redirect면 새 URL에 대한 조회·연결이 다시 일어날 수 있고, 조건부 캐시 검증이면 `ETag`나 `Last-Modified`를 보내 304 응답을 받을 수 있습니다. HTML 응답을 받으면 DOM과 CSSOM을 구성하고, CSS·JavaScript·이미지·폰트 같은 서브리소스를 추가 요청합니다. JavaScript가 파싱을 막거나 DOM을 바꾸면 렌더링 단계가 지연·반복될 수 있습니다. DOM과 CSSOM으로 화면 대상을 정한 뒤 layout·paint·합성을 거쳐 첫 콘텐츠와 상호작용 가능한 상태가 서로 다른 시점에 도달합니다.

캐시 적중은 DNS 응답, HTTP 응답, 이미지·스크립트 파일 각각에서 독립적으로 일어날 수 있습니다. 이미 맺은 TCP/TLS 연결이나 HTTP/2 multiplexed connection을 재사용하면 연결 단계를 다시 하지 않을 수 있고, TLS session resumption은 handshake 비용을 줄일 수 있습니다. 하지만 캐시된 HTML이 최신 데이터라는 뜻은 아니므로 Cache-Control과 검증 정책을 함께 봅니다. DNS TTL은 답을 캐시하는 시간이지 이미 열린 TCP 연결의 수명이 아닙니다.

### 지연을 구간별로 관찰합니다

‘페이지가 느리다’고 한 숫자로 묶지 않고 DNS lookup, connection, TLS, request queueing, 서버 대기, response download, parse, script, layout·paint를 waterfall과 Performance 기록에서 분리합니다. 첫 탐색과 재탐색, 같은 origin 연결 재사용, 캐시 cold·warm 조건을 구분하겠습니다. 실패 분석에서는 실제 원격 IP, cache status, redirect 횟수, 브라우저 메인 스레드 작업을 함께 확인합니다.

테스트는 DNS·HTTP·브라우저 캐시를 비운 경우와 적중한 경우, 기존 연결 재사용, redirect, TLS 인증서 오류, 느린 서브리소스와 긴 JavaScript를 비교합니다. URL 입력에서 화면 표시까지는 단일 네트워크 호출이 아니라 여러 계층의 계약이 이어지는 과정이며, 캐시는 그 중 일부만 생략하게 한다는 점이 핵심입니다.

캐시가 있는 경우에도 어떤 검증이 생략됐는지와 최신성이 같은 문제는 아닙니다. 브라우저가 fresh 응답을 사용하면 원 서버를 호출하지 않을 수 있지만, stale-while-revalidate 같은 정책에서는 화면은 이전 값을 먼저 보이고 뒤에서 갱신될 수 있습니다. Service Worker가 있으면 일반 HTTP cache보다 앞에서 요청을 가로채 자체 응답을 만들 수 있으므로 DevTools의 실제 응답 주체를 확인합니다. DNS에서 여러 IP를 얻었다고 모든 연결이 균등하게 분산되는 것도 아니며, connection pool과 HTTP/2 stream이 특정 주소에 계속 붙을 수 있습니다.

## 득점 포인트

- URL·DNS·TCP·TLS·HTTP·렌더링의 경계와 실패 지점을 나눈다.
- HTTP/1.1·2의 TCP 전제와 HTTP/3의 QUIC 차이를 명시한다.
- DNS·HTTP 캐시, 연결 재사용, TLS 재개가 생략하는 단계를 구분한다.
- waterfall과 Performance에서 네트워크·메인 스레드 지연을 분리한다.

## 감점 포인트

- DNS 응답이 오면 HTML이 곧바로 화면에 보인다고 말한다.
- TLS 인증서 검증을 TCP 연결 기능으로 설명한다.
- TTL이 기존 연결을 자동으로 새 주소로 옮긴다고 말한다.
- HTTP/3에도 항상 TCP handshake가 먼저 필요하다고 단정한다.

## 더 파고들 거리

- redirect·조건부 캐시·서브리소스가 waterfall에 만드는 경계를 분석해 보세요.
- TCP 연결 재사용과 TLS session resumption의 시간 절약을 어떻게 비교할까요?
- 첫 콘텐츠 표시와 상호작용 가능 시점을 어떤 브라우저 지표로 검증할까요?
