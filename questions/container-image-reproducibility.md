---
id: "container-image-reproducibility"
title: "같은 Dockerfile로 빌드했는데 며칠 뒤 이미지 내용이 달라집니다. 재현 가능한 빌드는 어떻게 만드나요?"
answerMinutes: 5
followups: [{"id": "build-dependency-lockfiles", "prompt": "선언한 버전 범위와 실제 해결된 전이 의존 그래프를 어떻게 고정하나요?"}, {"id": "security-upload-content-validation", "prompt": "산출물의 확장자·서명 외에 내용·크기·실행·공개 상태는 어떻게 검증하나요?"}, {"id": "gitops-secrets-delivery", "prompt": "배포 자격과 비밀값이 Git·이미지·로그에 남지 않게 어떤 전달 경로를 사용하나요?"}]
difficulty: "중하"
category: "인프라"
tags: ["인프라", "container image reproducibility"]
related: ["build-dependency-lockfiles", "security-upload-content-validation", "gitops-secrets-delivery"]
---

# 같은 Dockerfile로 빌드했는데 며칠 뒤 이미지 내용이 달라집니다. 재현 가능한 빌드는 어떻게 만드나요?

## 구두 답변

Dockerfile이 같아도 base image tag·패키지 저장소·의존성·빌드 시간·외부 다운로드가 바뀌면 결과가 달라질 수 있습니다. 입력을 고정하고 출처·버전을 기록해야 재현성을 높일 수 있습니다.

### 동작 원리와 전제

변하는 tag 대신 digest와 lockfile을 사용하고 다운로드 검증·빌드 도구 버전을 관리합니다. 시간·경로 같은 비결정적 산출물도 확인합니다. 고정은 보안 업데이트를 중단하라는 뜻이 아니라 검토된 버전으로 의도적으로 갱신하라는 뜻입니다.

### 선택과 실패 처리

다단계 빌드로 불필요한 도구·비밀을 최종 이미지에서 제외하고 빌드 secret을 layer에 남기지 않습니다. 서명·provenance·SBOM은 출처와 구성 추적에 도움되지만 이미지가 안전하다는 완전한 증명은 아닙니다.

### 구체적인 사례와 검증

FROM image:latest와 버전 범위의 패키지 설치는 같은 Dockerfile에서 다른 입력을 가져오는 대표 경로입니다. digest·lockfile을 고정하더라도 빌드 스크립트가 외부 URL에서 최신 파일을 받으면 변동이 남습니다. CI의 네트워크·환경 변수·시각·플랫폼도 결과에 영향을 줄 수 있어 필요한 범위를 기록합니다. secret을 ARG나 RUN 문자열에 넣으면 layer·로그에 남을 수 있어 전용 secret 전달 기능과 최종 이미지 검사를 사용합니다. SBOM은 구성 목록을 제공하지만 알려지지 않은 취약점이나 악성 동작을 모두 검출하지는 않습니다. 출처·무결성·실행 안전성은 별도 검증입니다.

클린 환경 재빌드·캐시 유무·다른 머신·의존성 변경을 비교합니다. bit-for-bit 재현이 필요한지 기능적으로 동일한 산출물인지 기준을 정합니다. 공급망·운영 업데이트와 함께 유지보수 가능한 재현성을 설계하겠습니다.

## 득점 포인트

- 핵심 구분: Dockerfile이 같아도 base image tag·패키지 저장소·의존성·빌드 시간·외부 다운로드가 바뀌면 결과가 달라질 수 있습니다.
- 선택 조건: 다단계 빌드로 불필요한 도구·비밀을 최종 이미지에서 제외하고 빌드 secret을 layer에 남기지 않습니다.
- 검증 기준: 클린 환경 재빌드·캐시 유무·다른 머신·의존성 변경을 비교합니다.

## 감점 포인트

- Dockerfile이나 lockfile 하나만 같으면 모든 이미지가 완전히 재현된다고 한다.

## 더 파고들 거리

- 선언한 버전 범위와 실제 해결된 전이 의존 그래프를 어떻게 고정하나요?
- 산출물의 확장자·서명 외에 내용·크기·실행·공개 상태는 어떻게 검증하나요?
- 배포 자격과 비밀값이 Git·이미지·로그에 남지 않게 어떤 전달 경로를 사용하나요?
