---
id: "shard-snapshot-log-handoff-point"
title: "샤드 snapshot을 복사하면서 변경 로그를 따라갑니다. 복사본과 로그 시작 위치를 어떻게 같은 기준에 묶나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["샤딩","해시","핫키","일관된 해싱","데이터 마이그레이션","펜싱","심화 질문"]
related: ["hash-sharding-and-resharding","mutex-vs-serial-execution","transaction-and-lost-update"]
promotedFrom: {"id":"hash-sharding-and-resharding","prompt":"snapshot과 로그 시작 위치"}
---

# 샤드 snapshot을 복사하면서 변경 로그를 따라갑니다. 복사본과 로그 시작 위치를 어떻게 같은 기준에 묶나요?

## 구두 답변

snapshot이 나타내는 원본 시점과 그 다음부터 이어질 변경 로그 위치를 함께 확보해야 합니다. 복사 도중 쓰기가 일어나도 그 로그가 보존되고 대상에 빠짐없이 적용되어야 합니다.

증분을 먼저 적용한 뒤 늦은 snapshot 행이 덮지 않도록 version 조건이나 적용 순서를 둡니다. 삭제 tombstone·재삽입·큰 transaction도 처리합니다. 대상이 최종 장벽까지 따라잡았음을 확인한 뒤 writer·라우팅 세대를 전환합니다.

## 득점 포인트

- snapshot이 나타내는 원본 시점과 그 다음부터 이어질 변경 로그 위치를 함께 확보해야 합니다. 복사 도중 쓰기가 일어나도 그 로그가 보존되고 대상에 빠짐없이 적용되어야 합니다.
- 대상이 최종 장벽까지 따라잡았음을 확인한 뒤 writer·라우팅 세대를 전환합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: snapshot이 나타내는 원본 시점과 그 다음부터 이어질 변경 로그 위치를 함께 확보해야 합니다.

## 더 파고들 거리

- [기본 상황과 비교: 계정 키를 해싱해 DB를 나눴는데 한 샤드에 부하가 몰립니다. 샤드를 추가하면 해결되며 기존 데이터는 어떻게 옮기나요?](/tech-interview/questions/hash-sharding-and-resharding/)
