---
id: certificate-transparency-acme-lifecycle
title: Certificate Transparency·ACME 인증서 수명
topic: 보안
summary: ACME 자동 발급·갱신과 Certificate Transparency 로그·모니터링을 인증서 수명 주기로 연결합니다.
questionIds: []
prerequisites:
  - tls-trust
  - key-rotation
related:
  - tls-trust
reviewedAt: '2026-09-19'
---
# Certificate Transparency·ACME 인증서 수명

TLS 인증서 자동화는 “CA가 새 파일을 발급했다”에서 끝나지 않습니다. 도메인 통제를 증명하는 ACME authorization, order finalize와 인증서 다운로드, 모든 진입점에 대한 배포와 reload, 실제 handshake 확인이 하나의 수명 주기를 이룹니다. Certificate Transparency(CT)는 그 수명 주기에 공개 가시성을 더합니다. 로그가 인증서 또는 precertificate를 append-only 구조에 기록하고 Signed Certificate Timestamp(SCT)를 반환하면, 도메인 소유자는 예상하지 않은 발급을 발견할 기회를 얻습니다.

ACME와 CT는 서로 다른 보안 속성을 담당합니다. ACME는 CA가 신청자에게 도메인 통제 증명을 요구하는 발급 프로토콜이고, CT는 공인 TLS 인증서 발급을 관찰·감사할 수 있게 하는 투명성 시스템입니다. SCT가 있다고 hostname 검증이나 체인 신뢰가 자동으로 성립하지 않으며, ACME order가 valid가 되었다고 모든 load balancer가 새 인증서를 사용한다는 뜻도 아닙니다.

## 인증서 수명 상태

한 도메인의 인증서 상태를 다음처럼 나누면 장애 지점을 숨기지 않을 수 있습니다.

```text
renew_due -> order_created -> authorization_valid
          -> finalized -> certificate_downloaded
          -> distributed -> process_reloaded -> handshake_observed
```

`authorization_valid`는 CA가 요구한 control challenge를 통과했다는 뜻이고, `distributed`는 각 load balancer·region·worker에 파일 또는 secret이 도착했다는 뜻입니다. `handshake_observed`는 실제 클라이언트 경로가 새 인증서와 체인, 기대 hostname을 사용했다는 별도 관찰입니다. 단계마다 retry와 알람의 의미가 다르므로 하나의 `renewal_success=true` 플래그로 합치지 않습니다.

RFC 8555는 ACME account가 order를 만들고, order에 포함된 identifier의 authorization을 얻고, CSR로 finalize한 뒤 발급된 인증서를 다운로드하는 흐름을 설명합니다. CA별 rate limit, 인증서 유효 기간, renewal 권장 창은 이 RFC만으로 특정할 수 없으므로 운영자가 사용하는 CA 정책을 별도로 고정해야 합니다.

## order와 authorization

클라이언트는 원하는 identifier를 포함한 order를 제출합니다. 서버는 아직 유효하지 않은 authorization과 하나 이상의 challenge를 제시하고, 클라이언트는 통제 증명을 준비한 뒤 challenge 응답을 제출합니다. authorization이 valid가 된 후에야 CSR을 제출해 order를 finalize하는 것이 정상 흐름입니다. 발급이 실패하면 단순히 CSR을 다시 보내기보다 어떤 authorization 또는 challenge가 실패했는지 분리해 재시도합니다.

ACME JWS에는 replay 방지를 위한 nonce 계약도 있습니다. 서버가 제공한 `Replay-Nonce`를 사용하고, nonce가 거절된 경우 새 nonce로 유한하게 재시도합니다. 이 nonce는 도메인 통제 challenge와 같은 의미가 아닙니다. 하나는 ACME 요청의 재생을 제한하고, 다른 하나는 신청자가 도메인을 제어하는지 증명합니다.

## HTTP-01과 DNS-01의 통제 경계

