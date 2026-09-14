---
id: iocp-completion
title: IOCP 완료 식별과 제출 전 참조 예약
topic: 네트워크
summary: completion key·OVERLAPPED·GQCS 결과를 나누고 즉시 성공·pending·통지 생략·반환 전 완료에서 단일 정리 책임을 설명합니다.
questionIds: [iocp-completion-key-overlapped, iocp-gqcs-error-contract, gqcs-ex-per-entry-error, iocp-immediate-completion, windows-skip-success-completion, iocp-completion-before-submit-return, iocp-operation-counter-invariants, iocp-generation-not-memory-safety, iocp-user-packet-tagging]
---

# IOCP 완료 식별과 제출 전 참조 예약

## 연결 하나에도 여러 작업이 있습니다

소켓 A에서 수신 17과 송신 28을 동시에 제출하면 같은 핸들에서 나온 완료라도 작업 종류와 버퍼는 다릅니다. completion key는 보통 핸들·연결의 맥락이고, OVERLAPPED 포인터는 개별 중첩 I/O의 맥락입니다. 포인터를 key에 넣었다고 자동으로 참조를 잡아 주지는 않습니다.

미완료 작업마다 독립 OVERLAPPED를 두고 작업 컨텍스트에 종류·버퍼·연결 참조·세대를 저장합니다. 포인터 크기를 보존하는 ULONG_PTR 등의 API 타입을 사용하고 임의 메모리를 잘못된 포함 객체로 캐스팅하지 않습니다.

## GQCS의 반환값과 포인터를 함께 봅니다

| 반환 | OVERLAPPED | 해석 |
| --- | --- | --- |
| TRUE | non-null | 성공 I/O 또는 규약상 사용자 패킷 |
| FALSE | non-null | 실패한 I/O 완료, 그 작업을 종결해야 함 |
| TRUE | null | 사용자 제어 패킷으로 정의 가능 |
| FALSE | null | 패킷을 못 얻음, timeout·포트 오류 등 |

FALSE·null에서는 bytes·key가 유효한 작업 결과라고 가정하면 안 됩니다. FALSE·non-null에서 continue만 하면 실패 작업의 버퍼·참조가 남습니다. GetLastError는 다른 호출이 바꾸기 전에 저장합니다. timeout은 특정 I/O의 실패나 취소 완료가 아닙니다.

PostQueuedCompletionStatus는 애플리케이션 값을 게시하므로 non-null 포인터라고 반드시 커널 완료는 아닙니다. 이 노트의 단순 규약은 사용자 패킷을 null OVERLAPPED와 예약된 key로 구분하는 것입니다. payload 수명과 게시 실패의 반환 책임도 정해야 합니다.

```diagram
{"kind":"class","title":"핸들 맥락과 작업 맥락의 분리","caption":"화살표는 참조·식별 관계입니다. 완료 패킷의 key와 포인터는 식별값이며 실제 소유 참조는 제출 전에 별도로 확보합니다.","rows":[[{"id":"packet","label":"완료 패킷","detail":["key · OVERLAPPED · bytes"]}],[{"id":"connection","label":"Connection","detail":["종료 상태 · 세대"]},{"id":"operation","label":"IoContext","detail":["OVERLAPPED · 작업 종류","버퍼 · 소유 참조"]}]],"edges":[{"from":"packet","to":"connection","label":"completion key"},{"from":"packet","to":"operation","label":"작업 포인터"},{"from":"operation","to":"connection","label":"완료까지 참조"}]}
```

## 즉시 성공과 통지 도착은 별개의 계약입니다

기본 IOCP 통지 모드에서 WSARecv가 0을 반환해도 완료 패킷이 올 수 있습니다. SOCKET_ERROR와 WSA_IO_PENDING은 제출이 성공해 나중 결과를 기다리는 상태입니다. 그 밖의 즉시 오류는 해당 API가 완료를 통지하지 않는 계약이면 제출자가 예약을 되돌립니다.

| 제출 결과 | 기본 모드의 종결 소유자 |
| --- | --- |
| 즉시 성공 | 완료 포트 경로 |
| pending | 완료 포트 경로 |
| 완료 통지 없는 즉시 실패 | 제출 실패 경로 |

