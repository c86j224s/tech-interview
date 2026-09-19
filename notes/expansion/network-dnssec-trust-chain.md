---
id: network-dnssec-trust-chain
title: DNSSEC 신뢰 사슬과 검증 범위
topic: 네트워크
summary: >-
  DNSSEC RRset 서명과 RRSIG, trust anchor에서 DS·DNSKEY를 거쳐 자식 zone으로 이어지는 검증, NSEC의
  authenticated denial과 비밀성의 한계를 설명합니다.
questionIds: []
prerequisites:
  - computer-science-foundations
related:
  - dns-transition
reviewedAt: '2026-09-19'
---
# DNSSEC 신뢰 사슬과 검증 범위

DNSSEC은 DNS 응답을 암호화하는 기능이 아니라, resolver가 받은 DNS 데이터가 해당 zone의 권위 있는 서명 키에서 나왔고 전송 중 바뀌지 않았는지 판단하는 서명 체계입니다. 검증 대상은 문자열 하나가 아니라 같은 owner name·record type·class로 묶은 **RRset**(Resource Record Set)이며, 그 RRset을 덮는 RRSIG와 키의 신뢰 경로까지 함께 봅니다. 부모 zone의 DS와 자식 zone의 DNSKEY가 이어져야 trust anchor에서 실제 `www.example` 레코드까지 도달할 수 있습니다.

이 구조는 존재하는 답뿐 아니라 이름이나 유형이 없다는 답에도 적용됩니다. NSEC는 canonical 순서의 다음 이름과 그 이름에 존재하는 유형을 서명된 형태로 드러내어, resolver가 NXDOMAIN 또는 NODATA를 단순한 평문 주장으로 받아들이지 않게 합니다. 반면 DNSSEC 검증 성공만으로 질의 이름의 비밀성, 사용자 권한, DoS 방어를 얻는 것은 아닙니다.

## RRset과 RRSIG의 서명 단위

DNS 응답에 `www.example. A 192.0.2.10`과 `www.example. A 192.0.2.11`이 함께 있으면 resolver는 이를 두 독립 문자열보다 하나의 A RRset으로 다룹니다. 같은 owner name, type, class를 가진 레코드를 canonical form으로 정렬하고 zone signer가 그 집합에 서명합니다. RRSIG에는 covered type, algorithm, key tag, signer name, inception·expiration, signature가 들어갑니다. 따라서 RRSIG 필드가 “붙어 있다”는 존재만 확인해서는 안 되고, 어떤 RRset을 얼마나 오래 어떤 DNSKEY로 덮는지 대조해야 합니다.

원본 RRset이 두 A 레코드였는데 중간자가 하나를 삭제하거나 다른 주소로 바꾸면 canonical RRset의 입력이 달라집니다. 기존 RRSIG가 존재해도 서명 검증 결과는 실패합니다. 반대로 응답에 레코드 하나만 남은 것이 정상적인 별도 signed RRset이라고 오해하면 누락·변조를 놓칠 수 있습니다. validator는 응답 parser가 만든 집합과 RRSIG의 covered type·owner·class를 함께 확인합니다.

## Trust anchor와 위임 순서

validator는 이미 설정된 trust anchor에서 시작합니다. RFC 4033은 resolver가 새로 배운 키를 이전에 알고 있던 인증 키까지 되돌려 인증해야 하며, 최소 하나의 trust anchor가 필요하다고 설명합니다. 이 초기 신뢰는 DNS 메시지가 스스로 주장해서 생성되지 않고 resolver 운영 정책이나 안전한 배포 경로로 설치되어야 합니다.

DS는 부모 zone의 delegation 지점에 존재하며 자식 zone apex의 DNSKEY를 가리키는 digest를 담습니다. 자식은 그 DNSKEY RRset을 자체 키로 서명하고, 그 키에 대응하는 private key로 zone data를 서명합니다. 따라서 순서는 자식 DNSKEY가 부모 DS를 인증하는 방향이 아닙니다. 설명용 사슬은 다음과 같이 읽어야 합니다.

`root trust anchor/root DNSKEY → root가 인증한 .com DS → 일치하는 .com DNSKEY → .com이 인증한 example.com DS → 일치하는 example.com DNSKEY → www.example A RRset의 RRSIG`

