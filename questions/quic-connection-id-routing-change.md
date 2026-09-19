---
id: quic-connection-id-routing-change
title: QUIC client의 공인 IP와 UDP port가 바뀌었는데 기존 연결을 이어갈 수 있는 이유는 무엇인가요?
difficulty: 하
category: 네트워크
tags:
  - QUIC
  - Connection ID
  - migration
  - NAT
related:
  - quic-zero-rtt-replay
  - http3-quic-streams
---
# QUIC client의 공인 IP와 UDP port가 바뀌었는데 기존 연결을 이어갈 수 있는 이유는 무엇인가요?

## 구두 답변

QUIC peer가 선택한 Connection ID가 주소·port tuple과 별도로 connection identity를 제공하기 때문입니다. Wi-Fi에서 cellular로 이동해 source IP와 UDP port가 모두 바뀌어도, 새 packet이 기존 connection에 유효한 Destination Connection ID를 담고 있으면 server는 기존 암호화 context와 stream 상태를 찾을 수 있습니다. 다만 새 주소는 새 path 후보이므로 path validation을 거쳐야 하고, 서버 앞의 load balancer도 CID를 따라 같은 backend로 보내야 합니다.

예를 들어 기존 tuple이 `203.0.113.10:51000 → server:443`, CID가 `C1`이었다가 cellular에서 `198.51.100.7:62000`으로 바뀌었다고 하겠습니다. server는 tuple이 달라졌다는 이유만으로 새 TCP 연결처럼 처리하지 않고 C1로 connection context를 찾습니다. 이어 새 path에서 응답을 받을 수 있는지 확인한 뒤 전송 경로를 바꿉니다. 이것이 NAT rebinding과 의도적인 client migration을 같은 connection에서 다룰 수 있는 핵심입니다.

반대로 zero-length CID를 사용하면 수신자는 주소와 port에 의존해야 하므로 port 변경 뒤 기존 connection을 매칭하기 어렵습니다. 또 주소 hash만 쓰는 load balancer가 packet을 다른 backend로 보내면 CID가 있어도 backend가 암호화 key와 stream state를 갖지 못해 실패할 수 있습니다.


다만 CID를 찾았다는 것과 새 주소로 응답을 보내도 된다는 것은 다른 판정입니다. 수신 endpoint는 connection table에서 C1을 찾은 뒤 새 source tuple을 path 후보로 저장하고 검증합니다. zero-length CID라면 이 첫 단계가 tuple에 의존하므로 NAT가 `5000→6000`으로 매핑을 바꾼 순간 동일 connection이라는 증거가 줄어듭니다. 또한 server가 active migration을 허용하지 않는 배포라면 client가 이동성 신호를 받도록 계약을 명시해야 합니다.
## 득점 포인트

- CID와 IP·UDP port tuple을 서로 다른 connection 식별 축으로 설명합니다.
- 새 tuple을 기존 context에 연결한 뒤 path validation과 backend routing을 별도로 언급합니다.
- QUIC v1의 client migration과 zero-length CID의 제약을 구분합니다.

## 감점 포인트

- QUIC은 UDP라서 주소가 바뀌면 항상 새 연결이라고 합니다.
- CID만 있으면 모든 NAT·로드 밸런서 환경에서 자동 성공한다고 단정합니다.
- migration을 서버와 client가 언제나 대칭적으로 수행한다고 설명합니다.

## 더 파고들 거리

- 새 path에 PATH_CHALLENGE를 보내고 검증 상태를 기존 path와 어떻게 분리하나요?
- 주소 기반 load balancer가 CID 기반 라우팅으로 바뀌어야 하는 조건은 무엇인가요?
