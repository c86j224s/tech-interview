---
id: redis-persistence
title: Redis 재시작 복구와 데이터 유실 경계
topic: 데이터베이스
summary: 같은 쓰기 시나리오를 RDB와 AOF에 끝까지 적용해 snapshot·명령 로그·fsync·rewrite·복구 파일의 경계를 구분합니다.
questionIds: [redis-rdb-aof, redis-fork-rewrite-memory-peak]
---

# Redis 재시작 복구와 데이터 유실 경계

## “저장했다”의 시점과 복구 가능성

주문 상태를 Redis에 두고 서버가 갑자기 꺼졌다고 해 보겠습니다. 애플리케이션은 `order:42=paid`를 성공적으로 받았지만, 재시작 뒤 값이 `pending`으로 돌아왔다면 성공 응답과 복구 가능한 상태 사이에 틈이 있었던 것입니다. 이 틈을 줄이려면 먼저 메모리에 반영된 시점, 지속성 파일에 기록된 시점, 운영체제와 저장장치에 flush된 시점, 장애 뒤 실제로 읽어 복구한 시점을 나눠야 합니다.

**RDB**는 특정 순간의 데이터셋을 한 파일로 찍습니다. **AOF**는 변경 명령을 기록하고 재시작 때 다시 적용합니다. 따라서 RDB는 마지막 snapshot 뒤의 변경이 통째로 복구 대상에서 빠질 수 있고, AOF는 더 최근의 명령까지 담을 수 있지만 `appendfsync` 정책과 파일 상태가 허용하는 범위까지만 안전합니다. AOF를 켰다는 한 단어가 무손실을 뜻하지는 않습니다.

## 복구 시점과 유실 경계

이 노트에서는 다음 네 시점을 사용합니다.

- `T1`: Redis가 명령을 처리해 메모리 상태를 바꾼 시점
- `T2`: RDB라면 snapshot이 대표하는 fork 시점, AOF라면 명령이 파일에 append된 시점
- `T3`: AOF `fsync`가 요구된 저장장치 기록을 확인한 시점
- `T4`: 장애 뒤 Redis가 파일을 읽어 메모리 상태를 다시 만든 시점

예를 들어 `SET order:42 paid`가 `T1`에는 성공했지만 RDB의 다음 snapshot 전, AOF `everysec`의 다음 fsync 전, 또는 OS page cache에만 머문 순간에 전원이 끊기면 복구 결과에 없을 수 있습니다. 반대로 AOF의 명령이 fsync된 뒤라면 그 명령은 로컬 AOF 기준으로 더 강한 복구 후보가 됩니다.

그래도 디스크 자체 손상, 파일 복사 실패, 잘못된 백업, 다른 노드 승격은 별도 문제입니다. 프로세스만 중단하는 실험은 OS page cache의 내용이 남을 수 있으므로 전원 손실을 재현하지 않습니다. 프로세스 장애, 운영체제 재부팅, 저장장치·가상 머신의 전원 손실을 서로 다른 시험으로 나눠야 합니다.

## RDB snapshot과 데이터셋 기준 시점

RDB의 흐름은 다음과 같습니다.

```diagram
{"title":"RDB snapshot과 재시작 경계","caption":"화살표는 데이터와 실행의 흐름입니다. fork가 시작된 시점의 데이터가 snapshot 기준이며, 그 뒤 부모 메모리에 반영된 쓰기는 해당 파일에 자동으로 포함되지 않습니다.","rows":[[{"id":"client","label":"클라이언트","detail":["SET order:42 paid"]}],[{"id":"memory","label":"Redis 메모리","detail":["현재 데이터셋"]}],[{"id":"child","label":"백그라운드 저장","detail":["fork → 임시 RDB"]}],[{"id":"rdb","label":"dump.rdb","detail":["fork 시점의 한 장"]}],[{"id":"restart","label":"재시작 복구","detail":["파일을 메모리로 로드"]}]],"edges":[{"from":"client","to":"memory","label":"명령 적용"},{"from":"memory","to":"child","label":"fork 시작"},{"from":"child","to":"rdb","label":"완료 후 교체"},{"from":"rdb","to":"restart","label":"복구 입력"}]}
```

Redis는 snapshot을 만들 때 fork한 자식이 데이터셋을 임시 RDB에 쓰고, 완료되면 기존 파일을 새 파일로 교체합니다. 이때 파일의 기준은 자식이 작업을 끝낸 시간이 아니라 fork가 시작된 시점입니다. 자식이 시작한 뒤 부모가 계속 쓰면 copy-on-write로 원래 페이지와 변경 페이지가 함께 필요해집니다. 그래서 RDB는 한 파일을 다루기 쉽고 큰 데이터셋 재시작이 AOF보다 빠를 수 있지만, fork 시점 이후에 부모 메모리에 반영된 쓰기를 해당 snapshot 파일이 복구해 주지는 않습니다.

