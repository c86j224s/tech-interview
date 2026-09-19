---
id: kubernetes-watch-resource-version
title: Kubernetes watch의 resourceVersion·relist·bookmark
topic: 인프라
summary: >-
  LIST-WATCH의 resourceVersion 기준과 410 relist, bookmark 진행 신호, UID 기반 cache 복구를
  설명합니다.
questionIds: []
prerequisites:
  - event-stream-recovery
  - reconciliation
related:
  - event-stream-recovery
reviewedAt: '2026-09-19'
---
# Kubernetes watch의 resourceVersion·relist·bookmark

Kubernetes watch는 영구 이벤트 로그가 아니라 특정 `resourceVersion` 이후의 관찰 스트림이다. controller는 LIST로 현재 상태를 확보하고 그 경계 이후를 watch하며, 연결 종료나 history 만료가 오면 현재 상태를 다시 설치한다. 따라서 cache 복구의 핵심은 “마지막 숫자부터 모든 이벤트를 재생한다”가 아니라, resourceVersion을 API 계약에 맞는 cursor로 사용하고, 410에서는 relist로 상세 이력의 부재를 흡수하는 것이다.

## LIST와 watch 경계

일반적인 reflector는 LIST 응답의 객체 집합과 collection resourceVersion을 cache에 반영한 뒤 그 rv를 기준으로 watch를 연다. 예시로 LIST가 A, B와 `rv=120`을 반환하고 이후 A 수정이 121, C 생성이 122라면 cache는 A', B, C가 되어야 한다. 벽시계 12:00:00이나 객체 UID를 watch cursor로 쓰면 API 서버의 관찰 경계를 표현하지 못한다. 실제 LIST-watch 사이의 누락 방지는 사용하는 client-go와 대상 apiserver의 list/watch 계약으로 확인해야 한다.

watch 이벤트의 `resourceVersion`은 해당 객체 변경이 관찰된 버전이다. 이것은 다른 종류의 리소스 사이에서 전역 업무 순서를 약속하는 시계가 아니다. 숫자가 큰 rv를 무조건 더 최신인 사업 상태로 비교하거나 생성 시각을 대체하면 잘못된 외부 작업 순서가 생긴다.

## 최신성 옵션

LIST에서 `resourceVersionMatch`는 지정한 rv를 어떻게 해석할지 정한다. `Exact`는 지정 snapshot을 요구하며 그 버전을 사용할 수 없으면 410이 될 수 있다. `NotOlderThan`은 지정 버전보다 오래되지 않은 collection snapshot을 허용한다. 공식 API Concepts 문서 기준으로 `resourceVersionMatch`를 쓰려면 `resourceVersion`도 지정해야 한다. 생략·빈 값, `0`, 비제로 값은 서버가 제공하는 읽기 경로와 consistency 의미가 다르므로 대상 릴리스의 표를 함께 확인한다.

pagination도 같은 계약에 묶인다. `limit`으로 나눈 LIST는 continuation token으로 다음 페이지를 요청하며, 토큰의 snapshot 경계가 만료되면 410을 처리해야 한다. 강한 읽기를 모든 UI 목록에 적용할 필요는 없지만, 삭제나 외부 효과를 결정하는 controller는 허용 가능한 stale 범위를 명시하고 필요할 때 현재 상태를 재검증해야 한다.

## 410과 relist

서버가 요청한 오래된 rv를 history window에서 더 제공할 수 없으면 watch 또는 LIST는 HTTP 410 Gone을 반환할 수 있다. 같은 rv를 무한 재시도하는 것은 복구가 아니다. controller는 local cache를 신뢰 불가 상태로 표시하고 새 LIST를 수행하여 현재 객체 집합과 새 collection rv를 얻는다. 예를 들어 local `rv=900`, 현재 LIST `rv=1250`이면 901~1249를 재생한다고 약속하지 않고 현재 목록을 기준으로 cache를 설치한 뒤 1250 이후를 watch한다.

이때 목록에 없는 예전 객체는 삭제로 반영한다. LIST 직후 새 watch가 이미 처리된 update를 다시 보내는 경우도 있으므로 event handler는 중복 적용을 허용해야 한다. relist가 동시에 몰리면 backoff와 jitter를 넣지만, 낡은 cache로 외부 delete를 계속하는 것보다 재동기화를 우선할 기준을 둔다.

## Bookmark 진행 신호

bookmark는 ADDED·MODIFIED·DELETED가 아니라 서버가 특정 rv까지 관찰 위치를 진전시켰다는 `BOOKMARK` 이벤트다. `allowWatchBookmarks=true`로 요청할 수 있어도 특정 빈도나 항상 전달을 보장한다고 가정하지 않는다. bookmark를 object spec 변경으로 넣으면 실제 객체가 변하지 않았는데 reconcile이 발생한다.

