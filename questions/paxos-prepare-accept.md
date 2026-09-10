---
id: paxos-prepare-accept
title: "Paxos에서 제안자가 응답을 받기 전에 멈추고 새 제안자가 시작했습니다. 이미 수락된 값과 충돌하지 않도록 prepare와 accept에서 무엇을 확인하고 기록하나요?"
answerMinutes: 5
followups: [{"id":"multi-paxos-leader","prompt":"여러 슬롯에서 stable leader가 prepare 비용을 어떻게 줄이고 교체 때 무엇을 보존하나요?"},{"id":"consensus-vs-replication","prompt":"acceptor에 복제하는 것과 Paxos chosen은 어떻게 다른가요?"},{"id":"raft-term-election","prompt":"Paxos ballot과 Raft term의 늦은 메시지 처리 공통점은 무엇인가요?"}]
difficulty: 하
category: 분산 시스템
tags: ["Paxos","합의","ballot"]
related: ["consensus-vs-replication"]
---

# Paxos에서 제안자가 응답을 받기 전에 멈추고 새 제안자가 시작했습니다. 이미 수락된 값과 충돌하지 않도록 prepare와 accept에서 무엇을 확인하고 기록하나요?

## 구두 답변

Paxos prepare는 proposer가 높은 ballot으로 진행할 약속을 얻고 acceptor에게 과거 수락 ballot·value를 보고하게 합니다. 응답에 과거 수락이 있으면 그중 가장 높은 ballot의 value를 이어서 accept해야 하고, 없을 때만 새 value를 고릅니다. 그래야 과반 교집합에 이미 선택된 값이 보존됩니다.

### 기록과 상태

같은 슬롯의 같은 ballot·value가 과반에 수락되면 chosen이지만 learner가 즉시 알거나 client가 응답한 것은 아닙니다. 약속·수락·다음 ballot 정보는 재시작 뒤 보존해야 합니다. 기록 전 응답하면 낮은 ballot을 다시 받아들일 수 있습니다.

경쟁 proposer가 계속 높은 ballot을 내면 안전성은 유지돼도 progress가 멈출 수 있어 stable leader·backoff가 필요합니다. 지연 accept·재시작·learner 단절을 주입해 chosen·learned·응답을 따로 확인합니다.

### 과반 수락과 최고 ballot의 값

acceptor A·B·C에서 ballot 7의 값 X를 A와 B가 수락했다면 X는 chosen입니다. 새 proposer가 ballot 8로 B·C의 prepare 응답을 받으면 B의 X를 보므로 X를 이어서 제안해야 합니다. C가 아무 기록이 없다고 해서 새 값 Y를 선택하면 이전 결정과 충돌할 수 있습니다. 응답한 쿼럼에 수락값이 여럿이면 가장 높은 수락 ballot의 값을 고르며, 값 자체의 대소나 가장 많은 표를 얻은 값을 고르는 것이 아닙니다.

이전 값이 과반에 선택됐는지 proposer가 확실히 알지 못해도 같은 규칙을 지켜야 합니다. 한 노드만 수락한 값도 새 prepare 응답 중 최고라면 이어받을 수 있습니다. 이는 무조건 그 값이 이미 chosen이라는 뜻이 아니라, 이전 선택과 충돌하지 않는 안전한 진행 규칙입니다. ballot은 고유하고 비교 가능해야 하며 서로 다른 proposer가 같은 ballot으로 다른 값을 제안하지 않게 합니다.

### 영속 기록과 진행성

acceptor는 더 낮은 ballot을 받지 않겠다는 약속과 수락 ballot·value를 응답 전에 안정적으로 저장해야 합니다. 재시작 때 약속을 잊으면 옛 제안을 다시 받아 서로 다른 값이 선택되는 경로가 생길 수 있습니다. learner는 chosen을 알리는 관찰자이며 chosen 사실이 생겨도 모든 learner가 즉시 알 필요는 없습니다. 클라이언트 성공 응답과도 시점이 다릅니다.

경쟁 proposer가 서로 더 높은 ballot을 계속 제시하면 각자 prepare는 성공해도 accept 단계가 방해받을 수 있습니다. 안정 리더와 백오프는 진행을 돕고, 안전성은 여전히 prepare·accept의 값 보존 규칙에 의존합니다. 모든 노드 응답을 기다리면 작은 장애에도 멈추므로 정한 쿼럼을 사용합니다.

테스트에서는 prepare 응답 후 중단, accept 저장 후 응답 유실, 재시작, 지연된 낮은 ballot을 차례로 주입합니다. 같은 슬롯의 chosen 값이 하나인지 검사하고, learned·applied·클라이언트 응답을 따로 기록해 '모두 아는 것'과 '이미 결정된 것'을 혼동하지 않겠습니다.

## 득점 포인트

- prepare와 accept를 분리한다.
- 최고 기존 value를 이어받는 이유를 설명한다.
- chosen·learned·응답·영속성을 나눈다.
- 안전성과 진행성을 검증한다.

## 감점 포인트

- 새 proposer가 언제나 새 값을 고른다.
- 모든 노드 동의가 필요하다.
- 기록을 재시작 때 버린다.

## 더 파고들 거리

- 경쟁 proposer
- learner 단절
- ballot과 슬롯
