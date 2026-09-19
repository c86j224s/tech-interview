---
id: ct-sct-meaning
title: Certificate Transparency의 SCT가 인증서 신뢰 자체를 대신하지 않는 이유는 무엇인가요?
difficulty: 하
category: 보안
tags:
  - Certificate Transparency
  - SCT
  - TLS
related:
  - tls-certificate-validation
---
# Certificate Transparency의 SCT가 인증서 신뢰 자체를 대신하지 않는 이유는 무엇인가요?

## 구두 답변

SCT는 특정 CT 로그가 인증서 또는 precertificate 제출을 받아 기록할 예정이라는 서명된 시간 증거이지, 그 인증서가 우리 hostname에 맞고 trust chain이 유효하며 발급자가 권한이 있다는 판정이 아닙니다. 따라서 `shop.example`용 연결에서 SAN이 `other.example`인 인증서가 유효한 SCT를 갖고 있어도 hostname 검증에서 거절합니다. SCT는 transparency 속성을 보강하고 TLS authentication을 대체하지 않습니다.

CT 로그는 인증서를 append-only Merkle tree에 넣고 SCT를 반환합니다. 이후 inclusion proof는 특정 leaf가 tree root에 포함되는지, consistency proof는 이전 tree가 새 tree에 일관되게 이어지는지 확인하는 자료입니다. 이 구조는 로그가 발급 기록을 숨기거나 과거 내용을 몰래 바꾸는 일을 감시하는 데 도움을 주지만, 해당 발급이 올바른 CA 정책으로 승인됐다는 업무 인가는 아닙니다. 로그에 보였다는 사실만으로 인증서가 자동 철회되는 것도 아닙니다.

실제 TLS 허용 조건은 신뢰 앵커까지의 체인, 유효 기간과 key usage, 접속 hostname·SAN, 필요한 경우 client 인증과 API 인가를 먼저 검사하고, CT 정책은 그 위에 관찰·감사 조건으로 둡니다. 유효한 SCT가 없을 때의 행동은 브라우저·플랫폼 정책과 서비스 계약을 확인해야 하며, 모든 클라이언트가 같은 강제 규칙을 가진다고 단정하지 않습니다. SCT가 있는 예상 밖 인증서는 모니터링·CA 조사·키 교체·철회를 별도 단계로 처리하겠습니다.


SCT의 시간 순서를 더 엄격히 보면 구분이 분명합니다. 로그가 인증서 또는 precertificate를 받으면 SCT는 로그가 정해진 최대 merge delay 안에 append하겠다는 서명된 promise입니다. 그 순간에는 leaf가 실제 tree에 포함됐는지 아직 inclusion proof로 확인하지 않았을 수 있고, 나중에 Signed Tree Head와 proof를 대조해 포함·일관성을 확인합니다. 그래도 `SAN=other.example`, issuer chain 불일치, 만료 또는 key usage 오류는 TLS 검증에서 별도로 실패합니다. 반대로 `shop.example`의 체인과 hostname이 맞아도 SCT가 없을 때 연결을 허용할지는 클라이언트·플랫폼 정책의 문제이지 RFC 9162의 SCT가 hostname 판정을 대신한다는 뜻이 아닙니다. 따라서 모니터는 SCT 수신, inclusion 확인, 서비스 handshake와 CT enforcement를 네 개의 관측값으로 기록하고, 로그에 나타났다는 사실만으로 발급이 정당하거나 자동 철회됐다고 결론 내리지 않습니다.

## 득점 포인트

- SCT의 transparency evidence와 TLS hostname·chain 신뢰를 구분한다.
- inclusion/consistency proof가 각각 무엇을 검증하는지 설명한다.

## 감점 포인트

- SCT가 있으면 모든 도메인에서 인증서를 신뢰한다.
- CT 로그에 보이면 CA 오발급이 자동 철회된다고 한다.

## 더 파고들 거리

- CT 모니터가 예상치 못한 SAN을 발견한 뒤 어느 순서로 영향 범위를 줄일까요?
- 현재 플랫폼의 SCT 강제 정책과 RFC 정의를 어떻게 분리해 문서화할까요?
