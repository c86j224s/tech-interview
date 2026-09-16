---
id: python-parallel-boundary
title: Python GIL·Native 계산·프로세스 전달 비용
topic: 언어·런타임
summary: GIL 활성 CPython의 CPU·I/O를 구분하고 C 확장 해제·내부 스레드·free-threaded·spawn·fork·shared memory의 전제를 설명합니다.
questionIds: [python-gil-parallelism, python-c-extension-gil-release, python-multiprocessing-start-method, process-pool-large-payload-transfer]
---

# Python GIL·Native 계산·프로세스 전달 비용

## 기다리는 작업과 Python 계산은 다른 병목입니다

GIL이 활성인 일반 CPython에서 한 인터프리터가 Python 바이트코드를 실행할 때는 한 시점에 한 스레드가 그 바이트코드를 실행합니다. 그래서 순수 Python CPU 루프를 여러 스레드로 나누면 스레드 수만큼 여러 코어에서 바이트코드가 동시에 실행되지는 않아 이득이 제한됩니다. 반대로 파일·네트워크 I/O처럼 대기 중 GIL을 놓는 경로에서는 한 스레드가 기다리는 동안 다른 스레드가 실행해 대기를 겹칠 수 있습니다.

이는 “모든 Python 프로그램은 스레드 병렬성이 없다”는 주장이 아닙니다. 인터프리터 빌드·GIL 활성 여부·C 확장·실행 구간을 확인해야 합니다. asyncio 역시 GIL을 제거하는 기능이 아니라 협력적 대기 조정입니다.

## C 확장이 항상 GIL을 해제하는 것은 아닙니다

| 실행 구간 | 가능한 병렬성 | 확인할 조건 |
| --- | --- | --- |
| 활성 GIL의 순수 Python loop | 같은 인터프리터 바이트코드 병렬 제한 | 실제 GIL 상태 |
| GIL을 놓는 blocking I/O | 대기 겹치기 | API의 해제·취소 계약 |
| GIL을 놓는 native 계산 | 다른 thread·native 계산 가능 | Python 객체 접근·확장 thread safety |
| 내부 thread를 쓰는 수치 라이브러리 | 라이브러리 자체 병렬화 | 외부 worker와 곱해진 과구독 |
| free-threaded 빌드 | 다른 실행 조건 | 확장 호환·실제 GIL 활성·새 경합 |

4개 Python worker가 각자 8개 native thread를 만들면 32개 계산 thread가 코어·메모리 대역폭을 경쟁할 수 있습니다. GIL이 없다는 이유만으로 thread 수를 늘리지 않습니다. 일부 확장은 호환 때문에 GIL 활성화를 요구할 수 있어 빌드 이름뿐 아니라 실제 실행 상태를 확인합니다.

GIL은 여러 문장의 재고 조회·검사·차감을 하나의 거래로 만들지 않습니다. 중간 호출·스케줄링·native 해제 구간이 있으므로 앱 불변식에는 잠금·조건 갱신이 필요합니다. 특정 bytecode 조합의 우연한 동작을 언어 보장으로 사용하지 않습니다.

## 프로세스는 실행을 분리하지만 데이터를 전달해야 합니다

프로세스 풀은 별도 주소 공간을 사용하므로 계산 결과·가변 상태가 자동 공유되지 않습니다. 큰 배열을 매 작업마다 직렬화하고 복사하면 실제 계산보다 비용이 클 수 있습니다. 작업 크기·배치·입력 재사용·결과 크기를 함께 봅니다.

```diagram
{"title":"프로세스 병렬화의 전체 시간을 측정합니다","caption":"화살표는 요청과 결과 전달 순서입니다. worker 계산만 빨라져도 직렬화·복사·대기·병합이 전체 지연을 지배할 수 있습니다.","rows":[[{"id":"serialize","label":"입력 직렬화·전송"}],[{"id":"queue","label":"worker 큐·시작 대기"}],[{"id":"compute","label":"별도 프로세스 계산"}],[{"id":"result","label":"결과 전송·병합"}]],"edges":[{"from":"serialize","to":"queue","label":"프로세스 경계"},{"from":"queue","to":"compute","label":"실행 자리"},{"from":"compute","to":"result","label":"완료 데이터"}]}
```

