---
id: kafka-consumer-offset
title: Kafka 소비 offset과 완료 경계
topic: 분산 시스템
summary: poll로 받은 위치, 애플리케이션 처리 완료, 소비자 그룹 offset commit을 분리하고 병렬 처리와 rebalance에서 안전한 완료 경계를 계산합니다.
questionIds: [kafka-partition-offset, kafka-consumer-group, kafka-rebalance-processing, kafka-parallel-completion-watermark, kafka-worker-queue-revocation, kafka-pause-versus-leave-group, kafka-offset-gaps-compaction, kafka-cooperative-rebalance-scope]
---

# Kafka 소비 offset과 완료 경계

## poll 완료와 애플리케이션 처리 완료의 경계

소비자에서 `poll()`이 레코드 10·11·12를 반환하면 Kafka client의 현재 **position**은 보통 다음에 가져올 위치인 13으로 전진합니다. 그러나 이 순간 DB 반영이나 외부 API 호출까지 끝났다는 뜻은 아닙니다. `poll`은 레코드를 애플리케이션에 전달한 사건이고, 처리는 그 뒤에 시작할 수 있습니다.

세 위치를 따로 이름 붙이면 혼동이 줄어듭니다.

- `position`: 이 consumer가 다음 `poll()`에서 가져올 위치입니다. poll로 레코드를 전달받는 것만으로도 움직입니다.
- `processed`: 외부 효과와 애플리케이션의 완료 기록이 성공한 위치입니다. Kafka가 자동으로 아는 값이 아니라 서비스가 관리해야 합니다.
- `committed`: 소비자 그룹에 저장한 다음 읽을 위치입니다. offset 13을 commit한다는 것은 **offset 13 미만의 필요한 처리가 끝났다고 선언**하고, 재시작 뒤 13부터 재개하겠다는 의미입니다. offset 13 자체를 처리했다는 뜻은 아닙니다.

Kafka `KafkaConsumer` 공식 Javadoc이 설명하듯, `committed offset`은 마지막으로 처리한 레코드 번호가 아니라 재시작 뒤 다음에 읽을 위치입니다. 그래서 10만 처리했다면 11을 저장하지만, 12를 먼저 끝냈다는 이유로 13을 저장하면 아직 끝나지 않은 10·11을 재시작 뒤 건너뛸 수 있습니다. 따라서 commit 후보는 앞에서부터 끊기지 않고 성공한 구간의 다음 위치여야 합니다.

## 단일 poll의 위치·처리·commit 상태표

아래에서는 P0에 실제 레코드 10·11·12가 연속으로 전달되었다고 가정합니다. `committed=10`은 재시작하면 10부터 다시 받는다는 뜻입니다.

| 시점 | client position | 외부 처리 상태 | group committed | 안전한 해석 |
|---|---:|---|---:|---|
| 시작 | 10 | 아직 없음 | 10 | 다음 작업은 10입니다. |
| poll 완료 | 13 | 10 실행 중, 11 성공, 12 성공 | 10 | 받은 위치만 13이 되었고 commit은 전진하지 않습니다. |
| 10도 성공 | 13 | 10·11·12 모두 성공 | 10 | 연속 완료 경계가 13까지 열렸습니다. 이제 13을 commit할 수 있습니다. |
| 10 효과 후 프로세스 종료 | 13 | 10은 DB에 반영됐을 수 있음 | 10 | 재시작 뒤 10이 다시 오므로 중복 방지 키가 필요합니다. |
| 10 실패·재시도 대기 | 13 | 11·12만 성공 | 10 | 뒤의 성공만으로 13을 commit하면 10을 건너뜁니다. |
| 10·11·12 모두 성공 후 `commitSync({P0:13})` 실패 | 13 | 외부 효과는 완료 | 10 | 13을 성공 checkpoint로 기록하지 않고, 재시작 시 10부터 재전달 가능하게 둡니다. |

