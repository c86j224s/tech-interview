---
id: envelope-tenant-key-boundary
title: 테넌트별 DEK와 공용 KEK를 선택할 때 무엇을 비교하나요?
difficulty: 중하
category: 보안
tags:
  - 멀티테넌트
  - DEK
  - 키 격리
related:
  - authentication-vs-authorization
---
# 테넌트별 DEK와 공용 KEK를 선택할 때 무엇을 비교하나요?

## 구두 답변

비교 기준은 키 개수 하나가 아니라 격리·폐기·복구·KMS 권한·운영 비용입니다. 공용 KEK 아래 tenant별 DEK는 객체를 분리하면서 KEK 수를 관리하지만 key-level blast radius가 넓을 수 있습니다. tenant별 KEK는 disable·위임·삭제 경계가 선명하지만 key policy와 백업 복구가 복잡합니다.

tenant 탈퇴 때 DEK/KEK 폐기로 신규 복호화를 막을 수 있는지, 백업·아카이브·검색 인덱스에 wrapped DEK가 남는지, 보존 요구와 삭제가 충돌하는지 확인합니다. 실제 key 수 한계와 보존 기간은 KMS 계약으로 정합니다.

tenant별 키가 애플리케이션 인가를 대신하지 않는 점이 핵심입니다. 서비스가 t2 row를 잘못 읽은 뒤 t2 key로 unwrap에 성공하면 암호화는 조회 오류를 고치지 못합니다. 먼저 principal·tenant·action으로 DB 범위를 제한하고 그 뒤 필요한 key만 요청합니다.

키 경계의 효과를 검증하려면 실제 접근 경로를 두 종류로 나눕니다. t1 주체가 t1 row를 읽는 정상 경로와 t1 주체가 t2 row ID를 직접 넣는 거절 경로를 모두 실행하고, 두 번째 경로가 KMS 호출까지 도달하는지 확인합니다. KMS 호출이 발생하지 않도록 DB 범위를 먼저 제한하면 audit와 비용도 줄어듭니다. 탈퇴 후 복구 테스트에서는 폐기한 key가 백업 복원 과정에서 다시 자동 활성화되지 않는지 확인해야 합니다.

따라서 설계 문서에는 “tenant별 DEK를 사용한다”와 “t1 principal이 t2 row를 읽을 수 없다”를 별도 요구사항으로 적습니다. 전자는 key lifecycle과 blast radius의 문제이고 후자는 인증·인가와 DB query의 문제입니다. 두 통제를 함께 시험해 t1 요청이 t2 row를 로드하지 않고, KMS unwrap audit에도 불필요한 cross-tenant 호출이 남지 않는지 확인합니다.

백업 복구는 키 경계의 실제 비용을 드러냅니다. t1 탈퇴 후 온라인 key를 disable했더라도 백업에 t1의 wrapped DEK와 과거 key version이 남아 있으면, 복구 절차가 그 key를 자동으로 재활성화하지 않는지 확인해야 합니다. 공용 KEK와 tenant별 DEK 모델은 특정 tenant의 DEK를 폐기할 수 있지만 공용 KEK 권한 자체가 다른 tenant 데이터의 복호화 권한이 되지 않도록 wrapped DEK 조회와 unwrap 대상을 제한해야 합니다. tenant별 KEK 모델은 KMS 정책으로 t1만 차단하기 쉬운 대신 key 수·정책·복구 객체가 늘어납니다.

## 득점 포인트

- 키 격리와 KMS·백업·삭제 운영 비용을 함께 비교한다.
- 탈퇴와 복구에서 key lifecycle과 데이터 복제본을 같이 본다.
- 암호화 키 경계와 row-level 인가를 별도 통제로 둔다.

## 감점 포인트

- tenant별 키가 있으면 잘못된 DB 조회도 안전하다고 한다.
- 키 개수만 비교하고 폐기·복구·위임 비용을 무시한다.

## 더 파고들 거리

- 공용 KEK에서 특정 tenant만 즉시 회수할 때 DEK 폐기와 cache 무효화를 어떻게 연결할 것인가?
- 백업 복구 시 과거 key version을 다시 여는 조건은 무엇인가?
