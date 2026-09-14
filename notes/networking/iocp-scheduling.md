---
id: iocp-scheduling
title: IOCP 워커·배치·후속 실행의 공정성
topic: 네트워크
summary: 생성 스레드와 포트 concurrency를 분리하고 완료 배치 소유·offload 큐·연결별 적용 순서와 지연 예산을 설명합니다.
questionIds: [iocp-concurrency-workers, iocp-worker-wakeup-locality, iocp-blocking-offload-queue, iocp-batch-fairness, iocp-offload-connection-order, iocp-short-long-connection-fairness]
---

# IOCP 워커·배치·후속 실행의 공정성

## concurrency는 스레드를 생성하는 개수가 아닙니다

앱이 worker 16개를 만들고 IOCP concurrency를 8로 지정해도 OS가 스레드 8개만 생성하거나 나머지를 삭제하지 않습니다. worker는 앱이 생성하고 GQCS를 기다립니다. concurrency는 포트와 연결된 스레드의 실행을 조절하는 스케줄링 입력입니다.

이는 애플리케이션 요청 수나 연결별 상호 배제의 상한이 아닙니다. worker가 블로킹에 들어가고 다시 실행되는 상황까지 실제 스케줄링 계약을 확인해야 하며, 도메인 동시성을 정확히 8개로 제한하는 세마포어 대용으로 사용하지 않습니다.

## 완료 큐 순서와 worker 깨움은 다른 순서입니다

IOCP 완료 패킷의 큐잉과 대기 worker를 깨우는 정책은 구분합니다. 최근 실행한 worker를 재사용하는 LIFO 성격의 깨움은 캐시 지역성과 전환 비용을 줄이는 데 도움이 될 수 있지만 사용자 연결별 공정성을 자동으로 보장하지 않습니다.

| 값 | 조절하는 대상 | 별도 필요한 것 |
| --- | --- | --- |
| worker 수 | 생성한 실행 스레드 | 스택·수명·종료 |
| port concurrency | 포트 실행 스케줄링 | 요청별 자원 제한 |
| dequeue batch | 한 번 수집하는 항목 수 | 항목 처리 시간 예산 |
| 후속 pool 크기 | 별도 CPU·블로킹 실행 | 큐·바이트·기한 상한 |

같은 연결의 여러 완료가 다른 worker에서 처리될 수 있으므로 completion key가 같다는 사실로 연결 필드 수정이 직렬화되지 않습니다.

## 배치를 꺼낸 순간 소유권이 앱으로 넘어옵니다

GQCSEx로 100개를 가져왔다면 그 항목은 포트 큐에서 이미 빠졌습니다. 일부만 처리하고 포트 대기로 돌아간다고 나머지가 포트에 자동 복귀하지 않습니다. 자체 batch 저장소나 큐가 컨텍스트·버퍼 참조를 유지해야 합니다.

```diagram
{"title":"빠른 수집 뒤에도 처리 대기는 남습니다","caption":"화살표는 완료 컨텍스트의 소유권 이전입니다. 별도 실행기 제출에 실패하면 수집자가 책임을 유지하고, 후속 처리 전 버퍼를 반환하지 않습니다.","rows":[[{"id":"port","label":"IOCP 완료 큐"}],[{"id":"collector","label":"완료 수집 worker","detail":["항목별 결과 식별"]}],[{"id":"queue","label":"제한된 후속 큐","detail":["연결별 순서 · 바이트 예산"]}],[{"id":"handler","label":"파싱·도메인 처리","detail":["끝난 뒤 마지막 참조 반환"]}]],"edges":[{"from":"port","to":"collector","label":"dequeue"},{"from":"collector","to":"queue","label":"참조 소유 이전"},{"from":"queue","to":"handler","label":"실행 기회"}]}
```

함수 성공이 항목 전부 성공이라는 뜻도 아닙니다. 각 항목 오류를 따로 해석하고 실패 완료도 종결해야 합니다. 배치가 가득 찰 때까지 불필요하게 기다리는 정책은 한산한 큐의 짧은 요청을 늦춥니다.

## 개수뿐 아니라 시간과 연결별 몫을 제한합니다

짧은 완료 100개와 압축 해제 하나가 같은 비용일 수는 없습니다. 수집 개수 상한과 실제 파싱·콜백 실행 시간 예산을 나누고 긴 작업은 분할하거나 제한된 별도 실행기로 보냅니다. 비선점 콜백 하나가 매우 길면 다음 항목을 줄이는 것만으로 지연 상한을 만들 수 없습니다.

연결 하나가 계속 데이터를 생산하면 round-robin ready 연결이나 연결별 처리 quota로 다른 연결에도 기회를 줄 수 있습니다. 동점·우선순위·기아 정책은 별도이며, 특정 worker의 처리 개수가 균등한 것과 사용자 지연이 공정한 것은 다릅니다.

## Offload는 병목을 없애지 않고 옮길 수 있습니다

완료 수집을 빠르게 만들어도 후속 pool이 감당하지 못하면 대기와 buffer 보유가 그쪽으로 이동합니다. 후속 큐의 개수·바이트·나이·실행 수를 제한하고 포화되면 새 I/O 제출·수락·상위 유입을 조절해야 합니다. 이미 dequeue한 완료를 조용히 버려서는 안 됩니다.

같은 연결의 메시지 적용 순서가 필요하면 단일 연결 executor나 논리 순번을 사용합니다. 완료 도착 순서가 원래 메시지 순서라는 가정을 하지 않습니다. 실행기 경계를 넘을 때 취소·세대·필수 결과의 기록 책임도 유지합니다.

```text
collect(entry):
    context = identify_and_retain(entry)
    result = decode_individual_completion(entry)
    if bounded_followup_queue_accepts(context, result):
        transfer_reference_to_followup()
    else:
        retain_locally_and_apply_overload_policy()
        reduce_new_submission()
```

이 모형에서 포화 정책은 실제로 제한된 저장 공간과 진행 경로가 있어야 합니다. 로컬 보류 큐를 또 무한히 만드는 것은 해결이 아닙니다. 미리 제출할 작업 수와 완료를 보관할 공간을 함께 예약하는 방법도 고려합니다.

## 종료와 측정은 두 실행기를 모두 포함합니다

새 제출을 막고 커널 완료와 후속 처리 큐를 모두 drain한 뒤 worker를 닫습니다. 후속 큐가 살아 있는데 IOCP 작업 카운터만 0이라고 버퍼를 해제하면 안 됩니다. 실행기 간 서로의 종료 콜백을 기다리는 고리도 피해야 합니다.

작은 완료만 있는 부하, 큰 파싱 혼합, 한 연결 폭주, 많은 유휴 연결에서 worker 수·concurrency·batch·시간 예산을 독립적으로 바꿉니다. 완료 수집 대기와 후속 큐 대기, 짧은 요청 p99, CPU·문맥 전환·원본 오류를 같이 봅니다. 실제 Windows 실행 결과는 별도 환경에서 검증해야 하며 설정값 자체를 성능 개선의 증거로 삼지 않습니다.
