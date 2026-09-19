---
id: aead-associated-data-binding
title: 암호화하지 않는 tenant ID를 AEAD associated data에 넣는 이유는 무엇인가요?
difficulty: 하
category: 보안
tags:
  - AEAD
  - AAD
  - 테넌트
related:
  - authentication-vs-authorization
---
# 암호화하지 않는 tenant ID를 AEAD associated data에 넣는 이유는 무엇인가요?

## 구두 답변

tenant ID를 AAD에 넣는 이유는 숨기기 위해서가 아니라 ciphertext가 특정 문맥에 묶였음을 인증하기 위해서입니다. t1에서 `AAD(t1)`로 봉인한 blob을 t2 요청에서 `AAD(t2)`로 열면 바이트가 달라져 tag 검증이 실패합니다. tenant·용도·schema version처럼 라우팅에 필요해 평문으로 남는 값도 평문과 같은 인증 범위에 넣을 수 있습니다.

AAD는 인가를 대체하지 않습니다. 서버는 먼저 인증된 principal이 t2 객체를 읽을 권한이 있는지 검사하고, 실제 객체의 tenant로 canonical bytes를 구성해 open을 호출합니다. `{"tenant":"t1","purpose":"invoice"}`와 key 순서가 바뀐 JSON은 의미가 같아도 bytes가 다를 수 있으므로 필드 순서·UTF-8·숫자 표현·길이 구분을 고정합니다.

복호화 실패 때 평문 일부를 fallback으로 쓰지 않습니다. AAD 불일치는 다른 tenant 이동, serialization mismatch, key 세대 오류일 수 있으므로 외부에는 일반 인증 실패를 주고 내부에는 식별자와 분류만 기록합니다. AAD 성공도 자원 접근 권한 허용을 뜻하지 않는다는 구분이 핵심입니다.

실제 저장 포맷에서는 tenant ID를 요청 body에서 재사용하지 않고, 서버가 조회한 객체의 tenant와 목적 문자열을 함께 정규화합니다. 예를 들어 레코드의 `tenant=t1`, `purpose=invoice`, `version=3`을 길이 구분 방식으로 연결하면 필드 경계가 모호해지지 않습니다. t2 요청이 t1 ciphertext를 제출하면 인가 단계에서 먼저 거절할 수도 있고, 실수로 open까지 도달해도 AAD mismatch로 두 번째 방어가 작동합니다. 어느 단계의 거절인지 관측하되, 암호화 성공을 자원 접근 성공으로 기록하지 않는 것이 중요합니다.

AAD와 인가의 순서를 상태로 말하면 더 분명합니다. 요청 principal이 `t2/user7`로 인증된 뒤 서버가 row를 조회해 실제 소유 tenant가 `t1`임을 확인하면, 가장 먼저 인가 정책에서 거절하고 KMS나 `open()`까지 호출하지 않는 경로가 정상입니다. 조회 경로가 잘못되어 t1 blob이 t2 처리기에 들어가더라도 복호화 측이 신뢰한 기대 문맥 `t2|invoice|v3`로 AAD를 구성하면 태그가 실패합니다. 반대로 blob과 함께 옮겨진 t1 메타데이터만으로 AAD(t1)를 재구성하면 태그는 성공할 수 있으므로, 기대 tenant와 저장 메타데이터의 일치를 별도로 검증해야 합니다. 이 두 방어는 서로 대체 관계가 아니라 비용과 오류 위치가 다른 방어입니다.

## 득점 포인트

- AAD가 암호화되지 않은 문맥을 태그에 결합하는 역할임을 설명한다.
- 복호화 시 의미가 아니라 같은 canonical bytes가 필요하다고 말한다.
- AAD 검증과 자원별 인가를 별도 통제로 둔다.

## 감점 포인트

- AAD가 있으면 tenant 권한 검사를 생략해도 된다고 한다.
- JSON 의미가 같으면 직렬화 바이트가 달라도 tag가 맞는다고 기대한다.

## 더 파고들 거리

- AAD에 schema version을 넣으면 마이그레이션과 key rotation을 어떻게 운영할 것인가?
- serialization 오류와 실제 tenant 이동을 어떤 증적으로 구분할 것인가?
