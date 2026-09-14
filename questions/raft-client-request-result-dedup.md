---
id: "raft-client-request-result-dedup"
title: "Raft 명령은 커밋됐지만 응답을 잃었습니다. 요청 ID별 결과를 상태 머신과 snapshot에 어떻게 보관하나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["Raft","커밋","상태 머신","심화 질문"]
related: ["raft-log-commit-apply","raft-term-election"]
promotedFrom: {"id":"raft-log-commit-apply","prompt":"요청 ID 결과 조회"}
---

# Raft 명령은 커밋됐지만 응답을 잃었습니다. 요청 ID별 결과를 상태 머신과 snapshot에 어떻게 보관하나요?

## 구두 답변

논리 client 요청 ID와 처리 결과를 상태 머신 적용과 함께 보관해 같은 명령이 다른 로그 위치에 다시 들어와도 효과를 반복하지 않게 합니다. 응답 유실은 commit 실패의 증거가 아닙니다.

snapshot에도 dedup 상태와 필요한 결과를 포함하고 보존 기간을 최대 재시도와 맞춥니다. 외부 결제·메일의 효과는 별도 멱등 경계가 필요합니다. commit·apply·응답 전후 중단을 시험합니다.

## 득점 포인트

- 논리 client 요청 ID와 처리 결과를 상태 머신 적용과 함께 보관해 같은 명령이 다른 로그 위치에 다시 들어와도 효과를 반복하지 않게 합니다. 응답 유실은 commit 실패의 증거가 아닙니다.
- commit·apply·응답 전후 중단을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 논리 client 요청 ID와 처리 결과를 상태 머신 적용과 함께 보관해 같은 명령이 다른 로그 위치에 다시 들어와도 효과를 반복하지 않게 합니다.

## 더 파고들 거리

- [기본 상황과 비교: Raft 리더가 명령을 로그에 넣고 팔로워에 보냈습니다. 복제·커밋·상태 머신 적용은 어떻게 다르며 클라이언트에 성공을 언제 응답하나요?](/tech-interview/questions/raft-log-commit-apply/)