예를 들어 `10:00:00`에 fork가 시작되어 `10:00:05`에 snapshot 파일 작성이 완료됐다고 하겠습니다. `10:00:01`에 `SET order:42 paid`가 부모 메모리에 반영됐다면, 파일이 `10:00:05`에 완성됐더라도 `order:42`는 그 RDB에 들어가지 않습니다.

`save 60 1000`은 최소 60초가 지나고 변경량이 1000개 이상일 때 snapshot을 시도한다는 조건이지, 정확히 60초마다 snapshot이 완료된다는 보장은 아닙니다. `10:00:35`에 전원 손실이 발생하고 그 사이 새 snapshot이 없으면 재시작한 RDB에는 `order:42`가 없을 수 있습니다.

RDB의 유실 경계는 “마지막 명령”이 아니라 “마지막으로 완료된 snapshot이 대표하는 fork 시점”에 가깝습니다. snapshot 파일이 생성됐다는 사실도 다른 장애 도메인에 복사되어 복구 가능한 백업이 됐다는 뜻은 아닙니다.

## AOF 명령 기록과 재생

AOF의 흐름은 같은 예를 더 촘촘한 시간축으로 기록합니다.

```diagram
{"title":"AOF append와 재생 경계","caption":"화살표는 명령의 흐름입니다. AOF fsync 정책은 로컬 파일의 복구 가능 시점을 바꾸며, 응답 반환이 외부 효과나 모든 장애 도메인의 보존을 뜻하지는 않습니다.","rows":[[{"id":"client","label":"클라이언트","detail":["SET order:42 paid"]}],[{"id":"server","label":"Redis 메모리","detail":["명령 실행"]}],[{"id":"aof","label":"AOF 파일","detail":["append → fsync 정책"]}],[{"id":"restart","label":"재시작","detail":["AOF 명령 재생"]}]],"edges":[{"from":"client","to":"server","label":"쓰기 요청"},{"from":"server","to":"aof","label":"명령 기록"},{"from":"aof","to":"restart","label":"재생 입력"}]}
```

`appendfsync always`는 AOF에 append한 뒤 매번 fsync하는 쪽으로 가장 강한 로컬 지점을 만들지만 지연 비용이 큽니다. `everysec`는 보통 성능과 유실 범위의 절충으로, 문서상 대략 최근 1초의 쓰기가 유실될 수 있다고 설명되는 정책입니다. 그러나 실제 유실 시간이 정확히 1초로 고정되는 것은 아닙니다.

fsync 예약·실행 지연, 운영체제와 저장장치의 flush 동작, 장애 형태, 설정에 따라 경계가 달라질 수 있습니다. `no`는 Redis가 fsync하지 않고 운영체제에 맡기므로 유실 시점을 숫자로 단정하기 어렵습니다. 실제 저장장치와 운영체제 계약까지 포함해 판단해야 합니다.

같은 주문을 시간순으로 따라가 보겠습니다. `10:00:01`에 `SET order:42 paid`, `10:00:02`에 `SET order:43 paid`가 실행됐습니다. `everysec`에서 첫 fsync가 두 명령을 담았다면 두 값 모두 local AOF에 남을 수 있습니다. 그러나 `10:00:02` 직후 전원이 나가 두 번째 명령이 아직 fsync되지 않았다면 `order:42`만 복구될 수 있습니다. AOF는 RDB보다 최신 상태를 복구할 가능성을 높이지만, fsync 이전 명령의 보존을 보장하지 않습니다.

Redis 7.0부터는 multipart AOF를 사용합니다. rewrite가 시작되면 새 base 파일과 그 뒤의 incremental 파일을 manifest가 가리키는 구조로 현재 상태와 이후 변경을 이어 붙입니다. 이전 버전의 “rewrite 중 in-memory buffer”라는 설명과 현재 구현을 섞지 말고, 운영 중인 버전의 파일 구조와 복구 로그를 확인해야 합니다.

## rewrite의 로그 축약과 COW 메모리·유실 경계

카운터에 `INCR count`를 100번 보냈다면 AOF에 100개의 명령이 생기지만 현재 값을 `100`으로 복원하는 데 모든 중간 명령이 필요한 것은 아닙니다. rewrite는 현재 데이터셋을 만드는 더 짧은 표현을 백그라운드에서 만들고, 그동안 들어온 새 변경을 별도로 이어 붙인 뒤 전환합니다. 따라서 rewrite가 “안전하다”는 말은 새 파일로 바꾸는 과정에서 서비스의 최신 변경을 잃지 않도록 조정한다는 뜻이지, 장애 직전 명령이 이미 디스크에 fsync됐다는 뜻이 아닙니다.

