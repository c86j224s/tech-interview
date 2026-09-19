---
id: watch-uid-delete-recreate
title: LIST와 watch 사이 객체가 삭제·재생성될 때 이름만 cache key로 쓰면 어떤 오류가 생기나요?
difficulty: 중하
category: 인프라
tags:
  - watch
  - resourceVersion
  - relist
related:
  - service-discovery-stale-endpoint
---
# LIST와 watch 사이 객체가 삭제·재생성될 때 이름만 cache key로 쓰면 어떤 오류가 생기나요?

## 구두 답변
이름은 재사용 가능한 주소이고 UID는 특정 객체 인스턴스의 정체성이므로, 이름만 cache key로 쓰면 ABA 오류가 생깁니다. `worker-a/UID-1`을 LIST로 넣은 뒤 UID-1 삭제와 `worker-a/UID-2` 생성이 반영되었다고 하겠습니다. 현재 cache에는 UID-2가 있어야 합니다. 이후 reconnect 중복이나 테스트 fixture로 늦은 UID-1 delete가 도착하면 name-only handler는 UID-2까지 삭제합니다. 정상 ordered watch가 임의로 오래된 event를 준다고 전제하는 것이 아니라, 재연결·중복 전달에 방어하는 조건입니다.

삭제 적용 조건은 현재 항목이 없거나 현재 항목의 UID가 event UID와 같을 때입니다. 현재 항목 UID-2와 event UID-1이 다르면 옛 인스턴스의 delete로 보고 무시합니다. `generation`은 동일 UID의 spec 세대이고 `resourceVersion`은 API 관찰 버전이므로 UID를 대신하지 않습니다. 외부 효과를 수행하는 controller는 namespace/name으로 찾은 뒤 UID와 generation을 조건부 update에 묶어야 합니다.

작은 검증 sequence는 LIST UID-1, DELETE UID-1, CREATE UID-2, 늦은 DELETE UID-1입니다. name-only 결과는 absent, UID-aware 결과는 UID-2입니다. relist 후에도 이 검사를 유지하고, UID mismatch가 반복되면 cache 손상이나 잘못된 fixture를 관찰 지표로 남겨 full relist를 고려합니다.

이 검사는 단순히 UID를 로그에 남기는 것보다 cache write 조건으로 구현해야 합니다. delete event의 UID가 현재 값과 일치하지 않으면 delete를 적용하지 않고 mismatch counter를 증가시키며, 같은 name에 새 UID가 반복해서 나타나면 full relist를 요청합니다. 외부 API가 name만 받아 조건부 갱신을 지원하지 않는다면 먼저 UID를 조회해 확인한 뒤 효과를 수행해야 ABA를 외부 시스템까지 전파하지 않습니다.

참고: https://kubernetes.io/docs/reference/using-api/api-concepts/ (2026-09-19에 읽은 공식 문서 본문; 대상 릴리스와 실제 cluster 실행은 별도 확인)

## 득점 포인트
- name·UID·generation·resourceVersion의 재사용성과 범위를 분리합니다.
- UID-1과 UID-2의 중간 상태를 순서대로 추적해 ABA 결과를 증명합니다.
- 늦은 delete를 UID mismatch로 무시하는 구체적인 조건을 제시합니다.

## 감점 포인트
- namespace/name이 영구 식별자라고 말합니다.
- 큰 resourceVersion이 모든 리소스의 업무 순서를 보장한다고 합니다.
- UID 불일치 delete를 무조건 적용합니다.

## 더 파고들 거리
- 같은 UID에서 generation 4→5 update를 외부 조건부 변경과 어떻게 묶을까요?
- UID mismatch 빈도와 relist 임계값을 어떤 운영 지표로 정할까요?
