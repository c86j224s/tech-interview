---
id: "shared-memory-owner-death-recovery"
title: "공유 메모리의 락 소유자가 죽었습니다. 락을 다시 얻는 것과 부분 변경 데이터를 복구하는 것은 어떻게 다른가요?"
difficulty: "중하"
category: "운영체제"
tags: ["프로세스","스레드","가상 메모리","장애 격리","컨텍스트 스위칭","IPC","심화 질문"]
related: ["process-vs-thread","mutex-vs-serial-execution","goroutine-lifecycle-and-leaks"]
promotedFrom: {"id":"process-vs-thread","prompt":"공유 메모리에서 owner가 죽었을 때 잠금 복구와 데이터 복구는 어떻게 나누나요?"}
---

# 공유 메모리의 락 소유자가 죽었습니다. 락을 다시 얻는 것과 부분 변경 데이터를 복구하는 것은 어떻게 다른가요?

## 구두 답변

owner-death를 감지해 락을 다시 얻는 기능이 있어도 보호하던 데이터는 중간 변경 상태일 수 있습니다. 일관성 검사·저널·복구 마커로 상태를 복원한 뒤 정상 사용을 허용해야 합니다.

robust mutex 등 API의 inconsistent·recoverable 상태 계약을 따릅니다. 모든 프로세스가 같은 복구 규칙과 version을 사용해야 합니다. owner 중단 지점별로 데이터 불변식·락 재획득·반복 복구를 시험합니다.

## 득점 포인트

- owner-death를 감지해 락을 다시 얻는 기능이 있어도 보호하던 데이터는 중간 변경 상태일 수 있습니다. 일관성 검사·저널·복구 마커로 상태를 복원한 뒤 정상 사용을 허용해야 합니다.
- owner 중단 지점별로 데이터 불변식·락 재획득·반복 복구를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: owner-death를 감지해 락을 다시 얻는 기능이 있어도 보호하던 데이터는 중간 변경 상태일 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 공유 캐시를 빠르게 사용하는 서버와 실패한 작업자를 격리해야 하는 서버에서 프로세스와 스레드는 어떤 기준으로 선택하나요?](/tech-interview/questions/process-vs-thread/)
