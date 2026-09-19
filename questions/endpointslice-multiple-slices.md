---
id: endpointslice-multiple-slices
title: EndpointSlice가 여러 객체로 분할될 때 한 Slice만 읽는 client의 누락은 어떻게 생기나요?
difficulty: 중하
category: 인프라
tags:
  - EndpointSlice
  - ready
  - serving
  - terminating
related:
  - headless-clusterip-selection-boundary
---
# EndpointSlice가 여러 객체로 분할될 때 한 Slice만 읽는 client의 누락은 어떻게 생기나요?

## 구두 답변

한 EndpointSlice는 Service 전체 backend가 아니라 분할된 일부일 수 있으므로 한 객체만 읽는 client는 누락을 만듭니다. 주소 수 제한이 100이고 backend가 101개라면 `slice-a`에 100개, `slice-b`에 1개가 놓일 수 있습니다. a만 읽으면 pod-101을 발견하지 못해 부하 분산 대상과 장애 감지 대상이 모두 잘못됩니다. 따라서 Service를 가리키는 label 기준으로 모든 Slice를 list/watch하고, 추가·수정·삭제를 집계해야 합니다.

구현 상태는 주소를 무조건 append하지 말고 endpoint identity를 key로 갱신합니다. 최초 list 뒤 watch가 시작되는 경계에서 변경을 놓치거나 resourceVersion이 너무 오래되면 전체 list로 재동기화합니다. b 삭제 event를 적용하면 집합은 101개에서 100개가 되고, 같은 endpoint의 중복 event는 하나로 남아야 합니다. Slice를 모두 합치는 일은 routing이 아닙니다. 그 뒤 zone 선호·균등 선택·fallback은 kube-proxy, mesh, resolver 또는 애플리케이션 중 책임진 계층이 정해야 합니다. 이 수치는 설명용 계산이며 cluster 실행 결과가 아닙니다. Slice 삭제와 endpoint 삭제를 같은 의미로 기록하지 않습니다. 집계기는 object-level event를 적용한 뒤 현재 Service 집합을 재계산하고, stale Slice가 남아 있는 동안에는 오래된 backend로 새 연결을 만들지 않도록 resourceVersion과 resync 완료 상태를 표시합니다.

## 득점 포인트

- 100+1 endpoint가 두 Slice로 나뉘는 중간 집합을 추적합니다.
- list/watch·resourceVersion·resync·삭제 반영을 설명합니다.

## 감점 포인트

- 첫 Slice가 전체 Service 목록이라고 합니다.
- append만으로 삭제·중복·watch 재연결이 해결된다고 말합니다.

## 더 파고들 거리

- watch resourceVersion이 만료된 뒤 list와 watch를 어떤 순서로 재개하나요?
- 동일 주소가 중복 event로 들어올 때 stable identity를 어떻게 정하나요?
