---
id: io-uring-lifetimes
title: io_uring 버퍼 수명과 종료
topic: 네트워크
summary: 일반·등록·제공 버퍼의 수명과 CQE 기반 재사용을 구분하고, 취소·다중 완료·종료 드레인을 안전한 상태 전이로 설계합니다.
questionIds: []
prerequisites: [io-uring-foundations, reference-counting-foundations]
related: [safe-reclamation, file-state, tcp-close, iocp-completion]
reviewedAt: '2026-09-17'
---

# io_uring 버퍼 수명과 종료

## 버퍼 수명의 두 경계

io_uring 작업의 버퍼에는 적어도 두 개의 종료 경계가 있습니다. 첫째는 커널이 해당 주소를 더 이상 읽거나 쓰지 않는 I/O 완료 시점입니다. 둘째는 애플리케이션의 파서, 압축기, 송신 큐 같은 후속 소비자가 메모리를 더 이상 참조하지 않는 시점입니다. 첫째만 확인하고 pool에 반환하면 늦은 사용자 참조가 새 데이터와 겹칠 수 있습니다.

`user_data`는 operation을 찾는 식별자이지 버퍼 소유권을 자동으로 제공하지 않습니다. 안정된 operation 객체가 buffer, FD, generation, parser reference, 완료 정책을 소유하게 하고 다음 상태를 별도로 기록합니다.

`Allocated → Submitted → KernelDone → ConsumerDone → Released`

취소 요청, 소켓 close, 응답 deadline은 이 전이를 건너뛰지 않습니다. 결과의 종류와 주소를 아직 참조하는 주체를 별도 필드로 둬야, “취소되었으니 free 가능” 같은 잘못된 단축을 피할 수 있습니다.

## 일반 사용자 버퍼

일반 `read`·`recv` 작업은 SQE에 주소와 길이를 담아 커널에 전달합니다. 확인한 `io_uring(7)`의 기본 규칙은 read/write 버퍼가 완료될 때까지 유효해야 한다는 것입니다. 따라서 SQE 제출 직후 stack 배열이 반환되거나 같은 pool slot이 다음 요청으로 덮이는 구조는 금지합니다.

수신 CQE의 `res=120`은 커널 관점에서 버퍼 앞 120바이트가 결과라는 뜻입니다. 그것이 완성된 프레임인지, parser가 복사했는지, parser가 view를 계속 보유하는지는 별도 사실입니다. 한 버퍼에서 두 프레임이 나왔는데 첫 프레임만 소비했다면, 사용한 범위의 후속 참조와 버퍼 전체 반환을 연결 객체의 소비 상태로 관리합니다.

다음은 실제 liburing 프로그램이 아니라 수명 전이를 보여 주는 교육용 의사코드입니다. token 재사용 방지, parser 큐와 CQ 소비자의 동시성, `try_release`의 원자적 종결, 제출 실패 분기는 실제 구현 계약으로 보강해야 합니다.

```text
# 교육용 의사코드: 실제 컴파일·실행 결과가 아님
submit_recv(connection):
    op = operation_pool.acquire()
    op.buffer = buffer_pool.acquire()
    op.kernel_ref = 1
    op.consumer_ref = 0
    op.state = SUBMITTING
    op.user_data = new_generation_token(op)
    register_operation(op)
    prepare_recv(op)
    mark_in_flight(op)
    submit(op)

on_cqe(cqe):
    op = lookup_live(cqe.user_data)
    op.kernel_ref = 0
    op.state = KERNEL_DONE
    if cqe.res > 0:
        op.consumer_ref += 1
        parser.enqueue(op, view(op.buffer, cqe.res))
    else:
        record_result(op, cqe.res)
    try_release(op)

on_parser_done(op):
    op.consumer_ref -= 1
    try_release(op)

try_release(op):
    if op.kernel_ref == 0 and op.consumer_ref == 0 and mark_released_once(op):
        op.state = RELEASED
        unregister_operation(op)
        buffer_pool.release(op.buffer)
        operation_pool.release(op)
```

