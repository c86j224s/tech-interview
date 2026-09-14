---
id: "quorum-failure-domain-placement"
title: "합의 노드 수는 충분하지만 한 랙 장애로 과반을 잃었습니다. 투표자 배치와 장애 허용 수를 어떻게 계산하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["합의","구성 변경","Raft","심화 질문"]
related: ["consensus-membership-change","consensus-quorum-failure"]
promotedFrom: {"id":"consensus-membership-change","prompt":"장애 영역 배치"}
---

# 합의 노드 수는 충분하지만 한 랙 장애로 과반을 잃었습니다. 투표자 배치와 장애 허용 수를 어떻게 계산하나요?

## 구두 답변

고정 구성에서 N의 과반은 floor(N/2)+1입니다. 3개와 4개 모두 하나의 노드 손실만 견디는 이유처럼 replica 추가가 항상 장애 허용 수 증가를 뜻하지는 않습니다.

같은 랙의 세 노드가 한 번에 사라질 수 있으므로 host·전원·zone별 배치와 남은 과반 통신을 확인합니다. 장애 후 새 용량과 로그 복구 지연도 포함합니다. 쿼럼 교집합만 아니라 투표·로그 보존 프로토콜이 있어야 충돌 확정을 막을 수 있습니다.

## 득점 포인트

- 고정 구성에서 N의 과반은 floor(N/2)+1입니다. 3개와 4개 모두 하나의 노드 손실만 견디는 이유처럼 replica 추가가 항상 장애 허용 수 증가를 뜻하지는 않습니다.
- 쿼럼 교집합만 아니라 투표·로그 보존 프로토콜이 있어야 충돌 확정을 막을 수 있습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 고정 구성에서 N의 과반은 floor(N/2)+1입니다.

## 더 파고들 거리

- [기본 상황과 비교: 합의 클러스터의 노드를 교체하려고 합니다. 각 서버의 노드 목록만 새 목록으로 바꾸면 왜 위험한가요?](/tech-interview/questions/consensus-membership-change/)
