---
id: threat-modeling-stride-assets
title: 결제 시스템에서 자산·신뢰 경계를 먼저 어떻게 정하나요?
difficulty: 중하
category: 보안
tags:
  - 위협 모델링
  - STRIDE
  - 신뢰 경계
related:
  - authentication-vs-authorization
---
# 결제 시스템에서 자산·신뢰 경계를 먼저 어떻게 정하나요?

## 구두 답변

먼저 구성요소가 아니라 손실의 단위로 자산을 정합니다. 결제 흐름에서는 provider token, 환불 권한, 주문 상태, 원장 무결성, 개인정보, 감사 증적을 따로 적고 누가 잃는지와 어떤 결과가 생기는지 붙입니다. 그 다음 브라우저·API·provider·webhook worker·DB를 process/store/flow로 그리며 사용자 입력, 외부 응답, 내부 권한, 운영자 가정이 바뀌는 곳에 trust boundary를 둡니다.

브라우저에서 API로 환불 요청이 오고 API가 provider와 통신한다면 승인 요청, 브라우저 callback, 서버 webhook을 별도 flow로 그립니다. provider의 메시지는 HTTPS라는 이유로 내부 사실이 되지 않습니다. 원문 서명, timestamp, event ID, 현재 주문 상태를 확인하고 나서만 원장에 반영합니다. 요청 주체는 body의 `tenant_id`가 아니라 인증된 문맥에서 가져오며 대상 조회와 조건부 갱신에도 tenant·owner·version을 남깁니다.

그 뒤 각 경계와 flow에 STRIDE를 적용합니다. 다른 사용자를 가장하는가, 금액을 변조하는가, 승인 행위를 부인할 수 있는가, token이나 export가 노출되는가, 대량 webhook으로 inbox가 고갈되는가, 일반 사용자가 관리자 환불 권한으로 상승하는가를 묻습니다. 결과는 태그 목록이 아니라 위협 ID, 보호 자산, 완화, 실패 시 기대 상태를 가진 표여야 합니다. provider의 실제 서명 형식과 retry 계약은 별도로 읽어 고정합니다.

경계는 네트워크 hop만으로 정하지 않습니다. 같은 VPC 안이라도 provider가 운영하는 서명키와 우리 DB의 원장 권위가 다르면 trust assumption이 바뀝니다. 경계를 정한 뒤에는 각 flow의 입력 형식, 인증 주체, replay 범위, 실패 시 재시도 주체를 적습니다. 그래야 이후 STRIDE 분류가 구성요소 이름에 매달리지 않고 실제 메시지의 이동을 따라갑니다.

## 득점 포인트

- 자산을 기밀성뿐 아니라 무결성·가용성·증적 관점으로 나눈다.
- DFD의 process/store/flow와 권한·운영 가정이 바뀌는 trust boundary를 표시한다.
- 외부 응답을 검증 없이 내부 권위 상태로 승격하지 않는다.

## 감점 포인트

- 구성요소만 나열하고 자산 소유자와 손실 결과를 적지 않는다.
- 요청 본문의 tenant나 user ID를 인증된 주체로 해석한다.

## 더 파고들 거리

- 새 provider의 callback과 webhook을 하나의 흐름으로 취급하면 어떤 STRIDE 항목이 달라지는가?
- 자산 영향과 공격 가능성을 어떻게 우선순위화할 것인가?
