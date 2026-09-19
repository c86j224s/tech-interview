---
id: network-http-content-coding
title: HTTP 콘텐츠 인코딩 협상
topic: 네트워크
summary: >-
  Content-Encoding이 표현에 적용한 변환, Accept-Encoding 협상과 Transfer-Encoding의 분리,
  Vary·ETag를 이용한 압축 variant 캐시를 설명합니다.
questionIds: []
prerequisites:
  - http-cache
related:
  - http-cache
reviewedAt: '2026-09-19'
---
# HTTP 콘텐츠 인코딩 협상

HTTP에서 압축을 이해할 때 먼저 “무엇을 변환했는가”와 “메시지를 어떻게 운반했는가”를 나눠야 합니다. `Content-Type`은 representation의 media type을 말하고, `Content-Encoding`은 그 representation data에 적용한 coding을 말합니다. 반면 HTTP/1.1의 `Transfer-Encoding: chunked`는 전송 framing을 설명합니다. 클라이언트가 `Accept-Encoding`으로 처리 가능한 coding과 선호도를 알리면 서버는 그 협상 결과와 정책에 따라 실제 응답 representation을 선택합니다.

같은 URL이라도 gzip을 지원하는 client와 identity만 처리하는 client가 서로 다른 바이트를 받을 수 있습니다. 이 차이는 cache variant와 validator에 반영되어야 합니다. 압축을 전송 계층의 단순 장식으로 취급하면 cache가 한 표현을 다른 client에게 주거나, ETag의 strong 비교 의미를 실제 표현 bytes와 어긋나게 만들 수 있습니다.

## Representation·media type·coding

HTTP representation data를 개념적으로 `Content-Encoding(Content-Type(bits))`로 생각할 수 있습니다. 먼저 bits를 media type으로 해석할 수 있는 원래 데이터가 있고, 그 데이터에 gzip 같은 content coding을 적용해 전송 표현을 만듭니다. 응답에 `Content-Type: application/json`과 `Content-Encoding: gzip`이 있다면 “gzip 파일”이라는 media type이 아니라 gzip으로 변환된 JSON representation이라는 뜻입니다.

여러 coding을 적용할 때 목록은 적용 순서입니다. 원문에 coding A를 적용하고 그 결과에 gzip을 적용했다면 `Content-Encoding: A, gzip`입니다. 수신자는 반대 순서인 gzip 해제 후 A의 역변환을 수행해야 원래 JSON bytes를 얻습니다. 헤더를 알파벳순으로 정렬하거나 가장 바깥 coding부터 먼저 적는다고 임의 해석하면 디코딩 순서가 바뀝니다.

원본 JSON이 1,000 bytes이고 A 적용 뒤 1,400 bytes, gzip 적용 뒤 420 bytes가 되었다고 하겠습니다. 이 수치는 설명용 계산입니다. wire body 420 bytes만 보고 media type을 `application/gzip`으로 바꾸는 것이 아니라, `Content-Type: application/json`과 `Content-Encoding: A, gzip`으로 복원 계약을 전달합니다.

## Accept-Encoding 협상

`Accept-Encoding`은 client가 이해하거나 선호하는 content coding 목록입니다. RFC 9110 §12.5.3은 각 coding의 선호도와 `identity`의 처리 가능성을 협상 입력으로 설명합니다. 헤더에 `gzip`이 있다고 서버가 반드시 gzip을 사용해야 하는 것은 아닙니다. identity가 허용되고 서버가 압축하지 않기로 선택할 수 있으며, coding을 만들 수 없거나 응답이 이미 압축된 포맷이면 unencoded representation을 보낼 수 있습니다. 반대로 모든 선택지가 명시적으로 허용되지 않으면 서버는 협상 실패를 적절한 응답으로 처리해야 합니다.

예를 들어 `Accept-Encoding: gzip, br`은 client가 두 coding을 처리할 수 있음을 알리지만, 작은 JSON에 identity를 보내는 선택을 금지하지 않습니다. `gzip;q=1.0, identity;q=0.5, *;q=0`처럼 작성된 경우 parser는 명시 항목·wildcard·qvalue를 HTTP 규칙대로 해석해야 합니다. 헤더 부재와 빈 필드의 의미를 임의로 같게 만들지 말고 사용하는 HTTP library의 테스트로 확인합니다. 이 문서는 RFC 9110의 해당 의미론을 기준으로 삼으며, qvalue를 normalize하는 CDN의 내부 정책은 별도 계약입니다.

