---
id: "protobuf-field-number-reservation"
title: "protobuf 필드를 삭제한 뒤 같은 번호를 다른 의미로 재사용하면 과거 메시지와 어떤 충돌이 생기나요?"
difficulty: "중하"
category: "설계"
tags: ["API","호환성","프로토콜","심화 질문"]
related: ["api-backward-compatibility","db-online-schema-migration"]
promotedFrom: {"id":"api-backward-compatibility","prompt":"프로토콜 버퍼 필드 번호 재사용은 왜 위험할까요?"}
---

# protobuf 필드를 삭제한 뒤 같은 번호를 다른 의미로 재사용하면 과거 메시지와 어떤 충돌이 생기나요?

## 구두 답변

protobuf의 필드 번호는 wire 데이터에서 필드를 식별합니다. 삭제한 번호를 새 의미로 쓰면 오래된 저장 메시지나 구버전 sender의 값을 새 필드로 잘못 해석할 수 있습니다.

삭제한 번호와 필요하면 이름을 reserved로 남기고 새 의미에는 새 번호를 사용합니다. wire type이 같아 파싱이 성공하는 변경도 단위·업무 의미는 깨질 수 있습니다. JSON 변환의 필드 이름과 unknown field·enum 처리도 별도로 시험합니다.

## 득점 포인트

- protobuf의 필드 번호는 wire 데이터에서 필드를 식별합니다. 삭제한 번호를 새 의미로 쓰면 오래된 저장 메시지나 구버전 sender의 값을 새 필드로 잘못 해석할 수 있습니다.
- JSON 변환의 필드 이름과 unknown field·enum 처리도 별도로 시험합니다.

## 감점 포인트

- 다음 핵심 구분을 반대로 설명하거나 성립 조건을 생략한다: protobuf의 필드 번호는 wire 데이터에서 필드를 식별합니다.

## 더 파고들 거리

- [기본 상황과 비교: 서버의 JSON 응답에 필드나 상태 값을 추가하려 합니다. 업데이트하지 않은 모바일 앱이 왜 실패할 수 있으며 어떻게 검증하나요?](/tech-interview/questions/api-backward-compatibility/)