offset 숫자에 공백이 있다고 해서 공백을 처리할 때까지 멈추라는 뜻은 아닙니다. compaction, 제어 레코드, 보관 정리 등으로 실제 전달 레코드가 없는 위치가 있을 수 있습니다. 완료 경계는 “모든 정수”가 아니라 “실제로 전달받은 순서열 중 앞에서부터 성공한 구간”으로 계산해야 합니다.

## 병렬 worker의 완료 watermark와 commit 경계

poll 스레드와 worker를 분리하면 네트워크 수신과 느린 DB 호출을 격리할 수 있습니다. 대신 파티션마다 제한된 대기열과 완료 상태가 필요합니다. 다음 그림의 핵심은 `position=13`인 consumer가 `watermark=10`인 상태로도 정상일 수 있다는 점입니다. watermark는 다음 commit 후보인 위치를 뜻하며, 여기서는 10이 아직 미완료이므로 그대로입니다.

다만 이 watermark는 **앞선 offset이 완료될 때까지 commit을 늦추는 경계**일 뿐입니다. 11·12의 외부 효과가 10보다 먼저 실행되는 것 자체를 되돌리거나 막아 주지는 않습니다. 순서가 의미인 상태 전이라면 같은 파티션 또는 같은 key의 작업을 직렬화하거나, 도메인 저장소가 기대하는 다음 순번을 조건으로 거부·보류해야 합니다.

```diagram
{"title":"수신 위치와 완료 경계","caption":"화살표는 레코드와 완료 정보의 흐름입니다. position은 poll이 만든 수신 위치이고, watermark만 처리 성공을 반영해 group coordinator에 commit됩니다.","rows":[[{"id":"poller","label":"Consumer poll","detail":["position=13","10·11·12 전달"]},{"id":"queue","label":"Partition 큐","detail":["bounded","순서 목록 유지"]}],[{"id":"worker","label":"Worker","detail":["외부 효과 수행","성공·실패 반환"]},{"id":"watermark","label":"완료 watermark","detail":["앞의 연속 성공","다음 commit 위치"]}],[{"id":"coordinator","label":"Group coordinator","detail":["committed offset","소유권 세대 검사"]}]],"edges":[{"from":"poller","to":"queue","label":"레코드 전달"},{"from":"queue","to":"worker","label":"작업 투입"},{"from":"worker","to":"watermark","label":"완료 표시"},{"from":"watermark","to":"coordinator","label":"offset commit"},{"from":"coordinator","to":"poller","label":"할당·재할당"}]}
```

완료 상태 자료구조는 offset 정수의 연속성만 전제로 만들면 안 됩니다. 파티션별로 `deliveredOffsets`를 poll로 전달된 순서대로 보관하고, 완료된 offset 집합을 별도로 두는 방식이 이해하기 쉽습니다. 다음은 실행 코드가 아닌 의사코드입니다.

```pseudocode
# KafkaConsumer를 소유하는 한 poll thread에서만 호출합니다.
onPoll(records):
    for each partition p in records:
        # poll 전에 이번 배치를 보관할 제한된 메모리를 확보했다고 가정합니다.
        for record in records[p]:
            task = Task(record, generation=state[p].generation)
            state[p].deliveredOffsets.append(record.offset)
            state[p].waitingToSubmit.append(task)
        submitWaiting(p)

submitWaiting(p):
    while state[p].waitingToSubmit is not empty:
        task = state[p].waitingToSubmit.front
        if not workerQueue.trySubmit(task):
            pause(p)                         # 입력은 보관하고 미완료 경계로 남김
            return
        state[p].waitingToSubmit.pop_front()
    resume_if_capacity_allows(p)

onWorkerFinished(result):
    # worker가 보낸 완료 이벤트를 소유 thread의 입력 큐에서 꺼내 처리합니다.
    p = result.partition
    if p not in state or result.generation != state[p].generation:
        discard_late_result(result)          # 이미 소유권을 잃은 작업
        return
    if result.success:
        state[p].completed.add(result.offset)
    else:
        state[p].failed.add(result.offset)   # 실패 offset 앞에서 완료 watermark를 멈춤

    while state[p].deliveredOffsets is not empty and
          state[p].deliveredOffsets.front in state[p].completed:
        finished = state[p].deliveredOffsets.pop_front()
        state[p].completed.remove(finished)
        state[p].nextCommit = finished + 1

commitCompleted():
    for p whose nextCommit advanced:
        candidate = state[p].nextCommit
        try:
            commitSync({p: candidate})       # 무인자 commitSync()로 poll position을 저장하지 않음
            state[p].lastSuccessfulCommit = candidate
        catch CommitFailedException:
            keep_candidate_uncommitted(p, candidate)
            # 성공 checkpoint로 기록하지 않음; 새 owner의 재전달을 허용
            retain_external_effect_id_for_dedup(p, candidate)
```

