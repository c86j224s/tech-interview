---
id: iocp-shutdown
title: IOCP 취소·drain·워커 종료의 순서
topic: 네트워크
summary: 취소 요청과 실제 종결을 나누고 새 제출 차단·후속 처리 참조·종료 패킷·독립 로그의 의존 순서를 설명합니다.
questionIds: [iocp-cancel-drain, iocp-worker-shutdown, iocp-stop-packets-after-drain, iocp-timeout-loop-versus-stop-packet, shutdown-independent-audit-sink]
---

# IOCP 취소·drain·워커 종료의 순서

## 취소 함수가 돌아왔다고 버퍼 사용이 끝난 것은 아닙니다

CancelIoEx는 취소를 요청합니다. 호출 직전에 작업이 이미 완료됐거나 완료 큐로 이동 중일 수 있고, 취소와 정상 완료가 경쟁할 수 있습니다. 성공 반환이나 ERROR_NOT_FOUND를 버퍼 해제의 근거로 삼으면 안 됩니다. 애플리케이션이 추적한 작업의 실제 종결을 확인해야 합니다.

연결은 논리적으로 닫혔어도 컨텍스트와 버퍼는 완료 소비·후속 처리까지 살아 있어야 합니다. 늦은 결과를 새 세션에 적용하지 않는 것과 그 결과의 자원 정리를 생략하는 것은 전혀 다릅니다.

## 종료는 의존성의 역순으로 합니다

```diagram
{"title":"완료 통로를 마지막까지 유지합니다","caption":"화살표는 종료 절차입니다. worker와 포트는 남은 I/O 결과를 정리하는 데 필요하므로, 새 제출을 막고 drain한 뒤 종료합니다.","rows":[[{"id":"stop","label":"새 연결·I/O 제출 차단"}],[{"id":"cancel","label":"기존 작업 완료·취소 요청"}],[{"id":"drain","label":"완료와 후속 처리 drain","detail":["정상 · 취소 · 오류 모두 종결"]}],[{"id":"workers","label":"worker 종료 신호·join"}],[{"id":"port","label":"포트·공유 자원 해제"}]],"edges":[{"from":"stop","to":"cancel","label":"등록 집합 고정"},{"from":"cancel","to":"drain","label":"완료 통로 유지"},{"from":"drain","to":"workers","label":"종결 확인"},{"from":"workers","to":"port","label":"독자 없음"}]}
```

포트를 먼저 닫으면 결과를 수집해 OVERLAPPED와 버퍼를 정리할 경로를 잃을 수 있습니다. 타이머가 끝났거나 큐가 잠깐 비었다는 사실은 pending 작업이 없다는 증거가 아닙니다.

## 종료 플래그와 제출 예약을 같은 규칙으로 묶습니다

제출자가 open을 확인한 뒤 멈추고 종료자가 pending=0을 보고 연결을 해제한 다음 제출자가 재개하면 위험합니다. 새 제출 허가와 pending 등록을 같은 잠금·상태 전이로 보호해야 합니다. 완료 후 다음 WSARecv를 자동 제출하는 경로도 종료 상태를 따릅니다.

```text
beginShutdown():
    under_admission_lock:
        accepting = false
        snapshot = retain_all_registered_operations()
    for operation in snapshot:
        request_cancel_if_needed(operation)
    release_snapshot_references()
    wait_until_no_submitted_or_processing_operations()
    signal_each_worker_to_exit()
    join_workers()
    close_completion_port()
```

snapshot은 작업 목록을 순회하는 동안 컨텍스트가 사라지지 않게 참조를 유지한다는 뜻입니다. 취소 요청 자체가 정상 완료·취소 완료의 단일 종결 경로와 경쟁해 카운터를 두 번 줄이지 않게 해야 합니다. 즉시 제출 실패는 통지가 없다는 API 계약에 맞춰 예약을 되돌립니다.

## 패킷을 꺼낸 뒤에도 사용자 코드가 버퍼를 읽을 수 있습니다

완료 worker가 패킷을 꺼내자마자 pending을 0으로 만든 뒤 파서가 버퍼를 읽는다면 종료자가 먼저 메모리를 회수할 수 있습니다. 커널 I/O 참조를 후속 처리 참조로 넘기거나, 모든 소비가 끝난 뒤 마지막 참조를 놓아야 합니다.

| 상태 | 종결됐다고 볼 수 있는 것 | 남을 수 있는 것 |
| --- | --- | --- |
| CancelIoEx 반환 | 취소 요청 API 결과 | 커널 작업·완료 패킷 |
| 완료 dequeue | 해당 I/O 결과 수집 | 파싱·별도 실행기 처리 |
| 후속 처리 완료 | 버퍼 소비 종료 | 연결의 다른 작업 |
| worker join | 해당 worker 실행 종료 | 잘못 남긴 작업·참조 누수 검사 |

세대 검사에서 오래된 완료라고 판단해도 참조 반환은 해야 합니다. 반대로 세대가 맞아도 연결이 닫혔거나 요청이 취소됐다면 사용자 결과 적용은 별도 정책에 따릅니다.

## 종료 패킷 수와 배치 소비를 고려합니다

단일 GQCS로 한 worker가 종료 패킷 하나를 받고 즉시 빠지는 구조에서는 worker 수만큼 신호를 넣는 방식이 가능합니다. 하지만 GQCSEx로 한 worker가 여러 종료 패킷을 한꺼번에 가져오면 다른 worker의 신호까지 소비할 수 있습니다. 신호 전달 규약·재게시·별도 이벤트 등으로 모두 깨어나도록 설계해야 합니다.

종료 패킷은 drain 뒤에 보내거나, 받더라도 실제 종결 조건을 확인하도록 합니다. 짧은 GQCS timeout으로 주기 검사하는 방식은 단순할 수 있지만 idle wakeup 비용과 종료 반응 시간의 절충이 있습니다. 어느 쪽도 pending I/O를 자동으로 취소·회수하지 않습니다.

## 기한과 마지막 진단도 독립 계약입니다

종료 기한이 지났다고 사용 중 버퍼를 free하면 안전한 종료가 아닙니다. 강제 종료가 필요하다면 프로세스 단위 격리 등으로 범위를 정하고 불확정 외부 효과를 복구할 기록을 남겨야 합니다. 개별 작업의 메모리 수명을 무시하는 것으로 기한을 맞추지 않습니다.

마지막 로그가 이미 닫힌 DB 풀이나 종료한 worker에 의존하면 오류를 잃거나 교착할 수 있습니다. 제한된 독립 sink·stderr·내구 상태 기록을 사용하되 flush에도 기한을 둡니다. 감사 필수 기록과 버려도 되는 debug 로그의 정책을 나누고 비밀값·무한 재시도를 피합니다. 로그 전송 성공은 거래 커밋 증거가 아닙니다.

## 정지 직전·직후의 경합을 재현합니다

수신 대기·송신 진행·AcceptEx 대기에서 종료를 시작하고, 취소 직전 정상 완료·취소 직후 완료·완료 중 재제출·반복 종료를 시험합니다. 전역 및 연결별 작업 집합과 카운터, 참조 생존을 대조해야 합니다.

실제 Windows API의 취소 가능성·오류와 스케줄링은 대상 환경에서 시험해야 합니다. 이 노트는 종료 불변식이며, worker가 모두 끝났다는 결과만 보고 누수나 외부 효과까지 정리됐다고 판단하지 않습니다.
