---
id: "nats-account-import-export-trust"
title: "NATS account 사이 import·export를 구성합니다. 방향·subject·권한을 어떤 최소 범위로 제한하나요?"
difficulty: "중하"
category: "보안"
tags: ["NATS","subject","권한","심화 질문"]
related: ["nats-subject-isolation","nats-subject-queue-group","authentication-vs-authorization"]
promotedFrom: {"id":"nats-subject-isolation","prompt":"account 간 import/export가 만드는 방향성 신뢰를 어떤 최소 subject로 제한할까요?"}
---

# NATS account 사이 import·export를 구성합니다. 방향·subject·권한을 어떤 최소 범위로 제한하나요?

## 구두 답변

export는 제공할 subject·서비스 범위를, import는 다른 account의 어떤 기능을 가져올지 정합니다. 방향성 신뢰와 publish·subscribe 권한을 최소 범위로 유지합니다.

광범위 wildcard를 주면 이름에 tenant를 넣어도 격리가 약해질 수 있습니다. reply inbox의 제한·수명·계정 매핑도 검사합니다. 정책 갱신·기존 연결·다른 account 접근을 실제 구성에서 시험합니다.

## 득점 포인트

- export는 제공할 subject·서비스 범위를, import는 다른 account의 어떤 기능을 가져올지 정합니다. 방향성 신뢰와 publish·subscribe 권한을 최소 범위로 유지합니다.
- 정책 갱신·기존 연결·다른 account 접근을 실제 구성에서 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: export는 제공할 subject·서비스 범위를, import는 다른 account의 어떤 기능을 가져올지 정합니다.

## 더 파고들 거리

- [기본 상황과 비교: NATS subject 이름에 tenant와 environment를 넣는 것만으로 메시지가 격리되지 않는 이유와 필요한 인가 설정은 무엇인가요?](/tech-interview/questions/nats-subject-isolation/)
