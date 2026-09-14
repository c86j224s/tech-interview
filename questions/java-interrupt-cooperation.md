---
id: "java-interrupt-cooperation"
title: "Java 스레드에 interrupt를 보냈는데 계속 실행됩니다. interrupt는 강제 종료와 어떻게 다른가요?"
answerMinutes: 5
followups: [{"id": "deadline-cancellation-propagation", "prompt": "상위 응답이 timeout된 뒤에도 하위 작업이 남는다면 취소 요청과 실제 종료를 어떻게 확인하나요?"}, {"id": "graceful-shutdown", "prompt": "새 작업을 막은 뒤 진행 중 작업·공유 풀·로그를 어떤 순서로 종료하나요?"}, {"id": "java-completablefuture-executor", "prompt": "비동기 단계가 어느 executor·완료 스레드에서 실행되는지 어떻게 검증하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["Java", "언어·런타임", "interrupt"]
related: ["deadline-cancellation-propagation", "graceful-shutdown", "java-completablefuture-executor"]
---

# Java 스레드에 interrupt를 보냈는데 계속 실행됩니다. interrupt는 강제 종료와 어떻게 다른가요?

## 구두 답변

interrupt는 스레드가 협력적으로 중단할 수 있도록 상태나 예외로 신호를 전달하는 수단이지 임의 코드의 즉시 강제 종료가 아닙니다. 작업이 어떤 대기 API와 중단 검사를 사용하는지 확인해야 합니다.

### 동작 원리와 전제

interruptible 대기는 InterruptedException을 던질 수 있고 예외 처리에서 인터럽트 상태가 지워지는 경우를 알아야 합니다. 복구할 수 없고 상위에 신호를 전달해야 한다면 재설정·전파 정책을 명시합니다. 예외를 로그만 남기고 계속하면 취소가 사라집니다.

### 선택과 실패 처리

CPU 루프는 적절한 간격에 상태를 확인하고 자원을 정리해야 합니다. 외부 I/O와 라이브러리의 취소 지원은 별도이며 이미 commit한 변경은 interrupt로 되돌아가지 않습니다. 강제 종료에 의존하기보다 짧은 작업 단계와 deadline을 설계합니다.

### 구체적인 사례와 검증

InterruptedException을 catch한 뒤 아무 처리 없이 루프를 계속 돌면 종료 요청이 사실상 무시될 수 있습니다. 해당 계층에서 작업을 끝낼지 상위에 다시 알릴지 정책을 정하고 cleanup을 수행합니다. Thread.interrupted처럼 상태를 읽고 지우는 API와 isInterrupted처럼 확인하는 API의 차이도 필요한 코드에서 검토합니다. 파일이나 소켓 I/O가 어떤 취소 계약을 제공하는지는 라이브러리마다 다릅니다. 종료 신호를 보낸 뒤 join이나 작업 완료로 실제 끝을 확인하며, 정리 기한을 넘기면 격리된 프로세스 종료 같은 상위 fallback과 외부 결과 대사를 설계해야 합니다.

대기 중·계산 중·락 보유·종료 경합을 시험합니다. 중단 요청과 실제 종료 시각, 남은 자원과 외부 효과를 구분해 기록합니다. interrupt를 받았다는 사실이 안전한 정리 완료의 증거가 아니라는 점이 핵심입니다.

## 득점 포인트

- 핵심 구분: interrupt는 스레드가 협력적으로 중단할 수 있도록 상태나 예외로 신호를 전달하는 수단이지 임의 코드의 즉시 강제 종료가 아닙니다.
- 선택 조건: CPU 루프는 적절한 간격에 상태를 확인하고 자원을 정리해야 합니다.
- 검증 기준: 대기 중·계산 중·락 보유·종료 경합을 시험합니다.

## 감점 포인트

- interrupt 호출 성공이 스레드와 외부 작업의 즉시 종료를 뜻한다고 한다.

## 더 파고들 거리

- 상위 응답이 timeout된 뒤에도 하위 작업이 남는다면 취소 요청과 실제 종료를 어떻게 확인하나요?
- 새 작업을 막은 뒤 진행 중 작업·공유 풀·로그를 어떤 순서로 종료하나요?
- 비동기 단계가 어느 executor·완료 스레드에서 실행되는지 어떻게 검증하나요?