HTTP-01은 CA가 특정 도메인의 HTTP 경로로 challenge 응답을 조회해 control을 확인하는 모델입니다. 외부 CDN이나 reverse proxy 뒤에 있다면 해당 경로가 올바른 origin으로 라우팅되고, 모든 edge가 동일한 응답을 내는지 확인해야 합니다. 앱의 일반 인증·사용자 session과 challenge route를 섞지 않고, challenge token이 로그·응답 변환·캐시로 손상되지 않도록 별도 경계를 둡니다.

DNS-01은 도메인에 대응하는 DNS TXT 기록을 설정해 control을 증명하는 모델입니다. 와일드카드처럼 HTTP 경로만으로 처리하기 어려운 범위에 유용하지만 DNS provider API secret이 넓은 zone 권한을 가지기 쉽습니다. 자동화 계정은 필요한 zone과 record만 조작하도록 좁히고, challenge 생성기와 앱 데이터 경로를 분리합니다. DNS 전파 지연과 오래된 TXT record가 남는 경우를 retry와 cleanup 정책에 포함합니다.

```diagram
{"title":"ACME 발급 성공과 서비스 적용을 분리합니다","caption":"authorization과 order가 성공해도 배포·reload·실제 handshake 관찰을 통과해야 운영 완료로 판단합니다.","rows":[[{"id":"control","label":"도메인 통제 challenge","detail":["HTTP-01 또는 DNS-01"]}],[{"id":"order","label":"order valid·CSR finalize","detail":["ACME account·nonce"]}],[{"id":"cert","label":"인증서 다운로드","detail":["체인·키 쌍 확인"]}],[{"id":"serve","label":"배포·reload·handshake","detail":["모든 진입 경로 관찰"]}]],"edges":[{"from":"control","to":"order","label":"authorization valid"},{"from":"order","to":"cert","label":"CA issuance"},{"from":"cert","to":"serve","label":"별도 배포 확인"}]}
```

## 갱신 창과 실패 경로

만료 시점 직전에만 갱신을 시작하면 challenge 오류, CA rate limit, DNS 전파, secret 저장소 장애, 배포 롤백을 처리할 시간이 없습니다. 운영 창은 CA의 유효 기간과 rate limit, 예상 retry 간격, 배포·reload 시간, 업무 시간의 관찰 가능성을 합쳐 정해야 합니다. 이 수치를 여기서 임의로 “만료 30일 전”으로 고정할 수는 없습니다. 중요한 것은 만료까지 남은 시간보다 order부터 모든 진입점의 handshake까지 남은 예산을 측정하는 것입니다.

재시도는 같은 실패를 빠르게 반복해 CA 또는 DNS provider를 압박하지 않도록 backoff와 최대 시도 횟수를 둡니다. authorization이 계속 실패하면 challenge 유형과 외부 관찰 위치를 조사하고, 인증서 파일을 덮어쓰는 단일 cron 작업이 아니라 상태가 남는 renewal job으로 운영합니다. 새 인증서 다운로드 성공 뒤 배포가 실패하면 새 order를 무작정 만들지 말고, artifact·배포·reload 상태를 재개 가능한 작업으로 처리합니다.

긴급한 key compromise는 정상 갱신과 다른 흐름입니다. 새 키와 인증서를 발급한 뒤 기존 인증서의 영향 범위와 철회 정책을 확인하고, 모든 경로가 새 키를 제공하는지 검증합니다. 이미 열린 TLS 연결과 session ticket이 새 인증서를 즉시 다시 검사한다는 보장은 없으므로 연결 drain, ticket 수명, 재인증 정책을 별도로 결정합니다.

## CT 로그와 SCT

CT 로그는 인증서 또는 precertificate를 leaf로 넣는 append-only 구조를 유지하고, 로그가 제출을 수락하면 SCT를 반환합니다. RFC 9162는 Merkle tree, inclusion proof, consistency proof, Signed Tree Head 같은 구조를 정의합니다. inclusion proof는 특정 leaf가 특정 tree root에 포함되는지 확인하고, consistency proof는 이전 tree가 새 tree의 prefix로 유지되는지 확인하는 데 사용됩니다.

