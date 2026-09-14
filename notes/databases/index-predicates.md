---
id: index-predicates
title: 검색 가능 조건·부분 인덱스·온라인 생성
topic: 데이터베이스
summary: 원본 범위와 함수 인덱스·predicate 함의를 구분하고 시간대·파라미터 계획·상태 전환·동시 인덱스 구축과 실패 잔여를 설명합니다.
questionIds: [db-expression-index-sargability, db-partial-index-predicate, db-index-online-build]
---

# 검색 가능 조건·부분 인덱스·온라인 생성

## 함수를 계산한 값과 인덱스에 정렬된 값이 다를 수 있습니다

timestamp 컬럼에 DATE 함수를 적용해 오늘과 비교하면 기존 timestamp 인덱스의 탐색 범위를 직접 사용하기 어려울 수 있습니다. 같은 의미를 `created_at >= start AND created_at < next_start`로 표현할 수 있다면 원본 정렬 구간을 명확히 만들 수 있습니다. 모든 함수가 무조건 인덱스를 막는다는 법칙은 아니며 엔진의 변환·특수 접근을 실제 계획으로 확인합니다.

현지 날짜의 start와 다음 날짜 start를 각각 시간대 규칙으로 계산해야 합니다. 일광절약 전환이 있는 날은 24시간과 다를 수 있어 UTC 시작에 무조건 24시간을 더하면 결과가 달라질 수 있습니다. 성능을 개선하며 업무 날짜 의미를 바꾸면 안 됩니다.

## 파라미터 타입과 정규화도 접근 경로입니다

| 조건 | 먼저 확인할 것 | 대안 |
| --- | --- | --- |
| 날짜 함수 비교 | 현지 날짜·저장 시간대 | 반열린 원본 범위 |
| LOWER(email) | 실제 대소문자·collation 규칙 | expression index·생성 컬럼 |
| 문자열 ID와 숫자 parameter | 암묵 변환의 적용 쪽 | 같은 도메인 타입으로 바인딩 |
| 복잡한 표현식 | 결정성·immutable 요구 | 지원되는 표현 저장·재생성 |

변환 자체가 질의 의미라면 expression index·computed/generated column을 사용할 수 있습니다. 함수의 결정성·collation·지원 타입·식의 일치 조건을 확인합니다. 정규화 정책이나 함수가 바뀌면 저장된 인덱스 표현과 데이터 검증·재구성이 필요할 수 있습니다. 인덱스용 변환이 사용자의 동일성 의미를 대신 결정하지 않습니다.

## 부분 인덱스는 질의가 포함 범위를 벗어나지 않아야 합니다

pending 행만 저장한 인덱스를 쓰려면 쿼리가 pending 집합만 요구한다는 것을 옵티마이저가 판단할 수 있어야 합니다. `status='pending' AND created_at<...`는 후보가 되지만 `status IN ('pending','failed')`의 전체 결과를 그 인덱스 하나만으로 제공할 수는 없습니다.

```diagram
{"title":"부분 인덱스는 전체 테이블의 조건 집합입니다","caption":"화살표는 행의 포함 관계입니다. 질의 결과가 부분 집합 안이라는 근거가 있어야 누락 없이 인덱스를 사용할 수 있습니다.","rows":[[{"id":"table","label":"전체 작업 테이블"}],[{"id":"subset","label":"status=pending 인덱스"}],[{"id":"query","label":"pending이며 기한 전인 질의"}]],"edges":[{"from":"table","to":"subset","label":"predicate로 선별"},{"from":"subset","to":"query","label":"질의가 함의하는 범위"}]}
```

parameter 상태가 준비된 generic plan에서 미정이면 항상 pending이라고 증명할 수 없어 부분 인덱스를 선택하지 않을 수 있습니다. 조건 표현·NULL·함수·parameter plan의 실제 추론을 확인합니다. 인덱스가 작다는 것과 어떤 쿼리에서든 사용할 수 있다는 것은 다릅니다.

pending→done 변경은 부분 인덱스 제거 작업이고 done→pending은 삽입입니다. pending 비율이 급증하면 인덱스 크기와 유지 비용도 커집니다. 활성 행 UNIQUE로 활용할 때 탈퇴 후 이름 재사용·복구 충돌은 별도 정책입니다. 엔진마다 partial·filtered 지원이 다르므로 같은 SQL을 이식하면 된다고 가정하지 않습니다.

## 온라인 생성은 스캔·변경 반영·최종 게시를 수행합니다

기존 데이터를 읽어 인덱스를 만들면서 동시 변경도 반영하고 최종 유효 구조로 전환해야 합니다. online·concurrent 옵션은 일반 작업과 공존을 높이는 기능이지 모든 잠금·I/O·로그·추가 디스크를 없애지 않습니다. 시작·끝 메타데이터 잠금이나 오래된 transaction 대기가 남을 수 있습니다.

PostgreSQL concurrent build, SQL Server online build, MySQL online DDL은 지원 버전·대상·단계·잠금·실패 상태가 다릅니다. 취소 뒤 invalid index·임시 파일·부분 자원이 남을 수 있어 이름 존재만으로 사용 가능하다고 판정하지 않습니다. 고유 인덱스는 기존 중복과 생성 중 새 중복도 최종 검증해야 합니다.

## 생성 전후 모두 용량과 계획을 검증합니다

실제 규모 사본에서 구축 시간·디스크 여유·로그·replica lag·잠금 대기를 측정하고 중단·재시작·실패 정리 절차를 마련합니다. 실행 완료 뒤 인덱스 유효성·대표 parameter plan·쓰기 p99를 확인합니다. 새 인덱스 때문에 일부 쿼리 계획이 오히려 나빠질 수도 있습니다.

날짜 경계·DST·NULL·정규화·상태 분포의 결과 집합을 먼저 대조한 뒤 읽기량을 비교합니다. 현재 작업에서는 이 제품들의 online DDL이나 실제 질의 plan을 실행하지 않았습니다. 본문은 접근 조건과 구축 수명 설명입니다.
