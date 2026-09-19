---
id: sqlite-wal-checkpoint-busy
title: SQLite 단일 writer·WAL checkpoint
topic: 데이터베이스
summary: >-
  SQLite WAL의 reader/writer 동시성, 단일 writer, checkpoint가 오래된 reader와 busy 상태에서
  멈추는 경계를 설명합니다.
questionIds: []
prerequisites:
  - wal-recovery
  - mvcc
  - lock-pressure
related:
  - connection-lifetime
  - transactions
reviewedAt: '2026-09-19'
---
# SQLite 단일 writer·WAL checkpoint

SQLite의 WAL(Write-Ahead Logging)은 기존 database 파일을 읽는 reader와 WAL 끝에 append하는 writer가 서로 겹칠 수 있게 만든다. 그렇다고 여러 writer가 같은 WAL 위치를 동시에 자유롭게 쓰는 것은 아니다. 한 writer가 쓰기 순서를 조정하고, reader는 시작 시점에 본 end mark를 기준으로 snapshot을 읽는다. checkpoint는 WAL frame을 database 파일로 옮기는 별도 작업이며, 오래된 reader가 남아 있으면 안전한 지점 이후를 진행하지 못한다. 그래서 “WAL을 켜면 읽기와 쓰기가 동시에 된다”와 “쓰기가 무제한 병렬화된다”를 반드시 분리해야 합니다.

## WAL 파일과 reader snapshot

rollback journal 방식에서는 쓰기 중 원본 페이지 보호와 잠금 경계가 reader를 막기 쉽지만, WAL에서는 변경 page가 WAL에 append되고 reader가 원래 database와 자신이 허용한 WAL frame을 조합해 읽습니다. SQLite 공식 WAL 설명에서 reader는 읽기를 시작할 때 end mark를 선택하고, 그 mark보다 뒤에 있는 새 frame을 보지 않습니다. 따라서 reader A가 frame 100을 end mark로 잡은 뒤 writer가 101~200을 append해도 A의 논리 snapshot은 바뀌지 않습니다. 새 reader B는 더 뒤의 end mark를 볼 수 있습니다.

이 구조가 가능한 전제는 WAL과 shared-memory 영역에 필요한 coordination이 가능하고, 같은 호스트의 프로세스들이 해당 파일 경계를 공유한다는 것입니다. 네트워크 파일시스템에서의 동작이나 VFS별 세부 busy 결과는 같은 설명으로 확장하지 않습니다. WAL mode 설정 성공만으로 모든 환경에서 동일한 동시성 계약이 만들어진다고 단정하지 않습니다.

## 단일 writer와 BEGIN IMMEDIATE

두 connection이 동시에 `BEGIN IMMEDIATE`를 시도하면 첫 번째가 write transaction을 얻고, 두 번째는 writer 경합의 결과를 받거나 busy handler/timeout 동안 기다립니다. 첫 번째 writer가 2,000개의 작은 row 변경을 WAL에 순서대로 append하는 동안 두 번째 writer가 다른 테이블을 만지더라도 “다른 데이터이니 동시에 commit”이 되는 것은 아닙니다. WAL은 reader와 writer의 겹침을 개선하지만 writer 수를 여러 개로 분리하는 샤딩 장치가 아닙니다.

설명용 trace를 보겠습니다.

```diagram
{"title":"SQLite WAL에서 reader·writer·checkpoint가 만나는 지점","caption":"reader는 자신의 end mark 뒤 frame을 보지 않고, writer는 하나의 append 순서를 얻습니다. checkpoint는 가장 오래된 reader가 허용하는 지점까지만 전진할 수 있습니다.","rows":[[{"id":"db","label":"database 파일","detail":["기존 page"]},{"id":"reader","label":"reader A","detail":["end mark = 100"]}],[{"id":"wal","label":"WAL frames","detail":["101 … 200 append"]},{"id":"writer","label":"단일 writer","detail":["write lock 경쟁"]}],[{"id":"checkpoint","label":"checkpoint","detail":["reader 경계까지 복사"]}],[{"id":"busy","label":"다음 writer·checkpoint","detail":["대기 또는 SQLITE_BUSY"]}]],"edges":[{"from":"db","to":"reader","label":"snapshot 기준"},{"from":"writer","to":"wal","label":"순서 있는 append"},{"from":"reader","to":"checkpoint","label":"end mark 경계"},{"from":"wal","to":"checkpoint","label":"frame 복사"},{"from":"checkpoint","to":"busy","label":"남은 frame·잠금"}]}
```

