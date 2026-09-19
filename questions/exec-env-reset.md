---
id: exec-env-reset
title: >-
  execve로 새 프로그램을 실행할 때 argv와 envp는 누가 만들며 기존 heap·stack·signal handler는 어떻게
  되나요?
difficulty: 하
category: 운영체제
tags:
  - execve
  - argv
  - envp
  - 프로세스 이미지
related:
  - process-vs-thread
---
# execve로 새 프로그램을 실행할 때 argv와 envp는 누가 만들며 기존 heap·stack·signal handler는 어떻게 되나요?

## 구두 답변

`execve`를 호출하는 launcher가 `argv`와 `envp` 포인터 배열 및 문자열을 준비해 새 image에 전달합니다. 성공한 exec는 child를 만드는 `fork`가 아니라 현재 process의 code·data·heap·stack을 새 executable image로 바꾸는 동작이므로 PID는 유지됩니다. launcher가 `malloc`한 설정 객체나 stack frame, 기존 함수 주소가 worker의 heap과 code로 이어지는 것은 아닙니다. 예를 들어 `argv=[worker,--port,8080]`, `envp=[PATH=/usr/bin,CONFIG=/etc/app]`라면 worker는 시작 규약으로 이 문자열을 읽지만 old heap 객체는 읽지 못합니다.

signal도 구분해야 합니다. caught handler는 새 image에 같은 함수 주소가 없으므로 default로 reset되고, Linux에서는 ignored disposition이 유지됩니다. calling thread의 mask와 pending signal은 POSIX exec 규칙에 따라 새 initial thread에 상속되며 alternate stack은 별도 폐기 규칙을 따릅니다. exec가 실패하면 기존 image와 PID·heap·thread가 남아 있으므로 errno, 임시 env 배열, 열린 자원의 정리는 실패 경로에서 수행해야 합니다. 환경 변수는 process memory의 문자열일 뿐이므로 token을 자동으로 안전하게 전달하는 비밀 저장소로 취급하지 않습니다.

argv와 envp의 문자열 수명도 호출자 계약에 포함됩니다. exec 성공 뒤에는 새 image의 초기화 코드가 전달된 배열을 읽지만, launcher의 이후 stack frame을 참조하는 식으로 설계할 수 없습니다. 환경 key를 추가하면 하위 library의 동작이 바뀔 수 있으므로 allowlist와 함께 기본값·충돌 우선순위도 기록합니다. 반대로 경로가 존재하지 않아 exec가 실패하면 launcher는 같은 주소 공간에서 계속 실행하므로, 실패 로그가 old handler와 old heap을 전제로 작성되어야 합니다.


## 득점 포인트

- caller가 `argv`·`envp`를 구성하고 exec가 image를 교체한다는 두 책임을 분리합니다.
- PID 유지와 old code·data·heap·stack·pointer의 수명 종료를 한 실행 trace로 연결합니다.
- caught handler reset, ignored disposition, mask·pending 상속을 한 범주로 뭉개지 않습니다.
- 성공과 실패에서 기존 image가 계속 실행되는지와 환경·FD 정리 책임이 달라짐을 설명합니다.

## 감점 포인트

- exec가 새 PID의 child를 생성한다고 합니다.
- launcher의 heap pointer가 새 worker image의 heap 객체를 가리킨다고 설명합니다.
- 모든 signal disposition과 mask를 동일하게 초기화한다고 단정합니다.
- envp가 process memory와 진단 경로에 노출될 수 있다는 경계를 빠뜨립니다.

## 더 파고들 거리

- PATH 탐색을 수행하는 `execvp` wrapper와 경로를 직접 받는 `execve`의 책임을 어떻게 시험할까요?
- argv/envp와 별개로 worker에 넘기는 listening FD의 번호·객체·CLOEXEC 계약을 어떤 startup assertion으로 확인할까요?
