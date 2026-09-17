---
id: functional-dependencies
title: 함수 종속·후보키·기간별 식별의 설계
topic: 데이터베이스
summary: 샘플 유일성과 영속 제약을 구분하고 속성 폐포·최소 후보키·테넌트·이메일 이력·collation·NULL의 엔진별 검증을 설명합니다.
questionIds: [functional-dependency-keys, temporal-email-history-keys, unique-null-collation-cross-engine]
---

# 함수 종속·후보키·기간별 식별의 설계

## 현재 이메일 유일성과 미래 제약의 구분

회원 샘플에 같은 이메일이 없다고 이메일이 반드시 회원을 결정하는 것은 아닙니다. 중복 가입을 허용하거나 테넌트별로만 유일하거나 이력에 이전 이메일을 남기는 서비스라면 관계가 달라집니다. 함수 종속 X→Y는 같은 X를 가진 모든 **유효한 상태의 행**이 같은 Y를 갖는다는 도메인 제약입니다.

관찰 데이터는 제약 후보를 찾는 힌트입니다. 유일성의 범위·기간·정규화·재사용 규칙을 결정하고 DB 제약·쓰기 경로에서 강제해야 합니다. 내부 surrogate ID를 추가해도 다른 업무 유일성 요구가 사라지지 않습니다.

## 속성 폐포와 결정 속성 계산

R(A,B,C,D)에 A→B, B→C, AC→D가 있다고 하겠습니다. A를 알면 어디까지 알아낼 수 있을까요? 이렇게 주어진 속성에서 함수 종속을 반복 적용해 얻는 속성 집합을 **폐포**라고 쓰고 `A+`로 나타냅니다.

처음에는 `{A}`입니다. A→B를 적용하면 `{A,B}`, 이어 B→C를 적용하면 `{A,B,C}`가 됩니다. 이제 A와 C를 모두 알고 있으므로 AC→D도 적용할 수 있습니다. 결과는 `{A,B,C,D}`입니다.

A 하나로 행의 모든 속성을 결정할 수 있으므로 A는 **슈퍼키**입니다. 여기서 불필요한 속성을 더 뺄 수 없는 슈퍼키가 **후보키**입니다. A에서 유일한 속성을 빼면 빈 집합인데, 주어진 종속에는 빈 집합에서 다른 속성을 얻는 규칙이 없습니다. 따라서 이 예에서 A는 후보키입니다.

```text
closure(X, dependencies):
    result = X
    repeat:
        changed = false
        for L -> R in dependencies:
            if L is subset of result and R adds new attributes:
                add R to result
                changed = true
    until not changed
    return result
```

| 용어 | 의미 | 주의점 |
| --- | --- | --- |
| superkey | 전체 행을 결정하는 속성 집합 | 불필요한 속성을 포함할 수 있음 |
| candidate key | 포함 관계상 최소 superkey | 가장 짧은 하나만이라는 뜻 아님 |
| primary key | 후보키 중 대표 선택 | 다른 후보키 제약이 사라지지 않음 |
| prime attribute | 어떤 후보키에라도 포함되는 속성 | 선택한 PK 포함 여부만이 아님 |

후보키를 찾으려면 전체 폐포뿐 아니라 각 속성을 제거한 최소성도 확인합니다. 함수 종속을 잘못 가정하면 키·정규형·외래키 설계가 모두 흔들립니다.

```diagram
{"title":"업무 규칙에서 키와 실제 제약으로 내려갑니다","caption":"화살표는 설계 검증 순서입니다. 샘플의 우연한 중복 부재가 아니라 모든 허용 상태의 의미를 먼저 정합니다.","rows":[[{"id":"domain","label":"유일 범위·기간·동등성 규칙"}],[{"id":"fd","label":"함수 종속·폐포·후보키"}],[{"id":"schema","label":"PK·UNIQUE·기간 제약"}],[{"id":"test","label":"동시 쓰기·이력·엔진 검증"}]],"edges":[{"from":"domain","to":"fd","label":"유효 상태 정의"},{"from":"fd","to":"schema","label":"집행 위치 선택"},{"from":"schema","to":"test","label":"실제 계약 확인"}]}
```

## 현재 계정과 이메일 이력의 관계 분리

현재 계정에서 `(tenant_id, normalized_email) → account_id`를 요구할 수 있습니다. 이메일 이력에서는 같은 이메일이 여러 기간·계정에 등장할 수 있어 이메일 단독으로 이력 행을 식별하지 못합니다. `(account_id, valid_from)`을 쓴다면 한 계정에 같은 시작 시각이 중복되지 않는 계약이 필요하고, 충돌 가능성이 있으면 별도 change_id나 순번을 사용합니다.

기간은 예를 들어 `[valid_from, valid_to)`의 반열린 구간으로 정해 끝과 다음 시작의 맞닿음을 표현할 수 있습니다. 키 유일성만으로 기간 중첩 금지가 강제되는 것은 아닙니다. 계정별 겹침·현재 열린 기간 한 개·다중 계정 간 이메일 점유 정책은 별도 제약과 동시성 경계가 필요합니다.

과거 주문의 주체는 변경·재사용 가능한 이메일이 아니라 불변 account ID를 참조합니다. 이메일이 다른 계정에 재할당됐다고 과거 주문·제재·로그인 연결이 새 계정으로 옮겨가면 안 됩니다.

## 문자열 동등성과 DB 엔진 규칙의 정합성

이메일을 고유 키로 쓸 때는 표시 원문과 비교용 `canonical key`(비교에 사용할 정규화된 값)를 나누고, 대소문자·악센트·Unicode 정규화·공백·로케일을 어떤 규칙으로 처리할지 먼저 정합니다. `collation`은 DB가 문자열의 같음과 정렬을 판단하는 규칙이므로 앱의 사전 검사와 DB의 UNIQUE가 서로 다른 규칙을 쓰면 결과도 달라지며, 이메일 전체를 무조건 소문자화해도 도메인 요구에 맞는지 확인해야 합니다.

`NULL`의 UNIQUE 처리와 nullable 열의 후보키 의미는 엔진·인덱스 옵션에 따라 달라서 PostgreSQL의 기본 distinct NULL·지원 버전의 `NULLS NOT DISTINCT`, SQL Server의 unique·filtered index, MySQL의 NULL·generated column 대안을 각각 목표 버전에서 확인해야 합니다. 활성 행에만 유일성을 적용하는 partial·filtered index도 predicate·표현식 지원이 엔진마다 다르므로, 같은 이름의 SQL 문법을 다른 엔진에서 같은 계약으로 보지 않습니다.

NULL을 허용하는 UNIQUE 열을 수학적 관계 모델의 후보키와 동일하게 취급해서는 안 됩니다. UNIQUE 제약이 있어도 모든 행에 식별 가능한 값이 있다는 보장까지 생기지는 않습니다.

## 마이그레이션 전 충돌 데이터·동시성 검증

대소문자·악센트·조합 Unicode·NULL·빈 문자열·탈퇴 행·같은 시각 이력·테넌트 차이를 포함한 데이터로 목표 DB 제약을 시험합니다. 기존 키가 새 collation에서 충돌하면 임의 계정 병합·삭제 대신 소유권·참조·사용자 복구 정책으로 처리합니다.

폐포 계산은 작은 속성 집합에서 검산하고 실제 제약은 두 세션의 동시 삽입·변경으로 확인합니다. 이 노트는 관계 모델과 엔진별 검증 절차이며 PostgreSQL·SQL Server·MySQL에서 이 제약들을 실행한 결과는 아닙니다.