실제 다중 소비자 parser라면 단일 `consumer_ref=1`로 축약하지 않고 frame view마다 reference를 둡니다. CQE를 본 직후 `cqe_seen`을 호출하는 것과 parser가 buffer를 놓는 것은 다른 사건이며, 두 사건 모두 끝나기 전에는 pool slot을 재사용하지 않습니다.

## 등록 버퍼와 메모리 고정

등록 버퍼는 ring에 사용할 메모리 영역을 미리 등록하는 방식입니다. 확인한 `io_uring_register(2)` 문서는 등록 버퍼가 메모리에 고정되고 memory-lock quota를 사용한다고 설명합니다. 이 선택은 호출 경로와 메모리 관리 비용을 줄일 수 있는 가능성이 있지만, 많은 영역을 등록하면 프로세스의 memlock 한도와 운영 정책이 기동 조건이 됩니다.

`IORING_UNREGISTER_BUFFERS`의 동기적 해제 설명을 provided-buffer ring의 모든 해제에 일반화하지 않습니다. 등록 버퍼 관리자는 등록 상태, dependent I/O 수, parser 소비 수를 별도 카운터로 두고 모두 종결된 뒤 일반 등록 버퍼를 해제합니다. provided-buffer ring의 해제는 그 기능의 별도 계약과 실제 반환값을 확인합니다.

등록 버퍼가 모든 workload에 좋은 선택도 아닙니다. 연결 수가 적고 payload가 짧으면 고정 비용과 memlock 관리가 복사 비용보다 클 수 있습니다. 반대로 크기가 고정된 고속 수신에서 pool과 메모리 예산을 이미 관리한다면 예측 가능한 대여 경계가 장점이 될 수 있습니다. 어느 쪽이 빠른지는 실행 측정 없이는 결론 내리지 않습니다.

## 제공 버퍼와 그룹

provided buffer는 커널이 수신 시 선택할 수 있도록 길이가 같은 버퍼 여러 개를 buffer group에 제공하는 방식입니다. `IOSQE_BUFFER_SELECT`를 지정한 수신 SQE는 선택할 group ID를 사용합니다. CQE에 `IORING_CQE_F_BUFFER`가 설정되면 상위 16비트에서 선택된 buffer ID를 추출해 실제 대여 항목을 찾습니다.

선택된 버퍼는 다시 provide하기 전까지 커널의 선택 대상에서 빠집니다. 따라서 CQE를 처리하며 “이 ID가 여전히 pool에 있다”고 가정하지 말고 `KernelSelected → AppHeld → Reprovided` 상태를 기록합니다. parser가 view를 보유하면 재제공을 미루고, parser가 데이터를 즉시 복사한 경우에만 소비 완료 뒤 다시 제공할 수 있습니다.

```diagram
{"title":"provided buffer 대여와 반환","caption":"버퍼가 커널의 선택 대상에서 빠지는 시점과 애플리케이션 소비가 끝나는 시점을 분리합니다. ID는 추적 키이지 수명 증명이 아닙니다.","rows":[[{"id":"pool","label":"buffer group","detail":["커널 선택 가능"]}],[{"id":"select","label":"CQE buffer 선택","detail":["ID와 바이트 수 기록"]}],[{"id":"held","label":"애플리케이션 소비","detail":["parser view 유지 가능"]}],[{"id":"provide","label":"다시 provide","detail":["그룹에 재등록"]}]],"edges":[{"from":"pool","to":"select","label":"recv 결과"},{"from":"select","to":"held","label":"선택 대상에서 제거"},{"from":"held","to":"provide","label":"소비 완료"},{"from":"provide","to":"pool","label":"다음 수신 준비"}]}
```

