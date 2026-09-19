---
id: seccomp-user-notification-supervisor
title: seccomp user notification supervisor가 멈추거나 잘못된 응답을 보내면 어떤 보안·가용성 문제가 생기나요?
difficulty: 중하
category: 보안
tags:
  - seccomp
  - syscall
  - sandbox
related:
  - agent-sandbox-isolation
---
# seccomp user notification supervisor가 멈추거나 잘못된 응답을 보내면 어떤 보안·가용성 문제가 생기나요?

## 구두 답변

`SECCOMP_RET_USER_NOTIF`는 syscall 자동 승인 기능이 아니라 userspace supervisor가 요청을 읽고 거부·응답·fd 전달을 결정하는 중재 경계입니다. supervisor가 멈추면 tracee 요청이 valid response를 기다린 채 pending인 경우 장애 시간만큼 지연될 수 있지만, 항상 그렇지는 않습니다. tracee가 종료되거나 signal로 notification이 중단되거나 higher-precedence action이 선택되거나 listener가 없어 `ENOSYS`가 되는 경우 결과가 달라집니다. 따라서 “2초 멈추면 모든 호출이 정확히 2초 지연”이라고 쓰지 않고 pending 상태가 유지된다는 조건을 명시합니다. 설명용 흐름은 tracee `openat` → listener fd → supervisor가 notification ID·pid·syscall data 확인 → 거부 또는 `NOTIF_ADDFD` 응답입니다. 잘못된 fd를 전달하면 tracee가 직접 open하지 않은 자원을 사용하게 되므로 fd가 가리키는 inode, namespace와 정책 대상을 검증해야 합니다. 응답은 ID와 tracee 생존을 확인하고, 반복·취소·재시도는 멱등 작업 ID로 관리합니다. 포인터 내용을 읽어 정책을 결정해야 한다면 tracee 메모리를 supervisor 메모리로 복사한 뒤 판단해 TOCTOU를 줄입니다. listener 하나에 fork한 여러 task의 알림이 올 수 있으므로 task별 상태와 동시성 한도를 둡니다. 이 예는 실제 notification 측정이 아닌 kernel 문서 기반 설계입니다. 가용성 설계에는 timeout, tracee exit, interruption, supervisor restart를 포함하고 supervisor에는 필요한 최소 capability만 부여합니다. supervisor가 sandbox 바깥의 신뢰 루트라는 사실 자체가 새 공격면이므로, response contract와 접근 자원을 검증하지 않으면 seccomp를 중재로 추가한 만큼 위험도 커질 수 있습니다.

## 득점 포인트

- pending 요청의 조건부 지연과 interruption·tracee exit·listener 부재의 다른 결과를 구분합니다.
- notification ID·tracee 생존·fd 대상·포인터 복사·TOCTOU를 response 검증에 포함합니다.
- supervisor 권한과 가용성이 새로운 신뢰 경계임을 latency·재시도·멱등성으로 설명합니다.

## 감점 포인트

- USER_NOTIF가 요청을 자동 승인한다고 말합니다.
- supervisor 중단 시간만큼 모든 tracee 호출이 반드시 같은 시간 지연된다고 단정합니다.
- val/error/fd 계약과 ID 검증 없이 임의 응답도 안전하다고 설명합니다.

## 더 파고들 거리

- listener가 없는 경우와 tracee가 signal로 대기에서 빠지는 경우의 결과를 어떻게 분리해 관측하겠습니까?
- supervisor가 mount를 대신할 때 재시도 중복으로 이중 작업이 생기지 않게 어떤 idempotency key를 두겠습니까?
