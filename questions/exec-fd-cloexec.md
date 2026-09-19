---
id: exec-fd-cloexec
title: >-
  서버가 listening socket을 연 뒤 exec한 worker에 비밀 파일 FD가 노출됐습니다. FD_CLOEXEC를 언제 설정해야
  race 없이 상속을 막나요?
difficulty: 하
category: 보안
tags:
  - exec
  - file descriptor
  - FD_CLOEXEC
  - 보안
related:
  - os-file-descriptor-sharing
  - security-upload-content-validation
---
# 서버가 listening socket을 연 뒤 exec한 worker에 비밀 파일 FD가 노출됐습니다. FD_CLOEXEC를 언제 설정해야 race 없이 상속을 막나요?

## 구두 답변

성공한 exec에서 `FD_CLOEXEC`가 설정된 descriptor-table entry는 닫히고, 설정되지 않은 entry는 새 image에 남을 수 있습니다. 따라서 기본은 descriptor를 **생성하는 순간** `O_CLOEXEC` 같은 옵션으로 close-on-exec 상태로 만드는 것입니다. `fd=open(path, flags)` 뒤 `fcntl(fd, F_SETFD, FD_CLOEXEC)`를 수행하는 동안 다른 thread가 exec하면, 그 짧은 창에서 비밀 FD가 이미 worker로 상속될 수 있습니다. Linux `open(2)`가 설명하는 `O_CLOEXEC`는 이 open/fcntl 경쟁을 생성 시점에서 제거합니다.

listener만 전달하려면 모든 FD를 inheritable로 열어 두지 말고, 신규 FD는 CLOEXEC 기본값으로 만든 뒤 exec를 직렬화한 경계에서 의도한 listener 하나만 pass-FD로 준비합니다. worker startup에서는 fd 3이 정말 listening socket인지, 접근 모드와 수명이 기대와 같은지, secret file·임시 pipe가 없는지를 확인합니다. `close(fd)`는 현재 번호 하나를 닫는 연산이고 CLOEXEC는 성공한 exec 시점의 동작이므로 같지 않습니다. `dup`으로 다른 descriptor reference가 남아 있으면 하나를 close해도 leak이 사라지지 않습니다.

race를 재현할 때는 open과 fcntl 사이에 barrier를 두고 다른 thread가 exec를 시도하도록 해야 합니다. 성공한 worker에서 허용 FD 3의 `fstat`·socket 종류·예상 peer를 검사하고, secret FD가 닫혔다는 결과를 실제 descriptor 열거와 권한 테스트로 확인합니다. 단일 테스트에서 누출이 없었다고 open/fcntl 순서가 안전해지는 것은 아닙니다. 대상 API가 생성 시 CLOEXEC를 지원하지 않는다면 exec 직렬화, close-range 같은 플랫폼 기능, 또는 단일-thread launcher로 경쟁 자체를 없애는 선택지를 비교합니다.


## 득점 포인트

- open 후 fcntl의 시간 창을 “다른 thread가 exec하는 순간”으로 구체화합니다.
- 생성 시 `O_CLOEXEC`와 의도된 listener pass-FD를 결합한 allowlist 절차를 제시합니다.
- descriptor 번호, descriptor-table flag, open file description, dup reference를 분리합니다.
- worker 내부에서 허용 객체와 금지 객체를 실제로 감사하고 `/proc` 의존성은 Linux 진단 범위로 제한합니다.

## 감점 포인트

- exec 직전에 fcntl하면 멀티스레드에서도 언제나 안전하다고 말합니다.
- fd 번호 7을 close하면 dup된 모든 reference도 사라진다고 설명합니다.
- 번호를 숨기거나 worker가 사용하지 않으면 secret FD 상속이 문제가 아니라고 합니다.
- listening socket을 전달하기 위해 모든 신규 FD를 inheritable로 둡니다.

## 더 파고들 거리

- 이미 열려 있는 여러 FD 중 listener 하나만 전달해야 할 때 exec 직렬화와 pass-FD 상태 변경의 원자성을 어떻게 설계할까요?
- descriptor 0·1·2와 set-ID 실행의 특수 동작을 일반 CLOEXEC allowlist와 어떻게 별도로 확인할까요?