`finished + 1`은 Kafka가 그 offset 이후 위치부터 다시 탐색하도록 하는 표현입니다. 중간 숫자에 레코드가 없어도 broker가 실제 다음 레코드로 건너뛸 수 있으므로, 존재하지 않는 offset을 완료 집합에 억지로 넣지 않습니다.

완료 watermark를 계산하기 전에 `deliveredOffsets` deque가 비어 있지 않은지 확인하고, worker 큐에 아직 제출하지 못한 레코드도 전달 순서 목록에 미완료로 남겨야 합니다. 예를 들어 10의 제출이 실패했는데 11·12만 목록에 넣으면, 11과 12가 끝나는 순간 경계가 13으로 잘못 이동해 10을 건너뜁니다. 전달 순서 목록에는 미완료 상태를 남기고, 제출되지 않은 task 본문은 제한된 큐에 따로 보관해야 합니다.

위 코드는 작업의 세대와 모든 전달 offset을 먼저 등록하고, 제출되지 않은 본문을 제한된 대기 큐에 보관합니다. 큐에 자리가 생기면 소유 스레드가 `submitWaiting`을 다시 호출합니다. 실행 실패 항목도 같은 세대에서 재시도하거나 명시적인 격리 정책을 완료하기 전에는 성공으로 표시하지 않습니다.

보관 자체가 실패하면 해당 파티션의 commit 전진을 막고 소비자를 종료해 기존 commit 위치부터 재전달받는 등, 입력을 버리지 않는 복구 경로가 필요합니다. 한 번의 poll 배치를 모두 처리한 경우에는 client가 제공하는 파티션별 다음 위치 계산을 사용할 수도 있지만, 그 계산 결과가 실제 외부 효과 완료보다 앞서지 않는지 확인해야 합니다.

실패한 레코드를 건너뛸지, 재시도할지, 명시적인 격리 큐로 보낼지는 서비스의 데이터 손실 정책으로 정해야 합니다.

`lastSuccessfulCommit`은 클라이언트가 성공 응답을 확인한 위치입니다. 응답 유실이나 timeout이면 서버에는 commit이 반영됐을 수도 있으므로 실제 group 위치를 10이라고 단정할 수 없습니다. 위 예의 `CommitFailedException`처럼 소유권 관련 오류와 일시적 timeout을 구별하고, 이미 잃은 할당에는 다시 commit하지 않습니다. 새 할당의 세대 값은 이전 할당과 재사용하지 않고, `nextCommit`은 실제 재개 위치로 초기화합니다.

## 외부 효과와 offset commit의 중복·누락 경계

일반적으로 외부 효과를 먼저 확정하고 그 뒤에 offset을 commit하면, 두 단계 사이의 종료에서 같은 레코드가 다시 전달될 수 있습니다. 이것은 누락보다 중복 재처리를 선택한 형태입니다. 같은 DB transaction 안에 `eventId` 처리 기록과 도메인 변경을 넣고 고유 제약으로 재전달을 흡수하면, 재시도는 가능하지만 효과는 한 번만 남길 수 있습니다. 외부 HTTP나 결제 API라면 그 API의 idempotency key 또는 결과 조회가 별도로 필요합니다.