RFC 4033이 제시한 일반 형태도 `DNSKEY → [DS → DNSKEY]* → RRset`입니다. 예를 들어 `example.com DS`가 K2의 digest를 가리키는데 자식이 K3만 보내면 DS/DNSKEY 일치가 깨집니다. K2가 맞아도 RRSIG expiration이 지나거나 covered RRset이 달라지면 데이터 단계에서 실패합니다. 여러 key-signing·zone-signing 역할은 이 기본 순서에 추가된 세부 정책으로 분리해 추적합니다.

## DNSKEY·DS·RRSIG 연결

DNSKEY는 zone의 공개 키 RR이고, RRSIG는 RRset을 서명한 결과이며, DS는 부모가 저장하는 child DNSKEY의 요약값입니다. 즉 세 레코드는 같은 일을 반복하지 않습니다.

| 자료 | 저장 위치와 역할 | 다음 검증 단계 |
| --- | --- | --- |
| trust anchor | validator 설정 | root 또는 지정 zone의 첫 신뢰 |
| DS | 부모 delegation | 자식 DNSKEY digest 일치 확인 |
| DNSKEY | 자식 zone | DNSKEY·data RRSIG 검증용 공개 키 |
| RRSIG | 서명된 RRset 주변 | 서명·유효기간 확인 |

`example.com DS`가 DNSKEY K2를 가리키면 부모에서 DS RRset을 인증한 뒤 자식에서 K2를 찾고 digest를 비교합니다. DNSKEY가 자기 자신의 RRset을 서명했다는 사실은 유용한 암호학적 연결이지만, parent DS가 일치하지 않으면 외부 trust chain을 만들지 못합니다. DS가 없는 위임과 digest 불일치는 같은 오류로 합치지 말고, 부모가 signed denial로 insecure를 증명했는지와 secure delegation에서 검증 실패했는지를 구분합니다.

```diagram
{"title":"부모 DS에서 데이터 RRset까지의 검증","caption":"DS는 부모 delegation에 있고 child DNSKEY digest를 가리킵니다. 화살표는 부모 인증, digest 일치, 데이터 서명의 순서를 나타내며 자식 키가 부모 DS를 거꾸로 인증하지 않습니다.","rows":[[{"id":"anchor","label":"Root trust anchor","detail":["resolver가 구성한 시작 신뢰"]}],[{"id":"comds","label":".com DS","detail":["root DNSKEY로 부모 RRset 인증"]}],[{"id":"comkey","label":".com DNSKEY","detail":["DS digest와 일치"]}],[{"id":"exds","label":"example.com DS","detail":[".com이 인증한 delegation"]}],[{"id":"exkey","label":"example.com DNSKEY","detail":["DS와 digest 일치"]}],[{"id":"rrsig","label":"www A RRSIG","detail":["child key로 RRset 검증"]}]],"edges":[{"from":"anchor","to":"comds","label":"부모 서명 확인"},{"from":"comds","to":"comkey","label":"digest 일치"},{"from":"comkey","to":"exds","label":"자식 delegation 인증"},{"from":"exds","to":"exkey","label":"digest 일치"},{"from":"exkey","to":"rrsig","label":"RRset 서명 검증"}]}
```

## NSEC와 부재 증명

일반 DNS의 NXDOMAIN은 resolver가 받은 응답 내용일 뿐, 공격자가 중간에서 만든 것인지 자체로 증명하지 않습니다. DNSSEC zone의 NSEC는 이름을 canonical 순서로 연결하고, 현재 이름에서 어떤 RR type들이 존재하는지 알려주는 signed record입니다. 요청한 이름이 두 기존 이름 사이의 빈 구간에 들어가면 해당 구간에 그 이름이 없다는 사실을 검증할 수 있습니다.

정렬된 이름이 `alpha.example`과 `omega.example`이고 NSEC가 alpha에서 omega를 가리킨다면 beta는 그 사이의 이름입니다. NSEC와 그 RRSIG가 검증되면 beta 부재를 authenticated denial로 만들 수 있습니다. 이름은 존재하지만 AAAA type이 없다면 해당 이름의 NSEC type bitmap에 AAAA가 없다는 증명이 NODATA 판단에 관여합니다. RFC 4033은 NSEC chain이 이름 사이의 빈 공간과 기존 이름의 RRset type을 서명해 name/type non-existence를 인증한다고 설명합니다.

## TTL과 서명 유효기간

