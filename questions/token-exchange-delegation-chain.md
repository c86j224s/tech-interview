---
id: token-exchange-delegation-chain
title: 여러 서비스가 연쇄적으로 token exchange할 때 감사 주체를 어떻게 보존하나요?
difficulty: 중하
category: 보안
tags:
  - OAuth
  - actor
  - 감사
related:
  - authentication-vs-authorization
---
# 여러 서비스가 연쇄적으로 token exchange할 때 감사 주체를 어떻게 보존하나요?

## 구두 답변

연쇄 교환은 token 하나를 전달하는 일이 아니라 각 hop이 독립된 권한 결정입니다. U가 gateway G를 거쳐 order service O를 호출하고 O가 shipping S를 부른다면, G→O 교환은 U를 subject로, G를 actor로, O를 audience로 검증합니다. O→S 교환에서는 O가 다음 actor가 될 수 있는지, U의 원래 승인 범위에서 shipping 작업이 허용되는지 다시 판단합니다. O가 client가 보낸 `act`를 그대로 복사해 새 token을 만들면 actor 위조가 되므로 AS가 검증한 입력과 등록 정책으로만 발급해야 합니다.

감사 모델은 `U ← G ← O`처럼 읽을 수 있습니다. 최종 S가 U만 보면 사용자 승인 주체는 남지만 실제 호출 경로가 사라집니다. 반대로 모든 actor chain을 token에 넣으면 설명 가능성이 좋아지는 대신 token 크기, 개인정보, 검증 비용이 증가합니다. 바로 앞 actor만 보존할지 전체 chain을 구조화해 보존할지는 profile 선택이며, 중요한 것은 각 단계의 exchange ID와 correlation을 보호된 감사 저장소에 남기는 것입니다. token 원문과 subject 개인정보는 로그에서 제외하고 보호된 식별자·audience·승인 scope·결과·거절 이유를 기록합니다.

교환 장애 때 U의 원래 token을 S에 직접 보내는 fallback은 chain과 audience 격리를 깨뜨립니다. 재시도는 안전한 발급 결과 캐시나 provider가 정의한 멱등 계약 안에서만 하고, 짧은 TTL과 회수 지연을 별도 운영 정책으로 둡니다. 검증 시험에서는 U→G→O→S 각 결과의 subject·actor·audience·scope를 표로 비교하고, O가 S용 token을 orders audience로 잘못 발급하는 경우와 허위 actor claim을 각각 거절해야 합니다.

## 득점 포인트

- 각 hop의 subject·actor·audience 재검증을 U→G→O→S trace로 설명한다.
- 전체 chain과 바로 앞 actor 보존의 감사·크기·개인정보 비용을 비교한다.
- exchange 장애 시 원래 token fallback을 금지하는 이유를 말한다.

## 감점 포인트

- 최종 사용자만 남기면 호출 경로가 충분하다고 한다.
- 중간 서비스가 `act`를 자유롭게 수정해도 된다고 말한다.
- exchange 실패 때 원래 token을 모든 downstream에 전달한다.

## 더 파고들 거리

- 전체 chain을 token claim과 감사 저장소 중 어디에 둘까요?
- 중간 actor의 권한 회수가 이미 발급된 token에 언제 반영될까요?
