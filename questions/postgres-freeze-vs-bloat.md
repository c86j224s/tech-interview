---
id: postgres-freeze-vs-bloat
title: VACUUM freeze가 transaction ID wraparound를 막는 일과 bloat를 줄이는 일이 어떻게 다른가요?
difficulty: 하
category: 데이터베이스
tags:
  - PostgreSQL
  - freeze
  - bloat
  - VACUUM
related:
  - db-postgres-vacuum
---
# VACUUM freeze가 transaction ID wraparound를 막는 일과 bloat를 줄이는 일이 어떻게 다른가요?

## 구두 답변

freeze의 주목적은 충분히 오래된 tuple이 더 이상 과거 XID를 계속 비교하지 않아도 되도록 표시해 transaction ID wraparound 위험을 줄이는 것입니다. bloat 정리는 dead tuple의 공간을 재사용 가능하게 하고 인덱스·visibility 상태를 정리하는 일입니다. 일반 VACUUM에서 함께 진행될 수 있지만 목적과 성공 판단은 다릅니다.

dead tuple가 거의 없는 오래된 relation도 freeze가 필요할 수 있습니다. 반대로 대량 UPDATE 뒤 dead tuple가 많아 파일이 커져도 XID age는 낮을 수 있습니다. 일반 VACUUM이 재사용 공간을 만들었다고 파일이 OS에 즉시 반환되는 것도 아니며, `VACUUM FULL`은 별도 잠금과 공간이 필요한 재작성입니다.

결과를 age 감소, frozen tuple 진행, dead tuple, relation 크기, scan 성능으로 나눠 관찰하겠습니다. PostgreSQL vacuum을 이 작성 과정에서 실행하지 않았으므로 성공을 가장하지 않고, 공식 문서와 격리 DB에서 freeze·파일 반환·bloat 효과를 각각 확인하겠습니다.

freeze는 오래된 insertion XID를 FrozenTransactionId처럼 취급해 32-bit modulo 비교에서 과거 tuple을 미래로 오인하는 visibility 오류를 막는 안전성 조치입니다. bloat 정리는 dead tuple 공간을 재사용하게 만드는 물리·I/O 조치입니다. 따라서 dead=0인 오래된 relation도 freeze가 필요할 수 있고, 반대로 최근 UPDATE가 집중된 relation은 dead tuple가 많아도 XID age가 낮을 수 있습니다.

일반 VACUUM 뒤에는 `age(relfrozenxid)`와 frozen tuple 진행, dead tuple, visibility map, relation size를 따로 비교합니다. relation 내부 재사용 공간이 늘어도 OS 파일이 줄었다는 뜻은 아니며, `VACUUM FULL`은 ACCESS EXCLUSIVE와 추가 공간을 사용하는 재작성입니다. 이 답변에서는 실제 서버 실행을 하지 않았으므로 수치와 즉시 파일 회수를 주장하지 않고 격리 환경 검증을 성공 조건으로 둡니다.

## 득점 포인트

- freeze의 안전성 목적과 bloat의 물리 정리 목적을 나눕니다.
- 작은 정적 relation의 freeze 필요성을 설명합니다.
- 재사용 공간과 OS 파일 축소를 구분합니다.
- 결과 지표를 목적별로 나눠 검증합니다.

## 감점 포인트

- VACUUM 한 번이면 모든 bloat와 파일 크기가 사라진다고 합니다.
- freeze를 단순 dead tuple 삭제로 정의합니다.
- age와 파일 크기를 같은 신호로 취급합니다.

## 더 파고들 거리

- visibility map과 index-only scan의 관계를 어떻게 별도로 확인할까요?
- freeze 지연과 오래된 snapshot의 상호작용을 어떤 실험으로 보겠습니까?
