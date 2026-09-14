---
id: "js-web-worker-transfer"
title: "브라우저의 큰 계산을 Web Worker로 옮깁니다. 객체 전달과 ArrayBuffer transfer는 비용·소유권이 어떻게 다른가요?"
answerMinutes: 5
followups: [{"id": "js-object-copy", "prompt": "얕은 복사·깊은 복사·소유권 이동에서 어떤 중첩 데이터가 공유되나요?"}, {"id": "atomics-memory-order", "prompt": "준비 플래그와 데이터 게시의 순서를 release·acquire로 어떻게 연결하나요?"}, {"id": "browser-rendering-layout", "prompt": "메인 스레드 계산과 layout 반복이 화면 응답을 늦추는 구간을 어떻게 나누어 측정하나요?"}]
difficulty: "중하"
category: "언어·런타임"
tags: ["JavaScript", "언어·런타임"]
related: ["js-object-copy", "atomics-memory-order", "browser-rendering-layout"]
---

# 브라우저의 큰 계산을 Web Worker로 옮깁니다. 객체 전달과 ArrayBuffer transfer는 비용·소유권이 어떻게 다른가요?

## 구두 답변

Worker는 별도 실행 문맥에서 계산해 UI 스레드의 부담을 줄일 수 있지만 메시지 전달·직렬화·동기화 비용이 생깁니다. structured clone과 transferable의 소유권 이동, SharedArrayBuffer의 공유를 구분합니다.

### 동작 원리와 전제

큰 ArrayBuffer를 transfer하면 복사를 줄일 수 있지만 송신 쪽 버퍼가 분리되어 이전처럼 사용할 수 없습니다. 공유 메모리는 양쪽에서 접근하므로 Atomics와 동기화가 필요하며 지원 보안 조건도 확인합니다. 일반 객체 참조가 그대로 공유된다고 가정하지 않습니다.

### 선택과 실패 처리

작업 ID와 취소·결과 세대를 두고 늦은 계산이 새 화면을 덮지 않게 합니다. 작은 계산은 worker 시작·전송 비용이 더 클 수 있어 측정합니다. DOM 조작은 메인 스레드와 역할이 다르므로 결과만 전달합니다.

### 구체적인 사례와 검증

전송 목록으로 ArrayBuffer를 넘긴 뒤 메인 스레드가 그 데이터를 다시 렌더링에 사용하려 하면 분리된 버퍼 상태를 만날 수 있습니다. 데이터 소유권을 worker로 옮겼는지 복사본을 보냈는지 API 계약을 명시합니다. worker가 결과를 반환할 때도 필요한 버퍼를 다시 transfer할 수 있지만 참조를 잡고 있는 다른 코드와 충돌하지 않게 합니다. SharedArrayBuffer는 분리되지 않는 대신 동시 접근의 순서·가시성을 설계해야 합니다. 큰 작업을 여러 worker로 나누면 메모리 복제와 결과 병합이 늘 수 있어 메인 스레드 프레임 시간과 전체 지연·메모리 피크를 함께 측정합니다.

큰 입력·transfer 후 접근·worker 종료·중복 메시지·UI 응답성을 시험합니다. 총 계산 시간과 메인 스레드 블로킹 시간을 따로 봅니다. Worker는 메모리와 CPU를 무한 제공하는 장치가 아니므로 동시 worker와 메시지 큐 상한을 둡니다.

## 득점 포인트

- 핵심 구분: Worker는 별도 실행 문맥에서 계산해 UI 스레드의 부담을 줄일 수 있지만 메시지 전달·직렬화·동기화 비용이 생깁니다.
- 선택 조건: 작업 ID와 취소·결과 세대를 두고 늦은 계산이 새 화면을 덮지 않게 합니다.
- 검증 기준: 큰 입력·transfer 후 접근·worker 종료·중복 메시지·UI 응답성을 시험합니다.

## 감점 포인트

- Worker 메시지가 모든 객체 참조를 복사 비용 없이 안전하게 공유한다고 한다.

## 더 파고들 거리

- 얕은 복사·깊은 복사·소유권 이동에서 어떤 중첩 데이터가 공유되나요?
- 준비 플래그와 데이터 게시의 순서를 release·acquire로 어떻게 연결하나요?
- 메인 스레드 계산과 layout 반복이 화면 응답을 늦추는 구간을 어떻게 나누어 측정하나요?