반대로 offset을 먼저 commit하고 DB를 바꾸면 consumer가 성공했다고 선언한 뒤 프로세스가 죽을 때 외부 효과가 영구히 빠질 수 있습니다. `enable.auto.commit=true`인 상태의 주기적 자동 commit도 애플리케이션 처리 완료를 확인해 주는 장치가 아닙니다. 수동 완료 경계를 설계한다면 자동 commit을 끄고 명시적인 commit 위치를 관리해야 합니다.

이 때문에 관측값도 하나로 합치지 않습니다. client가 받아온 `position`, group에 저장된 `committed`, worker가 완료한 `effect watermark`, 그리고 가장 오래된 미완료 작업의 나이를 각각 기록해야 합니다. commit을 빨리 해 내부 큐에 일이 쌓이면 Kafka lag만 작게 보일 수 있고, commit을 늦게 해도 DB 처리는 이미 끝나 lag가 크게 보일 수 있습니다.

## rebalance와 진행 중 작업의 취소·소유권

소비자 그룹에서 파티션은 한 시점에 한 consumer에게만 할당됩니다. 하지만 그 consumer가 이미 worker에 넘긴 DB 호출이 rebalance와 동시에 자동 취소되는 것은 아닙니다. 새 consumer가 같은 파티션을 받기 전에 옛 worker가 늦게 완료할 수 있으므로, event ID 중복 방지와 도메인 version 조건을 함께 둬야 합니다.

각 작업에 assignment generation을 붙이고 완료 이벤트를 소유 스레드가 확인하게 하면, 현재 generation과 다른 늦은 완료를 외부 상태에 반영하지 않을 수 있습니다. 이것은 이미 발행된 DB 호출을 소급해 취소한다는 뜻이 아니며, 저장소의 조건부 version 검사와 함께 써야 합니다.

```diagram
{"title":"반납과 소유권 상실의 차이","caption":"화살표는 partition 소유권과 commit 가능 범위를 나타냅니다. revoke는 아직 소유자인 동안 정리할 기회이고, lost는 이미 소유권이 끝난 뒤의 정리 통지입니다. lost 뒤에는 다른 consumer가 이미 소유 중일 수 있어 인과 화살표를 그리지 않습니다.","rows":[[{"id":"old","label":"기존 consumer","detail":["worker 실행 중","partition 소유"]}],[{"id":"revoke","label":"onPartitionsRevoked","detail":["새 투입 중지","완료 경계 commit"]},{"id":"lost","label":"onPartitionsLost","detail":["소유권 이미 종료","commit하지 않음"]}],[{"id":"new","label":"새 consumer","detail":["assignment 수신","로그에서 재처리"]}]],"edges":[{"from":"old","to":"revoke","label":"정상 반납 통지"},{"from":"revoke","to":"new","label":"commit 후 handoff"},{"from":"old","to":"lost","label":"세션 만료·치명 오류"}]}
```

정상적인 `onPartitionsRevoked`에서는 해당 파티션에 새 작업을 넣지 않고, 진행 중 작업을 정해진 시간 안에 끝내거나 재시도 가능한 상태로 돌린 다음 완료된 연속 구간만 commit하는 경계를 둘 수 있습니다. Kafka 공식 `ConsumerRebalanceListener` Javadoc은 이 callback이 파티션을 넘기기 전에 호출되며, 이때 offset과 파티션별 상태를 저장할 수 있다고 설명합니다.

반면 `onPartitionsLost`는 session 만료나 치명적인 group 오류처럼 이미 소유권을 잃은 뒤 호출됩니다. 다른 consumer가 벌써 그 파티션을 소유할 수 있으므로 이 callback을 마지막 commit 기회로 취급하면 안 됩니다.

이때는 worker 취소, 임시 자원 반환, 늦은 완료 표시 차단 같은 정리를 하고, 새 소유자는 자신의 assignment를 받은 뒤 원본 log에서 다시 읽게 됩니다. lost callback이 새 consumer에게 파티션을 넘기는 화살표나 handoff를 뜻하지 않는 이유가 여기에 있습니다.

