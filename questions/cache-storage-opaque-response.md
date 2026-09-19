---
id: cache-storage-opaque-response
title: opaque Response를 저장할 때 저장 성공만으로 콘텐츠를 검증할 수 없는 이유는 무엇인가요?
difficulty: 중하
category: 웹
tags:
  - Cache Storage
  - HTTP cache
  - Service Worker
  - offline
related:
  - cache-negative-results
---
# opaque Response를 저장할 때 저장 성공만으로 콘텐츠를 검증할 수 없는 이유는 무엇인가요?

## 구두 답변

opaque Response는 보안 경계 때문에 JavaScript가 원격 응답의 본문·헤더·실제 상태 코드를 읽지 못하게 제한된 결과입니다. `no-cors` 교차 출처 요청에서는 `type`이 opaque이고 `status`가 0으로 보이며 body를 읽을 수 없습니다. 따라서 `cache.put()` Promise가 fulfill됐다는 것은 Request/Response 쌍을 저장소가 받아들였다는 뜻이지, 원격 서버가 200을 보냈거나 본문이 기대한 자산이라는 검증이 아닙니다.

외부 이미지 URL이 저장됐지만 실제로는 404 HTML일 수 있습니다. `add()`와 `addAll()`은 성공 응답 조건을 요구하므로 opaque를 넣는 경로와 구분해야 하고, `put()`으로 넣었더라도 “검증 불가 외부 자산”으로 분류합니다. 콘텐츠 무결성이 중요하면 CORS로 읽을 수 있게 하거나 신뢰 가능한 서버 프록시·서명된 manifest·대체 UI를 사용합니다. status 0을 200으로 바꾸어 해석하거나 저장 성공을 사용자에게 정상 자산이라고 표시하지 않습니다.

opaque의 한계는 저장 API의 성공 여부와 원격 HTTP 의미 사이에 관찰 단절이 있다는 데 있습니다. `response.ok`도 일반 응답처럼 정상 판정에 사용할 수 없고, 본문 해시나 Content-Type을 읽어 검증할 수도 없습니다. 이미지처럼 브라우저 렌더러가 소비하는 자산이면 실패 아이콘과 재시도 URL을 준비하고, 실행 가능한 코드나 민감한 데이터에는 opaque 저장을 허용하지 않는 것이 낫습니다. CORS를 선택한다면 허용 origin을 `*`로 넓히는 대신 필요한 출처와 credentials 조건을 함께 고정해야 합니다.

실패 처리는 저장 성공과 표시 성공을 분리해야 합니다. `put()` 후에 앱이 할 수 있는 검사는 opaque 자체가 아니라 로컬 정책입니다. 예를 들어 출처와 URL allowlist가 맞는지, 필요한 자산이 별도의 서명 manifest에 포함됐는지 확인한 뒤에도 실제 body 검증은 불가능하다고 표시합니다. 이 불확실성을 제거할 수 없다면 캐시하지 않고 매번 네트워크에서 브라우저의 리소스 로더에 맡기는 편이 디스크 절약보다 안전합니다.

## 득점 포인트

- opaque의 type·status 0·본문/헤더 비공개 특성을 설명합니다.
- put 성공과 콘텐츠 검증, add/addAll의 성공 응답 요구를 구분합니다.
- CORS·프록시·서명·대체 경로 중 요구사항에 맞는 선택을 합니다.

## 감점 포인트

- status 0을 정상 200으로 해석합니다.
- 저장 Promise가 성공했으니 외부 본문도 정상이라고 단정합니다.
- opaque를 JSON 검증과 같은 방식으로 검사합니다.

## 더 파고들 거리

- offline에서 깨진 opaque 이미지와 정상 이미지를 어떻게 구분해 사용자에게 표시하겠습니까?
- CORS를 열 때 Origin·credentials 정책을 어느 범위로 제한하겠습니까?
