---
id: threat-modeling-stride-boundary-change
title: 외부 결제 provider를 추가하면 위협 모델에서 무엇이 바뀌나요?
difficulty: 하
category: 보안
tags:
  - 신뢰 경계
  - 외부 연동
  - STRIDE
related:
  - security-webhook-verification
---
# 외부 결제 provider를 추가하면 위협 모델에서 무엇이 바뀌나요?

## 구두 답변

외부 provider를 추가하면 구성요소 하나가 늘어나는 것이 아니라 신뢰 가정과 데이터 흐름이 새로 생깁니다. API에서 provider로 나가는 승인 요청, provider에서 브라우저로 돌아오는 callback, provider에서 서버로 들어오는 webhook을 각각 그립니다. callback과 webhook은 전달 주체·재시도·서명·부수 효과가 다르므로 한 flow로 합치지 않습니다.

provider가 보낸 원문 body와 지정 헤더를 공식 verifier로 검증하고 서명된 timestamp와 event ID를 확인한 뒤에만 JSON 의미를 읽습니다. 검증된 메시지도 현재 주문과 대응하는지, 이미 처리된 ID인지, 상태 전이가 허용되는지 다시 검사합니다. event ID와 상태 변경은 같은 DB 거래로 확정하고, worker가 실패하면 inbox에서 재처리합니다. 빠른 2xx는 업무 효과 완료가 아니라 내구 접수 완료를 뜻하게 제한합니다.

provider 응답을 내부 사실로 저장할 때는 tampering과 elevation을 함께 봅니다. 금액·tenant·환불 상태를 현재 정책과 대조하고 token 원문을 로그에 남기지 않습니다. 장애·재시도·중복·역순 이벤트·알 수 없는 서명키를 시험합니다. signature algorithm, retry window, 상태 권위는 provider 계약을 읽어 고정해야 하며 HTTPS만으로 생략할 수 없습니다.

새 provider가 추가되면 데이터 최소화도 다시 봅니다. 결제에 필요한 주문 식별자와 금액만 보내고 내부 사용자 메모나 권한 토큰을 provider flow에 섞지 않습니다. provider가 돌려준 callback의 브라우저 표시값과 서버 webhook의 상태 변경 권위도 분리해, 브라우저가 보고한 성공 화면만으로 주문을 완료 처리하지 않습니다.

변경 전에는 `browser → API → provider`의 동기 승인 흐름만 있고 API가 결과를 주문에 반영한다고 가정했다고 하겠습니다. 변경 후에는 `provider → browser callback`과 `provider → webhook inbox → worker → ledger`가 분리됩니다. 같은 결제에 webhook이 두 번 오면 첫 event ID만 inbox에 커밋되고 두 번째는 멱등 응답을 받으며, 알 수 없는 key ID나 서명 변경은 JSON 파싱 전 거절됩니다. callback이 성공 화면을 보여줘도 webhook이 아직 없으면 주문은 pending으로 남겨야 합니다. 이렇게 before/after 상태를 비교해야 새 provider가 만든 trust assumption을 누락하지 않습니다.

## 득점 포인트

- callback과 webhook을 다른 데이터 흐름과 책임으로 모델링한다.
- 원문 서명·시각·event ID·현재 상태를 단계별로 검증한다.
- 내구 inbox 이후를 멱등·재처리 가능한 경계로 둔다.

## 감점 포인트

- provider 응답을 HTTPS로 받았다는 이유로 내부 권위 상태로 저장한다.
- 서명 검증만으로 중복·재생·역순 상태가 해결된다고 본다.

## 더 파고들 거리

- provider 키 회전 중 unknown key를 어떻게 bounded refresh로 처리할 것인가?
- provider 장애와 worker 실패를 어떤 지표로 분리할 것인가?
