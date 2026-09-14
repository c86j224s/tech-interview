---
id: "rss-pss-shared-memory-accounting"
title: "여러 프로세스가 페이지를 공유합니다. RSS 합과 PSS는 어떤 메모리 용량 판단에 각각 맞나요?"
difficulty: "중하"
category: "운영체제"
tags: ["메모리","힙","RSS","메모리 할당자","심화 질문"]
related: ["memory-rss-vs-heap","virtual-memory-page-fault"]
promotedFrom: {"id":"memory-rss-vs-heap","prompt":"공유 페이지가 많은 프로세스에서 RSS와 PSS를 어떤 의사결정에 사용하나요?"}
---

# 여러 프로세스가 페이지를 공유합니다. RSS 합과 PSS는 어떤 메모리 용량 판단에 각각 맞나요?

## 구두 답변

RSS는 각 프로세스에 보이는 상주 페이지를 세므로 공유 페이지가 합계에서 중복될 수 있습니다. PSS는 공유 페이지를 참여자 수로 나눈 기여를 보는 데 유용합니다.

프로세스 하나의 관찰과 host·cgroup 실제 한도는 별도입니다. fork·공유 라이브러리·mmap·COW 쓰기 전후를 비교합니다. PSS도 보안·성능 원인을 직접 말해 주지는 않으므로 anonymous·file·allocator 지표를 함께 봅니다.

## 득점 포인트

- RSS는 각 프로세스에 보이는 상주 페이지를 세므로 공유 페이지가 합계에서 중복될 수 있습니다. PSS는 공유 페이지를 참여자 수로 나눈 기여를 보는 데 유용합니다.
- PSS도 보안·성능 원인을 직접 말해 주지는 않으므로 anonymous·file·allocator 지표를 함께 봅니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: RSS는 각 프로세스에 보이는 상주 페이지를 세므로 공유 페이지가 합계에서 중복될 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 객체를 해제해 힙 사용량은 줄었는데 프로세스의 RSS는 그대로입니다. 누수인지 재사용 공간인지 어떻게 구분하나요?](/tech-interview/questions/memory-rss-vs-heap/)
