---
id: "external-merge-fanin-buffer-budget"
title: "외부 정렬의 fan-in을 늘립니다. 병합 단계 감소와 파일별 버퍼·FD·임시 공간은 어떻게 계산하나요?"
difficulty: "중하"
category: "알고리즘"
tags: ["병합 정렬","외부 정렬","I/O","심화 질문"]
related: ["merge-sort-external"]
promotedFrom: {"id":"merge-sort-external","prompt":"다중 병합 fan-in을 늘릴 때 단계 수와 파일별 버퍼 크기가 어떻게 맞바뀌는지 설명해 보세요."}
---

# 외부 정렬의 fan-in을 늘립니다. 병합 단계 감소와 파일별 버퍼·FD·임시 공간은 어떻게 계산하나요?

## 구두 답변

fan-in이 커지면 병합 pass를 줄일 수 있지만 열린 파일·힙 후보·파일별 buffer 예산이 늘거나 각 buffer가 작아집니다. 총 메모리 안에서 입력 buffer·출력·decode 공간을 함께 계산합니다.

N바이트를 각 pass마다 읽고 쓰는 I/O와 임시 공간을 포함합니다. 빈 run·큰 레코드·FD 한도·중단 재개를 시험합니다. 순차 읽기의 이점과 작은 buffer의 syscall·cache 비용을 비교합니다.

## 득점 포인트

- fan-in이 커지면 병합 pass를 줄일 수 있지만 열린 파일·힙 후보·파일별 buffer 예산이 늘거나 각 buffer가 작아집니다. 총 메모리 안에서 입력 buffer·출력·decode 공간을 함께 계산합니다.
- 순차 읽기의 이점과 작은 buffer의 syscall·cache 비용을 비교합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: fan-in이 커지면 병합 pass를 줄일 수 있지만 열린 파일·힙 후보·파일별 buffer 예산이 늘거나 각 buffer가 작아집니다.

## 더 파고들 거리

- [기본 상황과 비교: 메모리에 다 들어가지 않는 큰 파일을 정렬하려 합니다. 병합 정렬은 어떻게 활용할 수 있나요?](/tech-interview/questions/merge-sort-external/)
