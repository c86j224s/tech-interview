---
id: "multi-region-name-reservation"
title: "여러 지역에서 같은 사용자명을 동시에 등록합니다. 지역별 UNIQUE 밖의 전역 예약 권위는 어디에 두나요?"
difficulty: "중하"
category: "데이터베이스"
tags: ["고유 제약","경쟁 상태","계정","심화 질문"]
related: ["db-unique-constraint-race","transaction-and-lost-update"]
promotedFrom: {"id":"db-unique-constraint-race","prompt":"다중 지역 전역 유일성의 권위 위치를 설계해 보세요."}
---

# 여러 지역에서 같은 사용자명을 동시에 등록합니다. 지역별 UNIQUE 밖의 전역 예약 권위는 어디에 두나요?

## 구두 답변

각 지역 DB의 UNIQUE는 지역 안의 충돌만 막습니다. 전역 이름 예약을 단일 권위·합의 저장소·분할 가능한 namespace로 관리하거나 충돌 허용과 정정 정책을 명시해야 합니다.

예약과 실제 계정 생성 사이 중단을 복구할 상태·기한·멱등 키가 필요합니다. 지역 분할 중 전역 유일성을 지킬 수 없으면 확정을 보류할 수 있습니다. 이메일 정규화·tenant·탈퇴 후 재사용의 의미를 모든 경로에서 같게 적용합니다.

## 득점 포인트

- 각 지역 DB의 UNIQUE는 지역 안의 충돌만 막습니다. 전역 이름 예약을 단일 권위·합의 저장소·분할 가능한 namespace로 관리하거나 충돌 허용과 정정 정책을 명시해야 합니다.
- 이메일 정규화·tenant·탈퇴 후 재사용의 의미를 모든 경로에서 같게 적용합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: 각 지역 DB의 UNIQUE는 지역 안의 충돌만 막습니다.

## 더 파고들 거리

- [기본 상황과 비교: 두 사용자가 같은 계정명을 동시에 가입할 때 사전 중복 조회가 모두 통과하는 이유와 DB 고유 제약 처리 방법은 무엇인가요?](/tech-interview/questions/db-unique-constraint-race/)
