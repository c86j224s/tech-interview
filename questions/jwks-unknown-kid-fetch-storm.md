---
id: "jwks-unknown-kid-fetch-storm"
title: "새 kid를 모르는 서비스가 JWKS를 반복 조회합니다. 캐시·singleflight·실패 backoff를 어떻게 조합하나요?"
difficulty: "중하"
category: "보안"
tags: ["키 교체","비밀 관리","JWT","심화 질문"]
related: ["secret-key-rotation","jwt-vs-server-session","tls-certificate-validation"]
promotedFrom: {"id":"secret-key-rotation","prompt":"공개키 캐시가 새 kid를 모를 때 재조회 폭주를 어떻게 제한할까요?"}
---

# 새 kid를 모르는 서비스가 JWKS를 반복 조회합니다. 캐시·singleflight·실패 backoff를 어떻게 조합하나요?

## 구두 답변

알 수 없는 kid마다 외부 JWKS를 조회하면 공격·회전 때 요청이 폭증할 수 있습니다. 신뢰 issuer별 cache와 singleflight·짧은 부정 cache·재시도 상한을 둡니다.

조회 실패를 검증 생략으로 바꾸지 않습니다. token이 임의 URL을 선택하게 하지 않고 기존 유효 키와 새 키의 전환 창을 관리합니다. 회전·키 제거·동시 요청·저장소 장애에서 정상과 악성 요청을 나눠 시험합니다.

## 득점 포인트

- 알 수 없는 kid마다 외부 JWKS를 조회하면 공격·회전 때 요청이 폭증할 수 있습니다. 신뢰 issuer별 cache와 singleflight·짧은 부정 cache·재시도 상한을 둡니다.
- 회전·키 제거·동시 요청·저장소 장애에서 정상과 악성 요청을 나눠 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 알 수 없는 kid마다 외부 JWKS를 조회하면 공격·회전 때 요청이 폭증할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 서비스를 중단하지 않고 JWT 서명키나 API 비밀키를 교체할 때 배포 순서와 유출 대응을 어떻게 나누나요?](/tech-interview/questions/secret-key-rotation/)
