---
id: "secret-store-outage-last-known-good"
title: "외부 비밀 저장소가 장애입니다. 이미 가진 자격을 어느 범위와 기간까지 사용하고 신규 작업은 어떻게 제한하나요?"
difficulty: "중하"
category: "보안"
tags: ["GitOps","Kubernetes","Secret","심화 질문"]
related: ["gitops-secrets-delivery","secret-key-rotation","argocd-gitops-reconcile"]
promotedFrom: {"id":"gitops-secrets-delivery","prompt":"외부 비밀 저장소 장애 때 마지막 정상값을 유지할 범위는 무엇일까요?"}
---

# 외부 비밀 저장소가 장애입니다. 이미 가진 자격을 어느 범위와 기간까지 사용하고 신규 작업은 어떻게 제한하나요?

## 구두 답변

이미 검증한 자격을 잠시 유지하는 선택은 가용성을 높이지만 회수 지연을 만듭니다. 토큰·키의 원래 만료와 위험별 최대 보관 기간을 넘겨 무기한 허용하지 않습니다.

신규 고권한 작업은 제한하고 정상적인 짧은 읽기와 민감 변경을 구분합니다. 비밀 저장소 복구 때 재조회 폭주를 제한하고 현재 발급·회수 version을 확인합니다. 원문 비밀을 fallback 로그나 설정 파일로 복사하지 않습니다.

## 득점 포인트

- 이미 검증한 자격을 잠시 유지하는 선택은 가용성을 높이지만 회수 지연을 만듭니다. 토큰·키의 원래 만료와 위험별 최대 보관 기간을 넘겨 무기한 허용하지 않습니다.
- 원문 비밀을 fallback 로그나 설정 파일로 복사하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 이미 검증한 자격을 잠시 유지하는 선택은 가용성을 높이지만 회수 지연을 만듭니다.

## 더 파고들 거리

- [기본 상황과 비교: Kubernetes Secret의 base64 값을 Git에 넣어 배포하려 합니다. 이 값은 비밀로 보호되며 어떻게 안전하게 전달·교체해야 하나요?](/tech-interview/questions/gitops-secrets-delivery/)
