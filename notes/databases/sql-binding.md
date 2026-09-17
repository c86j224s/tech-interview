---
id: sql-binding
title: SQL 값 바인딩과 동적 구조의 허용 경계
topic: 데이터베이스
summary: 파라미터와 식별자·LIKE 패턴·IN 목록을 구분하고 서버 준비·드라이버 에뮬레이션·계획 재사용·행 인가·로그를 설명합니다.
questionIds: [prepared-statement-injection, prepared-server-emulated-contract]
---

# SQL 값 바인딩과 동적 구조의 허용 경계

## 입력값과 SQL 문법의 분리

사용자 이름을 SQL 문자열에 직접 붙이면 따옴표·주석 같은 문자가 원래 문법의 일부로 해석될 수 있습니다. 파라미터 바인딩은 SQL 구조와 값을 분리해 드라이버가 올바른 데이터 타입·인코딩으로 전달하게 합니다. 직접 모든 특수문자를 escape하려는 구현보다 검증된 API를 사용합니다.

```python
row = connection.execute(
    'SELECT id FROM members WHERE tenant_id = ? AND name = ?',
    (principal.tenant_id, supplied_name),
).fetchone()
```

위는 Python sqlite3 스타일의 예제입니다. 다른 드라이버의 placeholder 문법은 다를 수 있습니다. 값을 바인딩해도 tenant 조건과 현재 사용자의 자원 인가를 빠뜨리면 다른 사람의 행을 읽을 수 있습니다. injection 방어와 인가는 별도입니다.

## 컬럼명·정렬 방향과 값 파라미터의 구분

| 입력 종류 | 처리 | 주의점 |
| --- | --- | --- |
| 이름·금액·날짜 값 | 드라이버 parameter | 타입·범위 검증 별도 |
| 컬럼·테이블 식별자 | 서버의 허용 매핑·인용 API | 일반 값 placeholder로 선택 불가 |
| ASC·DESC | 고정 열거값 매핑 | 문자열 전체 허용 금지 |
| IN 목록 | 지원 array 또는 개수만큼 placeholder | 목록 크기·빈 목록 계약 |
| LIKE 패턴 | 값 binding + 패턴 의미 정책 | %·_는 여전히 wildcard |

`ORDER BY ?`에 "created_at"을 넣는다고 임의 컬럼명이 되는 것이 아닙니다. 서버가 `recent → created_at`, `name → normalized_name`처럼 허용된 구조를 고르고 값만 바인딩합니다. 안전한 identifier quoting API도 허용되지 않은 테이블에 접근할 권한을 자동 제한하지 않으므로 허용 목록·인가가 필요합니다.

LIKE에서 사용자 입력의 %·_를 문자 그대로 찾고 싶다면 해당 DB의 escape 규칙·ESCAPE 절을 사용합니다. 패턴을 허용하려는 요구라면 그대로 패턴으로 다루되 크기·비용 제한을 정합니다. 바인딩이 wildcard 의미를 없애는 것은 아닙니다.

```diagram
{"title":"동적 요청을 구조와 값으로 분리합니다","caption":"화살표는 입력 처리 경로입니다. SQL 구조는 서버의 검증된 선택에서 만들고 사용자 데이터는 값으로 전달합니다.","rows":[[{"id":"request","label":"사용자 필터·정렬 요청"}],[{"id":"structure","label":"허용된 컬럼·방향 매핑"},{"id":"values","label":"타입·범위 검증한 값"}],[{"id":"execute","label":"드라이버 parameter 실행","detail":["자원·tenant 인가 유지"]}]],"edges":[{"from":"request","to":"structure","label":"구조 선택"},{"from":"request","to":"values","label":"데이터 입력"},{"from":"structure","to":"execute","label":"고정 SQL 문법"},{"from":"values","to":"execute","label":"값 바인딩"}]}
```

## Prepared 명칭과 실제 Driver 계약 대조

서버 측 prepared statement에서는 SQL 템플릿과 parameter가 서버 프로토콜의 statement 상태로 따로 전달되므로, 같은 템플릿의 계획을 다시 사용할 수 있는 경로가 생길 수 있습니다. 반대로 클라이언트 에뮬레이션에서는 driver가 값을 인코딩·인용해 실행용 SQL을 만들 수 있으므로, 이름이 ‘prepared’인지보다 실제 전송 방식을 확인해야 합니다.

예를 들어 드라이버 버전과 문자셋, SQL mode, 배열·바이너리·날짜 타입이 어떤 placeholder와 데이터로 변환되는지 작은 입력을 실제 연결에서 확인해야 사용자 데이터가 SQL 문법으로 섞이지 않습니다.

서버 prepared를 켜도 connection pool에서 연결이 바뀌거나 statement cache 수명이 끝나면 준비된 상태와 계획을 다시 만들 수 있고, DB가 generic plan(여러 값에 공통으로 쓰는 계획)과 custom plan(현재 parameter에 맞춘 계획) 중 무엇을 택하는지도 달라질 수 있습니다. 특히 parameter skew처럼 값의 분포가 한쪽에 치우친 질의에서는 한 계획이 어떤 값에는 잘 맞고 다른 값에는 비쌀 수 있으므로, 준비 여부와 별개로 대표 parameter의 실행 시간·읽은 행 수를 비교해야 합니다.

따라서 prepared가 하나의 계획을 영원히 재사용하거나 모든 parameter에서 더 빠르다는 뜻은 아니며, SQL을 안전하게 분리하는 보안 효과와 파싱·컴파일 비용의 성능 효과를 같은 근거로 설명하지 않습니다.

ORM을 써도 raw SQL·동적 정렬·관리 도구·migration이 문자열 연결을 할 수 있습니다. 외부 입력을 저장한 뒤 나중 다른 동적 SQL에 붙이는 경로도 값·구조 분리를 유지해야 합니다. DB 계정에는 필요한 읽기·쓰기만 허용해 피해 범위를 줄입니다.

## 안전한 값과 질의 비용의 분리

parameter로 전달한 매우 넓은 패턴이나 거대한 IN 목록은 injection은 아니어도 많은 읽기·메모리·CPU를 요구할 수 있습니다. 입력 길이·목록 개수·허용 필터·query deadline·반환 바이트를 제한합니다. 정규식·전문 검색 구문도 별도 문법이면 해당 의미·비용 검증이 필요합니다.

오류 응답에는 내부 SQL·자격을 노출하지 않고 추적 ID·드라이버 오류 분류로 진단합니다. plan history에 parameter 원문을 남길 때도 개인정보·비밀 보관 정책을 적용합니다.

## 정상·경계 문자와 권한 검증

자신의 테스트 DB에서 따옴표·개행·Unicode·%·_·빈 목록을 값으로 넣어 SQL 구조와 예상 행이 유지되는지 검사합니다. 허용하지 않은 컬럼·정렬 방향은 실행 전에 거절되어야 합니다. 다른 tenant의 유효 ID를 넣어도 자원 경계를 넘지 않는지도 확인합니다.

이 노트는 방어 구현 예제이며 모든 DB 드라이버의 서버 준비·에뮬레이션 모드를 실제 실행한 결과는 아닙니다. 실제 채택하는 드라이버와 옵션에서 회귀 테스트를 유지해야 합니다.
