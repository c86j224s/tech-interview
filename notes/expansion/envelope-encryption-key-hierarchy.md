---
id: envelope-encryption-key-hierarchy
title: DEK·KEK 봉투 암호화와 회전
topic: 보안
summary: 데이터키와 키암호화키를 분리해 저장·복호화·회전하는 봉투 암호화 경계를 설명합니다.
questionIds: []
prerequisites:
  - key-rotation
  - secret-delivery
related:
  - authentication
  - file-publication
reviewedAt: '2026-09-19'
---
# DEK·KEK 봉투 암호화와 회전

## 봉투 암호화의 문제 분해

큰 데이터를 중앙 KMS에 직접 보내지 않고 애플리케이션이 데이터 암호화 키(DEK)를 만들고 본문은 DEK로 처리한 뒤 DEK만 키 암호화 키(KEK)로 감싸 저장하는 구조를 봉투 암호화라고 합니다. Google Cloud 문서는 DEK를 데이터 자체의 키, KEK를 DEK를 wrap하는 중앙 키로 구분하고 KEK가 KMS 밖으로 나오지 않는 흐름을 설명합니다.

DEK는 큰 payload와 가까이 두어 빠르게 처리하고 KEK는 적은 수로 중앙 권한·감사·회전 경계를 만듭니다. ciphertext와 `wrapped_dek`를 함께 저장해도 평문 DEK를 DB에 넣으면 보호가 사라집니다. unwrap한 DEK는 요청 수명에 맞춰 메모리에서만 사용합니다.

## DEK·KEK 역할과 저장 형태

쓰기 순서는 `DEK 생성 → DEK로 plaintext seal → KMS KEK로 DEK wrap → ciphertext와 wrapped_dek 저장`입니다. 읽기는 `ciphertext·wrapped_dek·key_id 조회 → KMS unwrap → DEK로 open`입니다. 문서마다 새 DEK를 쓰면 compromise 범위를 줄일 수 있지만 row·파일·tenant 단위 선택은 회수·복구 요구로 정합니다.

Google 문서는 DEK를 locally generate하고 at rest에서 암호화하며 다른 사용자의 데이터를 같은 DEK로 암호화하지 말 것을 권고합니다. 이는 해당 제품 관리 지침이지 모든 시스템의 자동 규칙은 아닙니다.

```diagram
{"title":"DEK와 KEK의 저장·복호화 경계","caption":"본문은 DEK로 처리하고 wrapped DEK만 저장합니다. KEK 원문은 KMS 밖으로 이동하지 않습니다.","rows":[[{"id":"plain","label":"평문 데이터","detail":["문서·파일"]},{"id":"kek","label":"KMS의 KEK","detail":["중앙 권한·감사"]}],[{"id":"dek","label":"로컬 DEK","detail":["짧은 메모리 수명"]}],[{"id":"cipher","label":"ciphertext","detail":["DEK로 암호화"]},{"id":"wrapped","label":"wrapped DEK","detail":["KEK로 wrap"]}],[{"id":"record","label":"저장 레코드","detail":["ciphertext + wrapped + key_id"]}]],"edges":[{"from":"plain","to":"dek","label":"DEK 생성"},{"from":"kek","to":"dek","label":"KMS wrap"},{"from":"dek","to":"cipher","label":"본문 seal"},{"from":"dek","to":"wrapped","label":"DEK wrap 결과"},{"from":"cipher","to":"record","label":"함께 저장"},{"from":"wrapped","to":"record","label":"key_id 저장"}]}
```

`key_id`는 레코드가 임의 KMS URL을 지시하는 값이 아니라 신뢰된 registry의 식별자입니다. tenant를 AAD에 넣을 수 있어도 암호화가 row-level authorization을 대체하지는 않습니다.

## 읽기 경계와 KMS 권한

worker는 주체와 대상 row를 먼저 인가하고 필요한 key ID에만 unwrap을 요청합니다. KMS 호출 권한만으로 row 범위를 결정하면 KMS를 쓸 수 있는 서비스가 모든 tenant를 읽게 됩니다. DB query는 tenant·object·version을 제한하고 KMS는 key version의 unwrap을 맡깁니다.

unwrap 응답의 평문 DEK가 로그·trace·exception·crash dump에 복사되지 않게 합니다. KMS 장애를 이유로 임의 새 DEK를 만들거나 ciphertext를 평문으로 저장하는 fallback은 데이터 손상과 우회입니다. 이미 열린 DEK의 요청 수명 사용, 새 문서 생성 차단, retry budget은 별도 정책입니다.

## KEK 회전과 rewrap

