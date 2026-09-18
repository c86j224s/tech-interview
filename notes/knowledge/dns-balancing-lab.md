---
id: dns-balancing-lab
title: DNS와 프록시 분산의 경계 실습
topic: 네트워크
summary: DNS RR·가중 RR·least connections를 캐시·연결 재사용·HTTP/2 stream과 함께 결정적 시뮬레이터로 추적하고 DNS 주소 응답과 health-aware proxy routing을 구분합니다.
questionIds: []
prerequisites: [dns-transition, proxy-boundaries, http-pools]
related: [service-connections, http-multiplexing, health-feedback]
reviewedAt: '2026-09-18'
---

# DNS와 프록시 분산의 경계 실습

## 학습 목표와 실행 범위

이 장의 핵심 질문은 “DNS가 서버를 골라 주었으니 장애 서버도 자동으로 제외되는가?”입니다. 답은 기본적으로 그렇지 않습니다. DNS는 이름에 대한 resource record와 TTL을 응답하고, 클라이언트나 resolver가 그 답을 캐시합니다. 프록시 로드밸런서는 자신이 가진 backend 상태와 선택 정책으로 요청을 분산하고, 실제 통신 실패나 별도의 health check를 기준으로 대상을 제외할 수 있습니다. 이 두 경계를 한 단계로 합치면 DNS가 반환한 주소와 실제 요청의 backend, 그리고 실패를 판정한 주체를 구분하지 못합니다.

함께 구분할 두 번째 경계는 연결입니다. DNS 답이 새 주소로 바뀌어도 이미 열린 TCP 연결은 스스로 다른 주소로 이동하지 않습니다. HTTP/1.1 keep-alive든 HTTP/2 연결이든 요청이 기존 연결에 실리면 새 DNS 질의를 거치지 않을 수 있습니다. HTTP/2에서는 하나의 연결에 여러 stream이 동시에 존재할 수 있으므로 connection 수, stream 수, 요청 수, backend 부하가 서로 같은 숫자가 아닙니다.

이 실습은 외부 DNS, NGINX, HAProxy, TCP/TLS, HTTP/2 frame을 실행하지 않습니다. `examples/knowledge/dns-balancing-lab/`의 Node.js 의존성 없는 결정적 모델만 실행합니다. 공식 문서의 모든 알고리즘과 운영 기능을 재현한다고 주장하지 않고, DNS 답·캐시·proxy 선택·연결 재사용·stream capacity를 비교하는 작은 실험으로 범위를 고정합니다.

## 기본 모델과 선택 단위

먼저 네 가지 선택 단위를 나눕니다.

| 층 | 입력 | 선택 또는 보존하는 상태 | 장애 판단 |
| --- | --- | --- | --- |
| DNS RR | 질의 이름, resolver cache | 주소 목록, TTL | 기본 DNS 응답은 주소 데이터이며 backend health 판정이 아님 |
| Proxy weighted RR | backend weight, health 상태 | 요청마다 선택 cursor | proxy가 제외한 unhealthy backend는 후보에서 빠짐 |
| Proxy least connections | active 연결·요청 수, weight | 현재 부하와 tie-break | proxy가 관찰한 active 상태와 실패 정책에 따름 |
| 연결·HTTP/2 | 목적지 주소, 연결 수명, stream capacity | 열린 소켓과 active streams | 연결 재사용 자체는 DNS 재조회나 health check가 아님 |

NGINX 공식 문서는 upstream의 기본 방식에 대해 “By default, requests are distributed between the servers using a weighted round-robin balancing method.”라고 설명합니다. `least_conn`은 “the server with the least number of active connections, taking into account weights of servers”를 선택하고, 동률에는 weighted round-robin을 사용한다고 명시합니다. 또한 `max_fails`와 `fail_timeout`은 일정 기간의 unsuccessful communication attempts 뒤 server를 unavailable로 보는 passive failure 계약입니다. DNS `resolve`는 domain name에 대응하는 IP 변화를 감시해 upstream configuration을 바꾸는 기능이지, DNS 응답 자체가 backend의 애플리케이션 상태를 검사했다는 뜻이 아닙니다.

