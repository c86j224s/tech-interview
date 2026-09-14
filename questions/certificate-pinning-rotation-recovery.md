---
id: "certificate-pinning-rotation-recovery"
title: "앱에 인증서 pinning을 넣습니다. 정상 키 교체·긴급 유출·오래된 앱의 복구 경로는 어떻게 준비하나요?"
difficulty: "중하"
category: "보안"
tags: ["TLS","인증서","인증","심화 질문"]
related: ["tls-certificate-validation","authentication-vs-authorization"]
promotedFrom: {"id":"tls-certificate-validation","prompt":"인증서 pinning이 정상 교체와 긴급 복구에 만드는 운영 비용은 무엇일까요?"}
---

# 앱에 인증서 pinning을 넣습니다. 정상 키 교체·긴급 유출·오래된 앱의 복구 경로는 어떻게 준비하나요?

## 구두 답변

pinning은 신뢰할 인증서·공개키 집합을 더 좁히지만 정상 회전이나 키 분실 때 오래된 앱이 연결할 수 없게 만들 수 있습니다. backup pin·업데이트·만료·긴급 복구 정책을 준비합니다.

복구 경로를 너무 느슨하게 만들면 pinning을 우회합니다. CA·hostname 검증과 pin 조건을 구분하고 지원 앱 버전·키 교체·네트워크 실패를 시험합니다. 만능 보안보다 운영 가능한 신뢰 범위를 선택합니다.

## 득점 포인트

- pinning은 신뢰할 인증서·공개키 집합을 더 좁히지만 정상 회전이나 키 분실 때 오래된 앱이 연결할 수 없게 만들 수 있습니다. backup pin·업데이트·만료·긴급 복구 정책을 준비합니다.
- 만능 보안보다 운영 가능한 신뢰 범위를 선택합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: pinning은 신뢰할 인증서·공개키 집합을 더 좁히지만 정상 회전이나 키 분실 때 오래된 앱이 연결할 수 없게 만들 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: TLS 핸드셰이크가 성공해도 의도한 서버를 신뢰한다고 말하려면 어떤 인증서 검증과 API 인가가 필요한가요?](/tech-interview/questions/tls-certificate-validation/)
