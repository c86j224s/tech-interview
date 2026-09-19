---
id: quic-client-migration-new-path
title: QUIC client가 새 네트워크로 이동한 직후 server가 새 주소로 데이터를 보내기 전에 무엇을 확인해야 하나요?
difficulty: 중하
category: 네트워크
tags:
  - QUIC
  - migration
  - path validation
  - 보안
related:
  - quic-zero-rtt-replay
---
# QUIC client가 새 네트워크로 이동한 직후 server가 새 주소로 데이터를 보내기 전에 무엇을 확인해야 하나요?

## 구두 답변

새 path에서 packet이 도착했다는 사실만으로 그 주소를 신뢰하지 않고 path validation을 수행해야 합니다. server는 기존 connection의 CID와 암호화 상태를 찾은 뒤 새 주소를 후보 path로 기록하고, PATH_CHALLENGE를 보내 PATH_RESPONSE를 올바르게 돌려받을 수 있는지 확인합니다. 검증 전에는 큰 응답을 보내지 않아 source spoofing으로 다른 주소에 데이터를 반사시키는 증폭 위험을 제한합니다.

예를 들어 client가 LTE 주소에서 packet을 보냈는데 server가 새 tuple을 처음 봤다고 하겠습니다. 기존 path가 validated였더라도 그 상태를 새 path에 자동 복사하지 않습니다. challenge token에 대응하는 response가 확인되면 새 path를 사용할 수 있지만, 응답이 없거나 token이 맞지 않으면 기존 path를 유지하거나 후보를 폐기합니다. 이때 운영 timeout은 사용하는 QUIC 구현의 정책으로 측정해야 하며 RFC 일반 원칙만으로 특정 밀리초를 단정하지 않겠습니다.

path validation은 client 인증이나 애플리케이션 권한 검사가 아닙니다. 주소로 패킷을 돌려받을 수 있는지를 확인하는 transport 단계이며, connection의 사용자 인증과는 별도입니다.


검증 전의 송신량은 새 주소에서 실제로 응답을 받을 수 있다는 근거가 없으므로 보수적으로 제한해야 합니다. PATH_RESPONSE가 오지 않는다고 즉시 기존 connection을 폐기하는 것도 안전한 기본값은 아닙니다. 기존 path가 아직 살아 있으면 그 경로로 전송을 유지하면서 새 후보의 timeout과 challenge token을 별도 상태로 만료시키는 편이 장애 범위를 줄입니다.
## 득점 포인트

- “새 packet 도착”과 “새 주소 소유·반환 가능성 확인”을 구분합니다.
- PATH_CHALLENGE/PATH_RESPONSE, 검증 전 송신량 제한, path별 상태를 연결합니다.
- path validation을 사용자 인증이나 TLS certificate 검증으로 확대하지 않습니다.

## 감점 포인트

- 기존 path가 검증됐으므로 모든 새 주소도 자동 신뢰한다고 합니다.
- challenge 전에 큰 응답을 보내도 된다고 합니다.
- 실패하면 즉시 새 connection을 만든다고만 말하고 기존 path 보존을 고려하지 않습니다.

## 더 파고들 거리

- NAT rebinding과 의도적인 active migration을 관측·정책에서 어떻게 구분하나요?
- challenge timeout과 기존 path 장애를 어떤 로그로 분리 진단하나요?