`onPartitionsAssigned`에서는 외부에 별도로 보관한 처리 상태가 있다면 새 소유자의 시작 위치와 대조할 수 있습니다.

### Group과 cooperative rebalance 이동 범위

partition 3개에 같은 group의 consumer 5개라면 일반 할당에서는 최대 3개만 partition을 맡고 나머지는 유휴일 수 있습니다. Pod당 consumer 수가 몇 개인지도 확인합니다. 다른 group은 같은 로그를 자기 offset으로 독립 소비하므로 분석·알림이 각각 모든 레코드를 받아야 하면 group을 분리합니다. group 이름 변경은 새 시작 위치·재생·중복 효과의 변경입니다.

cooperative rebalance는 일부 partition만 단계적으로 넘겨 전체 반납 중단을 줄일 수 있습니다. 반납 대상의 큐·완료·세대만 정리하고 계속 소유한 partition과 혼동하지 않습니다. client·assignor·group protocol별 callback 계약을 확인합니다. 이 기능이나 static membership은 외부 DB의 옛 쓰기를 취소하거나 consumer effect를 정확히 한 번으로 만들지 않습니다.

메모리 큐를 폐기할 때는 원본 보관 범위와 성공 commit이 미완료 작업보다 앞서지 않는지 확인합니다. log start보다 오래된 재개 위치라면 조용히 latest로 보내지 말고 snapshot·재생의 복구 계약으로 처리합니다. topic을 같은 이름으로 재생성하거나 다른 cluster로 옮기면 topic·partition·offset도 영구 업무 ID가 아니므로 이벤트 ID·원본 세대를 유지합니다.

## poll 주기·큐 상한·완료 계약

느린 DB 호출을 poll callback 안에서 모두 기다리면 다음 poll 사이가 길어집니다. Kafka 4.3 consumer 설정에서 확인한 `max.poll.interval.ms` 기본값은 300,000ms이며, group-managed consumer가 이 간격을 넘기면 실패한 member로 간주되어 rebalance가 일어날 수 있습니다.

`group.instance.id`를 쓰는 static member는 소유권 이동이 session timeout까지 늦어질 수 있지만, 이것이 실행 중 외부 작업의 원자 취소나 완료를 보장하지는 않습니다.

`KafkaConsumer`는 thread-safe하지 않으므로 poll·commit·pause를 여러 thread가 각각 호출하는 구조를 그대로 쓰면 안 됩니다.

권장 경계는 consumer를 소유한 한 thread가 `poll()`을 호출하고, worker의 완료 이벤트를 thread-safe한 내부 queue로 받아 같은 소유 thread에서 완료 watermark 반영, `pause`/`resume`, 명시적인 `commitSync(offsetMap)`을 순서대로 수행하는 방식입니다.

worker는 KafkaConsumer를 직접 만지지 않고 결과만 돌려줍니다. 이렇게 해야 rebalance callback과 완료 이벤트가 서로 다른 thread에서 같은 assignment state를 덮어쓰지 않습니다.

앞의 의사코드의 `onWorkerFinished`도 worker thread가 KafkaConsumer를 호출한다는 뜻이 아니라, 소유 thread가 내부 완료 queue에서 꺼낸 결과를 처리하는 단계입니다.

poll과 worker를 나눠도 내부 queue를 무한히 키우면 메모리에 미완료 작업이 쌓일 뿐입니다. queue가 가득 차면 해당 파티션을 `pause`해 새 레코드를 덜 받되, consumer thread는 `poll`을 계속 호출해 client의 heartbeat 계약을 지켜야 합니다. `pause`는 해당 파티션의 전달만 조절하며 group에서 나가거나 소유권을 포기하는 동작이 아닙니다. 그래서 멈춘 작업의 실제 나이와 queue에서 가장 오래된 offset을 함께 관측합니다.

## 순서 의존 효과와 watermark의 한계