provided-buffer provisioning의 최소 커널 버전은 확인한 `io_uring_prep_provide_buffers(3)` 자료에 제시되지 않았습니다. 그러므로 특정 버전 이상이면 반드시 가능하다고 쓰지 않습니다. buffer ring과 같은 확장 기능은 별도의 capability 확인과 fallback 계약에 둡니다.

## CQ·버퍼·파서의 배압

buffer pool이 1,024개이고 각 버퍼가 4KiB라면 커널과 애플리케이션이 동시에 붙잡을 수 있는 payload 저장 공간은 약 4MiB입니다. 이는 CQ capacity 256, parser 대기 바이트 8MiB, 연결별 입력 상한과 별개의 예산입니다. parser가 느린데 수신 SQE를 계속 제출하면 CQ와 held buffer가 함께 증가해 새 입력을 받을 공간이 사라집니다.

예를 들어 held buffer가 900개를 넘으면 새 `recv` 제출을 줄이고, parser queue가 6MiB를 넘으면 연결별 read admission을 멈추며, CQ 점유가 임계치를 넘으면 먼저 CQE를 회수합니다. accept 슬롯도 전체 메모리 예산 안에서 줄입니다. 900개와 6MiB는 정책의 형태를 설명하는 숫자일 뿐, 이 시스템의 권장값이나 실행 측정값이 아닙니다.

| 관찰 상태 | 다음 조치 | 금지할 조치 |
| --- | --- | --- |
| CQ와 buffer에 여유 | 수신 제출 | 무제한 in-flight 증가 |
| CQ 점유 증가 | CQE 우선 회수 | `EBUSY` 무한 재시도 |
| held buffer 고갈 | parser 감속·입력 거절 | 빌린 buffer 재사용 |
| 대기 요청 만료 | 결과 기록·종결 확인 | 만료만으로 실행 허가 회수 |

## 다중 완료의 수명

multishot receive는 하나의 receive 요청이 여러 CQE를 만들 수 있는 연산입니다. 확인한 문서의 계약에 따라 `IORING_CQE_F_MORE`가 있는 동안 원래 operation context를 유지하고, 각 CQE의 `res`와 buffer 정보를 독립적으로 처리합니다. `MORE`가 없는 CQE는 해당 multishot 수신이 끝났다는 신호로 취급해 operation을 종결하고, 필요하면 새 수신을 제출합니다.

`MORE`는 buffer 소비 완료를 뜻하지 않습니다. 현재 CQE가 선택한 buffer를 parser가 붙잡고 있으면 원래 multishot operation과 개별 buffer reference를 각각 유지합니다. poll-first나 socket-nonempty 같은 flag는 수신 시점의 동작 힌트·상태이지 lifetime 종료 신호가 아닙니다.

multishot을 사용할 수 없는 환경에서 one-shot receive 여러 개로 바꿀 수는 있지만 상위 계약은 유지해야 합니다. 프레임 경계, 부분 읽기, 오류·EOF, buffer 반환, 종료 드레인의 기준을 구현 경로에 따라 바꾸지 않습니다. capability 확인 없이 multishot을 기동 기본값으로 가정하지 않습니다.

## 제로카피 송신의 알림

`send_zc`는 일반 송신과 다른 buffer 재사용 계약을 가질 수 있습니다. 확인한 liburing 문서는 보통 초기 결과 CQE와 후속 notification CQE 두 개를 만들 수 있다고 설명합니다. 초기 CQE에 `IORING_CQE_F_MORE`가 있으면 후속 `IORING_CQE_F_NOTIF`를 기다려 buffer를 다시 사용할 수 있는 경계로 삼습니다.

초기 CQE의 양수 `res`만 보고 peer가 애플리케이션에서 처리했다고 해석하지 않습니다. TCP 송신 결과와 외부 업무 효과는 별개의 계약입니다. 또한 확인한 자료는 `MORE`가 없는 경우의 재사용 시점을 이 장 하나로 확정하지 않으므로, 이를 보편 규칙으로 채우지 않고 해당 kernel·opcode 계약을 확인하거나 안전한 복사 경로를 선택합니다.