## Content-Encoding과 Transfer-Encoding

`Content-Encoding`은 representation 변환이며 payload의 의미를 복원하는 단계입니다. `Transfer-Encoding`은 HTTP/1.1 메시지를 현재 연결에서 전송하는 방식이며, chunked는 전체 길이를 미리 알지 못하는 메시지를 chunk와 종료 표식으로 나누는 framing입니다. 수신자는 먼저 HTTP/1.1 chunk framing을 제거하고, 그 다음 content coding을 적용 순서의 역순으로 되돌린다고 설명할 수 있습니다.

HTML을 gzip한 뒤 HTTP/1.1 chunked로 보내는 예는 다음과 같습니다.

```http
Content-Type: text/html
Content-Encoding: gzip
Transfer-Encoding: chunked

<chunk-size>\r\n<gzip bytes>\r\n0\r\n\r\n
```

chunk 크기와 `gzip bytes`의 의미는 서로 다릅니다. chunk 경계는 HTML 문단이나 JSON 객체의 경계를 보장하지 않으며, gzip bytes 내부의 경계도 애플리케이션 message 경계가 아닙니다. HTTP/2·HTTP/3는 HTTP/1.1의 chunked를 같은 wire framing으로 사용하지 않으므로 이 예를 모든 HTTP 버전에 그대로 옮기지 않습니다.

## 압축 책임과 중간 장비

서버·reverse proxy·CDN 중 어느 계층이 압축하는지 먼저 정해야 합니다. 원본 서버가 이미 `Content-Encoding: gzip`을 붙였는데 프록시가 body를 다시 gzip하면 이중 coding이 되고, 프록시가 헤더를 덮어쓰면 수신자는 올바르게 복원하지 못합니다. 반대로 프록시가 client의 Accept-Encoding을 보고 원본의 identity 표현을 변환한다면 그 변환 결과와 validator의 의미를 cache 계약에 반영해야 합니다.

응답이 압축됐는지 확인할 때는 body size만 보지 않습니다. 요청의 `Accept-Encoding`, 응답 `Content-Encoding`, Content-Length 또는 HTTP version의 framing, `Vary`, ETag를 함께 기록합니다. JPEG·PNG·zip처럼 내부 압축된 데이터는 다시 gzip해도 크기가 줄지 않거나 늘 수 있으므로 모든 응답을 압축하기보다 media type·크기·CPU 예산을 조건으로 정합니다.

## Vary와 압축 variant

응답 선택이 `Accept-Encoding` 필드에 따라 달라진다면 `Vary: Accept-Encoding`을 보내 cache에 그 필드가 선택에 참여했음을 알립니다. Vary는 “요청에 gzip이 있으면 반드시 gzip 응답”이라는 지시가 아닙니다. RFC 9110 §12.5.5의 의미는 cache가 현재 요청의 해당 field value와 저장 응답이 생성될 때의 선택 조건을 비교할 수 있도록 secondary key를 확장하는 것입니다. 실제 응답의 `Content-Encoding`은 서버가 선택한 representation이 무엇인지 나타냅니다.

같은 URL `/report`에 A가 `Accept-Encoding: gzip`을 보내고 B가 identity를 선호하는 요청을 보냈다고 하겠습니다. origin이 A에 gzip variant를, B에 identity variant를 선택했다면 cache는 Vary 규칙에 따라 두 요청 조건을 섞지 않아야 합니다. 그러나 A의 헤더에 gzip이 들어 있다는 사실만으로 gzip 응답을 요구한다고 결론 내릴 수는 없습니다. identity가 허용되거나 서버가 사용 가능한 coding을 선택하지 않으면 A도 identity를 받을 수 있으며, 그 실제 선택은 `Content-Encoding`으로 판별합니다.

