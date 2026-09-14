---
id: tcp
title: TCP 바이트 스트림과 연결 수명
topic: 네트워크
summary: 메시지 framing, 부분 I/O, 흐름·혼잡 제어와 종료 상태를 하나의 수명으로 이해합니다.
questionIds: [tcp-stream-message-framing, tcp-three-way-handshake, tcp-time-wait, tcp-flow-vs-congestion-control, tcp-nagle-delayed-ack, network-half-close, network-socket-backlog, io-readiness-vs-completion, iocp-send-order]
---

# TCP 바이트 스트림과 연결 수명

## TCP는 메시지 경계를 보존하지 않습니다

송신자가 두 번 write한 데이터는 수신자에게 한 번, 여러 번, 또는 일부씩 도착할 수 있습니다. TCP가 제공하는 것은 연결 내 순서 있는 바이트 흐름입니다. 애플리케이션이 길이 헤더·구분자·고정 길이 등으로 메시지 경계를 정의해야 합니다.

## 길이 헤더 파서

다음은 4바이트 네트워크 순서 길이를 사용하는 설명용 구조입니다.

```text
on_bytes(data):
    append data to bounded receive buffer
    while true:
        if available < 4: return
        length = decode_u32_network_order(first 4 bytes)
        if length > MAX_MESSAGE: reject and close
        if available - 4 < length: return
        frame = next length bytes
        process_or_transfer_ownership(frame)
        consume 4 + length bytes only when safe
```

길이 덧셈 overflow를 피하고 최대 메시지·연결별 버퍼·전체 메모리를 제한합니다. 복사 없는 view를 소비자에게 넘기면 그 소비자가 끝나기 전에 ring buffer를 덮어쓰거나 확장하면 안 됩니다.

구분자 방식은 delimiter escaping과 바이너리 처리, 손상 뒤 재동기화 규칙이 필요합니다. 어느 방식도 입력을 무한히 기다리거나 저장해도 되는 이유가 되지 않습니다.

## 부분 송신과 완료의 의미

read/write API의 반환·완료는 사용하는 OS·비동기 API에 따라 해석합니다. 일부 바이트만 처리됐으면 남은 범위를 이어 처리해야 할 수 있습니다. 로컬 송신 완료는 상대 앱이 메시지를 파싱하거나 DB에 저장한 확인이 아닙니다.

결제·보상 등 중요 메시지는 메시지 ID·처리 ACK·결과 조회가 필요합니다. ACK를 잃으면 같은 ID로 재전달해도 효과가 한 번만 남게 합니다. TCP 재연결은 새 바이트 스트림이므로 옛 연결의 미확정 작업을 자동 복구하지 않습니다.

## 흐름 제어와 혼잡 제어

수신 창은 수신 측이 받을 여유를, 혼잡 제어는 경로에 넣을 수 있는 데이터를 조절합니다. 실제 전송량은 이 조건과 앱·버퍼의 상태에 제한됩니다.

대역폭×RTT는 경로를 채우기 위해 필요한 in-flight 규모를 이해하는 데 도움이 됩니다. 창을 무조건 키우면 큐 지연·메모리 비용이 늘 수 있습니다. 수신 앱이 느린지, 경로 손실인지, 서버 CPU·DB가 느린지 따로 관측합니다.

## 연결 종료

FIN은 한 방향의 전송 종료입니다. 반대쪽 응답이 남아 있으면 half-close가 가능할 수 있습니다. RST는 다른 오류 경로입니다. 상위 프로토콜이 EOF를 정상 메시지 종료로 인정하는지도 확인합니다.

- **CLOSE_WAIT**: 상대 FIN 뒤 로컬 close가 아직 안 된 상태입니다. 지속 증가하면 앱의 정리 누락을 조사합니다.
- **TIME_WAIT**: 종료 후 지연 세그먼트·마지막 ACK 재전송을 위한 보호 상태입니다. 항목 하나마다 앱 FD가 남았다고 계산하지 않습니다.

## 연결 폭주를 해석하기

listen backlog, 미리 제출한 accept 작업 수, 앱 worker·큐·FD, NAT 상태는 서로 다른 자원입니다. backlog를 키우면 순간 burst를 흡수할 수 있어도 지속 처리 능력이 늘지는 않습니다. 연결 재사용·HTTP/2는 짧은 연결 생성량을 줄일 수 있지만 스트림·원본 용량 상한은 남습니다.

## 직접 확인하기

메시지를 한 바이트씩 나누고 여러 메시지를 합쳐 보내도 파서 결과가 같은지 시험합니다. 잘린 헤더·과대 길이·EOF·느린 reader·재연결·ACK 유실을 포함합니다. 제출·수신·파싱·처리·ACK의 시간을 나누고 실제 메시지 원장을 비교합니다.