HAProxy 3.2 문서의 확인 가능한 HTTP transaction 설명은 server-facing connection이 “reusable by any request from any client”일 수 있고, incoming HTTP/2에서는 요청을 병렬 처리한다고 설명합니다. 그러나 이번 확인에서 사용한 HAProxy 문서 발췌에는 `balance roundrobin`, `balance leastconn`, `weight`, resolvers와 health-check 정의의 본문이 포함되지 않았습니다. 그러므로 이 노트에서 그 HAProxy 세부 동작을 공식 사실로 확장하지 않고, NGINX 공식 문서와 공통 개념 비교로 한정합니다.

RFC 9113 §5는 stream을 HTTP/2 connection 안에서 교환되는 독립적인 양방향 frame sequence로 정의하고, §5.1.2는 `SETTINGS_MAX_CONCURRENT_STREAMS`로 동시에 활성인 stream 수를 제한할 수 있다고 설명합니다. simulator의 `maxStreams=2`는 이 capacity 개념만 모델링하며 SETTINGS frame 교환이나 TCP의 순서 보장에 따른 head-of-line blocking은 모델링하지 않습니다.

```diagram
{"title":"DNS 답과 프록시 선택의 분리","caption":"DNS는 주소 답을 캐시하고 프록시는 자신의 backend 상태로 요청을 선택합니다. 기존 HTTP/2 연결은 새 DNS 답이 생겨도 자동으로 이동하지 않습니다.","rows":[[{"id":"query","label":"DNS 질의","detail":["이름에 대한 RR","TTL 포함"]}],[{"id":"cache","label":"Resolver·앱 캐시","detail":["TTL 동안 답 보존","기존 답은 즉시 삭제되지 않음"]},{"id":"proxy","label":"프록시 선택기","detail":["weighted RR 또는 least connections","health 상태를 별도 보유"]}],[{"id":"connection","label":"HTTP/2 연결","detail":["여러 stream 공존","기존 목적지 재사용"]},{"id":"backend","label":"Backend","detail":["실제 요청 수신","health 판단 대상"]}]],"edges":[{"from":"query","to":"cache","label":"주소·TTL 응답"},{"from":"cache","to":"connection","label":"새 연결 시 목적지 후보"},{"from":"proxy","to":"connection","label":"proxy 연결·요청 경로"},{"from":"connection","to":"backend","label":"실제 stream 전달"},{"from":"proxy","to":"backend","label":"health-filtered 선택"}]}
```

## Golden 상태 추적

기본 입력은 요청 도착 시각 `0..11`, 서비스 시간 `[8,1,7,2,6,2,9,1,5,3,4,2]`입니다. DNS는 시각 0에 `[A,B]`를 TTL 5로 반환하고, 시각 7에 권한 답이 `[B,C]`로 바뀝니다. 초기 cache는 시각 5에 만료되지만, 그 시각의 권한 답은 아직 `[A,B]`이므로 cache가 `[A,B]`로 다시 채워지고 만료 시각은 10이 됩니다. 따라서 시각 7의 요청도 만료 전 cache를 사용하고, 시각 10에 처음으로 `[B,C]`를 반영합니다. backend weight는 `A=5, B=1, C=1`입니다. 연결은 같은 주소이고 유효 수명과 stream capacity가 남아 있으면 재사용합니다.

실제 실행 전 예측은 다음과 같습니다.

| 요청 | 도착 | DNS cache | DNS 반환 | DNS 전략 선택 | 연결 상태 |
| --- | ---: | ---: | --- | --- | --- |
| req-1 | 0 | 5 | A,B | A | conn-1 재사용 |
| req-2 | 1 | 5 | A,B | B | conn-2 재사용 |
| req-5 | 4 | 5 | A,B | A | 기존 A stream capacity가 차면 conn-3 |
| req-6 | 5 | 10 | A,B | B | TTL 경계에서 새 cache |
| req-8 | 7 | 10 | A,B | B | 답 변경 시각보다 cache가 우선 |
| req-11 | 10 | 15 | B,C | B | 새 답이지만 B 연결 재사용 |
| req-12 | 11 | 15 | B,C | C | C의 새 연결 |