```diagram
{"title":"표현 선택과 전송 framing의 분리","caption":"Accept-Encoding은 선택 입력이고 Vary는 그 요청 필드가 variant 선택에 참여했음을 기록합니다. 실제 coding은 Content-Encoding에 나타나며 Transfer-Encoding은 HTTP/1.1 운반 단계입니다.","rows":[[{"id":"request","label":"요청 필드","detail":["Accept-Encoding: gzip"]}],[{"id":"select","label":"표현 선택","detail":["gzip 또는 identity"]}],[{"id":"vary","label":"Vary metadata","detail":["선택에 사용한 필드 기록"]}],[{"id":"encode","label":"Content-Encoding","detail":["실제 적용 coding"]}],[{"id":"frame","label":"전송 framing","detail":["HTTP/1.1 chunked 등"]}]],"edges":[{"from":"request","to":"select","label":"협상 입력"},{"from":"select","to":"vary","label":"variant 조건 표시"},{"from":"select","to":"encode","label":"실제 결과 기록"},{"from":"encode","to":"frame","label":"표현 후 운반"}]}
```

## ETag와 실제 표현 바이트

strong ETag는 HTTP가 비교하는 표현의 바이트 동일성 계약과 연결됩니다. gzip과 identity body는 bytes가 다를 수 있으므로, 같은 논리 resource라는 이유만으로 strong validator를 무조건 공유하지 않습니다. 서버가 encoding별로 다른 ETag를 발행하거나, 여러 coding을 하나의 representation으로 취급하는 조건을 명시해야 합니다. GET 재검증에서 weak 비교가 가능한 경우와 If-Match·range처럼 strong comparison이 필요한 사용처도 분리합니다.

cache가 gzip variant를 재검증할 때는 요청의 encoding 선택과 현재 서버 표현을 함께 평가합니다. ETag가 단순히 “자원 버전 7”이라는 문자열이라고 해서 모든 encoding의 body가 strong equal인 것은 아닙니다. 서버·CDN이 body를 재압축한다면 strong 비교를 유지할지 weak validator로 낮출지 문서화해야 합니다. Vary와 ETag는 서로 다른 역할이며, Vary가 사용자별 인가를 대신하지 않습니다.

## 구현·검증 순서

먼저 원본 representation과 content coding을 생성하는 책임을 한 계층에 두고, 각 응답에서 실제 적용 순서와 헤더가 일치하는지 확인합니다. `Accept-Encoding` 부재, `gzip`, `identity`, wildcard, qvalue, 지원하지 않는 coding, 작은 body를 각각 테스트합니다. 같은 URL에 대해 warm cache 상태에서 gzip client와 identity client를 번갈아 요청해 body bytes·Content-Encoding·Vary·ETag가 섞이지 않는지 확인합니다.

프록시 경로는 원본 직결과 나누어 측정합니다. HTTP/1.1의 chunk decoding 후 body decode가 되는지, HTTP/2·HTTP/3에서 chunked 헤더를 잘못 보내지 않는지, 압축 후 Content-Length가 stale하지 않은지 확인합니다. 이 문서의 숫자와 header trace는 설명용이며 실제 서버·CDN 실행 결과가 아닙니다.

## 비용과 한계

압축은 네트워크 bytes를 줄이는 대신 CPU, latency, 메모리 buffer를 사용합니다. 높은 compression level은 작은 응답에서 이득이 없고, streaming 압축은 flush 빈도에 따라 지연과 압축률을 바꿉니다. CDN이 variant를 여러 개 보관하면 cache hit가 분산되고 저장량이 늘어납니다. Vary를 넓게 잡으면 cache가 안전해지는 대신 key cardinality와 miss가 증가합니다.

정확한 negotiation은 RFC 9110의 현재 의미론을 사용하고, RFC 7231의 content coding 설명은 역사적 배경으로만 취급합니다. RFC 9110 §8.4에서 coding 적용 순서, §12.5.3에서 Accept-Encoding과 identity 선택, §12.5.5에서 Vary의 secondary key 의미를 확인했습니다. HTTP/2·HTTP/3 wire framing과 CDN normalization은 해당 제품 문서를 추가로 확인해야 합니다.

## 참고 자료

- RFC 9110, §8.4 Content Codings, §12.5.3 Accept-Encoding, §12.5.5 Vary, §8.8 validators: https://www.rfc-editor.org/rfc/rfc9110
- RFC 7231 §3.1.2.1: obsolete 문서의 content coding 기본 설명과 RFC 9110으로의 계보 확인용: https://www.rfc-editor.org/rfc/rfc7231#section-3.1.2.1
