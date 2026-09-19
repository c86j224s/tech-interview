---
id: endpointslice-serving-terminating
title: >-
  Terminating endpoint가 terminating=true·serving=true·ready=false일 때 신규 연결과 기존
  연결을 어떻게 나누어 해석하나요?
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
# Terminating endpoint가 terminating=true·serving=true·ready=false일 때 신규 연결과 기존 연결을 어떻게 나누어 해석하나요?

## 구두 답변

`terminating=true, serving=true, ready=false`는 삭제 중인 endpoint가 일반적인 ready 신규 후보에서는 빠지지만 현재 응답을 제공할 수 있다는 뜻으로 읽습니다. `serving`은 현재 serving 여부이고, terminating은 lifecycle, ready는 기존 신규 traffic 판단과 연결된 조건입니다. 그래서 이미 열린 TCP나 HTTP/2 stream을 즉시 다른 Pod로 옮기라는 명령은 아닙니다. 일반적으로 terminating endpoint는 신규 선택에서 제외하지만, 모든 available endpoint가 terminating인 경우에는 serving 중인 endpoint가 계속 사용될 수 있는 예외도 있습니다.

앱은 종료 신호 후 신규 요청을 막고 active request를 grace budget 안에서 완료해야 합니다. EndpointSlice 전파보다 먼저 keep-alive 연결에 새 요청이 들어올 수 있으며, HTTP/2 stream은 socket 단위로 자동 이주하지 않습니다. proxy의 GOAWAY와 client 재연결, cursor·request ID를 통한 중복 제거를 별도로 확인합니다. `serving=true`만 보고 모든 consumer가 drain을 수행한다고 단정하지 않고, condition 변화 시각·신규 연결·기존 stream 종료·재전달 수를 consumer별로 관찰합니다. 신규 후보 제외와 기존 요청 완료를 같은 timestamp로 기대하지 않습니다. endpoint condition event, proxy backend set, application active request를 각각 기록해야 전파 지연을 drain 실패로 오인하지 않고 grace budget을 조정할 수 있습니다.

## 득점 포인트

- ready·serving·terminating을 신규 선택·현재 응답·lifecycle 축으로 나눕니다.
- all-terminating 상황의 serving endpoint 예외와 socket migration 부재를 설명합니다.

## 감점 포인트

- ready=false가 열린 연결을 즉시 끊는다고 합니다.
- serving=true가 모든 proxy의 drain과 신규 선택을 보장한다고 합니다.

## 더 파고들 거리

- 모든 endpoint가 terminating일 때 serving endpoint를 허용할지 consumer별로 어떻게 검증하나요?
- HTTP/2 GOAWAY 뒤 재연결에서 stream 중복을 어떤 cursor로 제거하나요?