DNS 캐시 TTL과 RRSIG의 inception·expiration은 다른 시계입니다. TTL은 resolver가 RRset을 캐시할 수 있는 일반적인 보존 시간이고, RRSIG 기간은 특정 서명이 검증될 수 있는 시간 범위입니다. TTL이 남아 있어도 signature expiration을 넘으면 signed RRset을 secure 데이터로 사용할 수 없습니다. 반대로 RRSIG가 오래 유효해도 TTL이 끝나면 캐시 resolver는 정상 DNS 캐시 규칙에 따라 원본에 다시 질의합니다.

운영 중에는 RRset 갱신과 함께 그 RRset의 RRSIG를 재생성해야 합니다. 새 주소를 추가하고 zone data만 바꾼 뒤 서명을 갱신하지 않으면 validator가 본문과 서명을 불일치로 판단합니다. 재서명 시각, 각 RRset 유효기간, authoritative response TTL을 따로 관찰해야 “캐시가 늦게 갱신됐다”와 “서명이 만료됐다”를 구분할 수 있습니다.

## 검증 상태와 실패 분류

RFC 4033은 secure, insecure, bogus, indeterminate 상태를 구분합니다. secure는 trust anchor와 chain이 있고 모든 서명을 검증한 상태입니다. insecure는 delegation 지점에서 DS 부재가 서명된 방식으로 증명되어 하위 branch가 provably insecure인 상태입니다. bogus는 secure delegation이 있는데 서명 누락·만료·알고리즘 미지원·NSEC와 데이터 불일치 등으로 응답이 검증되지 않는 상태입니다. indeterminate는 해당 영역을 secure로 표시할 trust anchor가 없는 상태입니다.

테스트는 `www.example A` 값 변경, DS가 가리키는 DNSKEY 교체, RRSIG expiration 통과, NSEC 구간의 존재하지 않는 이름, 이름은 있지만 없는 type을 따로 만듭니다. 각 응답에서 `AD` bit 같은 resolver 표시는 관찰 자료이지만 그 bit 하나만으로 client가 모든 신뢰 정책을 충족했다고 단정하지 않습니다. stub, recursive resolver, authoritative server 각각의 검증 위치를 기록합니다.

## 제공하지 않는 보안 속성

DNSSEC 검증에 성공한 질의는 관찰자에게 숨겨지지 않습니다. DNS query와 signed response가 평문으로 전달되는 경로라면 중간 관찰자는 조회 이름과 응답을 볼 수 있습니다. DNSSEC은 requester가 특정 레코드를 읽을 권한이 있는지 검사하지 않으며, 서명된 공개 zone data의 접근 통제도 제공하지 않습니다. DNS over TLS나 DNS over HTTPS는 전송 구간 관찰·변조 경계를 다루지만 DNSSEC의 origin validation과는 별도 기능입니다.

DNSSEC은 DoS 방어도 제공하지 않습니다. 큰 DNSSEC 응답과 서명 검증 비용이 운영 부하를 만들 수 있고, RFC 4033은 cryptographic operation에 기반한 추가 DoS 공격 가능성도 명시합니다. 따라서 “DNSSEC을 켜면 DNS 위조와 DDoS, 질의 비밀성이 모두 해결된다”는 주장은 범위를 벗어납니다.

## 비용과 검증 계획

zone 운영자는 데이터 변경마다 서명 생성, key rollover, DS 상위 위임 변경, signature lifetime 관리가 필요합니다. resolver는 DNSKEY·DS·RRSIG·NSEC를 추가로 질의하고 검증하므로 캐시와 CPU 비용이 증가합니다. key rollover는 새 DNSKEY, 부모 DS, RRSIG 기간이 겹치는 전환 순서를 설계해야 하며, 특정 제품의 자동화 정책은 여기서 확정하지 않습니다.

이 문서의 RRset 예시는 설명용 계산이며 실제 authoritative·recursive resolver를 실행한 결과가 아닙니다. 근거로 RFC 4033 본문에서 RRset 서명, trust anchor, 부모 DS와 child DNSKEY의 순서, NSEC, secure/insecure/bogus/indeterminate 및 confidentiality·access control·DoS 한계를 확인했습니다. 완전한 wire format과 validator 알고리즘은 RFC 4034·4035 및 후속 업데이트를 추가로 읽어 구현 세부를 확정해야 합니다.

## 참고 자료

- RFC 4033, §3.1 trust anchor와 RRset authentication, §3.2 NSEC, §4 제공하지 않는 서비스, §5 DS/DNSKEY chain: https://www.rfc-editor.org/rfc/rfc4033
- RFC 4034·4035: wire format과 validating resolver 동작을 확정할 때 추가 확인할 문서입니다.
