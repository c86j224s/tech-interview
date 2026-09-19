---
id: aead-nonce-associated-data
title: AEAD nonce·associated data 계약
topic: 보안
summary: 'AEAD의 기밀성·무결성, nonce 유일성, associated data의 인증 범위와 실패 처리를 분리합니다.'
questionIds: []
prerequisites:
  - security-foundations
related:
  - tls-trust
  - input-object-boundary
  - early-data-replay
reviewedAt: '2026-09-19'
---
# AEAD nonce·associated data 계약

## AEAD 계약의 범위

AEAD(Authenticated Encryption with Associated Data)는 평문 기밀성과 ciphertext의 무결성·인증을 묶고 암호화하지 않는 associated data(AAD)도 태그에 결합합니다. RFC 5116은 입력을 key `K`, nonce `N`, plaintext `P`, AAD `A`의 octet string으로 정의하고 ciphertext `C`를 출력합니다. 복호화는 `K,N,A,C`를 받아 인증된 plaintext 또는 `FAIL`을 내놓습니다.

이 계약은 로그인·인가·재생 방지를 자동 제공하지 않습니다. RFC 5116도 anti-replay와 access control은 별도 protocol 문제라고 명시합니다. `open()` 성공은 사용자가 tenant를 읽을 권한이 있다는 뜻이 아니므로 자원 인가를 별도로 검사합니다.

## nonce·key 조합의 유일성

일반 AEAD 계약에서 선택한 프로파일이 zero-length nonce를 쓰지 않는다면, 고정된 key에서 서로 다른 암호화 호출의 nonce는 서로 달라야 합니다. RFC 5116은 예외적으로 특정 key에서 모든 nonce를 zero-length로 쓰는 방식도 허용하지만, 그 경우에도 모든 호출이 일관되게 zero-length여야 하며 알고리즘이 이를 지원해야 합니다. AES-GCM처럼 일반적인 nonce 프로파일을 쓰는 서비스라면 이 예외를 기대하지 말고 nonce 유일성을 상태 계약으로 고정합니다. nonce는 비밀일 필요가 없고 ciphertext와 저장할 수 있지만 같은 key 아래 재사용하지 않는 상태 계약이 필요합니다. 12 octet은 일반 권장 길이지만 실제 길이와 호출 한계는 선택한 프로파일을 확인해야 합니다. “무작위”만으로 유일성이 증명되는 것은 아닙니다.

K7과 counter nonce를 쓰던 프로세스가 crash 뒤 counter를 0으로 초기화하면 같은 `K7,nonce=0`이 다시 생깁니다. 복제 인스턴스가 같은 key로 각자 1부터 세는 경우도 같습니다. 비휘발성 checkpoint, writer별 prefix, key 세대 분리로 유일성을 보장해야 합니다. RFC 5116은 장기 key에서는 nonce를 비휘발성 저장소에 checkpoint하고 여러 장치가 조정해야 한다고 설명합니다.

```diagram
{"title":"AEAD 입력과 nonce 계약","caption":"nonce는 공개 가능해도 고정 key 아래 유일해야 하고 AAD는 평문 밖 문맥을 태그에 묶습니다.","rows":[[{"id":"key","label":"Key K7","detail":["공통 비밀"]}],[{"id":"nonce","label":"Nonce allocator","detail":["재시작·복제에도 유일"]},{"id":"aad","label":"AAD bytes","detail":["tenant·용도·버전"]}],[{"id":"seal","label":"AEAD seal","detail":["P + A + N"]}],[{"id":"open","label":"AEAD open","detail":["성공 또는 FAIL"]}]],"edges":[{"from":"key","to":"seal","label":"고정 key"},{"from":"nonce","to":"seal","label":"유일 N"},{"from":"aad","to":"seal","label":"문맥 인증"},{"from":"seal","to":"open","label":"C·tag 전달"}]}
```

counter를 매번 저장하면 latency가 커지고 앞으로 쓸 범위를 미리 예약하면 유실된 번호가 생길 수 있지만 재사용 방지에는 유리합니다. 여러 writer가 key를 공유할 때 writer ID 재사용과 rollback까지 계약에 포함합니다.

## AAD와 평문 밖의 문맥

AAD는 암호화하지 않지만 인증해야 하는 값입니다. 주소·포트·sequence number·protocol version처럼 처리에 필요해 평문으로 남는 값을 예로 들 수 있습니다. `tenant=t1`, `purpose=invoice`, schema version을 넣으면 ciphertext를 다른 문맥으로 옮기는 변조가 tag 실패가 됩니다.

