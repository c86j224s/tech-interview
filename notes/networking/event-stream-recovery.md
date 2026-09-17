---
id: event-stream-recovery
title: SSE·WebSocket의 재연결과 상태 복구
topic: 네트워크
summary: 채널 선택·하트비트·커서·중복 적용·snapshot 전환을 나누고 프록시 버퍼링과 느린 소비자의 상한을 설명합니다.
questionIds: [http-sse-vs-websocket, websocket-heartbeat-reconnect, offline-client-snapshot-switch, http-proxy-buffering-stream]
---

# SSE·WebSocket의 재연결과 상태 복구

## 재연결과 과거 이벤트 복구

브라우저에 작업 진행률을 보내려면 SSE의 HTTP 텍스트 이벤트 스트림이 단순할 수 있습니다. 양방향 빈번한 메시지·바이너리 교환에는 WebSocket이 적합할 수 있습니다. 하지만 둘 다 연결 재수립만으로 과거 이벤트 로그와 정확히 한 번 적용을 만들어 주지는 않습니다.

EventSource의 자동 재연결과 Last-Event-ID를 활용하려면 서버가 그 ID 이후를 보관·재생해야 합니다. WebSocket도 재연결·인증 갱신·미확정 요청·마지막 적용 위치를 애플리케이션이 관리해야 합니다.

## 채널 기능과 메시지 의미의 분리

| 요구 | 선택과 확인 |
| --- | --- |
| 서버→브라우저 텍스트 알림 | SSE, 프록시 버퍼링·브라우저 인증 API 제약 |
| 양방향 메시지·바이너리 | WebSocket, 연결 지원·유휴 timeout·자원 점유 |
| 최신 진행률 | 옛 값 합치기 가능 여부 |
| 누락되면 안 되는 완료 이벤트 | 내구 로그·커서·중복 방지·상태 조회 |

브라우저 기본 EventSource는 임의 인증 헤더 설정에 제약이 있습니다. URL에 장기 비밀 토큰을 넣어 우회하면 기록·로그 노출이 생길 수 있으므로 안전한 인증 방식을 선택합니다. WebSocket의 handshake와 장기 세션 인가·회수도 별도입니다.

## 하트비트 종류와 확인 대상의 생존성

프로토콜 Ping/Pong은 스택이나 라이브러리가 앱 로직과 무관하게 응답할 수 있습니다. Pong이 온다고 DB나 실제 작업 처리가 정상이라는 뜻은 아닙니다. 앱 처리 가능성이 필요하면 별도 응용 heartbeat를 정의하되 정상 작업의 지연과 함께 해석합니다. 브라우저 WebSocket API에서 프로토콜 Ping을 직접 보내는 기능이 일반적으로 노출된다고 가정하지 않습니다.

유휴 장치 timeout보다 짧고 정상 RTT 변동을 견딜 간격·실패 임계값을 정합니다. 한 번 늦었다고 모두 재접속하면 복구 부하가 몰립니다. 지수 backoff·지터·최대 간격·접속 예산을 두고 패자의 옛 연결·타이머를 정리합니다.

## 수신 위치와 적용 위치의 커서 구분

특정 소비자 스트림에 빈 번호 없이 증가하는 순서 번호를 부여한다고 가정합니다. 기대 번호가 n일 때 m<n은 중복, m=n은 다음 이벤트, m>n은 gap입니다. 전역 로그를 필터링한 번호라면 숫자 공백만으로 누락을 단정할 수 없으므로 서버의 커서 계약을 따라야 합니다.

```text
onEvent(event):
    if event.sequence < nextExpected: return duplicate
    if event.sequence > nextExpected: return request_replay_or_snapshot
    in_local_transaction:
        apply_domain_effect_if_new(event.id, event.payload)
        persist_next_expected(event.sequence+1)
    acknowledge_applied_position()
```

로컬 변경 뒤 커서 저장 전에 중단되면 재적용이 생길 수 있으므로 같은 저장 경계에 묶습니다. 외부 API 효과라면 로컬 거래로 포함되지 않으므로 별도 멱등 키·조회가 필요합니다. 같은 ID의 다른 payload도 조용히 기존 결과로 합치지 않습니다.

```diagram
{"title":"복구 시작점은 마지막 적용 커서입니다","caption":"화살표는 재연결 복구 순서입니다. snapshot은 그 기준 위치 이후의 증분과 연결되어야 전송 중 발생한 변경을 놓치지 않습니다.","rows":[[{"id":"reconnect","label":"재연결·인증","detail":["마지막 적용 커서 전달"]}],[{"id":"retained","label":"로그가 남아 있음","detail":["다음 위치부터 재생"]},{"id":"expired","label":"보관 범위 밖","detail":["snapshot + 기준 커서"]}],[{"id":"apply","label":"중복을 흡수하며 적용","detail":["상태와 커서를 함께 저장"]}]],"edges":[{"from":"reconnect","to":"retained","label":"재생 가능"},{"from":"reconnect","to":"expired","label":"재생 불가"},{"from":"retained","to":"apply","label":"증분"},{"from":"expired","to":"apply","label":"기준 이후 증분 연결"}]}
```

## snapshot 전환과 오래된 커서 복구

서버 로그 시작이 100인데 클라이언트가 40까지만 적용했다면 41~99를 없었던 것으로 처리해서는 안 됩니다. 서버는 일관된 snapshot S와 그 기준 커서를 함께 제공하고, S 이후 변경을 이어 받을 수 있도록 보존해야 합니다.

그 상태에서 다운로드 중 도착한 이벤트는 먼저 버퍼에 보관했다가 S를 설치한 뒤 기준 커서 다음 위치부터 재생해야 합니다. snapshot을 완성 상태로 검증하기 전에 공개하지 않으며, 객체 삭제·세대 변경·권한 변경도 그 상태에 반영해야 합니다. 여러 기기의 커서를 하나로 합치면 한 기기의 ACK가 다른 기기의 미수신 데이터를 지울 수 있으므로 소비자 단위를 명확히 합니다.

## 서버 flush와 화면 표시 지연

앱 생성·framework flush·압축·프록시·CDN·브라우저 read·DOM 반영 시각을 나눕니다. 원본 직접 연결에서는 즉시 보이는데 프록시 경로만 묶인다면 중간 buffering이 후보입니다. 브라우저가 전체 body를 await한 뒤 표시하는 코드도 같은 증상을 만듭니다.

이미 200 헤더를 보낸 스트림 중간 실패는 상태 코드만 바꾸기 어려울 수 있습니다. 오류 이벤트·완료 표식·작업 ID와 상태 조회를 둡니다. 부분 응답을 최종 성공 결과로 저장하지 않습니다. 청크 크기·압축·버퍼 설정은 실제 지연과 CPU·네트워크 비용을 비교해 조정합니다.

## 느린 소비자 대기와 출력 상한

각 연결의 출력 바이트·이벤트 수·가장 오래된 대기 시간을 제한합니다. 진행률은 최신 값으로 합칠 수 있지만 거래 이벤트는 로그에 남기고 연결을 종료한 뒤 재생하게 할 수 있습니다. 무제한 메모리 버퍼는 재연결보다 더 큰 장애를 만들 수 있습니다.

ACK 유실·역순·gap·보관 만료·프록시 idle timeout·탭 정지·서버 재시작을 시험합니다. 성공 기준은 소켓이 다시 열렸다는 것이 아니라 최신 상태와 필요한 모든 효과가 중복 없이 복구되었는지입니다.
