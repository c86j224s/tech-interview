---
id: "shared-db-migration-owner"
title: "여러 앱이 같은 DB를 사용합니다. 마이그레이션의 실행 소유자와 각 앱의 호환 배포 순서는 어떻게 정하나요?"
difficulty: "중하"
category: "인프라"
tags: ["Argo CD","sync wave","hook","심화 질문"]
related: ["argocd-sync-waves-hooks","db-online-schema-migration"]
promotedFrom: {"id":"argocd-sync-waves-hooks","prompt":"동일 DB를 여러 앱이 공유할 때 migration 소유권과 배포 순서를 어떻게 정할까요."}
---

# 여러 앱이 같은 DB를 사용합니다. 마이그레이션의 실행 소유자와 각 앱의 호환 배포 순서는 어떻게 정하나요?

## 구두 답변

공유 DB의 스키마 변경은 앱별 배포보다 상위의 단일 실행 책임과 버전 기록이 필요합니다. 한 migration을 여러 앱이 동시에 실행하지 않게 조정하고, 모든 소비자가 혼합 스키마를 읽을 수 있는 확장 단계를 먼저 배포합니다.

migration 락만으로 구버전 코드 호환이 생기지는 않습니다. 배치·관리 SQL·ETL까지 쓰기 경로를 조사하고 백필·읽기 전환·옛 컬럼 제거를 분리합니다. 한 앱 rollback 시 다른 앱이 요구하는 새 스키마를 삭제하지 않습니다.

## 득점 포인트

- 공유 DB의 스키마 변경은 앱별 배포보다 상위의 단일 실행 책임과 버전 기록이 필요합니다. 한 migration을 여러 앱이 동시에 실행하지 않게 조정하고, 모든 소비자가 혼합 스키마를 읽을 수 있는 확장 단계를 먼저 배포합니다.
- 한 앱 rollback 시 다른 앱이 요구하는 새 스키마를 삭제하지 않습니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 공유 DB의 스키마 변경은 앱별 배포보다 상위의 단일 실행 책임과 버전 기록이 필요합니다.

## 더 파고들 거리

- [기본 상황과 비교: 새 버전의 앱이 변경된 DB 스키마를 요구합니다. Argo CD에서 마이그레이션과 앱 배포 순서를 어떻게 정하고, 앞 단계가 실패하면 어떻게 해야 하나요?](/tech-interview/questions/argocd-sync-waves-hooks/)
