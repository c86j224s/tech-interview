---
id: "dda-supercover-corner-cells"
title: "광선이 복셀 모서리나 꼭짓점을 정확히 지납니다. DDA와 supercover의 방문 셀 집합은 어떻게 다른가요?"
difficulty: "중하"
category: "게임 서버"
tags: ["복셀","raycast","DDA","심화 질문"]
related: ["voxel-raycast-dda","voxel-chunk-boundaries"]
promotedFrom: {"id":"voxel-raycast-dda","prompt":"일반 DDA와 supercover가 모서리에서 방문하는 셀 집합을 어떤 테스트로 비교하나요?"}
---

# 광선이 복셀 모서리나 꼭짓점을 정확히 지납니다. DDA와 supercover의 방문 셀 집합은 어떻게 다른가요?

## 구두 답변

일반 traversal은 선택한 경계 규칙으로 지나가는 셀을 나열하지만 접촉한 모든 셀을 포함하는 supercover는 모서리·꼭짓점의 추가 이웃을 후보에 넣을 수 있습니다.

시야와 물리 충돌의 접촉 의미를 명시하고 축별 tMax 동점·0 방향·시작 경계를 검사합니다. 반경 있는 물체는 중심선의 supercover만으로 충분하지 않을 수 있어 팽창·이웃 확장·정밀 sweep이 필요합니다.

## 득점 포인트

- 일반 traversal은 선택한 경계 규칙으로 지나가는 셀을 나열하지만 접촉한 모든 셀을 포함하는 supercover는 모서리·꼭짓점의 추가 이웃을 후보에 넣을 수 있습니다.
- 반경 있는 물체는 중심선의 supercover만으로 충분하지 않을 수 있어 팽창·이웃 확장·정밀 sweep이 필요합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 일반 traversal은 선택한 경계 규칙으로 지나가는 셀을 나열하지만 접촉한 모든 셀을 포함하는 supercover는 모서리·꼭짓점의 추가 이웃을 후보에 넣을 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 복셀 맵에서 광선이 통과하는 셀을 빠짐없이 검사하려 합니다. 3D DDA는 다음 셀을 어떻게 고르며 광선이 셀의 면·모서리에 걸리면 어떻게 처리하나요?](/tech-interview/questions/voxel-raycast-dda/)
