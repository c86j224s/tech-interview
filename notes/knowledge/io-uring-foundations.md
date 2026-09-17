---
id: io-uring-foundations
title: io_uring 제출과 완료
topic: 네트워크
summary: 공유 제출·완료 링의 head와 tail, SQE·CQE·user_data의 역할과 배압·종료 순서를 실제 수신 흐름으로 연결합니다.
questionIds: []
prerequisites: [iocp-foundations]
related: [io-readiness, safe-reclamation, admission-control, iocp-completion]
reviewedAt: '2026-09-17'
---

# io_uring 제출과 완료

## 제출과 완료의 분리

`io_uring`은 애플리케이션이 작업을 제출하고 커널이 완료 결과를 게시하는 Linux 인터페이스입니다. 제출 큐(submission queue, SQ)는 새 작업의 설명을 준비하는 영역이고, 완료 큐(completion queue, CQ)는 작업별 결과를 돌려주는 영역입니다. SQ의 tail은 애플리케이션이 공개한 끝을, SQ의 head는 커널이 소비한 경계를 나타냅니다. CQ에서는 커널이 tail에 결과를 게시하고 애플리케이션이 head에서 결과를 소비합니다.

따라서 “제출 함수가 성공했다”와 “I/O가 끝났다”는 다른 사건입니다. 제출 순서는 실행 순서나 완료 순서를 보장하지 않으므로, 연결별 순서가 필요한 프로토콜은 CQE를 받은 뒤 별도의 순서 상태를 갱신합니다. `user_data`는 제출 때 넣은 식별 정보가 CQE로 돌아오는 통로이지, 버퍼 소유권이나 객체 수명을 자동으로 보장하는 포인터 보호 장치가 아닙니다.

이 장에서 말하는 링의 진행은 커널·liburing 계약을 설명하는 것이며, 특정 opcode가 항상 같은 수의 CQE를 만든다는 뜻은 아닙니다. multishot, 성공 CQE 생략, 취소처럼 완료 관찰 방식이 달라지는 기능은 별도 상태로 다룹니다.

## 링의 숫자와 상태

SQ capacity가 8이고 CQ capacity가 16인 링에서 애플리케이션이 SQE 세 개를 준비했다고 하겠습니다. 커널이 아직 소비하지 않았다면 미소비 제출 수는 `sq_tail - sq_head = 3`으로 관찰됩니다. `io_uring_submit`이 3을 반환했다면 그 제출 경계에서 처리 요청된 SQE 수에 관한 결과이지, 세 I/O가 완료되었다는 뜻이 아닙니다.

그 뒤 CQ에 CQE 하나만 게시되었다면 완료가 관찰된 작업은 하나이고 나머지 두 작업은 아직 실행 중이거나, 별도의 완료 관찰 규칙을 가진 상태일 수 있습니다. CQE의 `res`는 작업별 결과입니다. 읽기 계열에서 양수는 바이트 수, 0은 EOF일 수 있고, 음수는 음수 `errno` 형식의 오류입니다. 정확한 의미는 opcode 계약에 따라 해석합니다.

| 사건 | 관찰할 값 | 아직 단정할 수 없는 것 |
| --- | --- | --- |
| SQE 준비 | 준비한 SQE 수, 작업 token | 커널이 소비했는지 |
| 제출 호출 | 요청한 수, 반환값 | I/O 완료 수 |
| CQE 게시 | `user_data`, `res`, flags | parser와 후속 소비자가 끝났는지 |
| CQE 소비 | CQ head 전진 | 다른 작업과 서비스 전체 종료 |

## 최소 수신 흐름

다음은 liburing API 이름을 사용한 교육용 의사코드입니다. 컴파일 가능한 C 코드가 아니며, 이 문서의 작성 과정에서 Linux 커널이나 liburing으로 실행한 결과도 아닙니다. 실제 구현에서는 초기화 실패, `get_sqe` 고갈, 제출 반환값, CQE 대기 오류, token 조회 실패, 동시 접근, buffer 소비 완료를 명시적으로 처리해야 합니다.

