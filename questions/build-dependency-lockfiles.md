---
id: "build-dependency-lockfiles"
title: "패키지 버전을 package.json에 적었는데 팀원마다 다른 의존성이 설치됩니다. lockfile은 무엇을 고정하나요?"
answerMinutes: 5
followups: [{"id": "container-image-reproducibility", "prompt": "동일 빌드 입력을 재현하려면 base digest·환경·외부 다운로드까지 무엇을 기록하나요?"}, {"id": "agent-tool-supply-chain", "prompt": "외부 도구의 코드뿐 아니라 설명·스키마·지침 변경은 어떻게 검토하나요?"}, {"id": "api-backward-compatibility", "prompt": "파싱은 성공하지만 새 필드·상태의 의미를 구버전이 잘못 해석하면 어떤 전환이 필요한가요?"}]
difficulty: "중하"
category: "설계"
tags: ["설계", "build dependency lockfiles"]
related: ["container-image-reproducibility", "agent-tool-supply-chain", "api-backward-compatibility"]
---

# 패키지 버전을 package.json에 적었는데 팀원마다 다른 의존성이 설치됩니다. lockfile은 무엇을 고정하나요?

## 구두 답변

버전 범위 선언과 실제 해결된 의존 그래프는 다릅니다. lockfile은 직접·전이 의존성의 특정 해결 결과와 무결성 정보를 기록해 설치를 재현하는 데 도움을 줍니다.

### 동작 원리와 전제

같은 범위라도 시간이 지나 새 버전이 나오거나 transitive dependency가 달라지면 설치 결과가 바뀔 수 있습니다. 잠금 기반 설치 명령과 패키지 매니저 버전을 맞추고 manifest와 lockfile 불일치를 검사합니다.

### 선택과 실패 처리

운영체제별 선택 의존성·native 빌드·postinstall·외부 다운로드는 추가 변동 요소입니다. lockfile만으로 외부 실행 코드의 안전성이 보장되지 않습니다. 업데이트는 diff·취약점·테스트와 함께 수행하고 무작정 잠금을 삭제해 충돌을 해결하지 않습니다.

### 구체적인 사례와 검증

CI에서 잠금 기반 설치가 실패했을 때 lockfile을 삭제하고 다시 해결하면 원래 검토한 의존 그래프가 바뀝니다. manifest와 잠금의 차이를 확인하고 의도적인 업데이트인지 결정해야 합니다. 전이 의존성 하나의 변경도 API·보안·빌드 결과에 영향을 줄 수 있으므로 diff와 테스트를 봅니다. 캐시가 있으면 설치가 성공하지만 새 환경에서는 registry나 integrity 오류로 실패할 수 있어 clean install을 검증합니다. native addon은 같은 package 버전이라도 OS·컴파일러·라이브러리에 따라 결과가 달라질 수 있습니다. 재현 범위와 지원 플랫폼을 명시하는 것이 중요합니다.

클린 설치·캐시 없는 CI·지원 플랫폼·업데이트 rollback을 시험합니다. 의존성 이름과 출처 혼동을 막고 필요한 registry를 제한합니다. 잠금은 재현성의 일부이며 환경과 실행 스크립트까지 전체 입력을 봐야 합니다.

## 득점 포인트

- 핵심 구분: 버전 범위 선언과 실제 해결된 의존 그래프는 다릅니다.
- 선택 조건: 운영체제별 선택 의존성·native 빌드·postinstall·외부 다운로드는 추가 변동 요소입니다.
- 검증 기준: 클린 설치·캐시 없는 CI·지원 플랫폼·업데이트 rollback을 시험합니다.

## 감점 포인트

- lockfile을 지워 재설치해도 검토한 의존성 구성은 그대로라고 한다.

## 더 파고들 거리

- 동일 빌드 입력을 재현하려면 base digest·환경·외부 다운로드까지 무엇을 기록하나요?
- 외부 도구의 코드뿐 아니라 설명·스키마·지침 변경은 어떻게 검토하나요?
- 파싱은 성공하지만 새 필드·상태의 의미를 구버전이 잘못 해석하면 어떤 전환이 필요한가요?
