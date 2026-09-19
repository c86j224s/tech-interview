---
id: cache-storage-vary-match-contract
title: Cache Storage의 match에서 Vary와 ignoreVary는 어떤 요청 헤더를 비교하며 언제 잘못된 표현을 반환하나요?
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
# Cache Storage의 match에서 Vary와 ignoreVary는 어떤 요청 헤더를 비교하며 언제 잘못된 표현을 반환하나요?

## 구두 답변

Cache Storage의 Vary 매칭은 저장된 Response의 `Vary`가 지정한 요청 헤더를, 저장 당시 Request와 현재 조회 Request 사이에서 비교하는 계약입니다. `/welcome`을 `Accept-Language: ko`로 저장했고 응답에 `Vary: Accept-Language`가 있다면 `en` 조회는 ko 표현과 같은 요청 변형으로 취급되면 안 됩니다. 기본 match가 miss가 되거나 다른 항목을 찾는 이유는 언어 표현이 달라졌기 때문입니다.

`ignoreVary:true`는 이 Vary 비교만 생략합니다. 그러면 en 요청에도 저장된 ko 응답이 반환될 수 있습니다. 이 옵션은 HTTP `max-age`를 무시하는 기능도 아니고 서버 인증 검사를 수행하거나 끄는 기능도 아닙니다. 언어·미디어 타입·압축이 응답 표현을 바꾸는 서비스라면 기본 비교를 유지하고 URL이나 namespace를 언어별로 분리하는 편이 추적하기 쉽습니다. 개인 응답이라면 Vary만으로 권한을 보장하지 말고 사용자 key, 로그아웃 삭제, 서버 재인가를 별도로 설계합니다.

매칭의 핵심은 Response의 `Vary`가 현재 Request의 헤더와 저장 당시 Request의 헤더를 연결한다는 점입니다. 저장된 응답이 `Vary: Accept-Language, Accept-Encoding`이라면 언어뿐 아니라 인코딩 차이도 표현 구분에 포함됩니다. 다만 이 비교가 사용자별 권한을 판정하지는 않으므로 `Authorization`을 캐시 키에 넣었다는 사실만으로도 개인 데이터 안전을 보장할 수 없습니다. `ignoreVary`를 쓸 때는 어떤 표현 차이를 의도적으로 버리는지 테스트 이름에 남겨야 합니다.

실무에서 이 차이는 언어만의 문제가 아닙니다. `Vary: Accept-Language, Accept-Encoding`이면 ko/en과 gzip/br 변형을 모두 같은 표현으로 보지 않아야 하므로, 저장 요청과 조회 요청의 헤더를 trace에 남겨야 합니다. 반대로 URL에 언어를 넣으면 key가 명시되는 대신 언어 변경 때 여러 항목을 무효화해야 합니다. `ignoreVary`는 이 비용을 없애는 대신 잘못된 표현을 반환할 수 있으므로, 공개 정적 자산처럼 변형이 실제로 의미 없다는 테스트가 있을 때만 제한적으로 선택합니다.

## 득점 포인트

- Response의 Vary가 지정한 요청 헤더를 저장 Request와 현재 Request에서 비교한다고 말합니다.
- ko 저장·en 조회 trace와 ignoreVary=true의 잘못된 표현 반환을 보여 줍니다.
- ignoreVary를 freshness·인증 옵션과 혼동하지 않습니다.

## 감점 포인트

- Vary가 본문과 현재 요청을 비교한다고 설명합니다.
- ignoreVary가 HTTP max-age나 서버 권한 검사를 비활성화한다고 주장합니다.
- 모든 언어 표현이 같은 공개 자원이라고 단정합니다.

## 더 파고들 거리

- Vary 헤더와 언어별 URL key 중 하나를 선택할 때 무효화 비용을 어떻게 비교하겠습니까?
- 개인 응답을 Cache Storage에 보관해야 한다면 Vary 외에 어떤 사용자 경계를 추가하겠습니까?
