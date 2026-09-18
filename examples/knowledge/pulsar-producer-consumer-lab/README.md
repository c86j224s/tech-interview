# Pulsar producer·consumer 실습

Java client와 broker image는 4.2.4, Java는 17로 고정합니다. producer 저장 확인, 파일 원장 효과, individual ACK를 분리합니다. Shared는 retry-topic 경로, Key_Shared는 key-based batching과 negative ACK를 사용합니다.

## 실행

Java 17, Maven 3.9+, Docker Compose v2가 필요합니다.

```sh
cd examples/knowledge/pulsar-producer-consumer-lab
mvn test
bash scripts/run-standalone.sh
bash scripts/run-multinode-failure.sh
```

standalone은 consumer READY 후 publish하며 volume과 `var/inbox.ledger`를 보존합니다. 여러 Shared worker가 중복 제거를 공유하려면 동일한 `PULSAR_INBOX_LEDGER` 경로를 사용합니다. 기본 producer를 다시 실행하면 새 event ID를 생성하므로 새로운 업무가 됩니다.

## 다중 노드와 장애 검사

ZooKeeper 1개, BookKeeper bookie 3개, broker 2개가 공통 metadata를 공유합니다. 단일 ZooKeeper는 SPOF입니다. E3/W3/A2와 여분 bookie 없는 구성은 bookie 장애 뒤 지속 쓰기·재복제를 보장하지 않습니다.

`bindAddresses`와 `advertisedListeners`를 분리합니다. 내부 broker port는 6650, 외부 bind port는 16650이고 host loopback 6650·6651로 매핑됩니다. host client는 `PULSAR_LISTENER_NAME=external`을 사용합니다.

`multinode.py`는 임의 project 이름의 disposable volume을 생성하고 종료 시 해당 project만 정리합니다. `var/<run-id>/` 로그·원장은 남습니다. 효과 COMMIT 뒤 ACK 전 worker 종료, 같은 원장의 재전달 중복 억제, 실제 owner broker 중지, survivor에서 세 sentinel ACK 확인을 수행하도록 작성되어 있습니다. bookie stop은 topology 관찰만 하며 데이터 가용성·복구 성공을 주장하지 않습니다. retry/DLQ와 Key_Shared wire 검사는 기본 runner 범위 밖입니다.

## 검증 상태

2026-09-18 JDK 17/Maven 3.9.9에서 실제 Pulsar client 컴파일과 JUnit 5개 테스트를 통과했습니다. Docker 부재로 broker startup·client wire integration·failover·bookie recovery는 NOT_RUN입니다. YAML parsing과 설정 소스 대조를 실행 성공으로 대체하지 않습니다.

파일 원장은 CRC frame, 파일 lock, `force(true)`와 재열기 중복 검사를 사용합니다. 외부 DB·결제 거래의 exactly-once 구현이 아니며, 전체 파일 재조회와 메모리 map 때문에 대규모 이력에 적합하지 않습니다. 전원 손실 내구성, symlink 별칭과 네트워크 파일시스템 lock도 검증하지 않았습니다.

[학습 노트와 공식 근거](https://c86j224s.github.io/tech-interview/notes/pulsar-producer-consumer-lab/)