SCT는 특정 로그가 제출을 받은 시점에 대한 서명된 증거입니다. 이것은 “이 인증서가 로그에 알려졌다”는 transparency 속성을 제공하지만, 발급자가 정당했는지, SAN이 서비스 hostname과 맞는지, trust store가 체인을 신뢰하는지, 서버가 해당 API에 권한이 있는지를 대신하지 않습니다. 유효한 SCT가 붙은 `other.example` 인증서를 `shop.example` 서비스에서 수락해서는 안 됩니다.

또한 SCT가 있다고 곧바로 로그의 append-only 성질이 운영자에게 완전히 검증된다는 뜻은 아닙니다. 모니터는 SCT와 로그 조회, 필요하면 inclusion·consistency proof를 확인하며 로그 운영 상태를 평가해야 합니다. 현재 브라우저의 CT enforcement와 로그 운영 정책은 플랫폼·시점별로 달라질 수 있으므로 이 장의 RFC 설명과 제품 정책을 구분합니다.

## 오발급 탐지와 대응

도메인 소유자는 자신이 승인한 CA, DNS 이름, SAN 패턴, 예상 SPKI 또는 키 계열을 정책으로 저장하고 CT 관측 결과와 비교합니다. 알 수 없는 CA, 예상하지 않은 wildcard, 승인되지 않은 SAN, 낯선 공개키가 나오면 먼저 로그 관측 누락과 실제 발급을 구분하고, 해당 인증서가 어느 서비스나 DNS 변경과 연결되는지 조사합니다.

탐지 뒤의 조치는 자동화하되 한 단계로 뭉치지 않습니다. CA에 철회 요청, 서비스에서 해당 키와 인증서 교체, 비밀 저장소 접근 조사, DNS·ACME account 변경 검토, affected hostname과 기간 계산을 각각 기록합니다. CT 모니터가 경고를 보냈다고 이미 발급된 인증서가 자동으로 무효화되는 것은 아닙니다. 철회 전파와 클라이언트의 revocation 처리도 별도 관찰이 필요합니다.

모니터링은 모든 로그를 즉시 완전히 본다고 가정하지 않고 수집 지연과 로그 목록 변경을 고려합니다. 알림에는 인증서 fingerprint, issuer, SAN, 발견 시각, 관찰한 로그와 예상 정책을 담되 private key나 ACME account key를 남기지 않습니다. 승인된 갱신과 오발급의 분류 결과를 추적할 수 있어야 경보 피로를 줄일 수 있습니다.

## 키 rollover와 배포 검증

인증서 공개키를 바꾸는 갱신은 서버 파일의 교체만이 아니라 pinning, mTLS trust, backend allowlist, HSM 또는 secret manager 참조를 함께 살펴야 합니다. 구·신 키를 잠시 모두 허용할지, 어떤 클라이언트가 새 키를 알게 된 뒤 서버를 전환할지, 유출 시 구 키를 즉시 차단할지 결정합니다. TLS trust store와 앱 pin은 서로 다른 검증 경로이므로 인증서가 새로 발급됐다고 모든 client가 허용하는 것도 아닙니다.

실제 검증은 새 인증서가 모든 LB와 region에서 제공되는지, 체인 순서가 맞는지, 기대 hostname과 SAN이 맞는지, 오래된 연결·재개 연결의 수명이 정책에 맞는지로 나눕니다. 배포 시스템의 “secret version updated” 이벤트는 증거의 하나일 뿐이고, 외부 합성 probe와 각 내부 진입 경로의 handshake가 완료되어야 서비스 적용을 선언합니다. 실패 시 이전 인증서로 롤백할 수 있지만, 그 키가 유출된 경우 가용성을 위해 되살리는 롤백은 침해 창을 연장할 수 있습니다.

