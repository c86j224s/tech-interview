---
id: "go-producer-failure-channel-close"
title: "여러 생산자 중 하나가 실패했습니다. 취소 전파·남은 송신·채널 close를 어떤 순서로 수행하나요?"
difficulty: "중하"
category: "언어·런타임"
tags: ["Go","채널","취소","심화 질문"]
related: ["go-channel-close-ownership","goroutine-lifecycle-and-leaks","deadline-cancellation-propagation"]
promotedFrom: {"id":"go-channel-close-ownership","prompt":"생산자 중 한 명의 오류 뒤 채널을 닫기 전 어떤 취소 순서를 지켜야 할까요?"}
---

# 여러 생산자 중 하나가 실패했습니다. 취소 전파·남은 송신·채널 close를 어떤 순서로 수행하나요?

## 구두 답변

오류가 난 생산자는 상위에 알리고 모든 생산자에게 취소를 전파합니다. 남은 송신이 끝났음을 WaitGroup 등으로 확인한 소유자만 채널을 close해야 send-on-closed 경쟁을 피할 수 있습니다.

수신자가 중단돼 송신이 막히지 않도록 send도 취소 신호를 관찰합니다. 큐의 남은 값은 drain·폐기·내구 재처리 중 정책을 정합니다. 한 생산자가 실패했다고 다른 생산자와 조정 없이 공유 채널을 닫지 않습니다.

## 득점 포인트

- 오류가 난 생산자는 상위에 알리고 모든 생산자에게 취소를 전파합니다. 남은 송신이 끝났음을 WaitGroup 등으로 확인한 소유자만 채널을 close해야 send-on-closed 경쟁을 피할 수 있습니다.
- 한 생산자가 실패했다고 다른 생산자와 조정 없이 공유 채널을 닫지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 오류가 난 생산자는 상위에 알리고 모든 생산자에게 취소를 전파합니다.

## 더 파고들 거리

- [기본 상황과 비교: 여러 고루틴이 하나의 채널로 결과를 보냅니다. 수신자가 먼저 종료할 때 채널을 닫아도 되며, close는 누가 해야 하나요?](/tech-interview/questions/go-channel-close-ownership/)