writer 두 개의 trace를 숫자로 고정하면 W1이 frame 101~110을 쓰는 동안 W2의 BEGIN IMMEDIATE는 즉시 성공하지 않습니다. W1 commit 후 W2가 lock을 얻으면 W2의 변경은 frame 111 이후에 기록됩니다. 이 숫자는 설명용 예상 순서이며 실제 busy 여부와 대기 시간은 SQLite release, VFS, busy handler, transaction 수명에 따라 확인해야 합니다.

## checkpoint와 오래 열린 reader

checkpoint는 WAL의 frame을 database 파일로 반영하는 작업입니다. 모든 reader가 특정 frame 이전의 snapshot을 사용한다면 그 지점까지 복사할 수 있지만, reader A가 end mark 100을 계속 붙잡은 상태에서 WAL이 1,100 page까지 자랐다고 하겠습니다. checkpoint가 1,100까지 요청되어도 A가 아직 100을 기준으로 읽을 수 있으므로 그 뒤 frame을 database 파일에 안전하게 재배치하거나 WAL을 truncate하는 데 제한이 생깁니다. 호출이 반환됐다는 사실은 WAL 파일이 0이 됐다는 뜻이 아닙니다.

checkpoint 결과는 “얼마나 frame을 처리했는가”, “남은 reader가 있는가”, “WAL 파일 크기가 실제로 줄었는가”로 나눠 관찰합니다. 오래 열린 reader는 단순히 CPU가 느린 요청이 아니라 snapshot 수명을 길게 하는 자원 보유자입니다. 화면용 cursor, 스트리밍 응답, 미종료 transaction이 모두 같은 효과를 낼 수 있으므로 connection pool의 idle과 active transaction을 구분합니다.

reader가 끝나고 checkpoint를 다시 실행하면 101~1,100을 database 파일로 밀고 truncate가 가능한지 달라질 수 있습니다. 그래도 다른 reader나 writer가 경쟁하면 결과는 다시 제한될 수 있습니다. 따라서 `checkpoint 성공`을 `파일 축소 성공`으로 번역하지 않고 결과와 파일 크기, oldest reader 추적을 함께 남깁니다.

## SQLITE_BUSY의 여러 경계

WAL에서도 `SQLITE_BUSY`가 사라지는 것은 아닙니다. 다만 원인을 구분해야 합니다. 두 쓰기 transaction이 writer lock을 경쟁하거나, VFS·shared-memory·파일 잠금 조건이 충족되지 않아 실제로 `SQLITE_BUSY`가 반환되는 경우가 있습니다. 반면 오래 열린 reader 때문에 checkpoint가 reader의 end mark 뒤에서 멈추거나 partial 결과를 내는 현상은, 그 자체로 BUSY 반환과 같은 뜻이 아닙니다. checkpoint 진행률과 반환 코드를 별도로 기록해야 합니다. `busy_timeout`은 lock을 얻기 위해 기다리는 시간 예산이지 writer를 병렬화하거나 오래된 reader를 끝내는 기능이 아닙니다. 긴 transaction이 계속되는 동안 timeout만 늘리면 다른 요청의 tail latency가 커질 수 있습니다.

짧은 write W1과 W2가 writer lock을 잠시 경쟁하면 제한된 재시도가 해결할 수 있지만, reader A가 10분 동안 cursor를 유지해 checkpoint가 reader 경계에서 partial로 끝나는 경우에는 timeout 증가가 원인 제거가 아닙니다. 먼저 checkpoint가 몇 frame을 처리했는지와 남은 frame을 확인하고, 별도로 실제 BUSY 반환이 있었는지 확인합니다. 운영에서 busy가 나오면 connection ID, transaction 시작 시각, `BEGIN` 종류, checkpoint 호출자, WAL 크기, busy handler의 대기 시간을 기록합니다. 무한 재시도는 종료·재시작·교착을 숨길 수 있어 전체 deadline 안에서 제한합니다.

재시도도 모든 오류에 같은 규칙을 적용하지 않습니다. 짧은 writer 경합은 backoff와 재시도가 합리적일 수 있지만, schema 변경이나 connection 폐기, 잘못된 transaction 상태는 새 connection과 명시적 rollback이 필요할 수 있습니다. SQLite 버전과 앱 드라이버가 busy를 어떤 예외·코드로 노출하는지 확인합니다.

