---
id: paxos-prepare-accept
title: "Paxos에서 prepare와 accept는 어떤 기록을 보호하며, 새 proposer가 이전에 수락된 값을 이어받아야 하는 이유는 무엇인가요?"
difficulty: 하
category: 분산 시스템
tags: ["Paxos","합의","ballot"]
related: ["consensus-vs-replication"]
---

# Paxos에서 prepare와 accept는 어떤 기록을 보호하며, 새 proposer가 이전에 수락된 값을 이어받아야 하는 이유는 무엇인가요?

## 구두 답변

Paxos의 prepare는 proposer(값을 제안하는 주체)가 더 높은 ballot(제안 번호)으로 진행할 수 있는지 acceptor(제안값을 받아 기록하는 참여자)에게 약속을 받고, 각 acceptor가 과거에 수락한 ballot과 value를 보고하게 하는 단계입니다. accept 단계에서 proposer는 prepare 응답 중 가장 높은 ballot으로 수락된 값이 있다면 그 값을 이어서 제안하고, 없다면 새 값을 제안합니다. 이 규칙이 없으면 이미 과반이 선택한 값과 다른 값이 나중에 선택될 수 있습니다.

같은 슬롯의 같은 ballot·value 제안을 과반 acceptor가 수락하면 그 슬롯의 value는 chosen(합의된 값) 상태가 될 수 있지만, 모든 learner(결정 결과를 전달받는 주체)가 즉시 알거나 응답을 받는 것은 아닙니다. 즉 선택(chosen), 학습(learner가 앎), 클라이언트 응답은 별개의 상태입니다. prepare의 약속과 accept 기록, 다음 ballot 생성 정보는 재시작 뒤에도 안전하게 보존돼야 합니다.

여러 proposer가 계속 더 높은 ballot을 내면 서로의 약속을 깨며 progress가 지연될 수 있어 안정적인 leader나 선출 장치가 진행성을 돕습니다. 하지만 leader가 Paxos 규칙을 생략하거나 모든 노드의 동의를 요구하는 것은 아닙니다. 지연된 accept, 경쟁 proposer, 선택 후 learner 단절을 재현해 안전성과 진행성을 별도로 확인하겠습니다.

## 득점 포인트

- prepare의 약속·보고와 accept의 실제 수락을 분리한다.
- 가장 높은 이전 수락값을 이어받는 안전성 이유를 설명한다.
- chosen·learned·client 응답과 재시작 영속성을 구분한다.

## 감점 포인트

- 새 proposer가 언제나 임의의 새 값을 선택할 수 있다고 말한다.
- 모든 노드의 동의가 필요하다고 말한다.
- 약속·수락 기록을 재시작 때 버려도 된다고 말한다.

## 더 파고들 거리

- 두 proposer가 계속 더 높은 ballot을 내면 안전성은 유지돼도 왜 progress가 멈추나요?
- 선택됐지만 아직 learner가 모르는 값이 어떤 실행에서 생길 수 있나요?
- ballot 번호와 애플리케이션 로그 슬롯 번호는 어떤 의미·수명을 가지나요?
