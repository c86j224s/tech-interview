---
id: "python-context-manager-errors"
title: "Python with 블록에서 예외가 났는데 호출자는 성공처럼 진행합니다. __exit__와 자원 정리는 어떤 계약인가요?"
answerMinutes: 5
followups: [{"id": "python-refcount-cycles", "prompt": "메모리 수집과 파일·소켓의 명시적인 close는 왜 별도 수명으로 관리하나요?"}, {"id": "cpp-raii-exception-safety", "prompt": "자원을 자동 해제해도 예외 전의 데이터 상태가 복원되는지는 어떤 보장으로 구분하나요?"}, {"id": "db-connection-session-state", "prompt": "재사용 연결의 transaction·역할·설정이 다음 요청으로 새지 않게 어떤 reset을 수행하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["Python", "언어·런타임", "context"]
related: ["python-refcount-cycles", "cpp-raii-exception-safety", "db-connection-session-state"]
---

# Python with 블록에서 예외가 났는데 호출자는 성공처럼 진행합니다. __exit__와 자원 정리는 어떤 계약인가요?

## 구두 답변

context manager는 진입·종료에 자원 관리나 상태 처리를 묶습니다. __exit__의 반환값은 예외 전파에 영향을 줄 수 있어 자원을 닫는 것과 오류를 억제하는 것은 별도 동작입니다.

### 동작 원리와 전제

__exit__가 참 값을 반환하면 블록의 예외가 억제될 수 있습니다. 의도하지 않은 억제는 실패한 transaction을 성공처럼 보이게 합니다. 반대로 cleanup 중 새 예외가 발생하면 원래 오류의 관찰이 어려워질 수 있어 예외 연결과 로그를 확인합니다.

### 선택과 실패 처리

여러 자원을 순차 획득하다 중간 실패하면 이미 얻은 자원만 정리해야 합니다. ExitStack 같은 도구를 사용할 수 있지만 각 자원의 close·commit·rollback 의미는 직접 정의합니다. async context manager는 종료에 await가 들어가 취소와 수명도 고려합니다.

### 구체적인 사례와 검증

DB context manager의 정상 종료가 commit이고 예외 종료가 rollback이라고 가정하는 코드라면 실제 라이브러리 계약을 확인해야 합니다. 어떤 manager는 연결 수명만 관리하고 transaction은 별도일 수 있습니다. 블록에서 오류를 잡아 삼키면 manager는 정상 종료로 보아 commit할 수도 있으므로 예외 처리 위치가 중요합니다. cleanup 오류를 새 예외로 던질 때 원래 예외와 연결을 보존하면 원인 분석에 도움이 됩니다. 파일 write와 close 성공도 전원 장애 내구성을 자동 보장하지 않으므로 필요한 flush 절차를 따로 정의합니다. with 문법의 편의와 그 안의 자원 계약을 분리하겠습니다.

진입 실패·블록 오류·종료 오류·중첩 manager를 시험합니다. 파일 닫힘과 데이터 내구화, DB 연결 반환과 transaction 성공을 혼동하지 않습니다. 편리한 문법이 잘못된 성공 보고를 숨기지 않도록 예외 계약을 명시하겠습니다.

## 득점 포인트

- 핵심 구분: context manager는 진입·종료에 자원 관리나 상태 처리를 묶습니다.
- 선택 조건: 여러 자원을 순차 획득하다 중간 실패하면 이미 얻은 자원만 정리해야 합니다.
- 검증 기준: 진입 실패·블록 오류·종료 오류·중첩 manager를 시험합니다.

## 감점 포인트

- with를 쓰면 모든 오류가 전파되고 transaction도 자동 rollback된다고 한다.

## 더 파고들 거리

- 메모리 수집과 파일·소켓의 명시적인 close는 왜 별도 수명으로 관리하나요?
- 자원을 자동 해제해도 예외 전의 데이터 상태가 복원되는지는 어떤 보장으로 구분하나요?
- 재사용 연결의 transaction·역할·설정이 다음 요청으로 새지 않게 어떤 reset을 수행하나요?
