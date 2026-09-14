---
id: "derived-data-version-lag-slo"
title: "원본 지형과 충돌·경로 데이터의 버전이 벌어집니다. 허용 조합·임시 정책·지연 SLO를 어떻게 관리하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["복셀","파생 데이터","버전","심화 질문"]
related: ["voxel-derived-data-update","dynamic-path-revalidation","voxel-chunk-boundaries"]
promotedFrom: {"id":"voxel-derived-data-update","prompt":"원본과 파생 버전 차이를 어떤 지표·경보·SLO로 운영하나요?"}
---

# 원본 지형과 충돌·경로 데이터의 버전이 벌어집니다. 허용 조합·임시 정책·지연 SLO를 어떻게 관리하나요?

## 구두 답변

원본 version과 충돌·경로·시야 산출물의 sourceVersion·게시 상태를 관측합니다. 기능별 허용 지연과 버전 조합을 명시해 최신 경로와 옛 충돌을 무심코 섞지 않습니다.

임시 차단층의 지속 시간·재생성 대기·stale 결과 폐기를 SLO로 봅니다. 최신 원본이 계속 바뀌면 coalescing하되 안전 조건을 유지합니다. 게시 포인터 교체와 옛 reader 수명을 별도로 관리합니다.

## 득점 포인트

- 원본 version과 충돌·경로·시야 산출물의 sourceVersion·게시 상태를 관측합니다. 기능별 허용 지연과 버전 조합을 명시해 최신 경로와 옛 충돌을 무심코 섞지 않습니다.
- 게시 포인터 교체와 옛 reader 수명을 별도로 관리합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 원본 version과 충돌·경로·시야 산출물의 sourceVersion·게시 상태를 관측합니다.

## 더 파고들 거리

- [기본 상황과 비교: 복셀 원본이 바뀔 때 충돌·경로·시야 파생 데이터를 서로 다른 버전으로 사용하지 않게 갱신하는 방법은 무엇인가요?](/tech-interview/questions/voxel-derived-data-update/)
