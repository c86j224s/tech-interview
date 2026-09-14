---
id: "cgroup-file-anon-memory-pressure"
title: "컨테이너 OOM 직전 파일 cache와 anonymous memory가 늘었습니다. 어떤 메모리가 회수 가능한지 어떻게 확인하나요?"
difficulty: "중하"
category: "운영체제"
tags: ["메모리","힙","RSS","메모리 할당자","심화 질문"]
related: ["memory-rss-vs-heap","virtual-memory-page-fault"]
promotedFrom: {"id":"memory-rss-vs-heap","prompt":"컨테이너 OOM 직전에 파일 캐시와 anonymous memory를 어떻게 식별할까요?"}
---

# 컨테이너 OOM 직전 파일 cache와 anonymous memory가 늘었습니다. 어떤 메모리가 회수 가능한지 어떻게 확인하나요?

## 구두 답변

file cache는 일부 회수 가능할 수 있지만 dirty·활성 참조와 I/O 조건이 있고 anonymous는 swap·런타임 수명에 영향을 받습니다. cgroup 버전과 실제 메모리 통계·pressure·OOM 사건을 대조합니다.

host 여유가 있어도 컨테이너 limit에 걸릴 수 있습니다. RSS·heap만 보고 file·native·공유 영역을 놓치지 않습니다. 최대 쓰기·snapshot·cache 부하에서 회수 지연과 p99를 검증합니다.

## 득점 포인트

- file cache는 일부 회수 가능할 수 있지만 dirty·활성 참조와 I/O 조건이 있고 anonymous는 swap·런타임 수명에 영향을 받습니다. cgroup 버전과 실제 메모리 통계·pressure·OOM 사건을 대조합니다.
- 최대 쓰기·snapshot·cache 부하에서 회수 지연과 p99를 검증합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: file cache는 일부 회수 가능할 수 있지만 dirty·활성 참조와 I/O 조건이 있고 anonymous는 swap·런타임 수명에 영향을 받습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체를 해제해 힙 사용량은 줄었는데 프로세스의 RSS는 그대로입니다. 누수인지 재사용 공간인지 어떻게 구분하나요?](/tech-interview/questions/memory-rss-vs-heap/)
