---
id: "http-content-negotiation"
title: "같은 URL이 JSON과 HTML을 반환합니다. Accept와 Content-Type은 어떤 방향의 정보를 표현하나요?"
answerMinutes: 5
followups: [{"id": "http-cache-vary", "prompt": "같은 URL의 사용자·언어·압축 표현이 캐시에 섞이지 않게 어떤 키를 유지하나요?"}, {"id": "api-backward-compatibility", "prompt": "파싱은 성공하지만 새 필드·상태의 의미를 구버전이 잘못 해석하면 어떤 전환이 필요한가요?"}, {"id": "security-deserialization", "prompt": "데이터 파싱과 임의 객체 생성·후크 실행의 신뢰 경계를 어떻게 나누나요?"}]
difficulty: "중하"
category: "네트워크"
tags: ["HTTP", "네트워크"]
related: ["http-cache-vary", "api-backward-compatibility", "security-deserialization"]
---

# 같은 URL이 JSON과 HTML을 반환합니다. Accept와 Content-Type은 어떤 방향의 정보를 표현하나요?

## 구두 답변

Accept는 클라이언트가 받을 표현의 선호를, Content-Type은 실제 전송 본문의 형식을 설명합니다. 요청의 Content-Type과 응답의 Content-Type도 각각 다른 본문에 대한 정보입니다.

### 동작 원리와 전제

JSON 요청 본문을 보내는 것이 JSON 응답을 요구하는 것과 같지 않습니다. 서버는 지원하는 표현과 Accept를 비교하고 선택한 형식을 응답에 명시합니다. 지원하지 않는 입력 형식과 응답 협상 실패를 서로 다른 오류로 처리합니다.

### 선택과 실패 처리

언어·압축·미디어 유형에 따라 표현이 달라지면 캐시의 Vary와 실제 키를 맞춥니다. 브라우저가 MIME을 추측해 실행하지 않도록 정확한 유형과 필요한 nosniff 정책을 사용합니다. 파일 확장자만으로 실제 내용이 안전하다고 보지 않습니다.

### 구체적인 사례와 검증

클라이언트가 Content-Type: application/json으로 보내고 Accept: text/html을 지정했다면 입력은 JSON이지만 응답은 HTML을 선호한다는 의미입니다. 서버가 이 두 방향을 혼동하면 올바른 요청도 잘못 파싱하거나 다른 표현을 반환할 수 있습니다. API 버전을 media type으로 표현하는 경우에도 실제 필드·기본값·오류 의미를 문서화해야 합니다. Accept를 무시하는 정책이라면 일관된 기본 형식과 오류 계약을 제공하고 캐시가 다른 표현을 혼합하지 않게 합니다. Content-Type이 맞는다고 HTML 안의 사용자 입력이 안전한 것은 아니므로 출력 문맥에 맞는 인코딩을 별도로 수행합니다.

잘못된 유형·빈 Accept·복수 선호·캐시 적중·압축 표현을 시험합니다. 파싱 형식뿐 아니라 버전·단위·필드 의미를 계약으로 관리합니다. 하나의 URL이 여러 표현을 제공할 수 있지만 인가와 데이터 공개 범위는 모든 표현에서 동일하게 적용해야 합니다.

## 득점 포인트

- 핵심 구분: Accept는 클라이언트가 받을 표현의 선호를, Content-Type은 실제 전송 본문의 형식을 설명합니다.
- 선택 조건: 언어·압축·미디어 유형에 따라 표현이 달라지면 캐시의 Vary와 실제 키를 맞춥니다.
- 검증 기준: 잘못된 유형·빈 Accept·복수 선호·캐시 적중·압축 표현을 시험합니다.

## 감점 포인트

- 요청 Content-Type이 응답 형식도 자동으로 결정한다고 한다.

## 더 파고들 거리

- 같은 URL의 사용자·언어·압축 표현이 캐시에 섞이지 않게 어떤 키를 유지하나요?
- 파싱은 성공하지만 새 필드·상태의 의미를 구버전이 잘못 해석하면 어떤 전환이 필요한가요?
- 데이터 파싱과 임의 객체 생성·후크 실행의 신뢰 경계를 어떻게 나누나요?