기본 모드는 완료 포트 연결과 통지 억제 설정이 없다는 전제입니다. OVERLAPPED hEvent의 낮은 비트 등으로 포트 통지를 억제하는 기능까지 섞으면 표의 계약이 달라집니다. 처음에는 경로를 단순화하고 최적화는 측정 뒤 적용하는 편이 검증하기 쉽습니다.

## 제출 함수가 돌아오기 전에 완료 worker가 실행될 수 있습니다

작업 참조를 호출 뒤 증가시키면 worker가 먼저 감소·해제할 수 있습니다. 또한 완료용 참조 하나만 잡아 두면 worker가 그것을 놓은 뒤 제출자가 반환 상태를 기록하려다 해제된 객체를 읽을 수 있습니다. **제출자 참조와 완료 참조를 별도로** 준비합니다.

```text
submit(connection, operation):
    acquire_submitter_reference(operation)
    atomically_check_open_and_reserve_pending(connection, operation)
    acquire_completion_reference(operation)
    result = call_overlapped_api(operation)
    if result is definite_failure_without_completion:
        finish_reserved_operation_once(operation, submission_error)
    else if result is immediate_success and confirmed_skip_mode:
        finish_reserved_operation_once(operation, success)
    # 나머지는 완료 경로가 담당
    release_submitter_reference(operation)

onCompletion(operation, result):
    finish_reserved_operation_once(operation, result)
```

finish는 실제 결과 처리·후속 버퍼 참조 이전·pending 등록 제거·완료 참조 반환을 일관되게 수행합니다. 제출 성공과 완료 사이 카운터가 잠깐 0처럼 보이지 않게 등록을 먼저 합니다. 중복 finish를 원자적으로 막는 것도 이미 해제된 포인터에 접근해도 된다는 뜻은 아닙니다.

## 성공 통지 생략 모드는 분기를 바꿉니다

지원되는 핸들에 FILE_SKIP_COMPLETION_PORT_ON_SUCCESS를 성공적으로 설정하면 즉시 성공한 요청의 포트 통지가 생략될 수 있으므로 직접 종결 경로가 필요합니다. pending은 나중 완료 경로를 유지합니다. 핸들에 적용된 모드를 명시적으로 저장하고 설정 실패를 성공으로 취급하지 않습니다.

공식 문서상 설정한 모드는 핸들에서 제거할 수 없고, 소켓의 경우 IFS 핸들을 반환하는 provider 지원 조건이 있습니다. 기본·skip 모드를 실행 중 추측하거나 파일 API·Winsock의 반환 규칙을 혼용하지 않습니다. 즉시 성공·pending 성공·pending 실패·즉시 오류를 모두 확인해야 합니다.

## 배치 완료와 세대의 한계

GetQueuedCompletionStatusEx의 함수 성공은 여러 항목을 수집했다는 뜻이지 모든 I/O가 성공했다는 뜻이 아닙니다. 항목별 상태와 바이트·컨텍스트를 API의 결과 해석 규칙에 따라 처리합니다. GetLastError 하나를 모든 항목의 오류로 복사하지 않습니다. 내부 상태 값과 Win32·Winsock 오류 표현을 무조건 같은 숫자로 해석하지도 않습니다.

세대 번호는 늦은 결과가 새 연결에 적용되는 것을 막지만 비교할 메모리 자체가 살아 있어야 합니다. 주소를 풀에 돌린 뒤 새 객체로 덮고 세대만 검사하는 것은 커널·worker의 오래된 포인터 접근을 안전하게 만들지 않습니다.

## 확인한 문서와 검증 범위

[GetQueuedCompletionStatus](https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-getqueuedcompletionstatus)의 반환 조합과 통지 억제, [SetFileCompletionNotificationModes](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setfilecompletionnotificationmodes)의 skip 조건을 확인했습니다. 실제 Windows 실행 테스트는 별도로 필요합니다.

테스트는 반환 전 완료, 기본 모드 즉시 성공, skip 모드 즉시 성공, pending, 취소·오류, 사용자 패킷과 GQCS timeout을 교차시킵니다. 작업 집합·연결 pending·참조 반환을 대조해 누수와 이중 해제를 각각 검출해야 합니다.