```text
# 교육용 의사코드: 실제 컴파일·실행 증거가 아님
ring = io_uring_queue_init(entries=256)
if ring failed:
    fail_startup()

while accepting_work:
    op = allocate_operation()
    op.buffer = allocate_stable_buffer()
    op.user_data = make_generation_tag(op)

    sqe = io_uring_get_sqe(ring)
    if sqe is unavailable:
        reap_available_cqes()
        release_or_retry(op)
        continue

    io_uring_prep_recv(sqe, op.fd, op.buffer, op.capacity, flags=0)
    io_uring_sqe_set_data64(sqe, op.user_data)
    register_before_submit(op)
    mark_in_flight(op)

    submitted = io_uring_submit(ring)
    if submitted is an error:
        resolve_submit_uncertainty(op)
        continue

    cqe = wait_or_peek_cqe(ring)
    if cqe is absent:
        handle_wait_error()
        continue
    op = lookup(cqe.user_data)
    apply_result(op, cqe.res, cqe.flags)
    io_uring_cqe_seen(ring, cqe)
    finish_or_resubmit(op)
```

`io_uring_get_sqe`가 빈 슬롯을 반환하지 않을 때 무조건 작업을 폐기할 필요는 없지만, CQE를 회수하지 않고 재시도해서는 안 됩니다. 새 작업을 무한히 만들기보다 in-flight 작업 수, SQ outstanding 수, 입력 바이트와 parser 대기량에 상한을 둡니다. 제출을 시도한 뒤 반환값으로 제출 여부를 완전히 알 수 없는 오류가 있으면, 해당 작업의 token과 CQ를 확인하기 전까지 자원을 재사용하지 않는 보수적 경로가 필요합니다.

## 작업 컨텍스트와 버퍼 수명

`user_data`에는 배열 인덱스, 세대가 붙은 정수 핸들, 안정된 operation 주소 등을 넣을 수 있습니다. 어떤 방식을 택하든 CQE 처리 동안 식별자를 역참조할 컨텍스트가 살아 있어야 합니다. `recv`나 `read`에 넘긴 버퍼 역시 해당 작업이 완료될 때까지 수정·해제·재사용하지 않습니다.

커널 완료 뒤에도 파서가 버퍼의 일부를 view로 들고 있다면 CQE 하나만으로 반환할 수 없습니다. 안전한 전이를 `Submitted → KernelDone → ConsumerDone → Released`로 나누면, 커널이 더 이상 주소를 쓰지 않는 경계와 애플리케이션이 더 이상 읽지 않는 경계를 구분할 수 있습니다. 파서가 데이터를 즉시 복사하면 `KernelDone` 뒤 반환이 가능할 수 있지만, view를 보관하는 설계에서는 `ConsumerDone`까지 기다립니다.

완료 처리 스레드가 제출 호출의 반환보다 먼저 실행될 수 있는 구조라면 제출 전에 operation table과 참조를 등록합니다. 등록 후 제출하고, 확실히 제출되지 않은 오류와 제출 여부가 불명확한 오류를 분리합니다. 이는 io_uring 전용 메모리 안전 보장이라기보다 비동기 실행기에서 필요한 애플리케이션 수명 규칙입니다.

## 완료 순서와 프로토콜 순서

작업 A, B, C를 이 순서로 SQ에 준비해도 CQE는 B, A, C 순으로 도착할 수 있습니다. 각 CQE는 `user_data`로 개별 operation을 찾고 `res`를 반영합니다. 같은 TCP 연결의 프레임 순서가 외부 관찰 계약이라면 connection ID와 sequence를 operation에 기록하고, B의 완료가 먼저 왔다는 이유로 A보다 먼저 공개하지 않습니다.

반대로 모든 작업을 전역 직렬화하면 독립 작업의 병렬성을 잃습니다. 순서가 필요한 범위만 연결·스트림·키 단위로 묶고, 독립 파일이나 타이머는 별도로 완료시킵니다. reorder 대기량이 커지면 커널 완료 지연과 애플리케이션 순서 제약을 분리해 관찰해야 하며, 성능 우위는 workload 측정 없이는 주장하지 않습니다.

