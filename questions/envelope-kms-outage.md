---
id: envelope-kms-outage
title: KMS 장애 중 저장된 wrapped DEK를 어떻게 다뤄야 하나요?
difficulty: 중하
category: 보안
tags:
  - KMS
  - 봉투 암호화
  - 가용성
related:
  - secret-store-outage-last-known-good
---
# KMS 장애 중 저장된 wrapped DEK를 어떻게 다뤄야 하나요?

## 구두 답변

KMS 장애 중에는 unwrap 권위를 우회하지 않고 이미 검증된 메모리 DEK의 사용 범위와 새 unwrap 실패를 분리합니다. 요청 수명 동안 열린 DEK로 현재 작업을 마칠 수는 있지만 평문 DEK를 파일·장기 캐시에 저장하거나 임의 새 DEK로 기존 ciphertext를 읽지 않습니다. 새 문서 생성은 새 DEK wrap이 필요하므로 fail-closed로 막을 수 있습니다.

마지막 KMS 확인이 10:08이고 stale window가 3분, DEK 만료가 10:10이면 허용 상한은 `min(10:10,10:11)=10:10`입니다. revoke·key disable 신호는 먼저 cache를 폐기합니다. 3분은 예시 정책이며 자산과 회수 요구로 정합니다. 새 관리자 export는 기존 조회보다 엄격하게 중단할 수 있습니다.

재시도는 deadline·backoff·jitter와 전체 예산으로 제한하고 복구 뒤 key version과 audit를 확인합니다. 장애와 ciphertext 손상, 인가 실패를 같은 오류로 기록하지 않아야 보안 결정과 원인을 구분할 수 있습니다.

장애 정책은 읽기와 쓰기를 더 세밀하게 나눌 수 있습니다. 이미 열린 DEK로 읽기 응답을 마치는 것과 새 row를 쓰는 것은 필요한 권위가 다릅니다. 또 고권한 export는 캐시된 DEK만으로 재개하지 않고 KMS 정상 확인을 요구할 수 있습니다. 오류 응답에는 KMS를 우회할 수 있는 내부 정보나 wrapped DEK를 포함하지 않으며, retry가 회복 후 요청 폭주가 되지 않도록 인스턴스별 예산과 jitter를 관찰합니다.

예를 들어 일반 목록 조회는 현재 열린 DEK로 끝낼 수 있어도 관리자 export는 KMS 정상 확인 없이는 막는 식으로 작업별 위험을 나눕니다. 캐시를 허용했다면 마지막 확인 시각, key version, 만료 시각을 함께 기록하고 stale 시간이 끝난 뒤 자동으로 fail-closed가 되는지 시험합니다. KMS가 복구됐다는 네트워크 신호만으로 이전 cache를 영구 신뢰하지 않고 새 unwrap과 권한 검사를 다시 통과시킵니다.

## 득점 포인트

- KMS 우회·평문 저장과 제한된 stale cache 사용을 구분한다.
- stale 기한을 만료·마지막 확인 후 한계 중 이른 값으로 계산한다.
- 열린 DEK·새 unwrap·새 문서 생성을 별도 정책으로 둔다.

## 감점 포인트

- 장애 동안 모든 ciphertext를 평문으로 저장한다.
- 마지막 정상 키를 무기한 캐시하거나 장애를 허용으로 바꾼다.

## 더 파고들 거리

- 복구 직후 old/new key version audit를 어떻게 대조할 것인가?
- 메모리 DEK cache가 요청 범위를 넘지 않는지 어떤 시험으로 확인할 것인가?
