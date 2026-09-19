---
id: quic-nat-rebinding-empty-cid
title: NAT가 같은 QUIC 연결의 client port를 바꿨을 때 zero-length Connection ID가 위험한 이유는 무엇인가요?
difficulty: 중하
category: 네트워크
tags:
  - QUIC
  - NAT rebinding
  - Connection ID
  - 라우팅
related:
  - quic-zero-rtt-replay
---
# NAT가 같은 QUIC 연결의 client port를 바꿨을 때 zero-length Connection ID가 위험한 이유는 무엇인가요?

## 구두 답변

Destination Connection ID가 비어 있으면 수신자가 주소·port tuple을 이용해 connection을 찾아야 하기 때문입니다. NAT가 외부 port를 `5000`에서 `6000`으로 바꾸면 server가 보는 tuple이 달라져 기존 context와 매칭할 별도 identity가 사라집니다. non-empty CID를 유지하면 주소 변경과 connection identity를 분리할 수 있습니다.

예를 들어 client 내부 상태는 그대로인데 NAT mapping만 바뀌었다고 하겠습니다. zero-length CID 연결에서는 새 packet이 기존 연결인지, 같은 주소를 재사용한 다른 연결인지 tuple만으로 판단해야 합니다. RFC 9000은 zero-length CID가 peer migration·NAT rebinding·client port reuse에서 실패를 일으킬 수 있다고 설명합니다. 따라서 CID를 쓰지 않는 단순 배치에서는 주소 기반 연결 수명과 port 재사용 조건을 더 엄격히 관리해야 합니다.

다만 non-empty CID도 만능은 아닙니다. load balancer가 CID를 backend 선택에 사용하지 않거나 backend 간 key·stream 상태를 공유하지 않으면 packet이 올바른 QUIC endpoint에 도달하지 못합니다. CID는 라우팅 identity를 제공하지만 path validation과 실제 state ownership을 대신하지 않습니다.


이것은 곧바로 “zero-length CID는 항상 연결을 끊는다”는 뜻은 아닙니다. NAT가 매핑을 유지하거나 구현이 별도 상태로 새 tuple을 연관하면 계속될 수 있지만, RFC가 제공하는 CID 기반 identity가 없으므로 동시 연결·port 재사용을 안전하게 구별해야 하는 부담이 배포에 남습니다. 판단 로그에는 old/new tuple, CID length, connection lookup 결과를 함께 남깁니다.
## 득점 포인트

- zero-length CID에서 주소 기반 매칭으로 되돌아가는 이유를 설명합니다.
- NAT rebinding과 client port reuse가 tuple만 키로 쓸 때 만드는 모호성을 제시합니다.
- non-empty CID, path validation, backend state의 관계를 분리합니다.

## 감점 포인트

- zero-length CID가 항상 보안 취약점이라고만 말합니다.
- NAT가 port를 바꾸면 QUIC이 반드시 새 handshake를 한다고 합니다.
- CID가 있으면 load balancer state 문제가 사라진다고 단정합니다.

## 더 파고들 거리

- zero-length CID 동시 연결을 주소만으로 구분하기 어려운 조건은 무엇인가요?
- CID retire와 NAT rebinding이 겹칠 때 수신자는 어떤 상태를 보존해야 하나요?
