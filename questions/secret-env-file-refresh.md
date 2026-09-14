---
id: "secret-env-file-refresh"
title: "Secret을 환경 변수와 파일로 각각 전달합니다. 키 회전 시 실행 중 앱이 새 값을 읽는 시점은 어떻게 다른가요?"
difficulty: "중하"
category: "보안"
tags: ["GitOps","Kubernetes","Secret","심화 질문"]
related: ["gitops-secrets-delivery","secret-key-rotation","argocd-gitops-reconcile"]
promotedFrom: {"id":"gitops-secrets-delivery","prompt":"환경 변수와 파일 마운트 Secret의 갱신 시점을 어떻게 실험할까요?"}
---

# Secret을 환경 변수와 파일로 각각 전달합니다. 키 회전 시 실행 중 앱이 새 값을 읽는 시점은 어떻게 다른가요?

## 구두 답변

환경 변수는 일반적으로 프로세스 시작에 읽고 파일 마운트는 플랫폼이 갱신해도 앱이 재읽어야 적용됩니다. subPath·열린 핸들·클라이언트 내부 cache 때문에 새 파일과 실제 사용 키가 달라질 수 있습니다.

신규 키 검증 지원을 먼저 배포하고 발급·사용을 전환한 뒤 옛 키 사용 수명을 종료합니다. 파일 변경을 감지하면 전체 비밀 묶음을 검증해 게시하고 원문을 로그에 남기지 않습니다. 만료·재시작·저장소 장애와 구·신 키 혼합을 시험합니다.

## 득점 포인트

- 환경 변수는 일반적으로 프로세스 시작에 읽고 파일 마운트는 플랫폼이 갱신해도 앱이 재읽어야 적용됩니다. subPath·열린 핸들·클라이언트 내부 cache 때문에 새 파일과 실제 사용 키가 달라질 수 있습니다.
- 만료·재시작·저장소 장애와 구·신 키 혼합을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 환경 변수는 일반적으로 프로세스 시작에 읽고 파일 마운트는 플랫폼이 갱신해도 앱이 재읽어야 적용됩니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes Secret의 base64 값을 Git에 넣어 배포하려 합니다. 이 값은 비밀로 보호되며 어떻게 안전하게 전달·교체해야 하나요?](/tech-interview/questions/gitops-secrets-delivery/)
