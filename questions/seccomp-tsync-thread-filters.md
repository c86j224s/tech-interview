---
id: seccomp-tsync-thread-filters
title: 멀티스레드 프로세스에서 한 스레드에만 필터를 설치했습니다. TSYNC를 적용할 때 실패 조건과 적용 범위를 어떻게 확인하나요?
difficulty: 중하
category: 보안
tags:
  - seccomp
  - syscall
  - sandbox
related:
  - agent-sandbox-isolation
---
# 멀티스레드 프로세스에서 한 스레드에만 필터를 설치했습니다. TSYNC를 적용할 때 실패 조건과 적용 범위를 어떻게 확인하나요?

## 구두 답변

seccomp filter는 thread 단위이므로 한 thread에 설치한 filter가 프로세스 전체를 자동으로 덮지 않습니다. T1에 `mount=ERRNO`를 설치하고 T2가 아직 filter가 없으면 T2의 mount 호출은 다른 결과를 낼 수 있습니다. `SECCOMP_FILTER_FLAG_TSYNC`는 caller의 filter chain을 다른 thread에 적용하려는 요청이며, 기존 chain과 결합할 수 없는 thread가 있으면 실패할 수 있습니다. `seccomp(2)` 계약에 따라 성공 여부, 호환되지 않는 TID 반환 또는 `TSYNC_ESRCH`에 따른 ESRCH를 기록해야 하며, 실패한 호출 뒤 새 filter가 전체에 원자적으로 설치됐다고 가정하지 않습니다. 설명용 상태를 T1=`base`, T2=`incompatible`로 두면 TSYNC 결과가 실패했을 때 T1·T2의 기존 상태를 기준으로 fail-closed 종료나 재시작을 선택합니다. 이 값은 Linux thread 실험 결과가 아니라 API 계약을 적용한 예상 trace입니다. TSYNC 성공 후에도 미래 thread의 상태를 별도 추적합니다. child/thread 생성은 부모 filter를 상속하지만 “모든 미래 thread에 실시간 동기화”는 아닙니다. 검증은 TID 목록, 설치 호출 반환값/errno, 각 thread의 금지 syscall, seccomp log를 함께 저장합니다. filter 설치 전에 `clone`, `pthread_create`, loader와 로그 syscall을 막으면 초기화가 자기 정책에 의해 실패할 수 있으므로 관찰 단계에서 누락을 찾고 운영 action을 좁힙니다. 정책 구현은 worker 생성 전 일괄 설치할지, 생성 후 TSYNC할지 한 방식으로 고정하고 비호환 chain을 Composition Root에서 관리하겠습니다.

## 득점 포인트

- filter의 thread 단위성과 TSYNC의 적용·실패 반환을 구분합니다.
- 호환되지 않는 TID/ESRCH와 설치 후 상태를 확인하며 실패를 부분 성공으로 추정하지 않습니다.
- 상속은 미래 thread의 자동 동기화가 아니라 생성 시점의 부모 chain 복사임을 설명합니다.

## 감점 포인트

- 한 thread의 filter를 프로세스 전역 상태로 설명합니다.
- TSYNC 실패 후 caller에게 새 filter가 반드시 남았다고 단정합니다.
- child inheritance를 실행 중인 모든 thread의 지속 동기화로 오해합니다.

## 더 파고들 거리

- 이미 서로 다른 chain을 가진 세 thread에서 어느 TID가 반환되는지와 fail-closed 정책을 어떻게 기록할지 말해 보세요.
- filter 설치 전에 thread 생성 syscall을 막으면 초기화가 깨지는 이유를 실제 순서로 설명해 보세요.
