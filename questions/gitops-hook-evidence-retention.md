---
id: "gitops-hook-evidence-retention"
title: "배포 hook이 실패했는데 Pod와 로그가 삭제됐습니다. 재시작 뒤에도 실패 근거와 실행 결과를 어떻게 보존하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Argo CD","sync wave","hook","심화 질문"]
related: ["argocd-sync-waves-hooks","db-online-schema-migration"]
promotedFrom: {"id":"argocd-sync-waves-hooks","prompt":"hook 로그가 삭제되거나 sync controller가 재시작돼도 실패 근거를 어떻게 보존할까요."}
---

# 배포 hook이 실패했는데 Pod와 로그가 삭제됐습니다. 재시작 뒤에도 실패 근거와 실행 결과를 어떻게 보존하나요?

## 구두 답변

hook 실행 ID·Git revision·migration 버전·시작·종료·오류를 내구 관측 저장소에 연결합니다. Pod 삭제 정책이 있어도 로그와 실제 변경 결과를 추적할 참조는 남겨야 합니다.

hook가 timeout됐지만 DB 변경은 완료됐을 수 있어 새 실행 전에 migration 원장을 확인합니다. 로그 원문에 자격 증명을 남기지 않고 필요한 오류와 단계만 보존합니다. controller 재시작·성공 직후 Pod 삭제·로그 sink 장애에서 근거와 재시도 판단을 시험합니다.

## 득점 포인트

- hook 실행 ID·Git revision·migration 버전·시작·종료·오류를 내구 관측 저장소에 연결합니다. Pod 삭제 정책이 있어도 로그와 실제 변경 결과를 추적할 참조는 남겨야 합니다.
- controller 재시작·성공 직후 Pod 삭제·로그 sink 장애에서 근거와 재시도 판단을 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: hook 실행 ID·Git revision·migration 버전·시작·종료·오류를 내구 관측 저장소에 연결합니다.

## 더 파고들 거리

- [기본 상황과 비교: 새 버전의 앱이 변경된 DB 스키마를 요구합니다. Argo CD에서 마이그레이션과 앱 배포 순서를 어떻게 정하고, 앞 단계가 실패하면 어떻게 해야 하나요?](/tech-interview/questions/argocd-sync-waves-hooks/)