`zero-copy`라는 이름도 모든 provider와 환경에서 실제 복사가 없다는 보증으로 확대하지 않습니다. 초기 CQE, notification, copied usage 같은 관측 결과를 상태에 남기고, 재사용 허가 전에는 payload를 변경하거나 pool에 반환하지 않습니다. 이 장은 zero-copy 성능을 측정하지 않았습니다.

## 취소 결과와 원래 작업

취소 SQE에는 원래 operation의 target 식별자와 구별되는 별도 `user_data`를 둡니다. cancel CQE가 도착했다는 사실은 cancel 작업의 결과이지 target operation의 모든 참조가 끝났다는 뜻이 아닙니다. 확인한 문서에 따르면 cancel CQE는 제출이 반환될 때까지 게시되고, 성공한 취소는 target completion도 그 시점까지 게시되도록 합니다. `-EALREADY`는 target이 너무 진행되어 취소할 수 없다는 뜻일 수 있으므로 target completion을 계속 기다립니다.

`-ENOENT`는 target이 이미 완료되었거나 식별자가 잘못되어 찾지 못했을 가능성을 나타냅니다. 이를 곧바로 메모리 해제로 매핑하지 말고 target table과 CQ drain을 확인합니다. cancel 성공, target 정상 완료, target 취소 완료, cancel 실패는 각각 별도의 사건으로 기록하고 operation 종결은 한 번만 허용합니다.

```text
# 교육용 상태 전이: 실제 API 호출 코드가 아님
Active --cancel submitted--> CancelPending
CancelPending --cancel res = 0--> TargetCompletionPending
CancelPending --cancel res = -EALREADY--> TargetCompletionPending
CancelPending --cancel res = -ENOENT--> TargetLookupAndDrain
Active --target CQE--> KernelDone
TargetCompletionPending --target CQE--> KernelDone
KernelDone --all consumer refs zero--> Released
```

취소 flag의 `ALL·FD·ANY` 5.19, `FD_FIXED` 6.0, `USERDATA·OP` 6.6 표기는 확인한 man page의 annotation입니다. 이는 독자의 설치 환경에서 실제 지원된다는 증명이 아니며, target completion의 정확한 `res` 값까지 확정하는 자료도 아닙니다. 미확인 환경은 기본 단일 target 취소와 CQ 확인 경로로 제한합니다.

## 종료 드레인

graceful shutdown은 새 입력 유입을 끊는 일에서 시작합니다. accept와 새 SQE 생성을 막고, operation table에서 Active, CancelPending, multishot, zero-copy notification 대기 항목을 snapshot합니다. 정상 완료를 기다리거나 target별 취소를 제출하면서 cancel operation과 target operation을 다른 수명으로 추적합니다.

CQE를 회수할 때는 cancel operation의 CQE, 원래 target의 CQE, multishot의 마지막 CQE, zero-copy notification을 서로 다른 사건으로 분류합니다. parser queue와 held buffer가 0이 되고 모든 operation이 `Released`가 된 뒤에야 buffer pool, 일반 등록 버퍼, operation context, ring을 차례로 정리합니다. provided-buffer ring의 해제는 별도 계약과 반환값을 확인합니다.

종료 deadline이 지났다고 커널이 사용하는 주소를 재사용해도 되는 것은 아닙니다. 프로세스 전체를 종료하는 강제 경로를 택할 수는 있지만, 이는 개별 buffer를 조기 free하는 안전한 종료가 아니라 주소 공간을 함께 폐기하는 운영 정책입니다. deadline 초과 항목에는 operation token, 마지막 CQE, buffer ID, 외부 효과 여부를 기록합니다.

## 오류별 진단

수신 `res`의 양수는 정상 진행일 수 있고, 0은 EOF, 음수는 작업별 오류입니다. provided buffer 선택 오류는 buffer ID가 있는 결과와 없는 일반 오류를 분리해 기록합니다. `EBUSY`가 반복되면 CQ 점유, reap 주기, 새 제출률을 함께 보고, held buffer 고갈이면 parser 처리율과 재제공 지연을 봅니다.

