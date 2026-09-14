---
id: "iocp-timeout-loop-versus-stop-packet"
title: "GQCS timeout으로 종료를 확인하는 방식과 명시적인 제어 패킷 방식은 응답성·CPU·정리에서 어떻게 다른가요?"
difficulty: "중하"
category: "네트워크"
tags: ["IOCP","정상 종료","워커","심화 질문"]
related: ["iocp-worker-shutdown","graceful-shutdown","iocp-cancel-drain"]
promotedFrom: {"id":"iocp-worker-shutdown","prompt":"GQCS timeout 제어 루프와 명시적 종료 패킷 방식을 어떤 조건에서 선택할까요?"}
---

# GQCS timeout으로 종료를 확인하는 방식과 명시적인 제어 패킷 방식은 응답성·CPU·정리에서 어떻게 다른가요?

## 구두 답변

짧은 GQCS timeout은 종료 상태를 주기적으로 확인하기 쉽지만 idle wakeup·CPU 비용이 있습니다. 제어 패킷은 즉시 깨울 수 있지만 구분·수명·worker 수와 drain 순서를 설계해야 합니다.

어느 쪽도 pending I/O를 자동 취소·회수하지 않습니다. 종료 상태 전이와 새 제출 금지·실제 완료를 공통 규칙으로 둡니다. idle·폭주·종료 중 신호 유실·중복을 시험합니다.

## 득점 포인트

- 짧은 GQCS timeout은 종료 상태를 주기적으로 확인하기 쉽지만 idle wakeup·CPU 비용이 있습니다. 제어 패킷은 즉시 깨울 수 있지만 구분·수명·worker 수와 drain 순서를 설계해야 합니다.
- idle·폭주·종료 중 신호 유실·중복을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 짧은 GQCS timeout은 종료 상태를 주기적으로 확인하기 쉽지만 idle wakeup·CPU 비용이 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: IOCP 서버에 수신·송신 작업이 남아 있는 채 종료 신호가 왔습니다. 워커와 완료 포트는 어떤 순서로 종료하나요?](/tech-interview/questions/iocp-worker-shutdown/)
