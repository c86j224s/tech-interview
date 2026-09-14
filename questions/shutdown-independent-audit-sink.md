---
id: "shutdown-independent-audit-sink"
title: "종료 로그가 이미 닫힌 DB나 worker에 의존합니다. 마지막 정리 결과를 어떤 별도 관측 경로로 남기나요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","정상 종료","워커","심화 질문"]
related: ["iocp-worker-shutdown","graceful-shutdown","iocp-cancel-drain"]
promotedFrom: {"id":"iocp-worker-shutdown","prompt":"종료 로그가 닫히는 DB·워커에 의존하지 않도록 어떤 관측 경로를 둘까요?"}
---

# 종료 로그가 이미 닫힌 DB나 worker에 의존합니다. 마지막 정리 결과를 어떤 별도 관측 경로로 남기나요?

## 구두 답변

종료 진단을 아직 종료 순서 안에 있는 DB·worker만으로 보내면 마지막 오류를 잃거나 교착할 수 있습니다. 제한된 독립 sink·stderr·내구 상태 기록 등 최소 경로를 둡니다.

감사 필수 기록과 debug 로그의 drop 정책을 분리하고 sink flush에도 deadline을 둡니다. 로그 성공이 업무 commit을 대신하지 않으며 비밀값·무한 재시도를 피합니다.

## 득점 포인트

- 종료 진단을 아직 종료 순서 안에 있는 DB·worker만으로 보내면 마지막 오류를 잃거나 교착할 수 있습니다. 제한된 독립 sink·stderr·내구 상태 기록 등 최소 경로를 둡니다.
- 로그 성공이 업무 commit을 대신하지 않으며 비밀값·무한 재시도를 피합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 종료 진단을 아직 종료 순서 안에 있는 DB·worker만으로 보내면 마지막 오류를 잃거나 교착할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: IOCP 서버에 수신·송신 작업이 남아 있는 채 종료 신호가 왔습니다. 워커와 완료 포트는 어떤 순서로 종료하나요?](/tech-interview/questions/iocp-worker-shutdown/)