## 비용과 한계

ACME 자동화는 만료 사고를 줄이지만 DNS 권한·HTTP 라우팅·CA rate limit·secret 저장소·배포 권한을 새로 연결합니다. 단일 중앙 계정이 모든 zone을 조작하면 운영은 편해져도 blast radius가 커집니다. 반대로 zone별 계정을 세분화하면 갱신 잡과 권한 관리 비용이 늘어납니다.

CT는 오발급을 발견할 시간을 줄이는 transparency 장치이지 예방·즉시 철회 장치가 아닙니다. 로그를 빠르게 수집해도 모니터의 도메인 정책이 부정확하면 정상 wildcard를 공격으로 오인하거나 실제 SAN을 놓칠 수 있습니다. RFC 8555와 RFC 9162는 프로토콜·자료 구조의 근거이고, CA별 수명·rate limit, 브라우저별 SCT 요구, 조직의 승인 CA 목록은 운영자가 별도로 버전과 책임자를 정해야 할 결정 사항입니다.

## 상태 추적과 구현 계약

갱신 작업은 단일 boolean 대신 `order_id`, authorization별 challenge 상태, 발급 artifact 버전, 배포 대상별 reload 결과를 저장합니다. 예를 들어 authorization이 valid이고 artifact가 `cert-v8`이어도 서울 LB만 `v7`을 제공하면 상태는 성공이 아니라 부분 배포입니다. 다음 retry는 새 order를 만들기보다 `cert-v8` 배포 작업을 재개해야 중복 발급과 CA rate limit 소비를 줄일 수 있습니다.

CT 모니터의 중간 상태도 분리합니다. 새 leaf의 SAN·issuer·SPKI를 정책 inventory와 대조한 뒤, 수집 지연인지 실제 발급인지, 실제 서비스 handshake에서 제공됐는지 순서대로 표시합니다. SCT는 로그가 제출을 받아 append하겠다는 서명된 약속이고, inclusion proof 확인은 그 뒤 단계입니다. 어느 단계도 hostname·chain 검증 결과를 대신하지 않습니다.

HTTP-01은 TCP 80의 well-known 경로가 외부 CA 관찰 지점에서 같은 token을 내는지 확인하고, DNS-01은 `_acme-challenge` TXT가 올바른 zone에 나타나는지 확인합니다. 이 환경에서는 CA 발급이나 배포를 실행하지 않았으므로 아래 상태와 시간축은 설계 trace입니다. 실제 운영에서는 선택한 CA의 rate limit, DNS API의 zone 권한, 클라이언트의 CT enforcement 문서를 버전 고정해 추가 검증해야 합니다.

## 참고 자료와 확인 범위

- RFC 8555, *Automatic Certificate Management Environment (ACME)*. account, order, authorization, challenge, CSR finalize, certificate download와 replay nonce 흐름을 확인했습니다.
- RFC 9162, *Certificate Transparency Version 2.0*. append-only 로그, SCT, Merkle inclusion·consistency proof와 모니터링 목적을 확인했습니다.
- CA별 renewal window·rate limit, 현재 브라우저의 CT enforcement, DNS provider 권한 모델은 특정 공급자를 선택한 뒤 추가 확인해야 합니다.
- 그림과 상태 추적은 운영 설계를 설명하기 위한 모델이며 실제 CA 발급·배포를 실행한 기록이 아닙니다.

### 참고 경로

- [https://www.rfc-editor.org/rfc/rfc8555.html](https://www.rfc-editor.org/rfc/rfc8555.html)
- [https://www.rfc-editor.org/rfc/rfc9162.html](https://www.rfc-editor.org/rfc/rfc9162.html)

위 링크는 개념별 참고 경로이며, 본문에서 명시한 확인 범위와 미확인 구현 조건을 함께 적용합니다.
