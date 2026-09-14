---
id: "prepared-server-emulated-contract"
title: "드라이버의 서버 측 준비와 클라이언트 에뮬레이션은 파라미터 분리·계획 재사용에서 무엇을 확인해야 하나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["Prepared Statement","파라미터 바인딩","SQL Injection","동적 SQL","심화 질문"]
related: ["prepared-statement-injection","authentication-vs-authorization"]
promotedFrom: {"id":"prepared-statement-injection","prompt":"드라이버의 서버·클라이언트 준비 차이를 확인해 보세요."}
---

# 드라이버의 서버 측 준비와 클라이언트 에뮬레이션은 파라미터 분리·계획 재사용에서 무엇을 확인해야 하나요?

## 구두 답변

서버 준비는 SQL 구조·계획을 서버에서 관리하고 에뮬레이션은 driver가 값 인코딩을 처리할 수 있습니다. 보안상 중요한 것은 입력이 SQL 문법으로 섞이지 않는 정확한 값 처리 계약입니다.

driver 버전·문자셋·타입·배열·식별자 지원을 확인합니다. 테이블·컬럼명은 일반 값 바인딩과 별도 허용 목록이 필요합니다. 계획 재사용 이점과 parameter skew·컴파일 비용을 실제 측정합니다.

## 득점 포인트

- 서버 준비는 SQL 구조·계획을 서버에서 관리하고 에뮬레이션은 driver가 값 인코딩을 처리할 수 있습니다. 보안상 중요한 것은 입력이 SQL 문법으로 섞이지 않는 정확한 값 처리 계약입니다.
- 계획 재사용 이점과 parameter skew·컴파일 비용을 실제 측정합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 서버 준비는 SQL 구조·계획을 서버에서 관리하고 에뮬레이션은 driver가 값 인코딩을 처리할 수 있습니다.

## 더 파고들 거리

- [기본 상황과 비교: 검색어를 SQL 문자열에 이어 붙인 코드가 위험합니다. 파라미터 바인딩으로 무엇을 막고 동적 식별자는 어떻게 처리하나요?](/tech-interview/questions/prepared-statement-injection/)
