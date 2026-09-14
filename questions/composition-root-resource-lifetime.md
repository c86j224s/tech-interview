---
id: "composition-root-resource-lifetime"
title: "협력 객체가 많아져 생성·종료 순서가 복잡합니다. composition root는 어떤 의존성과 수명을 소유하나요?"
difficulty: "중하"
category: "설계"
tags: ["상속","조합","위임","다형성","심화 질문"]
related: ["inheritance-composition","service-boundary-design"]
promotedFrom: {"id":"inheritance-composition","prompt":"조합된 객체의 생성과 생명주기를 관리하는 방법이 많아질 때 어디에 조립 책임을 둘까요?"}
---

# 협력 객체가 많아져 생성·종료 순서가 복잡합니다. composition root는 어떤 의존성과 수명을 소유하나요?

## 구두 답변

composition root는 구체 구현을 조립하고 공유·요청별 자원의 수명과 종료 순서를 정하는 제한된 위치입니다. 정책 코드가 service locator로 전역 구현을 다시 찾게 하면 의존성이 숨습니다.

DB·HTTP pool·logger의 owner를 하나로 두고 사용 작업을 먼저 정리한 뒤 자원을 닫습니다. 생성 중 일부 실패하면 이미 만든 자원만 회수합니다. 테스트는 새 객체 그래프를 만들어 전역 상태 누수를 줄입니다.

## 득점 포인트

- composition root는 구체 구현을 조립하고 공유·요청별 자원의 수명과 종료 순서를 정하는 제한된 위치입니다. 정책 코드가 service locator로 전역 구현을 다시 찾게 하면 의존성이 숨습니다.
- 테스트는 새 객체 그래프를 만들어 전역 상태 누수를 줄입니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: composition root는 구체 구현을 조립하고 공유·요청별 자원의 수명과 종료 순서를 정하는 제한된 위치입니다.

## 더 파고들 거리

- [기본 상황과 비교: 알림 채널마다 로깅·재시도 기능을 조합하다 보니 하위 클래스가 계속 늘어납니다. 어떤 책임을 분리하고 상속과 조합 중 무엇을 선택하나요?](/tech-interview/questions/inheritance-composition/)