위 표의 핵심은 `dnsReturned`와 `selected`가 같은 종류의 관측이 아니라는 점입니다. DNS 전략에서는 주소 목록에서 순환 선택하므로 backend 상태가 unhealthy인지 별도로 확인해야 합니다. proxy weighted 전략에서는 DNS cache와 무관하게 proxy cursor가 `A` 다섯 번, `B` 한 번, `C` 한 번의 가중 슬롯을 반복합니다. `proxy-rr`라는 별도 이름도 지원하지만, 이 작은 모델에서는 `proxy-weighted`와 동일한 가중 슬롯 규칙을 사용하므로 무가중치 RR의 구현으로 읽으면 안 됩니다. proxy least 전략에서는 매 요청의 active 작업을 서비스 완료 시각으로 해제하며 weight로 정규화한 부하가 가장 낮은 backend를 선택합니다. simulator는 tie-break를 backend ID로 고정해 golden output을 안정화합니다. 실제 프록시의 정확한 tie-break나 재시도 정책을 이 결과에서 추론하지 않습니다.

## 코드 walkthrough

`src/lab.mjs`의 `dnsAnswer`는 시각에 유효한 권한 답을 찾고, `simulate`는 cache 만료 시점에만 이를 state에 반영합니다. 이 state에는 `dnsExpiresAt`, `connections`, `active`, weighted cursor가 따로 있습니다. DNS cache가 바뀌는 것과 connection pool이 비워지는 것은 서로 다른 전이입니다. 입력 검증은 전략명·시간 순서·양의 TTL·backend/connection ID 중복·stream capacity를 먼저 확인해, 재현하기 어려운 상태 오염을 실행 전에 실패시킵니다. 완료 시각이 같은 요청은 다음 도착을 처리하기 전에 모두 해제하고, `activeBefore`는 증가 전 상태를 기록합니다.

`weightedRoundRobin`은 healthy이고 weight가 양수인 backend만 후보로 만들고, 가중치 합의 slot으로 cursor를 매핑합니다. 이것은 NGINX 문서가 설명하는 proportional weighted round-robin을 작은 결정 규칙으로 보여 주는 부분입니다. `selectLeastConnections`는 active 수를 weight로 나누어 가장 작은 후보를 고릅니다. 실제 구현의 active connection 정의, 요청 재시도, health failure window는 제품마다 다를 수 있으므로 이 함수는 운영 알고리즘의 전체 복제가 아닙니다.

`openOrReuseConnection`은 같은 address, `reusableUntil > time`, `activeStreams < maxStreams`를 모두 만족할 때만 connection을 재사용합니다. 따라서 DNS가 B를 새로 반환해도 기존 B connection에 stream 여유가 있으면 그 소켓을 사용할 수 있고, 새 주소 C는 새 연결을 필요로 합니다. 같은 시각에 A로 장기 stream 두 개가 진행 중이면 세 번째 요청은 A backend를 유지하더라도 다른 connection을 만들 수 있습니다. 이것이 HTTP/2의 connection 수와 stream 동시성이 다른 이유를 보여 줍니다.

## 실행 절차와 관찰값

호스트가 파일을 저장소에 반영한 뒤 저장소 루트에서 다음을 실행합니다.

```sh
cd examples/knowledge/dns-balancing-lab
npm test
npm run build
npm run run > run-output.json
```

`npm test`는 일곱 가지를 검증합니다.

1. DNS TTL cache와 답 변경, 주소 선택, 기존 connection 재사용
2. weighted proxy 선택이 DNS TTL과 독립적인지
3. service duration을 반영한 least-connections 선택
4. DNS가 unhealthy 주소를 제거하지 않는지, proxy가 health-filtering하는지
5. 잘못된 시간·전략·중복 ID 입력을 실행 전에 거부하는지
6. 제공된 connection ID와 생성된 ID가 충돌하지 않는지
7. 장기 HTTP/2-style stream이 capacity를 채우면 새 connection을 여는지

실행 결과의 각 request에서 `arrival`, `service`, `dnsReturned`, `dnsCacheExpiresAt`, `selected`, `reused`, `connection`, `doneAt`을 확인합니다. `dnsReturned`가 최신이라는 사실만으로 요청이 그 backend에 도착했다거나 backend가 건강하다는 뜻은 아닙니다. 반대로 proxy가 unhealthy 후보를 제외했다는 사실도 DNS resolver의 답이 바뀌었다는 증거가 아닙니다.

