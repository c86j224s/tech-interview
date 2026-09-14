---
id: "db-query-cancellation-state"
title: "클라이언트가 DB 쿼리 timeout을 받았습니다. 쿼리와 트랜잭션은 이미 취소됐으며 연결을 바로 재사용해도 되나요?"
answerMinutes: 5
followups: [{"id": "deadline-cancellation-propagation", "prompt": "상위 응답이 timeout된 뒤에도 하위 작업이 남는다면 취소 요청과 실제 종료를 어떻게 확인하나요?"}, {"id": "db-connection-session-state", "prompt": "재사용 연결의 transaction·역할·설정이 다음 요청으로 새지 않게 어떤 reset을 수행하나요?"}, {"id": "request-timeout-idempotency", "prompt": "성공 응답을 잃은 변경을 다시 실행하기 전에 어떤 논리 키와 결과 조회가 필요한가요?"}]
difficulty: "중하"
category: "데이터베이스"
tags: ["SQL", "데이터베이스"]
related: ["deadline-cancellation-propagation", "db-connection-session-state", "request-timeout-idempotency"]
---

# 클라이언트가 DB 쿼리 timeout을 받았습니다. 쿼리와 트랜잭션은 이미 취소됐으며 연결을 바로 재사용해도 되나요?

## 구두 답변

클라이언트 대기 종료, 서버 쿼리 취소 요청, 실제 서버 작업 종료와 transaction 정리는 서로 다른 상태입니다. timeout 하나로 모든 변경이 rollback됐다고 판단하지 않겠습니다.

### 동작 원리와 전제

드라이버가 별도 취소 신호를 보내더라도 서버가 이미 commit했거나 아직 취소를 처리하지 않았을 수 있습니다. transaction이 실패 상태로 남는 엔진에서는 rollback이 필요하고, 응답 프로토콜이 정리되기 전에는 연결을 다음 요청에 넘기면 안 됩니다.

### 선택과 실패 처리

서버 statement timeout과 transaction·connection 획득 timeout을 구분하고 전체 요청 deadline 안에 정리 시간을 남깁니다. 변경 결과가 불확실하면 요청 ID로 조회·재시도합니다. 비싼 읽기 취소도 DB CPU·잠금이 실제로 풀렸는지 관찰합니다.

### 구체적인 사례와 검증

요청자가 timeout을 본 뒤 DB session은 아직 쿼리를 실행 중일 수 있습니다. 앱이 연결을 즉시 반환하면 다음 요청이 같은 연결에서 앞 결과를 읽거나 busy 상태 오류를 만날 수 있습니다. 드라이버가 프로토콜을 drain·reset했는지 확인하고 불확실하면 폐기하는 편이 안전합니다. commit 응답 유실은 더 조심해야 합니다. 서버에서 transaction이 성공했는지 요청 기록으로 조회한 뒤 재시도해야 이중 변경을 막습니다. 취소 성공률은 API 호출이 예외 없이 끝난 비율보다 실제 실행 중 작업 수와 잠금·연결이 해제되는 시간으로 검증합니다.

쿼리 실행·commit·응답 직전의 지연과 취소 경쟁을 시험합니다. 연결을 폐기할 기준과 정상 반환 기준을 드라이버 계약으로 고정합니다. 취소 오류를 숨기기 위해 풀 크기를 늘리기보다 잔존 세션·열린 transaction·재시도 중복을 확인해야 합니다.

## 득점 포인트

- 핵심 구분: 클라이언트 대기 종료, 서버 쿼리 취소 요청, 실제 서버 작업 종료와 transaction 정리는 서로 다른 상태입니다.
- 선택 조건: 서버 statement timeout과 transaction·connection 획득 timeout을 구분하고 전체 요청 deadline 안에 정리 시간을 남깁니다.
- 검증 기준: 쿼리 실행·commit·응답 직전의 지연과 취소 경쟁을 시험합니다.

## 감점 포인트

- 클라이언트 timeout을 DB rollback과 연결 정리 완료로 취급한다.

## 더 파고들 거리

- 상위 응답이 timeout된 뒤에도 하위 작업이 남는다면 취소 요청과 실제 종료를 어떻게 확인하나요?
- 재사용 연결의 transaction·역할·설정이 다음 요청으로 새지 않게 어떤 reset을 수행하나요?
- 성공 응답을 잃은 변경을 다시 실행하기 전에 어떤 논리 키와 결과 조회가 필요한가요?