KEK K1에서 K2로 바꾸는 경우 본문이 DEK로 암호화되고 wrapped DEK만 K1에 의존한다면, K1 unwrap 후 같은 DEK를 K2로 다시 wrap할 수 있습니다. 본문 IO와 AEAD 재계산을 피할 수 있지만 row별 완료 추적이 필요합니다.

DEK가 유출됐거나 정책상 키 격리 단위를 바꾸면 rewrap으로는 부족하고 새 DEK로 본문을 re-encrypt해야 합니다. 반면 AAD나 암호문 포맷을 바꾸는 경우에는 기존 DEK로 open한 뒤 새 AAD·포맷으로 다시 seal하는 reseal이 필요하지만, 그 사실만으로 새 DEK가 필수인 것은 아닙니다. 알고리즘 교체도 선택한 프로파일이 기존 DEK와 호환되는지에 따라 reseal과 new-DEK re-encryption을 나눠 결정합니다. K1을 즉시 삭제하면 미처리 row가 열리지 않으므로 `K1 only → 진행 중 → K2 검증 → K1 disable` 상태를 둡니다.

| 변경 원인 | rewrap만 | 본문 재암호화 |
| --- | --- | --- |
| KEK 버전 교체 | 가능 | 보통 불필요 |
| DEK 유출 의심 | 불충분 | 필요 |
| AAD·암호문 포맷 변경 | 불충분 | 기존 DEK reseal 가능; 정책상 키 교체면 new-DEK re-encrypt |
| tenant 격리 단위 변경 | 대개 불충분 | 새 키 경계가 필요하면 new-DEK re-encrypt |

“가능”은 provider API가 자동 제공된다는 뜻이 아닙니다. key version 상태·audit·실패 재시도는 KMS profile로 확인합니다. Google Cloud 문서의 direct Encrypt/Decrypt 64 KiB는 provider-specific 한계로만 읽습니다.

## 장애 중 복호화와 캐시 수명

KMS가 장애인 동안 이미 열린 DEK를 현재 요청까지 쓰는 선택과 무기한 캐시는 다릅니다. 새 문서 생성은 새 DEK wrap이 필요하므로 중단할 수 있습니다. 예를 들어 cache expiry 09:10, 마지막 확인 09:08, stale window 3분이면 `min(09:10,09:11)=09:10`에 중단합니다. key disable이나 revoke 신호는 stale window보다 우선합니다.

retry는 deadline·backoff·jitter와 전체 예산으로 제한하고 복구 뒤 실제 key version과 audit를 확인합니다. 평문 임시 파일은 만들지 않습니다.

## tenant 키 경계와 인가

공용 KEK 아래 tenant별 DEK는 KMS key 수를 줄이지만 key-level blast radius가 넓을 수 있습니다. tenant별 KEK는 disable·위임 경계가 선명하지만 key policy와 백업 복구가 복잡합니다. 탈퇴 시 백업·아카이브·검색 인덱스의 wrapped DEK와 보존 요구를 같이 확인합니다.

키가 다르다는 사실은 DB 행 인가가 아닙니다. 서버가 t2 row를 읽은 뒤 t2 key로 unwrap에 성공하면 암호화는 조회 오류를 고치지 못합니다. principal·tenant·action으로 query를 제한하고 그 뒤 필요한 key만 요청합니다.

## 회전·장애 검증과 한계

K1 row와 K2 row를 함께 두고 rewrap 중단·재개, K1 disable 뒤 미처리 row, 두 worker의 중복 처리를 시험합니다. DEK 유출 시험에서는 old ciphertext가 old DEK로 계속 열리는지와 새 DEK re-encrypt 후 old material 의존 경로가 사라졌는지를 구분합니다.

이 문서의 백만 문서 예는 비용 범위를 설명하는 계산이며 성능 측정이 아닙니다. provider별 키 보존·삭제·복구 기간, IAM 조건, audit event는 이 문서에서 확정하지 않았습니다.

## 참고 자료와 검증 범위

- [Google Cloud: Envelope encryption](https://cloud.google.com/kms/docs/envelope-encryption) — 2026-09-19 본문 확인. DEK·KEK, wrap/unwrap, KMS 경계, direct API 한계.
- 기존 노트 [서명키·API 키의 중첩 교체와 긴급 회수](/tech-interview/notes/key-rotation/) — 중첩 기간과 유출 회수를 대조.
- 기존 노트 [비밀값 전달·재읽기·장애 시 유효 기간](/tech-interview/notes/secret-delivery/) — stale window와 실제 사용 버전을 대조.