controller가 기록할 수 있는 것은 마지막 bookmark rv, 수신 시각, 연결 생존 지표다. bookmark rv를 `metadata.generation`, 외부 티켓 commit offset, 처리 완료 번호로 쓰면 의미가 섞인다. bookmark가 있다고 cache가 모든 미래 상태를 안다는 뜻도 아니다. 연결이 끊기거나 rv가 만료되면 정상 경로는 relist다.

## UID와 이름

`namespace/name`은 재사용 가능한 주소이고 UID는 객체 인스턴스의 정체성이다. UID-1 `worker-a`가 삭제된 뒤 UID-2가 같은 이름으로 생겼다고 하자. 이름만 key인 cache에 늦은 UID-1 delete가 도착하면 현재 UID-2를 지우는 ABA 오류가 된다. 정상 ordered watch가 임의로 과거 event를 준다고 단정하는 것이 아니라, reconnect·중복 전달·테스트 fixture에서 방어해야 하는 적용 조건이다.

삭제 handler는 현재 cache 항목이 없거나 현재 UID가 event UID와 같을 때만 삭제한다. 다르면 이미 새 객체가 들어온 것으로 보고 옛 삭제를 무시한다. generation은 동일 UID 안의 spec 세대이고 rv는 관찰 버전이므로 서로를 대체하지 않는다. 외부 controller는 UID·generation과 자기 처리 marker를 조건부 갱신에 함께 사용한다.

## Cache 적용

동일 이벤트가 두 번 오더라도 첫 저장 전에 프로세스가 죽었을 수 있어 단순히 두 번째를 번호로 버리는 방식은 안전하지 않다. 현재 cache의 UID와 event UID, resourceVersion을 비교하여 재적용 가능한 handler를 만든다. 정렬은 watch 도착 시각이 아니라 명시적인 업무 필드로 하며, LIST 배열 위치도 순서 계약으로 사용하지 않는다.

relist 직후는 cache를 atomically 교체하거나 generation을 올려 부분 상태를 외부 reconcile이 읽지 않게 한다. 외부 부작용은 cache event마다 직접 실행하기보다 원하는 상태를 다시 계산하는 reconcile로 묶어 중복을 흡수한다. 이 설계가 있어야 bookmark와 실제 MODIFIED 이벤트가 섞여도 업무 callback과 관찰 cursor가 분리된다.

## 복구 관찰

운영 지표에는 410 비율, relist 횟수, 마지막 bookmark age, watch 처리 지연, cache object 수, UID mismatch, 재조정 중복을 둔다. reconnect 성공만으로 최신이라고 표시하지 않는다. 410 폭주 시 backoff가 API 서버를 보호하지만 너무 길면 stale cache가 커지므로 기능별 stale 행동과 외부 효과 차단을 함께 정한다.

설명용 fake stream은 LIST rv=10, MODIFIED rv=11, DELETED rv=12, BOOKMARK rv=12를 넣고 bookmark가 object callback을 만들지 않는지 확인한다. 이어 UID-1 삭제, UID-2 생성, 늦은 UID-1 삭제를 섞고 UID-2가 남는지 확인한다. 이 제안은 실제 cluster 실행이 아닌 상태 전이 검증 설계다.

## 비용과 한계

Exact는 일관성이 강한 대신 오래된 snapshot이 없으면 410 복구 비용을 만든다. NotOlderThan은 watch cache 활용과 부하 절감에 유리할 수 있지만 요구한 rv 이상으로 동기화된 결과라는 의미를 후속 동작에 맞춰 해석해야 한다. relist는 안전한 기준을 다시 만들지만 큰 collection의 LIST와 동시 backoff가 API·etcd에 비용을 준다. 대상 Kubernetes 릴리스와 client library가 고정되지 않았으므로 세부 pagination 동작은 통합 전에 확인한다.

## 참고자료

- https://kubernetes.io/docs/reference/using-api/api-concepts/ — 2026-09-19에 읽을 수 있는 공식 본문으로 `resourceVersion`, Exact/NotOlderThan, continuation, 410, bookmark, UID 의미를 대조했다.
- https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/ — 본 장의 admission 근거가 아니라 watch와 admission의 동기/스트림 경계를 구분하기 위해 확인했다.

```diagram
{"title":"Watch 복구 경계","caption":"bookmark는 진행 위치이고 410은 새 LIST가 필요한 이력 단절이다.","rows":[[{"id":"list","label":"LIST","detail":["현재 객체 + rv"]}],[{"id":"watch","label":"WATCH","detail":["변경 이벤트"]}],[{"id":"bookmark","label":"BOOKMARK","detail":["객체 변경 아님"]}],[{"id":"relist","label":"410 RELIST","detail":["cache 재설치"]}]],"edges":[{"from":"list","to":"watch","label":"rv 경계"},{"from":"watch","to":"bookmark","label":"진행 표시"},{"from":"watch","to":"relist","label":"history 만료"}]}
```
