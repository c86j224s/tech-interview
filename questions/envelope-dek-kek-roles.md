---
id: envelope-dek-kek-roles
title: DEK와 KEK를 왜 분리하며 각각 어디에 사용하나요?
difficulty: 하
category: 보안
tags:
  - 봉투 암호화
  - DEK
  - KEK
related:
  - gitops-secrets-delivery
---
# DEK와 KEK를 왜 분리하며 각각 어디에 사용하나요?

## 구두 답변

DEK와 KEK를 분리하는 이유는 데이터 처리와 중앙 키 통제를 서로 다른 규모·권한으로 운영하기 위해서입니다. DEK(Data Encryption Key)는 문서나 파일을 빠르게 암호화하고, KEK(Key Encryption Key)는 그 DEK를 wrap합니다. 흐름은 로컬 DEK 생성, AEAD 본문 암호화, KMS KEK로 DEK wrap, `ciphertext + wrapped_dek + key_id` 저장입니다.

읽을 때는 DB에서 ciphertext와 wrapped DEK를 가져와 자원 권한을 먼저 확인하고, 허용된 key ID로 KMS unwrap을 요청합니다. KMS에서 나온 DEK는 요청 처리 동안 메모리에서만 사용해 ciphertext를 열고 로그·DB·장기 캐시에 복사하지 않습니다. Google Cloud 문서도 DEK를 at rest에서 암호화하고 KEK를 중앙에 두며 KEK가 KMS 밖으로 나오지 않는 모델을 설명합니다.

KEK로 큰 본문을 직접 암호화하면 중앙 KMS 호출과 입력 제한을 받습니다. 평문 DEK를 DB에 저장하면 DB 유출 시 본문과 키가 함께 노출됩니다. 봉투 암호화도 tenant row 인가를 대신하지 않으므로 실제 대상과 행동을 별도로 검사해야 합니다.

DEK의 단위를 정할 때는 암호학적 편의와 운영 삭제 단위를 맞춰야 합니다. 한 파일마다 DEK를 만들면 파일별 폐기가 명확하지만 KMS unwrap 호출과 메타데이터가 늘어납니다. tenant 하나에 DEK 하나를 공유하면 호출 수는 줄어도 키 유출 시 영향 범위가 커집니다. 어떤 선택이든 wrapped DEK의 key ID와 데이터의 tenant·version을 함께 검증하고, KMS가 허용한 사실을 애플리케이션의 읽기 권한으로 오해하지 않아야 합니다.

구체적으로 KMS 권한을 가진 서비스가 곧 모든 데이터의 독자가 되지 않도록, 애플리케이션에서 row 범위를 먼저 제한하고 unwrap 요청의 key ID도 서버가 선택하게 합니다. unwrap 실패를 빈 평문이나 기본 객체로 바꾸면 데이터 손상과 권한 우회가 동시에 생깁니다. DEK의 수명과 메모리·crash dump 경계를 관찰 가능한 정책으로 두는 것이 계층을 실제 통제로 만드는 부분입니다.

## 득점 포인트

- DEK는 본문, KEK는 DEK를 wrap한다는 역할을 구분한다.
- wrapped DEK와 ciphertext를 저장하되 평문 DEK·KEK 원문은 저장하지 않는다.
- KMS key 접근과 애플리케이션 인가를 별도 통제로 둔다.

## 감점 포인트

- KEK로 모든 큰 본문을 직접 암호화한다.
- tenant별 키가 있으면 DB row 인가가 필요 없다고 한다.

## 더 파고들 거리

- DEK를 row·tenant·chunk 중 어느 단위로 만들지 운영 조건으로 판단하라.
- unwrap worker의 메모리·로그·crash dump 경계를 어떻게 점검할 것인가?
