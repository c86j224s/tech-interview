---
id: pid-namespace-init-exit
title: PID namespace 안의 PID 1이 종료되면 남은 프로세스는 어떻게 되나요? 호스트에서 보이는 상태와 비교해 설명하세요.
difficulty: 중하
category: 운영체제
tags:
  - namespace
  - PID
  - mount
  - network
related:
  - process-vs-thread
---
# PID namespace 안의 PID 1이 종료되면 남은 프로세스는 어떻게 되나요? 호스트에서 보이는 상태와 비교해 설명하세요.

## 구두 답변

PID namespace 안에서 첫 프로세스가 namespace init, 즉 내부 PID 1이라면 그 종료는 자식 하나의 종료와 다릅니다. `pid_namespaces(7)`의 규칙에 따라 namespace 안에 남은 프로세스는 커널이 `SIGKILL`로 종료하고, 그 namespace에서 새 `fork`·`clone`을 시도하면 `ENOMEM`으로 실패합니다. 따라서 애플리케이션이 내부 PID 1이 될 때는 작업 처리뿐 아니라 자식 회수와 종료 신호 전달을 맡을 수 있는지 확인해야 합니다. 다만 이것은 호스트 PID 1이 종료된다는 뜻이 아닙니다. 예를 들어 호스트에서 init이 4200, worker가 4201이고 내부에서 각각 1, 7이라면 init 종료 전에는 내부 `ps`에 1과 7이 보입니다. 종료 후에는 4201도 사라지지만 호스트 supervisor는 4200과 4201의 host PID를 기준으로 종료·재시작을 기록합니다. 이 숫자는 실제 Linux 실행 결과가 아니라 규칙을 적용한 설명용 상태입니다. 내부 `/proc`가 올바른 PID namespace에 mount됐는지까지 확인해야 목록이 맞습니다. 또한 `/proc/4200/ns/pid`의 fd나 bind mount가 남아 namespace 객체가 유지되는 것과 내부 프로세스가 실행되는 것은 분리된 문제입니다. 저는 진단 시 host PID, inner PID, namespace 링크, init 종료 시각, supervisor 재시작 여부를 한 표에 기록해 “보이지 않음”과 “종료됨”을 구분하겠습니다.

이 구분은 재시작과 수명 추적에도 영향을 줍니다. 외부 supervisor가 같은 이미지로 새 컨테이너를 만들면 새 PID namespace와 새 내부 PID 1이 생기므로, 이전 worker의 host PID가 사라졌다는 사실만으로 새 작업이 같은 namespace에서 이어졌다고 볼 수 없습니다. 종료 전후에 namespace inode와 container identity를 같이 저장해야 로그를 섞지 않습니다.

## 득점 포인트

- init 종료의 SIGKILL과 후속 fork/clone의 ENOMEM을 PID 가시성 문제와 구분합니다.
- host PID 4200·4201과 inner PID 1·7을 함께 기록하고 올바른 /proc mount 여부까지 확인합니다.
- namespace 객체의 fd 수명과 프로세스 수명을 같은 것으로 단정하지 않습니다.

## 감점 포인트

- PID 1이 일반 프로세스와 같으므로 남은 worker가 계속 실행된다고 설명합니다.
- 컨테이너 안 PID 1 종료를 호스트의 전역 PID 1 종료로 오해합니다.
- SIGKILL 뒤 새 프로세스 생성 실패를 supervisor의 재시작 정책과 섞어 단일 원인으로 단정합니다.

## 더 파고들 거리

- namespace init이 신호를 무시할 때 어떤 종료 경로와 zombie 회수 정책을 둘지 설명해 보세요.
- 내부 /proc가 다른 PID namespace를 볼 때 host PID와 inner PID를 어떻게 대조할지 말해 보세요.
