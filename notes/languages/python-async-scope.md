---
id: python-async-scope
title: Asyncio 실행 양보·TaskGroup·ContextVar 수명
topic: 언어·런타임
summary: async 선언과 실제 중단을 구분하고 to_thread의 잔여 실행·TaskGroup 예외 집계·취소 협력·task별 문맥과 가변 값 공유를 설명합니다.
questionIds: [python-asyncio-blocking, python-asyncio-taskgroup, python-contextvars-async]
---

# Asyncio 실행 양보·TaskGroup·ContextVar 수명

## Async 함수 안의 동기 호출은 이벤트 루프를 붙잡습니다

`async def handler`가 호출될 때는 본문이 즉시 실행되지 않고 coroutine 객체가 만들어집니다. 이후 이벤트 루프가 그 coroutine을 실행하는 동안 `time.sleep`이나 동기 HTTP가 호출되면 해당 호출이 끝날 때까지 같은 루프의 다른 task가 진행하지 못할 수 있으므로, `async`라는 선언만으로 본문이 다른 스레드로 이동한다고 생각하면 안 됩니다.

`await asyncio.sleep(...)`처럼 실제로 중단되는 대기는 다른 task에 기회를 줍니다. 그러나 즉시 완료되는 awaitable이나 중단 없이 반환하는 async 함수만 반복하면 await 문법이 있어도 긴 계산이 루프를 점유할 수 있습니다. CPU 작업은 시간 예산 분할 또는 다른 실행 자원을 검토합니다.

## Thread 분리와 실제 취소를 나눕니다

| 방식 | 시작·실행 의미 | 남는 비용 |
| --- | --- | --- |
| 비동기 I/O client | await로 완료 대기 | 연결·요청 상한·실제 취소 |
| asyncio.to_thread | 반환된 coroutine이 실행될 때 제출 | 이미 실행 중인 함수의 수명 |
| run_in_executor | 호출 시 executor에 제출 | 큐·worker·문맥 전달 |
| process pool | 별도 주소 공간 계산 | 직렬화·시작·결과 전송 |

`asyncio.to_thread`를 기다리던 task를 취소해도 이미 스레드에서 실행 중인 동기 함수는 계속될 수 있습니다. 이때 바깥의 async semaphore가 곧바로 반환되면 논리적으로는 허가 수를 지켰어도 실제 스레드 작업 수가 그보다 많아질 수 있습니다. 허가를 실제 underlying 작업이 끝날 때까지 유지하거나 제한된 executor·제출 큐를 사용해 물리 실행 상한을 별도로 둡니다.

외부 변경이 timeout 뒤 성공하면 단순히 결과를 폐기할 수 없는 경우가 있습니다. 같은 논리 요청 ID와 결과 대사를 유지합니다. 취소 가능한 네트워크 client로 바꿔도 서버의 이미 커밋한 거래가 자동 롤백되는 것은 아닙니다.

## TaskGroup은 관련 Task의 완료와 오류를 소유합니다

Python 3.11+의 `TaskGroup`은 블록 안에서 만든 task들을 같은 수명으로 묶고, 블록을 빠져나가기 전에 모두 종료할 때까지 기다리는 구조적 동시성 도구입니다. 일반적인 취소 이외의 예외가 하나 나오면 형제 task에 취소를 요청하고 정리를 기다린 뒤 `ExceptionGroup` 등으로 예외를 전달할 수 있습니다. `KeyboardInterrupt`·`SystemExit` 같은 특별한 예외는 같은 방식으로만 처리된다고 단정하지 않습니다.

```diagram
{"title":"Task 실패 뒤에도 자식의 정리가 끝나야 범위를 나갑니다","caption":"화살표는 TaskGroup의 실패 처리 개념입니다. 취소는 협력적이며 별도로 만든 detached task나 이미 실행 중인 native·thread 작업까지 자동 종결하는 것은 아닙니다.","rows":[[{"id":"tasks","label":"그룹의 관련 task 실행"}],[{"id":"failure","label":"필수 task의 일반 예외"}],[{"id":"cancel","label":"형제 task 취소·정리 대기"}],[{"id":"report","label":"예외 집계·호출자 전달"}]],"edges":[{"from":"tasks","to":"failure","label":"실패 발생"},{"from":"failure","to":"cancel","label":"수명 범위 종료"},{"from":"cancel","to":"report","label":"실제 task 반환"}]}
```