rewrite 중에는 fork의 copy-on-write, 새 base·incremental 파일, 기존 파일, 디스크 I/O가 동시에 자원을 씁니다. 부모가 최대 쓰기율로 계속 변경하면 fork 시점 페이지가 복사되어 메모리 피크가 커집니다. AOF가 RDB보다 유실에 유리해도 rewrite 시간과 메모리 여유를 평상시 평균으로 계산하면 안 됩니다. `redis-fork-rewrite-memory-peak` 질문이 이 지점을 부하 재현으로 이어 줍니다.

## RDB·AOF 복구 경계 비교표

| 상황 | RDB만 사용 | AOF 사용 | 확인해야 할 경계 |
| --- | --- | --- | --- |
| 마지막 snapshot 직후 쓰기 | 다음 snapshot 전이면 잃을 수 있음 | appendfsync 전이면 잃을 수 있음 | `T1`과 `T2/T3`의 간격 |
| `everysec` 중 갑작스런 전원 장애 | 마지막 완료 snapshot까지만 복구 | 보통 최근 fsync 간격 안의 명령이 유실 후보 | fsync·OS·장치 지연 때문에 “정확히 1초”로 단정하지 않기 |
| AOF 끝이 반쯤 기록됨 | 해당 없음 | 최신 버전은 마지막 불완전 명령을 버리고 로드할 수 있음 | 로그와 `aof-load-truncated` 설정 확인 |
| AOF 중간이 손상됨 | 파일 자체가 완전하면 영향 적음 | 시작이 중단되거나 손상 지점 이후를 버릴 수 있음 | 백업 후 `redis-check-aof` 결과와 손실 범위 |
| rewrite 중 쓰기 증가 | fork COW와 RDB I/O 부담 | COW·base·incremental·fsync 부담 | 최대 메모리와 p99 지연 |
| RDB+AOF 재시작 | RDB 단독 구성에는 해당 없음 | 기본 경로에서는 AOF를 사용해 재구성 | `preload-file` 같은 특별 복구 설정은 별도 확인 |
| 파일 하나가 살아남음 | snapshot 파일을 복사·검증 가능 | multipart AOF는 묶음과 manifest가 필요 | 다른 장애 도메인 복사와 실제 복원 |
| 논리적으로 잘못된 `DEL` | snapshot에 반영되면 그대로 복구 | AOF에 기록되면 그대로 재생 | replica와 persistence 모두 독립 백업이 아님 |

마지막 행이 중요합니다. persistence는 Redis가 관찰한 상태를 보존할 뿐, 애플리케이션이 잘못 실행한 명령을 되돌리지 않습니다. replica도 primary의 `DEL`을 복제하므로 독립 백업으로 대체할 수 없습니다. 장기 보존이나 잘못된 변경 복구가 필요하면 시점별 RDB 또는 외부 백업을 다른 장애 도메인에 보관하고 실제 복원을 주기적으로 수행해야 합니다.

## 장애 순서와 복구 상태 추적

1. `10:00:00`에 RDB snapshot이 완료되고 AOF rewrite도 정상 종료됐습니다. 이때의 복구 파일 상태를 `S0`라고 부르겠습니다.
2. `10:00:01`에 `SET order:42 paid`가 메모리에 반영되고 AOF append가 시작됐습니다.
3. `10:00:01.2`에 클라이언트가 성공 응답을 받았지만 `everysec` fsync 전에 전원이 끊겼습니다. 메모리의 성공과 local AOF의 복구 가능성은 다릅니다.
4. 재시작 시 RDB만 사용하면 `S0`에서 시작하므로 `order:42`가 사라질 수 있습니다. RDB와 AOF를 함께 켠 기본 경로에서는 공식 문서상 AOF가 더 완전한 입력으로 사용되어 `order:42`가 살아날 수 있지만, 끝부분 손상·미기록 여부와 `preload-file` 같은 특별 복구 설정은 별도로 확인해야 합니다.
5. `10:00:02`에 외부에서 “backup 완료”라고 표시했더라도 파일을 다른 머신으로 전송하지 못했다면 원본 디스크 장애 때 사용할 백업은 없습니다.
6. 복원 후에는 단순히 서버가 기동한 것만 보지 말고 `order:42`, 키 수, 마지막 요청 ID, 원장과의 대조를 확인합니다. TTL은 복사·복원 중 벽시계 시간이 흘렀으므로 원본의 남은 초가 그대로인지가 아니라 절대 만료 시각과 경과 시간에 맞게 줄었는지를 확인합니다.