```diagram
{"title":"SQ 제출과 CQ 완료의 분리","caption":"애플리케이션은 SQ에 작업을 공개하고 CQ에서 결과를 소비합니다. 제출 수와 완료 수를 같은 카운터로 해석하지 않습니다.","rows":[[{"id":"app","label":"애플리케이션"}],[{"id":"sq","label":"SQ","detail":["앱 tail 공개","커널 head 소비"]},{"id":"cq","label":"CQ","detail":["커널 tail 게시","앱 head 소비"]}],[{"id":"kernel","label":"커널 I/O 처리"}],[{"id":"done","label":"완료 컨텍스트"}]],"edges":[{"from":"app","to":"sq","label":"SQE 준비·제출"},{"from":"sq","to":"kernel","label":"head에서 소비"},{"from":"kernel","to":"cq","label":"CQE 게시"},{"from":"cq","to":"done","label":"user_data·res 처리"}]}
```

## 대기와 제출의 결합

`io_uring_enter`는 새 I/O 제출과 completion wait를 한 진입에서 함께 수행할 수 있습니다. 제출할 SQE가 있으면 커널에 소비를 요청하고, CQE가 필요한 경우 `GETEVENTS`와 최소 완료 수를 사용해 기다립니다. timeout이나 signal로 깨어난 뒤에는 진입 호출의 반환값을 전체 완료 수로 해석하지 말고 CQ의 실제 항목을 다시 확인합니다.

대기 호출은 “최소 몇 개의 완료를 기다리는 경계”이지 모든 요청이 한 번씩 CQE를 남긴다는 보장은 아닙니다. 성공 CQE 생략 옵션, multishot, opcode별 추가 notification은 완료 수와 종결 수를 다르게 만듭니다. 대기에서 깨어났다는 사건과 operation을 최종 해제해도 된다는 사건을 분리합니다.

## CQ 배압과 오버플로

CQ 소비가 커널의 결과 생산보다 느리면 CQ가 가득 찰 수 있습니다. CQ를 크게 잡으면 순간적인 burst를 흡수하는 시간이 늘 뿐, 소비자 병목을 없애지는 않습니다. `IORING_FEAT_NODROP`은 특정 CQ overflow 상황에서 completion이 거의 유실되지 않도록 돕는 기능으로 문서화되어 있지만, 메모리 고갈을 포함한 모든 손실을 제거한다는 보장은 아닙니다.

NODROP이 없거나 overflow 조건이 해소되지 않은 경우 제출·대기 호출이 `EBUSY`가 될 수 있고 먼저 CQE를 회수해야 할 수 있습니다. `EBUSY`를 무한 재시도로 감추지 말고 `cqe_reap`을 우선 실행하며 새 제출과 accept를 줄이는 backpressure 상태로 전환합니다. NODROP에서도 completion이 CQ로 이동하지 못해 유실되면 `EBADR`로 상태를 관찰할 수 있으므로, 모든 요청이 반드시 하나의 CQE를 만든다고 가정하는 복구 코드를 쓰지 않습니다.

작은 숫자로 보면 CQ capacity가 4이고 점유가 3일 때 커널이 두 완료를 만들면 하나는 정상 게시되고 다른 하나는 overflow 상태가 될 수 있습니다. 앱이 CQE 하나를 회수해 점유를 3에서 2로 낮춘 뒤 다시 제출·대기하면 overflow를 처리할 여지가 생깁니다. 이 수치는 문서 계약을 설명하는 계산 예이며, 실제 게시 순서나 측정 결과가 아닙니다.

## 제출 경계와 완료 개수

`IO_LINK` chain은 하나의 제출 경계를 넘어 이어지지 않습니다. 체인을 구성하고 제출하는 호출을 별도의 경계로 다루며, 그 사이에 다른 생산자가 SQE를 추가하거나 제출이 실패할 수 있음을 포함합니다. `IOSQE_CQE_SKIP_SUCCESS`는 성공 작업의 CQE를 생략할 수 있으므로 완료 수와 operation 종결 관찰 방식이 바뀝니다.

