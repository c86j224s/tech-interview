---
id: trusted-types-report-enforce
title: Trusted Types Report-Only와 enforce 모드를 어떻게 전환하나요?
difficulty: 중하
category: 보안
tags:
  - Trusted Types
  - CSP
  - 운영
related:
  - security-csp-nonce
---
# Trusted Types Report-Only와 enforce 모드를 어떻게 전환하나요?

## 구두 답변

Report-Only와 enforce의 차이는 관찰과 차단입니다. 전환 첫 단계에서 Report-Only CSP를 배포해 어떤 페이지의 어떤 stack이 문자열을 injection sink로 보내는지 수집하고, 직접 코드·legacy 라이브러리·제3자 위젯·테스트 경로를 분류합니다. 예를 들어 보고에 `/editor`의 `innerHTML = preview`가 반복되면 먼저 `textContent`나 구조화 DOM으로 바꿀 수 있는지 확인하고, 정말 HTML이 필요한 경우에만 입력 출처와 sanitizer 계약을 가진 policy를 만듭니다. 보고 건수가 0이어도 관측된 브라우저와 트래픽에서 위반이 없었다는 뜻일 뿐 미지원 브라우저와 미실행 경로까지 안전하다는 증거는 아닙니다.

수정 후 정상 댓글·빈 값·공격 fixture·제3자 위젯·캐시된 페이지를 재현하고, 허용 policy 이름과 생성 횟수도 검증합니다. 보고 endpoint에는 입력 원문이나 민감한 query를 과도하게 저장하지 않고, CDN이 서로 다른 CSP header와 HTML을 섞지 않도록 캐시 key를 확인합니다. enforce로 바꾼 뒤 문자열 sink는 지원 브라우저에서 차단되므로 오류가 생겼다고 만능 policy를 추가하지 않습니다. 미지원 브라우저에는 안전한 DOM API, escaping, sanitizer, 서버 인가가 계속 필요합니다. 긴급 rollback으로 Report-Only를 잠시 켤 수 있지만 그 순간 차단 보장이 사라졌다는 사실과 만료 시각을 운영 기록에 남기고, 새 코드·라이브러리 배포마다 sink review를 다시 수행합니다.

## 득점 포인트

- Report-Only는 관찰, enforce는 sink 차단이라는 운영 차이를 분명히 합니다.
- stack·제3자·미지원 브라우저·캐시 일관성을 inventory로 검증합니다.
- 오류를 만능 policy로 덮지 않고 공격 fixture 후 enforce로 전환합니다.

## 감점 포인트

- 보고 0건을 전 경로 안전의 증거로 해석합니다.
- enforce 오류를 모든 입력을 Trusted 값으로 감싸 해결합니다.

## 더 파고들 거리

- 긴급 rollback에서 차단 보장 상실과 만료 시각을 어떻게 기록하겠습니까?
- 새 라이브러리 배포 때 sink review를 어느 CI 단계에 넣겠습니까?