AAD는 인가 검사가 아닙니다. 서버는 실제 객체의 tenant와 인증 principal을 확인한 후 canonical bytes를 재구성해야 합니다. `{"tenant":"t1","purpose":"invoice"}`와 key 순서가 바뀐 JSON은 의미가 같아도 bytes가 다릅니다. canonical JSON, 고정 binary encoding, 길이 구분 중 하나를 정하고 test vector를 둡니다.

## tag 검증과 실패 경계

AEAD open의 결과는 authenticated plaintext 또는 FAIL입니다. RFC 5116은 길이 오류에서 부분 암호문·부분 복호문을 내보내지 말라고 합니다. 태그 검증 전 buffer를 parser, command dispatcher, cache writer에 넘기면 안 됩니다.

실패는 AAD mismatch, unknown key, nonce 재구성 오류, tag failure를 내부 분류할 수 있지만 외부에 key·plaintext를 노출하지 않습니다. 실패를 이유로 평문 fallback을 두면 변조 data가 상태로 승격됩니다. 성공 신호 뒤에만 schema parsing과 업무 인가를 수행합니다.

## 길이·알고리즘·키 수명

RFC 5116은 공통 인터페이스의 최대 nonce·plaintext·AAD 길이를 정하지 않고 알고리즘과 구현이 제한할 수 있다고 합니다. 따라서 “GCM은 어떤 크기도 된다”고 가정하지 않고 tag 길이, nonce 길이, key size, 최대 입력, 호출량을 선택한 profile에서 고정합니다. NIST SP 800-38D는 GCM IV 구성과 지침을 제공하지만 모든 배포의 운영 한계를 대신 정하지 않습니다.

key 세대와 nonce namespace를 분리하면 복구와 복제 충돌을 줄일 수 있습니다. key 회전은 저장 ciphertext 재암호화를 자동으로 뜻하지 않으므로 old key read/new key write나 일괄 re-encrypt 정책을 별도 결정합니다.

## 구현과 검증 시험

저장 포맷은 algorithm/version, key id, nonce, ciphertext+tag, AAD 재구성 메타데이터를 포함하되 key 원문과 plaintext는 저장하지 않습니다. key id는 신뢰된 registry에서만 해석합니다.

| 변형 | 예상 결과 |
| --- | --- |
| ciphertext 1바이트 변경 | tag failure, 상태 불변 |
| AAD t1→t2 | tag failure |
| 같은 K7·nonce 재사용 | allocator 거절 또는 key 세대 교체 |
| key id 미등록 | 외부 조회·fallback 없이 거절 |
| open 실패 뒤 buffer 사용 | API 경로에서 관찰되지 않음 |

이 숫자와 결과는 설명용 예상이며 실제 암호 라이브러리 실행 결과가 아닙니다. GCM 수치 한계와 운영 profile은 대상 라이브러리 문서를 추가 확인해야 합니다.

## 재시작·복제와 복구 상태

nonce allocator를 애플리케이션 메모리의 정수 하나로 구현하면 복제와 복구에서 유일성을 보장할 수 없습니다. 번호를 DB에서 예약하는 경우에는 예약 후 seal 전에 프로세스가 중단될 수 있으므로 번호를 버리는 것은 허용하되, 예약을 롤백해 재사용하지 않아야 합니다. 여러 writer가 공통 key를 쓰면 writer ID가 재사용되지 않는지, backup 복원으로 counter가 과거로 돌아가지 않는지까지 확인합니다. 복구 epoch를 key 세대나 nonce prefix에 포함하면 오래된 상태 복원과 현재 상태를 구별하는 한 방법이 됩니다.

무작위 nonce를 선택하면 충돌 확률을 계산하고 허용 호출량과 key 수명을 함께 제한해야 합니다. 이 문서에서 특정 확률이나 GCM 호출 상한을 제시하지 않는 이유는 대상 알고리즘 profile과 구현의 계약이 필요하기 때문입니다. 유일성의 증거가 불충분한 경우에는 nonce를 숨기는 대신 key 세대를 짧게 하고, 이미 생성된 ciphertext의 영향 범위를 조사합니다.

## 참고 자료와 검증 범위

- [RFC 5116](https://www.rfc-editor.org/rfc/rfc5116.html) — RFC 5116, January 2008. AEAD, nonce, AAD, FAIL과 부분 plaintext 금지를 원문 txt로 확인.
- [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final) — November 2007. GCM IV 지침의 근거로 사용했으며 특정 수치 한계는 단정하지 않음.
- 기존 노트 [TLS·QUIC 0-RTT의 재생과 업무 멱등성](/tech-interview/notes/early-data-replay/) — AEAD와 애플리케이션 재생의 분리 대조.
