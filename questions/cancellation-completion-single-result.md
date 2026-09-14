---
id: "cancellation-completion-single-result"
title: "취소와 정상 완료가 동시에 도착합니다. 사용자에게 결과를 한 번만 전달하면서 실제 늦은 효과는 어떻게 기록하나요?"
difficulty: "중하"
category: "설계"
tags: ["타임아웃","취소","데드라인","심화 질문"]
related: ["deadline-cancellation-propagation","request-timeout-idempotency","goroutine-lifecycle-and-leaks"]
promotedFrom: {"id":"deadline-cancellation-propagation","prompt":"취소와 정상 완료가 경합할 때 결과를 한 번만 전달하려면 어떻게 할까요?"}
---

# 취소와 정상 완료가 동시에 도착합니다. 사용자에게 결과를 한 번만 전달하면서 실제 늦은 효과는 어떻게 기록하나요?

## 구두 답변

Pending에서 Completed 또는 Cancelled 중 하나만 결과 전달권을 얻도록 CAS나 락으로 상태를 전이합니다. callback이 각각 플래그를 읽고 실행하는 두 단계는 중복 전달 경쟁을 남깁니다.

취소가 이겨도 실제 외부 변경이 늦게 완료될 수 있으므로 그 사실은 감사·불확정 결과 대사에 남깁니다. 사용자 결과와 자원 회수의 상태를 분리하고 실제 I/O가 끝나기 전 buffer를 반환하지 않습니다. 양쪽 선후와 동시 도착을 결정적으로 시험합니다.

## 득점 포인트

- Pending에서 Completed 또는 Cancelled 중 하나만 결과 전달권을 얻도록 CAS나 락으로 상태를 전이합니다. callback이 각각 플래그를 읽고 실행하는 두 단계는 중복 전달 경쟁을 남깁니다.
- 양쪽 선후와 동시 도착을 결정적으로 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: Pending에서 Completed 또는 Cancelled 중 하나만 결과 전달권을 얻도록 CAS나 락으로 상태를 전이합니다.

## 더 파고들 거리

- [기본 상황과 비교: 사용자 요청이 타임아웃됐는데 하위 API 호출과 DB 작업은 계속 실행됩니다. 응답 대기 종료와 작업 취소를 어떻게 구분하고 어디까지 전파하나요?](/tech-interview/questions/deadline-cancellation-propagation/)
