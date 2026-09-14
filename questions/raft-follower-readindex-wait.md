---
id: "raft-follower-readindex-wait"
title: "Raft follower가 선형화 읽기를 제공합니다. 리더에게 받은 read index와 로컬 apply를 어떻게 연결하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Raft","ReadIndex","선형화 가능성","심화 질문"]
related: ["raft-linearizable-read","raft-log-commit-apply","consistency-linearizability"]
promotedFrom: {"id":"raft-linearizable-read","prompt":"follower ReadIndex"}
---

# Raft follower가 선형화 읽기를 제공합니다. 리더에게 받은 read index와 로컬 apply를 어떻게 연결하나요?

## 구두 답변

follower는 현재 리더로부터 해당 읽기에 안전한 read index를 얻고 자신의 applied index가 그 위치 이상이 될 때 읽습니다. 단순히 follower에 로그가 저장됐다는 것과 적용 완료는 다릅니다.

리더 권위 확인·현재 term 조건·deadline을 지키고 분할 시 성공으로 오래된 값을 내지 않습니다. stale 읽기는 별도 API 계약으로 허용할 수 있습니다. apply 정지·리더 교체·늦은 응답을 시험합니다.

## 득점 포인트

- follower는 현재 리더로부터 해당 읽기에 안전한 read index를 얻고 자신의 applied index가 그 위치 이상이 될 때 읽습니다. 단순히 follower에 로그가 저장됐다는 것과 적용 완료는 다릅니다.
- apply 정지·리더 교체·늦은 응답을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: follower는 현재 리더로부터 해당 읽기에 안전한 read index를 얻고 자신의 applied index가 그 위치 이상이 될 때 읽습니다.

## 더 파고들 거리

- [기본 상황과 비교: 네트워크 단절 뒤에도 이전 Raft 리더가 읽기 요청을 받고 있습니다. 로컬 상태를 바로 반환해도 되며, 최신성을 보장하려면 무엇을 확인해야 하나요?](/tech-interview/questions/raft-linearizable-read/)
