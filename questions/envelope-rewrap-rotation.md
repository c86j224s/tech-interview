---
id: envelope-rewrap-rotation
title: KEK를 회전할 때 모든 데이터를 다시 암호화해야 하나요?
difficulty: 중하
category: 보안
tags:
  - DEK
  - KEK
  - 키 회전
related:
  - secret-key-rotation
---
# KEK를 회전할 때 모든 데이터를 다시 암호화해야 하나요?

## 구두 답변

KEK만 교체하는 경우라면 본문 ciphertext를 모두 다시 암호화하지 않고 wrapped DEK만 rewrap할 수 있습니다. K1으로 감싼 DEK를 unwrap하고 같은 DEK를 K2로 다시 wrap해 `key_id=K2`로 저장합니다. 본문은 그대로라 백만 문서라면 본문 IO와 AEAD 재계산을 피할 수 있습니다.

AAD·알고리즘·암호문 포맷이 바뀌면 wrapped DEK 교체만으로 부족하고 새 조건으로 본문을 다시 seal해야 합니다. DEK 유출이나 키 격리 정책 변경이면 새 DEK도 필요하지만, AAD 변경 자체가 언제나 새 DEK 생성을 요구하는 것은 아닙니다. 같은 DEK로 다시 seal할 때도 nonce 유일성은 지켜야 합니다. K1을 즉시 삭제하면 미처리 row가 열리지 않으므로 K1/K2 진행 상태와 row별 성공을 추적합니다. 일부 provider의 rewrap API와 key version 보존 규칙은 제품 문서로 확인해야 합니다.

실무에서는 새 write를 K2로 먼저 전환하고 background worker가 old row를 rewrap하며 중단 후 재개를 멱등화합니다. K1 사용률과 unwrap audit로 잔여를 확인합니다. 완료는 설정 변경 시점이 아니라 구 key가 더 이상 필요한 read 경로가 없고 폐기된 K1 사용이 거절되는 시점입니다.

rewrap을 구현할 때는 결과 레코드에 old key version을 남기거나 별도 audit를 두어 K1 잔존을 계산할 수 있게 합니다. 두 worker가 동시에 처리하면 한쪽이 만든 K2 wrapped value를 다른 쪽이 덮을 수 있으므로 row version, lease 또는 조건부 업데이트를 사용합니다. worker가 K1 unwrap 후 K2 저장 전에 중단돼도 원본 K1 record가 남아 재시도할 수 있어야 합니다. 반대로 K1을 폐기한 뒤 실패한 row를 복구할 경로가 없다면 회전은 운영상 데이터 손실입니다.

본문 재암호화가 필요한 상황에서는 old DEK로 open한 뒤 새 DEK로 seal하고, 새 ciphertext·wrapped DEK·version을 한 거래로 저장합니다. 이 과정에서 중단되면 구 레코드를 다시 읽을 수 있어야 하며, 새 레코드만 일부 저장된 상태를 성공으로 처리하지 않습니다. 백업과 복제본에도 K1 wrapped value가 남아 있다면 온라인 row의 K1 사용률만 0으로 만든 것은 회전 완료가 아닙니다.

## 득점 포인트

- KEK 회전과 DEK·본문 회전의 범위를 구별한다.
- rewrap 중단·K1 잔존·백업을 고려해 삭제 순서를 정한다.
- DEK 유출이나 알고리즘 변경에서는 re-encrypt가 필요함을 설명한다.

## 감점 포인트

- KEK를 바꾸면 항상 모든 본문을 다시 암호화한다.
- 구 key를 즉시 삭제해 미처리 wrapped DEK를 잃는다.

## 더 파고들 거리

- rewrap worker 두 개가 같은 row를 처리할 때 최종 결과와 audit를 어떻게 멱등화할 것인가?
- 백업에 남은 K1과 삭제 요구가 충돌하면 어떤 보존 정책을 둘 것인가?
