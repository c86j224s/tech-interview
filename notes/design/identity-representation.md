---
id: identity-representation
title: Unicode 비교 키와 UUID·ULID의 식별 계약
topic: 설계
summary: 표시 원문·정규화·casefold·grapheme·DB unique 의미와 시각적 유사성을 나누고 ID 충돌·시간 정렬·인가·논리 멱등성을 구분합니다.
questionIds: [unicode-normalization-identifiers, identifier-uuid-ulid]
---

# Unicode 비교 키와 UUID·ULID의 식별 계약

## 같은 글자처럼 보여도 Byte는 다를 수 있습니다

`é`는 U+00E9 하나 또는 `e`+U+0301 두 code point로 표현될 수 있습니다. NFC는 이런 canonical equivalence를 맞추지만 모든 시각적 유사 문자를 합치지는 않습니다. 라틴 a와 닮은 다른 script 문자는 별도 정책 대상입니다. 표시 원문과 비교용 canonical key를 분리하면 사용자 표현과 유일성 계약을 각각 관리할 수 있습니다.

NFKC는 전각 등 compatibility 문자를 합칠 수 있어 식별 의미를 더 바꿉니다. 정규화·대소문자 case folding·locale별 규칙은 별도이며 터키어 I 같은 조건을 검사합니다. username 규칙을 비밀번호에 임의 적용하지 않습니다.

| 단위 | `e`+결합 부호의 예 | 필요한 곳 |
| --- | --- | --- |
| UTF-8 bytes | 둘 이상의 bytes | 저장·전송 상한 |
| code points | 2 | Unicode 연산 |
| grapheme cluster | 보통 사용자 눈의 한 글자 | 화면 커서·표시 길이 |

이모지 family·skin tone·ZWJ도 “문자 수”를 단순 byte 길이와 다르게 만듭니다. 최대 입력 bytes와 표시 길이를 별도로 제한합니다.

## 앱 비교와 DB 유일성이 같은 정책이어야 합니다

앱은 NFC+casefold로 같다고 보는데 DB collation은 다르게 보거나 그 반대면 가입·로그인·검색이 어긋납니다. 비교 key 생성 version과 unique constraint를 맞추고 동시 가입은 최종 저장 경계에서 막습니다. 사전 조회만으로 유일성을 보장하지 않습니다.

기존 이름에 새 규칙을 적용하면 서로 다른 계정이 같은 key로 충돌할 수 있습니다. 임의 병합하지 말고 충돌 목록·소유 증명·이름 변경·사용자 안내·migration을 정합니다. 혼합 script·시각적 spoofing은 허용 문자·표시·신고 정책으로 보완하며 정규화가 인증·인가를 해결하지는 않습니다.

```diagram
{"title":"표현과 비교와 실제 자원 권한은 분리합니다","caption":"화살표는 식별 처리입니다. canonical key나 추측 어려운 ID가 있어도 실제 자원 인가와 논리 요청 중복 처리는 별도입니다.","rows":[[{"id":"input","label":"표시 원문·외부 ID"}],[{"id":"canonical","label":"정규화·형식·비교 정책"}],[{"id":"unique","label":"DB 유일성·충돌 처리"}],[{"id":"auth","label":"자원 인가·논리 작업 키"}]],"edges":[{"from":"input","to":"canonical","label":"명시적 변환"},{"from":"canonical","to":"unique","label":"동일한 의미"},{"from":"unique","to":"auth","label":"다른 보장 유지"}]}
```

## UUID도 Version마다 생성·정렬 의미가 다릅니다

충분한 무작위 UUID는 충돌 확률을 낮추지만 0이라는 보장이 아니므로 DB unique·충돌 처리를 유지합니다. UUID v4의 무작위성과 시간 성분을 갖는 version, ULID의 시간+난수 구조를 같은 것으로 설명하지 않습니다. 시간 정렬형은 인덱스 locality에 유리할 수 있지만 같은 millisecond·여러 노드 clock skew·역행에서 전역 인과 순서를 보장하지 않습니다.

ULID의 monotonic 생성 범위·재시작·entropy 소진은 구현 계약을 확인합니다. 문자열의 case·encoding·DB 정렬 규칙도 맞춰야 기대 순서가 유지됩니다. 시간 성분은 생성 시각을 노출할 수 있고 집중된 마지막 index page는 쓰기 경합을 만들 수 있어 실제 엔진에서 측정합니다.

## 충돌하지 않는 두 ID가 중복 요청일 수 있습니다

응답을 잃은 가입 요청이 매번 새 UUID를 만들면 충돌 없이 두 레코드가 생길 수 있습니다. 이는 ID 충돌이 아니라 같은 의도의 재실행입니다. 사용자 의도에서 발급한 안정된 멱등 key·업무 unique·결과 조회를 별도로 사용합니다. 반대로 같은 인자의 의도된 두 예약은 무조건 하나로 합치지 않습니다.

URL의 ID를 추측하기 어렵게 만들어도 소유권 인가는 필요합니다. 대량 생성·재시작·시계 역행·정규화 충돌·동시 저장·표현 변환·같은 논리 요청 재시도를 시험합니다. 이 노트는 식별 설계이며 ID 구현의 충돌 확률을 실험으로 증명한 결과는 아닙니다.
