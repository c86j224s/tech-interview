---
id: exec-env-inheritance
title: >-
  환경 변수와 파일 디스크립터를 새 image에 넘기는 launcher를 설계합니다. env 상속과 FD 상속은 각각 어떤 명시적
  allowlist가 필요하나요?
difficulty: 하
category: 보안
tags:
  - exec
  - 환경 변수
  - FD inheritance
  - launcher
related:
  - gitops-secrets-delivery
---
# 환경 변수와 파일 디스크립터를 새 image에 넘기는 launcher를 설계합니다. env 상속과 FD 상속은 각각 어떤 명시적 allowlist가 필요하나요?

## 구두 답변

환경과 FD는 모두 exec 경계를 넘어가지만 계약의 단위가 다릅니다. 환경 allowlist는 `PATH`, `CONFIG`, `LISTEN_FD=3`처럼 필요한 key와 값만 새 `envp` 배열에 넣고, 값의 형식·최대 길이·민감도·로그 redaction·회전 정책을 확인합니다. FD allowlist는 3번이라는 번호만 남기는 것이 아니라 해당 entry가 실제 listening socket인지, 접근 모드·소유권·peer 수명·상속 목적이 맞는지 검사합니다. 신규 FD는 생성 시 CLOEXEC를 기본값으로 만들어 임시 pipe와 secret file이 우연히 남지 않게 합니다.

예를 들어 launcher의 전체 `environ`에 `DB_PASSWORD`가 있어도 worker에는 필요한 세 key만 전달하고, secret은 별도 IPC나 제한된 읽기 전용 파일을 검토합니다. FD는 `CLOEXEC` 기본값으로 열고 listener만 exec 경쟁을 통제한 뒤 pass-FD로 준비합니다. worker가 `/proc/self/fd`를 열거하는 것은 Linux 진단에는 유용하지만 portable allowlist 계약은 아닙니다. exec가 실패하면 기존 image가 그대로 실행되므로 임시 env 배열·FD 상태를 실패 경로에서 정리합니다. 환경은 자동으로 안전한 비밀 저장소가 아니고 FD 번호를 숨기는 것도 상속 방지가 아닙니다.

두 allowlist를 함께 문서화할 때도 같은 문자열이나 번호를 재사용해 의미를 섞지 않습니다. `LISTEN_FD=3`은 worker가 어떤 FD를 사용할지 알려 주는 환경 설정이고, FD 3 자체의 상속 권한은 descriptor-table 상태입니다. worker가 환경에 3이 있다고 해서 실제 3번이 socket이라는 보장은 없으므로 startup에서 두 계약을 모두 검증해야 합니다. secret을 파일로 바꾸면 환경 누출은 줄어도 파일 FD의 CLOEXEC, 파일 mode, 회전 중 unlink와 open description 수명이라는 새 비용이 생깁니다.


## 득점 포인트

- env key/value allowlist와 FD 번호/객체/권한 allowlist를 별도 검증 문제로 나눕니다.
- `DB_PASSWORD` 제외, `LISTEN_FD=3` 전달, 임시 pipe 차단이라는 구체 입력과 예상 worker 상태를 제시합니다.
- 생성 시 CLOEXEC와 exec 직전 pass-FD race 통제를 함께 설명합니다.
- 성공·실패에서 launcher의 기존 image와 자원 정리 책임이 어떻게 다른지 말합니다.

## 감점 포인트

- 같은 process의 환경 변수는 외부에서 볼 수 없으므로 자동으로 안전하다고 주장합니다.
- FD 번호만 문서에 적으면 다른 open object가 노출되지 않는다고 합니다.
- 모든 FD와 전체 environ을 넘기고 worker가 알아서 무시하면 된다고 설계합니다.
- exec 실패 시 old image와 임시 자원이 사라진다고 가정합니다.

## 더 파고들 거리

- secret 값 회전이 필요한 서비스에서 env 재exec와 읽기 전용 FD·IPC 중 어느 쪽이 수명과 감사에 유리할까요?
- worker가 시작한 뒤 allowlist 위반 FD를 발견하면 readiness를 막고 supervisor에 어떤 실패 상태를 보고할까요?
