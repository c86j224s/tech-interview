---
id: "voxel-halo-version-consistency"
title: "청크 경계에 ghost cell을 복사합니다. 원본과 halo가 다른 버전일 때 어떤 검사를 보류해야 하나요?"
difficulty: "중하"
category: "게임 서버"
tags: ["복셀","청크","경계","심화 질문"]
related: ["voxel-chunk-boundaries","voxel-occupancy-representation"]
promotedFrom: {"id":"voxel-chunk-boundaries","prompt":"ghost cell을 둘 때 원본 청크와 halo의 버전 불일치를 어떻게 감지하나요?"}
---

# 청크 경계에 ghost cell을 복사합니다. 원본과 halo가 다른 버전일 때 어떤 검사를 보류해야 하나요?

## 구두 답변

halo에는 어느 원본 청크 version을 복사했는지 기록하고 경계 질의가 요구하는 조합과 맞는지 확인합니다. 원본 수정이 이웃 halo와 파생 데이터 무효화로 이어져야 합니다.

미갱신·미로딩을 빈 공간으로 반환하지 않고 보류·보수 차단·재시도 상태를 줍니다. reader가 참조한 snapshot을 언로드하지 않습니다. 면·모서리·꼭짓점·음수 좌표·동시 교체를 시험합니다.

## 득점 포인트

- halo에는 어느 원본 청크 version을 복사했는지 기록하고 경계 질의가 요구하는 조합과 맞는지 확인합니다. 원본 수정이 이웃 halo와 파생 데이터 무효화로 이어져야 합니다.
- 면·모서리·꼭짓점·음수 좌표·동시 교체를 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: halo에는 어느 원본 청크 version을 복사했는지 기록하고 경계 질의가 요구하는 조합과 맞는지 확인합니다.

## 더 파고들 거리

- [기본 상황과 비교: 복셀 월드를 청크로 스트리밍할 때 충돌·경로·시야가 청크 경계에서 틀어지지 않게 하려면 무엇을 관리해야 하나요?](/tech-interview/questions/voxel-chunk-boundaries/)
