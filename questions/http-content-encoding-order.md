---
id: http-content-encoding-order
title: 서버가 JSON 표현에 gzip과 다른 content coding을 차례로 적용했다면 Content-Encoding에는 어떤 순서로 적나요?
difficulty: 하
category: 네트워크
tags:
  - HTTP
  - Content-Encoding
  - 압축
  - 표현
related:
  - http-content-negotiation
---
# 서버가 JSON 표현에 gzip과 다른 content coding을 차례로 적용했다면 Content-Encoding에는 어떤 순서로 적나요?

## 구두 답변

Content-Encoding은 표현에 coding을 적용한 순서대로 나열합니다. 원문 JSON에 coding A를 먼저 적용하고 그 결과에 gzip을 적용했다면 `Content-Encoding: A, gzip`입니다. 수신자는 목록의 역순인 gzip 해제 후 A의 역변환을 수행합니다. 이 헤더는 JSON의 media type이나 HTTP/1.1 전송 framing을 나타내는 헤더가 아닙니다.

예를 들어 원문이 1,000 bytes이고 A를 적용한 결과가 1,400 bytes, gzip 후 420 bytes가 되었다고 하겠습니다. 이 수치는 설명용 계산입니다. 응답은 `Content-Type: application/json`, `Content-Encoding: A, gzip`으로 420-byte representation을 설명합니다. receiver가 목록을 알파벳순으로 바꾸거나 gzip을 먼저 적은 coding으로 해석하면 복원이 실패할 수 있습니다.

`Accept-Encoding`은 client가 처리할 수 있거나 선호하는 coding을 알리는 입력이고, server가 실제 선택한 결과는 Content-Encoding에 나타납니다. server가 압축하지 않고 identity를 선택할 수도 있으므로 Accept 목록과 실제 응답을 같은 값으로 간주하지 않겠습니다.


이 순서는 실제 디코더의 상태 전이로 확인할 수 있습니다. wire body가 420 bytes라면 먼저 gzip decoder가 1,400 bytes의 A-출력으로 되돌리고, 그 결과에 A의 inverse를 적용해 1,000-byte JSON을 얻습니다. 첫 단계에서 JSON parser를 호출하거나 A를 먼저 되돌리면 입력 형식이 맞지 않거나 원문이 복원되지 않습니다.
## 득점 포인트

- coding 목록이 적용 순서이고 decoding은 역순이라는 점을 설명합니다.
- Content-Type·Content-Encoding·Transfer-Encoding을 분리합니다.
- 수치가 있는 작은 바이트 흐름으로 A→gzip→역순 복원을 추적합니다.

## 감점 포인트

- Content-Encoding을 media type이나 chunk 크기라고 합니다.
- 수신자가 헤더 순서대로 decoding하면 된다고 합니다.
- Accept-Encoding에 gzip이 있으면 서버가 반드시 gzip을 선택한다고 단정합니다.

## 더 파고들 거리

- gzip variant와 identity variant를 같은 URL cache에 저장할 때 어떤 요청 조건을 키에 넣나요?
- HTTP/2·HTTP/3에서 HTTP/1.1 chunked framing을 어떻게 구분하나요?
