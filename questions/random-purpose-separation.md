---
id: random-purpose-separation
title: 세션 ID와 추첨용 난수를 같은 생성기 상태에서 함께 써도 되나요?
difficulty: 중하
category: 보안
tags:
  - CSPRNG
  - 키 분리
  - 토큰
related:
  - pure-random-state-threading
---
# 세션 ID와 추첨용 난수를 같은 생성기 상태에서 함께 써도 되나요?

## 구두 답변

같은 생성기 상태를 공유하지 않겠습니다. 추첨이나 replay처럼 seed를 저장해 재현해야 하는 PRNG와, 세션 ID처럼 예측되면 곧 권한이 되는 자격 생성기는 요구사항이 반대입니다. 하나의 전역 RNG에 테스트용 seed를 주입하거나 상태 snapshot을 로그로 남기면 session 출력까지 재현 가능해질 수 있습니다. 보안 자격은 OS CSPRNG와 접근 제한된 API를 쓰고, 추첨은 명시적인 seed·상태를 가진 별도 객체로 만들겠습니다.

구체적으로 `draw(seed=42)`가 게임 replay를 재생하는 동안 `sessionId()`가 같은 RNG 인스턴스를 호출하지 않도록 모듈·프로세스·권한을 분리합니다. 보안 생성기가 애플리케이션의 seed 인자를 받지 않게 하고, 로그에는 난수 상태나 token 원문 대신 요청 ID와 생성기 오류만 남깁니다. 두 용도가 같은 프로세스에 있어도 상태와 함수 경계를 분리해야 하며, “CSPRNG라서 같은 객체를 써도 괜찮다”는 말은 테스트가 그 상태를 통제할 수 있다는 위험을 놓칩니다.

재현성은 자격값이 아니라 테스트 전용 입력과 비밀을 제거한 메타데이터로 확보합니다. session ID가 추측되지 않는지뿐 아니라 충돌, 만료, 회수, 로그·분석 시스템 노출도 점검합니다. 추첨의 공정성이 필요한 경우에도 modulo bias를 별도 검토하되, 그 결과를 session token 생성에 재사용하지 않습니다.


호출 순서로도 오염을 드러낼 수 있습니다. replay 테스트가 `simulation.seed(42)`를 호출한 뒤 같은 전역 RNG에서 `sessionId()`를 생성하면 테스트마다 session 출력이 같아지거나 호출 순서에 따라 예측 가능한 위치로 밀립니다. 보안 생성기 함수는 seed·상태 snapshot 인자를 받지 않고 OS CSPRNG를 내부에서 호출하며, simulation은 별도 객체에만 seed를 전달합니다. 같은 프로세스라면 모듈 export와 IAM을 분리하고 crash dump·telemetry 필터가 CSPRNG 상태를 수집하지 않는지 확인합니다. 별도 프로세스는 경계를 강하게 하지만 배포·IPC 비용이 늘어나므로 최소한 API와 권한을 분리한 뒤, 고위험 session 발급은 전용 worker를 선택할 수 있습니다. 추첨의 modulo bias를 고쳐도 session 상태가 섞이면 해결되지 않고, 반대로 CSPRNG를 쓴다고 seed를 로그에 남겨도 괜찮아지는 것은 아닙니다. 이 결정의 기준은 재현성 편의가 아니라 상태를 통제할 수 있는 주체와 그 결과가 권한인지 여부입니다.

## 득점 포인트

- 재현 PRNG와 예측 불가능한 CSPRNG의 계약을 구분한다.
- seed·상태·로그 접근이 session 자격으로 이어지지 않게 한다.

## 감점 포인트

- 같은 CSPRNG 객체면 용도 분리가 자동이라고 한다.
- seed를 기록한 테스트가 운영 session 생성에도 영향을 주게 한다.

## 더 파고들 거리

- 프로세스 분리 없이 같은 서비스에서 두 RNG를 운영할 때 API·권한 경계를 어떻게 검사할까요?
- 보안 자격 생성기의 상태가 crash dump와 telemetry에 들어가지 않는지 어떻게 확인할까요?