이중 해제는 `Released` 전이를 한 번만 허용하는 assertion으로 찾습니다. 로그에 operation token과 buffer ID를 함께 넣으면 buffer가 선택 시점에 pool에서 제거되지 않았는지, parser 완료 전에 re-provide되었는지 확인할 수 있습니다. 초기 `send_zc` CQE 뒤 payload가 바뀌었다면 `MORE`와 `NOTIF` 처리, copied usage 관측, pool 반환 시점을 먼저 확인합니다.

검증 시나리오는 정상 수신, 부분 frame, 여러 frame, parser 지연, buffer 고갈, re-provide 실패, cancel 직전 완료, `-EALREADY`, `-ENOENT`, multishot 종료, zero-copy notification 지연으로 분리합니다. 실행 전에는 예상 state sequence와 counter invariant를 정하고, 실제 실행했다면 커널·liburing release, flags, 관측 로그를 보존합니다. 이 장의 수치와 상태 흐름은 실행 증거가 아니라 설계 예입니다.

## 참고 자료와 검증 범위

- [io_uring(7)](https://man7.org/linux/man-pages/man7/io_uring.7.html): footer 표기는 2020-07-26입니다. read/write buffer의 완료 전 유효성, `user_data`의 식별 역할을 확인했으며 특정 최신 기능의 버전 근거로 쓰지 않았습니다.
- [io_uring_register(2)](https://man7.org/linux/man-pages/man2/io_uring_register.2.html): 확인한 annotation에 registered buffer 5.1, 일부 확장 5.13·5.19, memory-lock quota, 일반 `IORING_UNREGISTER_BUFFERS`의 동기적 해제가 기록되어 있습니다. provided-buffer ring의 해제를 이 규칙에 포함하지 않았습니다.
- [io_uring_prep_provide_buffers(3)](https://man7.org/linux/man-pages/man3/io_uring_prep_provide_buffers.3.html): liburing-2.2, 문서 표기일 2022-03-13. buffer group, 선택된 buffer의 재제공 전 제외, CQE의 buffer ID 인코딩을 확인했습니다. 최소 커널 버전은 확인되지 않았습니다.
- [io_uring_prep_recv_multishot(3)](https://man7.org/linux/man-pages/man3/io_uring_prep_recv_multishot.3.html): 반복 receive 6.0, poll 관련 annotation 5.19, buffer-ring bundling 6.10 표기. `MORE` 종료와 buffer select 요구를 확인했습니다. 이 버전 표기는 문서 annotation이며 배포 대상 자동 판정이 아닙니다.
- [io_uring_prep_send_zc(3)](https://man7.org/linux/man-pages/man3/io_uring_prep_send_zc.3.html): liburing-2.3, 문서 표기일 2022-09-06. 초기 CQE·`MORE`·`NOTIF` 관계를 확인했으며 최소 커널 버전, provider별 무복사 보장, `MORE` 부재 시 재사용 규칙은 미확정으로 남겼습니다.
- [io_uring_prep_cancel(3)](https://man7.org/linux/man-pages/man3/io_uring_prep_cancel.3.html): flag annotation 5.19·6.0·6.6. target `user_data`, cancel CQE, `-EALREADY`, `-ENOENT`, submission 반환 경계를 확인했습니다.

검증 기준일은 2026-09-17입니다. Linux 커널이나 liburing에서 실제 프로그램을 컴파일·실행하지 않았고 benchmark도 수행하지 않았습니다. 위 문서의 버전·날짜는 확인한 자료의 상태이며 독자의 배포 대상 커널 버전을 뜻하지 않습니다. provided-buffer 최소 버전, send_zc의 최소 버전과 provider 동작, `MORE` 부재 시 재사용, 기능별 실제 성능은 확인하지 못한 범위로 남깁니다.
