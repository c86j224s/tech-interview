---
id: game-delta-field-presence
title: 상태 delta에서 값이 0인 필드와 “이번 delta에 없음”을 어떻게 구분하나요?
difficulty: 중하
category: 게임 서버
tags:
  - delta compression
  - presence
  - wire format
related:
  - serialization-endianness
---
# 상태 delta에서 값이 0인 필드와 “이번 delta에 없음”을 어떻게 구분하나요?

## 구두 답변

presence mask와 value payload를 분리합니다. baseline `{health:80,ammo:3}`에 `mask=health,value=0`이 오면 명시적 갱신으로 `{health:0,ammo:3}`이고, `mask=ammo,value=0`이면 `{health:80,ammo:0}`입니다. health bit가 mask에 없다는 것은 unchanged이지 health를 언어 기본값 0으로 만들라는 뜻이 아닙니다. false·빈 문자열·null도 명시 값일 수 있으므로 Option의 None 같은 내부 표현을 wire의 “미전송”과 혼동하지 않습니다. decoder는 schema/version을 확인하고 mask length, known bit, field 순서, 각 payload length를 검증한 뒤 임시 state에 적용하고 전체 검증이 끝날 때 atomic replace합니다. mask에 새 unknown bit가 있거나 길이가 맞지 않으면 부분 적용 없이 packet reject 또는 해당 entity resync입니다. full snapshot과 partial delta의 생략 의미도 message kind로 구분합니다. 예를 들어 full은 optional field를 default로 초기화할 수 있지만 delta는 baseline 유지가 계약일 수 있습니다. 새 schema가 health와 shield의 bit 순서를 바꾸면 version 없이 같은 위치로 읽는 순간 값이 뒤바뀝니다. 따라서 golden vector로 health 80→0, ammo 유지/0, null 명시, empty mask를 각각 검증하고 늦은 partial delta가 최신 값을 덮지 않는지 확인합니다.


부분 적용을 임시 객체에 먼저 수행하는 이유는 decoder가 중간에 실패해도 live state가 오염되지 않게 하기 위해서입니다. `mask=health,ammo`인데 health payload만 존재하면 ammo를 0으로 채우지 말고 길이 오류로 전체 delta를 거절합니다. 반대로 mask가 health 하나이고 payload 0이면 그 packet은 정상입니다. schema negotiation으로 새 필드를 지원한다고 확인한 경우에도 unknown optional field의 생략 정책을 명시해야 구버전 receiver가 새 sender의 partial update를 조용히 잘못 해석하지 않습니다.
## 득점 포인트

- health 80→0과 mask 부재를 서로 다른 결과로 계산합니다.
- schema·mask·length 검증과 atomic 적용을 wire-format 경계까지 연결합니다.
- full 생략과 delta 생략의 의미를 분리하고 null/false/empty를 사례로 듭니다.

## 감점 포인트

- 값 0을 미전송으로 처리하거나 생략 필드를 default로 덮습니다.
- mask와 payload 길이를 검증하지 않고 순서대로 읽으며 schema 변경을 bit 위치로 추측합니다.
- 일부 필드만 적용한 뒤 오류를 무시해 packet이 반쯤 설치되게 합니다.

## 더 파고들 거리

- 구버전 receiver가 새 unknown bit를 받았을 때 reject·capability negotiation·entity resync를 비교해 보세요.
- null을 “명시적으로 비움”과 “이번 delta에 없음”으로 모두 표현할 wire 타입을 설계해 보세요.