2026-09-18 저장소 코드에서 `node --check`와 `npm test`를 실행하여 7개 테스트를 통과했습니다. 실제 DNS resolver, NGINX/HAProxy process, HTTP/2 network path는 실행하지 않았습니다. 따라서 실행 판정은 “결정적 모델이 현재 Node 환경에서 통과”이며 플랫폼 통합 실행이 아닙니다.

## 실패 주입과 진단

### DNS unhealthy 주소

`backends`에서 B의 `healthy`를 false로 바꾸고 DNS 전략을 실행하면 DNS가 반환한 `[A,B]` 안에 B가 남아 있기 때문에 simulator가 `DNS returned unhealthy backend B`로 중단됩니다. 이것은 실습이 의도적으로 보여 주는 실패입니다. DNS 답의 주소 목록과 proxy health filter를 섞지 않았기 때문입니다.

진단 순서는 다음과 같습니다. 첫째, authoritative 답과 실제 client/resolver cache의 `dnsReturned`를 각각 기록합니다. 둘째, 실제 요청의 remote address 또는 proxy access log에서 `selected`에 해당하는 대상을 확인합니다. 셋째, health check 결과, passive failure window, connection reuse를 별도 시각으로 놓습니다. DNS를 다시 바꾸는 것으로 proxy health 상태나 이미 열린 연결을 고칠 수 있다고 가정하지 않습니다.

### DNS TTL 지연

권한 답이 시각 7에 `[B,C]`로 바뀌어도 cache 만료 전에는 `[A,B]`가 유지됩니다. 이 상태에서 C로 즉시 이동해야 한다는 요구가 있으면 DNS TTL만으로 해결되지 않습니다. resolver cache, runtime cache, connection pool의 생성·유휴·최대 수명을 각각 확인하고, 필요하다면 proxy drain이나 명시적 연결 교체를 설계합니다.

### 긴 HTTP/2 stream

A에 서비스 시간 10인 stream 두 개를 같은 시각에 시작한 뒤 세 번째 요청을 보내면 `conn-1`의 maxStreams=2 때문에 `conn-2`가 만들어집니다. 요청이 새 connection에 갔다는 사실은 DNS가 새 주소를 반환했다는 뜻이 아니라, 기존 connection의 stream capacity가 찼다는 뜻일 수 있습니다. 운영에서는 peer의 `MAX_CONCURRENT_STREAMS`, connection pool 상한, TLS·커널 버퍼, backend active request와 queue를 함께 확인합니다.

### Least-connections 오판

요청 수가 짧은 시간에 균등해 보여도 서비스 시간이 긴 요청이 한 backend에 남아 있으면 active 수가 달라집니다. 이 실습의 least 전략은 completion time을 기준으로 active를 줄입니다. 실제 NGINX `least_conn`은 active connections를 기준으로 하며, 요청이 하나의 HTTP/2 connection에 여러 stream으로 실리는 환경에서는 제품의 측정 단위를 확인해야 합니다. 이 simulator의 active request 대리값을 실제 proxy의 계측값으로 확대하지 않습니다.

### 연결 재사용 오판

이 모델은 먼저 현재 DNS cache에서 주소를 고른 뒤 같은 주소의 연결을 재사용합니다. 따라서 `reused=true`는 새 답에도 남아 있는 주소의 기존 연결을 뜻합니다. 실제 HTTP pool처럼 DNS 조회보다 연결 재사용을 먼저 결정하여 새 답에서 제거된 주소로 계속 보내는 경로는 구현하지 않았습니다. 반대로 `reused=false`라고 해서 DNS가 갱신됐다는 뜻도 아닙니다. stream capacity 부족, 연결 수명 만료, 유효하지 않은 socket 등 여러 이유로 새 연결이 생길 수 있습니다. 실제 진단에는 resolver 응답, connection 생성 시각, remote IP, stream 수, proxy 선택 로그를 함께 남깁니다.

## 운영 설계 결정

DNS RR 또는 weighted RR은 resolver cache와 연결 재사용 때문에 장기 요청 분배를 정확한 비율로 보장하지 않습니다. 가중치는 질의 시점의 주소 후보 선택에 영향을 줄 수 있지만, 한 번 선택된 주소의 연결이 여러 요청을 계속 운반하면 요청·바이트·CPU 비율이 달라집니다. HTTP/2에서는 특히 stream 수와 stream 처리 시간이 connection 수보다 중요한 설명 변수가 됩니다.