완료 watermark가 10에 멈춰 있다는 사실은 10 미만의 commit 경계를 안전하게 지켜 주지만, worker가 11·12의 외부 효과를 이미 먼저 실행했다는 사실을 없애지 않습니다. 예를 들어 10이 잔액을 확인하는 차감이고 11이 환불이라면, 11의 완료를 watermark 뒤에 숨겨도 데이터베이스에는 환불이 먼저 반영될 수 있습니다.

같은 파티션의 기록 순서 자체가 외부 상태 전이 순서여야 한다면 해당 key 작업을 직렬화하거나, 저장소 transaction에서 `expectedSequence`를 검사해 42를 기다리는 43을 보류해야 합니다. watermark는 **offset commit의 누락을 막는 장치**이지, 병렬 worker의 효과 순서를 재배열하는 장치가 아닙니다.

## 입력 상태별 예상 broker 위치와 결과

| 실험 입력 | 중단 지점·상태 | 예상되는 broker 위치 | 확인할 결과 |
|---|---|---|---|
| P0에 10·11·12 전달, worker는 11·12만 성공 | 10 실행 중 | commit 후보는 10 | 13을 commit하지 않고 10 재전달 가능성을 남깁니다. |
| 큐가 가득 차 12 제출 실패 | 10·11 성공, 12 미제출 | commit 후보는 12 | 12를 전달 순서 목록에 미완료로 보관합니다. 제출만 아니라 처리 성공까지 확인하기 전에는 13을 commit하지 않습니다. |
| 10 DB commit 직후 offset commit 전 프로세스 종료 | 외부 효과는 있음, group offset은 10 | 재시작 위치 10 | 10이 다시 오지만 `eventId` 처리 기록으로 중복 효과를 막습니다. |
| 10·11·12 모두 성공 후 `commitSync({P0:13})` 실패 | 외부 효과는 완료, group offset은 10 | 성공 checkpoint는 10 | 13을 성공으로 기록하지 않고 재전달 가능성을 유지합니다. |
| 10이 미완료인데 순서 의존적인 11·12가 먼저 완료 | watermark는 10 | commit 후보는 10 | watermark만으로 선행 효과를 되돌리지 못하므로 같은 key를 직렬화하거나 저장소 sequence 조건으로 보류합니다. |
| revoke callback 중 11 완료, 10 미완료 | 기존 consumer가 아직 owner | commit은 10 이하 | 새 owner가 10부터 재처리하고 11 중복을 흡수합니다. |
| lost callback 이후 늦은 worker 완료 | 기존 owner가 아님 | 늦은 commit은 허용하지 않음 | 외부 write가 새 상태를 덮지 않도록 generation/version을 검사합니다. |
| `pause` 후 poll을 계속 호출 | queue 포화, group은 유지 | position은 일시 정지 | pause와 leave/rebalance를 같은 동작으로 기록하지 않습니다. |

이 입력을 실제로 실행했다고 주장하지 않습니다. 실행할 때는 Kafka committed offset과 애플리케이션 effect watermark를 한 로그에 섞지 말고, 중복·누락·가장 오래된 작업 나이를 별도 기준으로 대조해야 합니다.

## Kafka 공식 문서와 API 계약

- [Apache Kafka 4.3 KafkaConsumer Javadoc](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html): `poll`, `position`, committed offset, `commitSync`, offset gap과 처리 후 commit의 의미.
- [Apache Kafka 4.3 ConsumerRebalanceListener Javadoc](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/ConsumerRebalanceListener.html): `onPartitionsRevoked`, `onPartitionsAssigned`, `onPartitionsLost`의 호출 시점과 commit 가능 경계.
- [Apache Kafka 4.3 Consumer Configs](https://kafka.apache.org/43/configuration/consumer-configs/): `max.poll.interval.ms`, `enable.auto.commit`, `max.poll.records`의 동작.
- [Apache Kafka 4.3 KafkaConsumer Javadoc — Method summary](https://kafka.apache.org/43/javadoc/org/apache/kafka/clients/consumer/KafkaConsumer.html#thread-safety): `KafkaConsumer`가 thread-safe하지 않다는 계약과 consumer method를 한 thread에서 호출해야 하는 경계.