## 자동 checkpoint와 애플리케이션 checkpoint

SQLite WAL 문서는 일정한 WAL 크기 임계에서 자동 checkpoint가 실행되는 경로와 애플리케이션이 직접 checkpoint를 호출하는 경로를 구분합니다. 자동 방식은 운영 코드가 단순하지만 foreground write가 checkpoint I/O와 겹칠 수 있습니다. 수동 방식은 idle 구간, 별도 maintenance worker, 명시적 시간 예산을 선택할 수 있지만, 실패와 남은 frame을 관측·재시도해야 합니다.

예를 들어 설명용 임계가 1,000 page이고 reader가 없다고 하겠습니다. 요청 처리 중 자동 checkpoint가 동작하면 write 요청 하나가 append뿐 아니라 page 복사 비용까지 함께 부담할 수 있습니다. 반대로 idle window에 수동 checkpoint를 하면 사용자 경로의 p99를 줄일 수 있지만, 새 writer가 계속 유입되거나 reader가 오래 살면 요청한 만큼 완료되지 않을 수 있습니다. `1,000 page`는 input에 있는 예시일 뿐 특정 기본값으로 일반화하지 않습니다.

checkpoint를 너무 자주 부르면 WAL이 작아지는 이점 대신 write latency와 I/O contention이 커질 수 있습니다. 너무 드물게 부르면 crash recovery에서 읽을 WAL과 디스크 사용량이 증가합니다. 선택 기준은 최대 WAL 크기, foreground p99, checkpoint 처리량, reader 수명, 재시작 복구 시간, 디스크 여유를 같이 둡니다.

## 구현 선택과 관측

단일 프로세스의 짧은 read와 짧은 write가 섞인 workload라면 WAL이 reader/writer 겹침을 줄일 수 있지만, 긴 write transaction은 여전히 writer를 오래 점유합니다. write를 작은 transaction으로 나누면 lock 보유 시간이 줄 수 있으나 중간 commit, 재시작·멱등성, 부분 성공 의미가 달라집니다. 단순히 connection 수를 늘리는 것은 단일 writer 경계 때문에 throughput을 자동으로 높이지 않습니다.

관측에는 열린 reader의 시작·종료, WAL frame 수와 파일 크기, checkpoint mode/result, busy 횟수와 대기 시간, writer transaction 보유 시간을 묶습니다. reader가 실제로 무엇을 읽는지와 connection이 열려 있는지만으로 판단하지 않습니다. 데이터가 큰 cursor를 한 번에 반환하는지, fetch를 오래 멈추는지도 구분합니다.

## 실패·검증과 근거 범위

검증 시나리오는 네 가지입니다. 두 reader가 서로 다른 snapshot을 유지하는 동안 writer가 1,000 page를 append하는 경우, 두 writer가 `BEGIN IMMEDIATE`를 경쟁하는 경우, 오래 열린 reader가 checkpoint를 뒤로 붙잡는 경우, 짧은 busy timeout과 긴 timeout의 tail latency를 비교하는 경우입니다. 첫째와 셋째에서는 checkpoint mode/result와 남은 frame을 기록하고 BUSY로 오인하지 않습니다. 둘째와 넷째에서는 실제 오류 코드, 대기 시간, 요청 deadline을 기록합니다. 실제 SQLite 파일 실행은 이 문서에서 수행하지 않았으므로 위 숫자와 결과는 예상 trace입니다.

SQLite 공식 `Write-Ahead Logging` 문서는 WAL이 readers와 writer의 동시 실행을 높이지만 writer는 하나이고, reader end mark와 checkpoint가 별도 경계를 만든다는 근거로 사용했습니다. 같은 문서의 BUSY 사례는 실제 잠금·복구 조건의 반환으로 다루며, reader 때문에 checkpoint가 끝까지 진행하지 못하는 현상과 합치지 않습니다. 문서의 current 페이지는 정확한 release를 고정하지 않으므로 VFS·드라이버·설정에 따른 결과는 unknown으로 남깁니다. 참고 URL: https://www.sqlite.org/wal.html. PostgreSQL WAL이나 일반 group commit의 내구 경계를 그대로 SQLite locking 계약으로 복사하지 않습니다.