이 최적화는 단순히 CQE 개수를 줄이는 선택이 아닙니다. 성공 경로에서 자원을 언제 반환할 수 있는지, 후속 소비자가 없는지, 실패만 관찰해도 충분한지를 먼저 증명해야 합니다. 일반 CQE 경로와 같은 in-flight 카운터를 공유하면서 생략된 성공을 기다리면 작업이 영원히 남고, 반대로 너무 일찍 반환하면 아직 필요한 상태를 해제할 수 있습니다.

## 종료 드레인

링 종료는 `io_uring_queue_exit` 한 번으로 operation과 buffer가 안전해지는 절차가 아닙니다. 먼저 새 연결 수락과 새 SQE 생성·제출을 막고, operation table에서 Active·제출 불확실·완료 대기·parser 보유 항목을 snapshot합니다. 정상 완료를 기다리거나 target별 취소를 제출하되 cancel operation과 원래 target operation을 구별합니다.

그 다음 CQE를 계속 회수합니다. 원래 작업의 CQE가 도착하고 parser가 view를 놓아 모든 operation이 종결된 뒤에야 buffer pool과 operation context를 반환합니다. 취소 요청의 완료를 원래 I/O의 완료로 세지 않습니다. 종료 deadline이 지났다고 커널이 사용하는 주소를 free할 근거가 생기는 것도 아닙니다. 강제 종료는 프로세스 주소 공간을 함께 폐기하는 별도 운영 정책으로 기록합니다.

## 관측과 진단

최소한 `sq_prepared`, `sq_submitted`, `cqe_posted_observed`, `cqe_reaped`, `in_flight`, `cq_occupancy`, `overflow`, `EBUSY`, `EBADR`, `buffer_held_bytes`를 구분해 기록합니다. 제출 수만 늘고 회수 수가 따라오지 않으면 CQ 소비자나 후속 parser가 병목일 수 있습니다. `EBUSY`가 반복되면 재시도 횟수보다 CQ 점유, reap 간격, 새 제출률을 먼저 봅니다.

완료 순서가 뒤섞인 문제는 링 자체의 오류가 아니라 제출 순서를 완료 순서로 가정한 애플리케이션 문제일 수 있습니다. 로그에 `user_data`, connection ID, generation, sequence, 제출 시각, CQE 시각을 넣으면 커널 처리 지연과 reorder 대기를 분리할 수 있습니다. `IOSQE_CQE_SKIP_SUCCESS`나 multishot을 썼다면 “요청 하나당 CQE 하나” 카운터를 별도로 폐기합니다.

## 참고 자료와 검증 범위

- [io_uring(7)](https://man7.org/linux/man-pages/man7/io_uring.7.html): footer 표기는 2020-07-26이며 번호가 있는 릴리스 표기로 사용하지 않았습니다. SQ·CQ의 생산·소비 경계, `user_data`, 버퍼 유효 기간, 제출 순서와 완료 순서의 비동일성을 확인했습니다.
- [io_uring_setup(2)](https://man7.org/linux/man-pages/man2/io_uring_setup.2.html): 확인한 문서에는 `IORING_FEAT_NODROP`의 커널 5.5 annotation과 CQ overflow의 범위가 있습니다. CQ 크기와 overflow 관련 관측을 확인했으며, NODROP을 무손실 보장으로 확대하지 않았습니다.
- [io_uring_enter(2)](https://man7.org/linux/man-pages/man2/io_uring_enter.2.html): 제출과 completion wait의 결합, `GETEVENTS`, overflow의 `EBUSY`·`EBADR`, 제출 경계와 성공 CQE 생략 옵션을 확인했습니다.

검증 기준일은 2026-09-17입니다. Linux 커널이나 liburing에서 실제 프로그램을 컴파일·실행하지 않았고, 성능 benchmark도 수행하지 않았습니다. 문서의 버전·날짜는 확인한 자료의 상태이며 독자의 배포 대상 커널 버전을 뜻하지 않습니다. NODROP, overflow, IO_LINK, 성공 CQE 생략은 확인한 문서 계약에 한정하고, 특정 opcode의 보편적인 완료 개수는 주장하지 않습니다.
