---
id: java-execution-lifetime
title: Java Future·Interrupt·가상 스레드의 실행 수명
topic: 언어·런타임
summary: CompletableFuture 단계의 executor·compose·오류를 나누고 interrupt 협력·실제 종료·가상 스레드와 하위 자원 상한을 설명합니다.
questionIds: [java-completablefuture-executor, java-interrupt-cooperation, java-virtual-threads-blocking]
---

# Java Future·Interrupt·가상 스레드의 실행 수명

## Future를 쓴다고 모든 단계가 전용 Worker에서 실행되지는 않습니다

네트워크 응답을 완료하는 스레드에서 CompletableFuture의 thenApply가 무거운 JSON 변환을 수행하면 그 스레드가 다른 응답을 처리하지 못할 수 있습니다. non-async 단계는 완료를 수행하는 스레드 등에서 실행될 수 있고, 이미 완료된 future에 단계를 붙이면 등록하는 스레드에서 실행될 수도 있습니다. API 이름보다 실제 실행 위치가 중요합니다.

async 단계는 명시 executor 또는 기본 비동기 실행 정책을 사용합니다. 기본 CompletableFuture는 일반적으로 common ForkJoinPool을 사용하지만 기본 풀의 병렬성 등에 따른 예외와 하위 타입의 실행 정책을 확인합니다. async가 항상 새 전용 스레드를 만든다는 뜻은 아닙니다.

## 단계의 결과 형태와 실행 위치를 따로 선택합니다

| 연산 | 결과 관계 | 수명 주의점 |
| --- | --- | --- |
| thenApply | 값 변환 | 긴 계산이 완료 스레드를 점유할 수 있음 |
| thenCompose | 반환한 비동기 단계 연결 | 중첩 Future를 평평하게 연결 |
| handle·exceptionally | 결과·오류를 새 결과로 변환 가능 | 실패를 성공 기본값으로 숨길 수 있음 |
| timeout 관련 완료 | Future 상태를 정착 | 원래 I/O 종결과 다름 |
| 명시 executor의 async 단계 | 실행 위치를 분리 | 큐·활성 수·거절·종료 필요 |

짧은 CPU 변환과 긴 blocking I/O를 같은 공용 풀에 무제한 넣지 않습니다. 별도 executor를 두어도 큐가 무제한이면 대기가 메모리로 이동할 뿐입니다. 결과를 기다리는 부모가 자식과 같은 제한된 풀의 자리를 모두 점유하면 자식 실행 자리가 없어 교착할 수도 있습니다.

```diagram
{"title":"Future의 완료와 실제 작업 종결은 별도입니다","caption":"화살표는 상태 관찰 경로입니다. timeout으로 사용자 대기가 끝나도 하위 작업이 계속되면 그 작업 소유자가 자원과 결과를 정리해야 합니다.","rows":[[{"id":"start","label":"하위 I/O 시작"}],[{"id":"timeout","label":"사용자 Future timeout"},{"id":"running","label":"실제 I/O 계속 실행 가능"}],[{"id":"finish","label":"실제 종결 확인·자원 반환"}]],"edges":[{"from":"start","to":"timeout","label":"대기 기한"},{"from":"start","to":"running","label":"별도 실행 수명"},{"from":"running","to":"finish","label":"완료·지원 취소"}]}
```

CompletableFuture의 cancel이 임의 계산이나 네트워크를 강제 interrupt한다고 가정하지 않습니다. 실제 작업 핸들·라이브러리의 취소 계약과 연결해야 합니다. 이미 서버 DB가 커밋된 변경은 future의 exceptional completion으로 되돌아가지 않습니다.

## Interrupt는 협력적인 종료 신호입니다

interruptible 대기는 InterruptedException을 던질 수 있고 그 과정에서 interrupt 상태가 지워질 수 있습니다. 호출 계층에서 처리를 끝내거나 예외를 전파하고, 시그니처상 전파할 수 없으면 적절히 `Thread.currentThread().interrupt()`로 상태를 복원한 뒤 종료하는 등 정책을 정합니다. 로그만 남기고 같은 루프를 계속 돌면 종료 요청이 사라질 수 있습니다.

Thread.interrupted는 현재 스레드 상태를 읽고 지우며 isInterrupted는 해당 상태를 확인하고 지우지 않습니다. CPU 루프는 적절한 단계마다 상태를 검사하고 자원을 정리합니다. 일반 synchronized monitor 획득과 interruptible lock 획득도 같은 취소 계약이 아닙니다. 소켓·파일·SDK별로 지원되는 중단 경로를 확인해야 합니다.

신호를 보낸 시각, 실제 함수 반환·스레드 종료 시각, 외부 효과 확정 시각을 나눠 기록합니다. join·완료 핸들로 실제 끝을 확인하고 기한을 넘긴 작업의 격리·프로세스 단위 종료·결과 대사는 상위 운영 계약으로 정합니다. 위험한 임의 스레드 강제 종료를 정상 복구 방식으로 삼지 않습니다.

## 가상 스레드는 DB 연결과 메모리를 늘리지 않습니다

가상 스레드는 지원되는 blocking 경로에서 carrier를 반환하며 많은 대기 작업의 표현 비용을 줄일 수 있습니다. 하지만 10만 요청이 100개 DB 연결을 기다리면 나머지 요청의 문맥·대기 시간·메모리는 남습니다. 수락 수·풀 획득 대기·하위 동시 호출·deadline을 별도로 제한합니다.

CPU 계산은 실제 코어를 사용하므로 가상 스레드 수 증가가 실행 용량을 무한히 늘리지 않습니다. ThreadLocal에 큰 객체를 넣으면 요청별 비용도 커집니다. 플랫폼 스레드 풀의 크기를 그대로 복제하기보다 필요한 하위 자원의 상한을 직접 정합니다.

pinning·monitor·native 호출의 동작은 JDK 버전에 따라 바뀝니다. 예를 들어 오래된 가상 스레드의 synchronized 관련 조언을 최신 JDK에 무조건 적용하지 말고 실제 버전의 JFR·pinning 이벤트·지원 문서를 확인합니다. 이 노트는 특정 최신 JDK 동작을 실험했다고 주장하지 않습니다.

## 빠른 완료와 느린 완료를 모두 시험합니다

이미 완료된 future와 나중 완료되는 future에 같은 단계를 붙여 thread 이름·executor 큐를 관찰합니다. thenCompose 누락, 오류 기본값, 풀 포화, timeout 후 늦은 완료를 나눕니다. interruptible 대기·CPU 루프·취소 무시 I/O도 각각 시험합니다.

가상 스레드 비교는 I/O 중심·CPU 중심·느린 DB·메모리 압력을 고정해 p99·대기 수·활성 연결·오류를 함께 봅니다. Homebrew OpenJDK 21.0.12.1의 `scripts/VerifyJavaStudy.java`로 thenCompose 결과와 가상 스레드 executor의 작은 작업 완료를 확인했습니다. JFR·pinning·실제 I/O 취소·가상 스레드 부하 성능은 측정하지 않았으며 이 기능 시험을 용량 검증으로 확대하지 않습니다.