이 추적은 RDB와 AOF의 차이를 “RDB는 느리고 AOF는 안전하다”처럼 끝내지 않게 해 줍니다. 질문은 항상 “어느 시점의 어떤 파일이, 어느 장애에서, 실제로 읽혀 복구되는가”로 바꿔야 합니다.

## 직접 확인할 입력과 예상 결과

다음은 별도 Redis 인스턴스에서 수행할 검증 계획입니다. 이 세션에서 실행한 실험의 결과가 아닙니다.

1. 같은 키에 순서대로 `SET order:42 pending`, `SET order:42 paid`를 실행하고 `BGSAVE` 완료 전 프로세스 중단을 재현합니다. 이 결과를 전원 손실로 부르지 말고, OS page cache가 남을 수 있는 프로세스 장애의 관찰로 기록합니다. RDB-only 복구에서는 마지막 snapshot의 fork 시점 이후 값이 빠질 수 있는지 확인합니다. 별도 환경에서 운영체제 재부팅·가상 머신 전원 손실도 나눠 시험합니다.
2. AOF `appendfsync everysec`에서 초당 여러 `SET`을 발생시킨 뒤 프로세스 중단과 전원 손실을 각각 재현합니다. 재시작 후 마지막 값과 AOF 경고를 비교해 fsync 예약·실행 지연, OS·저장장치 동작을 포함한 실제 유실 범위를 기록합니다. “최근 1초”를 측정 결과의 절대 상한으로 가정하지 않습니다.
3. AOF의 끝부분을 별도 복사본에서 잘라 로드합니다. 최신 버전의 기본 설정에서 마지막 불완전 명령을 버리고 기동하는지, 엄격 설정에서는 시작이 중단되는지 확인합니다. 원본 파일에는 작업하지 않습니다.
4. `BGREWRITEAOF` 중 최대 쓰기율을 걸고 `INFO persistence`의 rewrite 상태, RSS, `used_memory`, fork 시간, latency를 함께 측정합니다. 평균 메모리가 아니라 rewrite 동안의 최대치와 짧은 GET의 p99를 비교합니다.
5. RDB와 AOF를 함께 켠 구성에서 재시작 로그와 로드된 키를 확인합니다. 기본 경로에서 AOF가 사용되는지 확인하고, `preload-file`을 지정한 특별 복구 경로가 정상 설정을 우회하는지도 별도 확인합니다.
6. 완성된 RDB 파일은 다른 장애 도메인으로 복사할 수 있지만, Redis 7.0 이상의 multipart AOF는 rewrite 중 디렉터리를 단순 복사하면 조각과 manifest가 맞지 않는 invalid backup이 될 수 있습니다. AOF를 백업할 때는 자동 rewrite와 수동 rewrite를 막고, 진행 중인 rewrite가 있으면 `INFO persistence`로 끝났음을 확인한 뒤 관련 base·incremental 파일과 manifest를 한 묶음으로 복사하고 원래 rewrite 설정을 복원합니다. Redis 8.10 이상에서 지원되는 `BACKUP` 계열을 사용한다면 `BACKUP START`로 시작해 `BACKUP SEAL`로 완결한 다음 `BACKUP LIST`가 가리키는 전체 파일을 백업 저장소에 복사·검증하고, 완료 후에만 `BACKUP CLEANUP`으로 고정해 둔 파일을 정리합니다. 명령 지원 여부와 완료 상태는 해당 버전 문서로 확인하며, 복원 뒤에는 파일 크기·digest·키 수·최근 상태와 함께 TTL이 원본의 남은 초가 아니라 절대 만료 시각과 복사·복원 경과 시간에 맞는지 확인합니다.

### Redis 영속성 공식 문서

- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/): RDB snapshot, AOF fsync·rewrite·손상 복구, multipart AOF 백업과 재해 복구
- [Redis replication](https://redis.io/docs/latest/operate/oss_and_stack/management/replication/): 복제본과 persistence·독립 백업의 차이

결국 허용 가능한 RPO가 “몇 분”이면 RDB만으로도 충분할 수 있지만, 최근 쓰기 손실을 줄여야 하면 AOF의 fsync·rewrite·디스크 예산을 포함해 설계해야 합니다. 권위 데이터라면 Redis 파일 하나의 기동 성공을 데이터 보존의 최종 근거로 삼지 말고 원본 DB, 원장, 독립 백업, 복구 대사를 함께 둬야 합니다.
