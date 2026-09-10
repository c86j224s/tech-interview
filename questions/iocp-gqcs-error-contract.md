---
id: iocp-gqcs-error-contract
title: "GetQueuedCompletionStatus가 FALSE를 반환했습니다. 실패한 I/O 완료를 받은 것인지, 타임아웃으로 아무 패킷도 못 받은 것인지 어떻게 구분하나요?"
answerMinutes: 5
followups: [{"id":"iocp-completion-key-overlapped","prompt":"실패 완료에서 OVERLAPPED 컨텍스트를 찾은 뒤 연결이 이미 닫혔다면, 오류 처리와 수명 해제를 어떤 순서로 하겠습니까?"},{"id":"iocp-worker-shutdown","prompt":"GQCS timeout과 null 종료 패킷이 섞인 워커 루프에서 실제 종료 조건을 어떤 작업 카운터와 연결하겠습니까?"},{"id":"iocp-cancel-drain","prompt":"CancelIoEx 뒤 FALSE 오류 완료가 도착할 때, 그 완료를 버퍼 반환의 어느 단계로 처리하겠습니까?"}]
difficulty: 중하
category: 네트워크
tags: ["IOCP","오류 처리","GQCS"]
related: ["iocp-completion-key-overlapped"]
---

# GetQueuedCompletionStatus가 FALSE를 반환했습니다. 실패한 I/O 완료를 받은 것인지, 타임아웃으로 아무 패킷도 못 받은 것인지 어떻게 구분하나요?

## 구두 답변

`GetQueuedCompletionStatus`의 반환값만 보고 판단하면 안 됩니다. 반환이 FALSE여도 출력 `OVERLAPPED`가 non-null이면 실패한 비동기 I/O의 완료 패킷을 받은 것이므로 해당 작업의 오류와 자원을 처리해야 합니다. FALSE이고 `OVERLAPPED`가 null이면 실제 완료 패킷을 dequeue하지 못한 경우이며, timeout이면 `GetLastError`가 `WAIT_TIMEOUT`이고 포트가 닫힌 경우에는 `ERROR_ABANDONED_WAIT_0`처럼 별도 오류가 될 수 있습니다. TRUE이고 `OVERLAPPED`가 null이면 `PostQueuedCompletionStatus`로 게시한 사용자 패킷일 수 있습니다.

### 진리표로 분리한다

| GQCS 반환 | OVERLAPPED | 의미 | 처리 |
|---|---|---|---|
| TRUE | non-null | 성공한 I/O 완료 또는 사용자 패킷 | 작업 컨텍스트에서 결과 처리 |
| FALSE | non-null | 실패한 I/O 완료 패킷 | `GetLastError`를 읽고 작업 정리 |
| TRUE | null | 사용자 정의 완료 패킷 가능 | payload·key 규약으로 처리 |
| FALSE | null | 실제 패킷 없음 | timeout·포트 오류 처리, bytes·key 무시 |

GQCS 문서의 FALSE·non-null 경로는 이미 큐에서 소비한 실패 작업이므로 다시 취소하거나 별도 실패 큐에 중복으로 넣지 않습니다. 반대로 FALSE·null은 특정 I/O의 실패를 뜻하지 않으므로 작업 버퍼를 해제하지 않습니다. `PostQueuedCompletionStatus`의 사용자 패킷은 TRUE·null 규약으로만 설계해 FALSE·null과 혼동하지 않겠습니다. 이를 **완료 결과와 대기 결과의 분리**라고 부릅니다.

### 종료와 검증

실패 완료에서는 `OVERLAPPED`에서 작업 종류를 얻어 정상 완료와 같은 수명 경로를 태웁니다. 취소·peer close도 작업 완료이므로 카운터를 한 번 줄입니다. timeout이나 포트 오류는 미완료 작업이 끝났다는 근거가 아니며, 새 제출 차단·작업 카운터·워커 종료 조건을 별도로 확인합니다. 테스트는 정상·실패·취소 완료, GQCS timeout, TRUE·null 사용자 패킷, FALSE·null 포트 종료를 각각 재현하겠습니다.

### 추가 조건과 판단

예를 들어 정상 수신 요청은 등록됐지만 연결이 중간에 종료되어 오류 완료가 발생했다고 하겠습니다. FALSE만 보고 continue하면 그 작업의 카운터와 버퍼가 남습니다. 반대로 조용한 포트에서 WAIT_TIMEOUT이 반환됐는데 마지막으로 사용한 key로 연결을 닫으면 실제로 아무 완료도 받지 않은 상태에서 정상 연결을 훼손할 수 있습니다. 반환값·OVERLAPPED·오류 코드를 같은 호출의 한 결과로 묶어 처리하는 이유입니다. GetLastError는 다른 API 호출이 바꾸기 전에 즉시 저장하겠습니다.

표의 TRUE와 non-null도 사용자 패킷을 허용한 설계라면 커널 I/O라고 무조건 단정할 수 없습니다. PostQueuedCompletionStatus는 애플리케이션이 제공한 값을 게시하므로 별도의 패킷 종류 규약이 필요합니다. 여기서는 사용자 제어 패킷을 TRUE·null로 제한해 구분을 단순화한 것입니다. 여러 워커는 한 패킷을 각각 중복 소비하는 것이 아니라 서로 다른 패킷을 병렬 처리하므로, 오류 하나로 모든 워커의 종료를 단정하지 않겠습니다.

확장 API인 GetQueuedCompletionStatusEx는 한 호출에서 여러 항목을 가져옵니다. 함수가 성공했다는 사실은 패킷 수집 성공이며 항목별 I/O 결과까지 모두 성공이라는 뜻은 아닙니다. GQCS의 GetLastError 처리 규칙을 그대로 모든 항목에 복사하지 말고 항목별 상태의 API 계약을 확인해야 합니다.

## 득점 포인트

- FALSE와 OVERLAPPED 유무를 함께 보아 실패한 I/O 완료와 timeout을 구분한다.
- 실패·취소 완료도 작업 수명과 버퍼 정리의 대상임을 설명한다.
- PostQueuedCompletionStatus의 null OVERLAPPED 사용자 패킷 규약을 분리한다.
- 패킷이 없는 경로의 bytes·key를 유효하다고 가정하지 않는다.

## 감점 포인트

- GQCS가 FALSE면 무조건 continue해 실패 완료 자원을 누락한다.
- timeout을 특정 I/O 실패나 자동 취소로 해석한다.
- OVERLAPPED가 null이면 언제나 timeout이라고 단정한다.

## 더 파고들 거리

- GetQueuedCompletionStatusEx에서 항목별 오류와 마지막 오류 코드를 어떻게 분리할까요?
- 종료 패킷 수와 워커 수를 미완료 I/O drain 조건과 어떻게 맞출까요?
- 실패한 송신의 부분 바이트와 재전송 가능성을 Winsock API별로 어떻게 확인할까요?
