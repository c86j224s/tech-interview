---
id: dpop-jti-replay
title: DPoP의 jti와 iat를 왜 replay cache와 함께 검증하나요?
difficulty: 중하
category: 보안
tags:
  - DPoP
  - 재생 공격
  - OAuth
related:
  - security-webhook-verification
---
# DPoP의 jti와 iat를 왜 replay cache와 함께 검증하나요?

## 구두 답변

`iat`와 `jti`는 서로 다른 실패를 다룹니다. `iat`는 proof가 허용된 시간창 안에서 만들어졌는지 확인하는 freshness 조건이고, `jti`는 그 시간창 안에서도 같은 proof 식별자가 이미 소비되었는지 찾는 일회성 조건입니다. 서버 시각을 12:00:10, 최대 age를 300초, 허용 skew를 30초로 두면 `iat=11:54:00`은 370초 전이라 거절합니다. 반면 `iat=12:00:00, jti=J7`은 첫 요청에서 통과할 수 있고, 12:00:12에 동일 서명과 token을 다시 보내면 나이가 짧아도 cache hit로 거절해야 합니다.

검증은 서명·`htm`·`htu`·`ath`·키 결합을 먼저 확인한 뒤 replay 저장소에 `J7`을 원자적으로 삽입하는 식으로 구현합니다. 두 RS가 동시에 `GET J7` 후 `SET J7`을 하면 둘 다 miss를 보고 처리할 수 있으므로 `SETNX`나 조건부 insert가 필요합니다. cache 보존 기간은 허용 가능한 proof 창보다 짧지 않아야 합니다. 그렇다고 RFC가 모든 배포에 동일한 TTL이나 분산 제품을 지정하는 것은 아닙니다. cache 장애를 fail-open으로 처리하면 검증을 통과한 proof가 다시 bearer처럼 반복될 수 있어, fail-closed·제한된 grace·재시도 오류를 명시해야 합니다.

nonce는 `jti`의 중복 추적을 대체하지 않습니다. 다만 RFC 9449는 server-managed timestamp를 nonce에 실어 client `iat`와 서버 시각을 직접 비교하는 대신 proof 수명을 제한하는 방식을 허용합니다. 따라서 nonce 정책이 있다고 해서 jti를 제거한다고 말할 수는 없지만, iat의 시간 비교를 반드시 같은 방식으로 계속한다고도 단정하면 안 됩니다. 운영적으로는 정상 네트워크 재시도에도 새 jti로 새 proof를 만들게 해야 합니다. 같은 jti의 재전송은 공격 또는 구현 오류로 분류하고, 사용자가 이중 처리될 수 있는 API라면 HTTP 멱등키를 별도로 두어 업무 재시도와 DPoP proof 일회성을 섞지 않는 것이 안전합니다.

## 득점 포인트

- `iat`의 시간 창과 `jti`의 동일 proof 중복 차단을 12:00:10 trace로 구분한다.
- 동시 RS의 조회 후 저장 경합과 원자적 insert 필요성을 설명한다.
- nonce가 jti를 대체하지 않지만 서버 nonce가 iat 비교를 대신할 수 있음을 구분한다.

## 감점 포인트

- 시간 창만 늘려 재시도를 허용하면 같은 proof가 반복된다는 점을 놓친다.
- 지역 cache만으로 여러 RS의 동시 replay가 항상 막힌다고 한다.
- nonce가 있으면 모든 freshness·일회성 검사가 자동으로 없어졌다고 단정한다.

## 더 파고들 거리

- 네트워크 retry에서 새 proof와 같은 proof를 어떻게 구별할까요?
- replay cache의 개인정보·용량 비용을 어떤 지표로 감시할까요?
