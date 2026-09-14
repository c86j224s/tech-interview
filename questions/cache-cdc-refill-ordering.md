---
id: "cache-cdc-refill-ordering"
title: "CDC로 캐시 무효화를 전달해도 늦은 옛 조회가 캐시를 채울 수 있나요? 두 경로의 버전을 어떻게 맞추나요?"
difficulty: "중하"
category: "분산 시스템"
tags: ["캐시","캐시 무효화","데이터 정합성","캐시 어사이드","최종 일관성","심화 질문"]
related: ["cache-aside-consistency","transaction-and-lost-update","request-timeout-idempotency"]
promotedFrom: {"id":"cache-aside-consistency","prompt":"outbox·CDC와 stale refill의 관계"}
---

# CDC로 캐시 무효화를 전달해도 늦은 옛 조회가 캐시를 채울 수 있나요? 두 경로의 버전을 어떻게 맞추나요?

## 구두 답변

CDC는 원본 커밋에 대응하는 무효화 전달을 보강하지만 이미 시작한 옛 읽기의 게시를 취소하지 않습니다. 읽기 결과의 원본 version과 캐시의 최소 허용 version을 비교하는 원자 저장이 필요할 수 있습니다.

DB(old) 읽기 후 멈춤→DB(new) commit·CDC 삭제→옛 결과 SET 순서로 재현합니다. CDC 이벤트가 중복·지연돼도 version을 낮추지 않고, 삭제 표식의 수명과 eviction 정책을 정합니다. 권한·재고 확정은 캐시의 표시 값과 별도 권위 저장소에서 다시 검사합니다.

## 득점 포인트

- CDC는 원본 커밋에 대응하는 무효화 전달을 보강하지만 이미 시작한 옛 읽기의 게시를 취소하지 않습니다. 읽기 결과의 원본 version과 캐시의 최소 허용 version을 비교하는 원자 저장이 필요할 수 있습니다.
- 권한·재고 확정은 캐시의 표시 값과 별도 권위 저장소에서 다시 검사합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: CDC는 원본 커밋에 대응하는 무효화 전달을 보강하지만 이미 시작한 옛 읽기의 게시를 취소하지 않습니다.

## 더 파고들 거리

- [기본 상황과 비교: 데이터베이스를 수정한 뒤 캐시를 삭제하면 오래된 값이 다시 캐시에 들어갈 가능성은 없나요?](/tech-interview/questions/cache-aside-consistency/)