작은 작업을 배치로 합치면 전송 고정 비용을 줄일 수 있지만 큰 앞 작업이 뒤 작업을 막거나 메모리 피크가 늘 수 있습니다. cold pool의 시작 비용과 warm pool의 정상 작업 비용을 나눠 비교합니다. worker 수는 코어뿐 아니라 메모리·DB 연결·native 내부 thread 예산으로 정합니다.

## 시작 방식이 부모 상태의 의미를 바꿉니다

spawn은 새 인터프리터가 모듈을 읽으므로 import 가능한 worker 함수·직렬화 가능한 인자와 `if __name__ == '__main__':` 진입 보호가 중요합니다. top-level에서 풀을 만들면 자식 import가 같은 생성을 반복할 수 있습니다.

`fork`는 부모의 주소 공간을 복사한 상태에서 시작하지만, 멀티스레드 부모의 모든 스레드를 자식에서 그대로 실행하지는 않습니다. 자식에 복제되지 않은 다른 부모 스레드가 잡고 있던 lock이나 native 라이브러리 상태가 자식에서 안전하게 재구성된다고 가정할 수 없으므로, 이런 lock이나 native 상태를 자식이 안전하게 이어 쓸 수 있다고 보지 않습니다.

`forkserver`도 별도 서버에서 자식을 만드는 운영 계약을 가지므로 플랫폼·Python 버전의 지원과 기본값을 확인한 뒤 필요한 시작 문맥을 명시합니다. 라이브러리는 전역 시작 방식을 강제로 바꾸지 않아 호출자 코드와 충돌하지 않게 합니다.

부모의 DB 연결·네트워크 client를 자식이 안전하게 공유한다고 보지 말고 프로세스별 초기화·종료를 적용합니다. 직렬화에는 pickle 등의 실행 가능한 복원 경계가 있으므로 비신뢰 입력을 무조건 unpickle하지 않습니다.

## Shared Memory는 복사를 줄이고 수명 책임을 늘립니다

큰 읽기 전용 배열을 한 번 공유하고 각 작업에는 작은 offset·shape·dtype 정보만 보내면 반복 복사를 줄일 수 있습니다. worker가 읽기 전에 범위와 dtype을 확인하고, 읽기 종료 시점과 동시 쓰기를 허용하지 않을지 또는 동기화할지, close·unlink를 누가 책임지는지 정해야 합니다.

각 프로세스가 자기 매핑을 닫는 일과 공유 객체 이름을 제거하는 일은 같은 cleanup이 아니므로 분리해 추적합니다. 마지막으로 이 정리 순서와 resource tracker의 동작은 대상 플랫폼과 Python 버전에서 확인합니다.

부모 취소 뒤 자식이 아직 읽는데 공유 메모리를 재사용·폐기하면 오류가 납니다. 실제 worker 종료를 확인하고 한 소유자가 최종 제거하도록 합니다. process future 대기 취소가 이미 실행 중인 계산을 자동 중단하는 것도 아닙니다. 강제 worker 종료는 부분 외부 효과와 공유 자원 정리의 복구를 필요로 합니다.

## 계산·전송·메모리를 같은 입력으로 비교합니다

순수 Python·native 호출·I/O를 따로 프로파일링하고 thread 수·프로세스 수·native 내부 thread 수를 바꿉니다. 입력 크기·배치 크기·cold/warm pool을 고정해 CPU 시간·전체 지연·메모리 피크·직렬화량·오류를 비교합니다. 병렬화할 수 있는 부분이 작으면 전체 개선도 제한됩니다.

현재 기본 CPython 3.9.6의 작은 기능 시험과 free-threaded·C 확장·다중 프로세스 성능 검증은 구분해야 합니다. 이 노트는 실행 경계 설계이며 특정 확장의 GIL 해제나 프로세스 풀 손익분기점을 실제 측정한 결과는 아닙니다.