health-aware routing이 필요하면 proxy나 service-discovery 계층이 어떤 신호를 authoritative로 삼는지 정합니다. NGINX 공식 문서의 passive `max_fails`/`fail_timeout`처럼 실제 통신 실패를 반영하는 방식과 active health check는 서로 다른 비용·지연·오탐 경계를 가집니다. DNS provider가 별도 health-aware 응답을 제공하는 경우에도 표준 DNS RR 자체가 health 판단을 수행한다고 일반화하지 않고, provider 계약과 관측값을 확인합니다.

HTTP/2 connection을 늘리면 stream capacity로 인한 대기는 줄 수 있지만 TLS handshake, 메모리, 혼잡 창과 backend connection 수가 늘어납니다. 줄이면 재사용 효율은 좋아질 수 있지만 한 연결의 stream 편중과 head-of-line 영향, 특정 backend 고정이 커질 수 있습니다. 결정은 connection 수 하나가 아니라 stream active, request latency, backend queue, error/retry, connection creation rate를 함께 보고 내립니다.

## 버전과 실행 범위

문서 근거는 2026-09-18 확인 기준입니다. RFC 1034와 RFC 9113은 확정 표준 문서로 사용했습니다. NGINX upstream module 공식 문서는 기본 weighted round-robin, `least_conn`, passive failure, resolver TTL과 `resolve`의 주소 변경 감시를 설명하지만 페이지의 모든 동작이 동일한 NGINX release에 묶인다고 추론하지 않습니다. `least_conn`과 `resolve`처럼 문서에 표시된 release 정보는 해당 기능의 문서상 도입·가용성 참고로만 기록합니다.

HAProxy는 공식 3.2 configuration 문서에서 확인 가능한 connection reuse와 HTTP/2 병렬 처리 문구만 인용했습니다. supplied excerpt에서 balance와 resolver 세부 본문을 확인하지 못했으므로 NGINX 문서의 동작을 HAProxy에 복사해 말하지 않습니다. HTTP/2 표준은 `SETTINGS_MAX_CONCURRENT_STREAMS`와 stream multiplexing을 규정하지만, 특정 프록시의 connection reuse 정책이나 scheduling은 구현·설정 범위입니다.

현재 실행은 Node 26 환경의 의존성 없는 순수 simulator와 테스트입니다. 실제 authoritative DNS, recursive resolver, OS/runtime cache, NGINX, HAProxy, TCP/TLS handshake, HTTP/2 frame, health probe, passive failure, retry, drain을 실행하지 않았습니다. 이 실습의 성공은 교육용 상태 모델과 golden trace의 검증이며 실제 플랫폼 integration, production readiness, 모든 공식 기능의 완전한 coverage를 뜻하지 않습니다.

## 참고 자료

- [DNS concepts and facilities, RFC 1034 §3.6](https://www.rfc-editor.org/rfc/rfc1034.html#section-3.6)
- [HTTP/2, RFC 9113 §5](https://www.rfc-editor.org/rfc/rfc9113.html#section-5)
- [HTTP/2 stream concurrency, RFC 9113 §5.1.2](https://www.rfc-editor.org/rfc/rfc9113.html#section-5.1.2)
- [NGINX upstream module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html)
- [NGINX `least_conn`](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#least_conn)
- [NGINX `server` failure parameters](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server)
- [NGINX resolver and `resolve`](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#resolve)
- [HAProxy 3.2 configuration, HTTP transaction model](https://docs.haproxy.org/3.2/configuration.html#1.1)
- [기존 노트: DNS 변경과 기존 연결의 전환 시점](/tech-interview/notes/dns-transition/)
- [기존 질문: L4 로드밸런서 뒤에서 HTTP/2 요청이 특정 서버에 몰립니다](/tech-interview/questions/network-load-balancing-l4-l7/)
- [기존 질문: 외부 HTTP 호출에서 연결 풀이 늘었습니다](/tech-interview/questions/http-connection-pool/)
- [실습 코드 의도 경로](https://github.com/c86j224s/tech-interview/tree/main/examples/knowledge/dns-balancing-lab)