CancelledError를 무조건 삼키고 계속 실행하면 그룹 종료가 지연되거나 취소 규약이 깨질 수 있습니다. finally에서 필요한 정리를 하고 특별한 의도가 없다면 취소를 전파합니다. except*로 집계 안의 특정 오류를 처리할 때 다른 오류까지 잃지 않게 합니다. 필수·선택 결과를 구분해 선택 실패를 로컬 결과로 표현할지 정합니다.

TaskGroup은 입력과 task 수를 자동 제한하지 않습니다. 수천 개 task를 먼저 만들고 semaphore를 기다리게 하면 대기 객체·문맥은 남습니다. bounded 입력·worker 수·바이트·기한을 별도로 제한합니다. 그룹 밖 create_task로 만든 작업도 누가 기다리고 예외를 관찰하는지 명확해야 합니다.

## ContextVar는 한 스레드의 여러 요청 문맥을 분리합니다

전역 user=A를 설정한 task가 await한 사이 B가 user=B를 설정하면 A 재개 시 B를 읽을 수 있습니다. thread-local도 둘이 같은 OS 스레드라면 요청별 격리가 아닙니다. ContextVar는 현재 비동기 문맥에 값을 연결해 이 구분을 돕습니다.

```python
from contextvars import ContextVar
user = ContextVar('user')

async def handle(user_id):
    token = user.set(user_id)
    try:
        await process_request()
    finally:
        user.reset(token)
```

`process_request`는 실제 함수라는 전제이며, `reset` 토큰으로 이전 문맥을 복원해야 중첩 scope도 표현할 수 있습니다. task 생성 시 기본적으로 현재 context가 복사되지만, context에 넣은 dict 자체까지 깊은 복사되는 것은 아닙니다. 따라서 같은 가변 dict를 값으로 넣으면 task들이 dict 내부 수정 결과를 공유할 수 있습니다.

## 실행 경계를 넘을 때 전파 계약을 확인합니다

asyncio.to_thread는 현재 contextvars 문맥을 전달하는 API이지만 다른 executor API까지 모두 같은 자동 전파를 한다고 가정하지 않습니다. 명시적인 copy_context 또는 프레임워크 기능을 사용하되 같은 Context 객체의 동시 진입 규칙과 값의 가변성을 확인합니다.

인증 주체는 신뢰된 진입점에서 설정하고 없는 경우 안전하게 실패합니다. 로그 상관 ID 전파가 대상 인가를 대신하지 않습니다. detached 백그라운드 작업이 요청의 큰 데이터·자격을 오래 붙잡지 않도록 독립 수명과 필요한 최소 입력을 선택합니다. 필수 설정·저장소 의존성까지 문맥에 숨기지 않습니다.

## 교차 실행과 종료 지점을 제어해 확인합니다

A·B task를 Event로 번갈아 재개해 문맥이 분리되는지, 중첩 set/reset과 취소 finally가 복원되는지 확인합니다. TaskGroup은 동시 예외·cleanup 실패·취소 무시를 분리해 검사합니다. to_thread는 대기 취소 뒤 실제 함수가 끝나는 시점을 별도 이벤트로 확인해야 합니다.

기본 CPython 3.9.6에서는 TaskGroup을 SKIP했고, 이후 설치된 Homebrew CPython 3.14.7로 `scripts/verify-python-study.py`를 실행해 형제 task 취소·finally 정리·ExceptionGroup의 ValueError를 확인했습니다. 두 버전에서 ContextVar 교차 task 분리도 확인했습니다. 동시 다중 실패·to_thread의 실제 잔여 작업·외부 I/O 취소는 이 실행 범위에 포함하지 않았습니다.
