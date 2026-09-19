---
id: threat-modeling-stride-boundaries
title: 자산·신뢰 경계·STRIDE 위협 모델링
topic: 보안
summary: 자산과 trust boundary를 먼저 고정하고 STRIDE를 경계별 위협·완화·검증 항목으로 바꾸는 방법입니다.
questionIds: []
prerequisites:
  - security-foundations
related:
  - authentication
  - input-object-boundary
  - workload-policy
reviewedAt: '2026-09-19'
---
# 자산·신뢰 경계·STRIDE 위협 모델링

## 모델링의 출발점과 산출물

위협 모델링은 취약점 목록을 많이 적는 일이 아니라, 보호해야 할 자산이 어떤 흐름을 거쳐 누구의 통제 아래 놓이는지 고정하고 설계 선택을 시험 가능한 주장으로 바꾸는 작업입니다. 결제 시스템이라면 브라우저가 주문 결제를 요청하고 API가 provider의 결과를 반영해 주문과 원장을 갱신한다는 목적을 먼저 적습니다. 그 다음 자산을 기술 요소가 아니라 손실의 단위로 나눕니다. 카드 원문 대신 provider token, 환불 권한, 주문 상태, 원장 무결성, 개인정보, 감사 증적이 서로 다른 자산입니다.

자산마다 소유자와 손실 결과를 붙이면 우선순위가 달라집니다. token 유출은 기밀성과 규제 문제지만, 환불 권한 변조는 금전 손실입니다. 같은 DB에 저장된다고 보호 목표가 같아지는 것은 아닙니다. 결과물은 자산 목록, data-flow diagram(DFD), trust boundary, 위협-완화-검증 추적표입니다. 그래야 “인증을 넣었다”가 아니라 “공격 입력에서 어떤 거절과 불변 상태가 관찰되는가”를 말할 수 있습니다.

## 자산과 책임 주체의 분리

자산 표에는 값의 이름뿐 아니라 생성·사용·변경·폐기 권한을 씁니다. 환불 요청이 브라우저에서 시작돼도 환불 권한의 근거는 브라우저가 아닙니다. 서버가 검증한 주체, 주문의 현재 상태, provider의 권위 상태가 함께 있어야 합니다. 요청 JSON의 `tenant_id`나 `role`은 신원의 증명이 아닙니다. 주체·행동·대상을 서버 문맥에서 구성하고 대상 조회와 조건부 갱신에 다시 남겨야 합니다.

자산 분류는 기밀성으로 끝나지 않습니다. 원장 정확성은 무결성, webhook inbox는 가용성과 재처리 가능성, 감사 로그는 부인 방지의 증적이면서 개인정보 자산입니다. 각 자산에 누가 잃는지, 잘못된 결과가 무엇인지, 복구 가능한지를 적으면 STRIDE 태그가 피해와 연결됩니다.

## DFD와 신뢰 경계

DFD에서 process, data store, data flow를 구분하고 서로 다른 권한·운영자·프로토콜·실패 가정이 만나는 곳에 경계를 둡니다. 브라우저와 API, API와 외부 provider, worker와 원장 DB가 다른 경계입니다. provider가 HTTPS를 사용해도 provider의 금액과 주문 ID가 올바르다는 뜻은 아닙니다. API가 응답을 받았다는 사실도 내부 상태 변경 권한을 주지 않습니다.

provider를 추가할 때는 API 옆에 이름만 붙이지 말고 승인 요청, 브라우저 callback, 서버 webhook을 별도 flow로 그립니다. response body, 서명 헤더, timestamp, event ID, 환불 상태가 어느 경계에서 검증되는지 표시합니다. callback은 브라우저 거래 결과이고 webhook은 비동기 서버 이벤트라 재시도와 부수 효과가 다릅니다.

```diagram
{"title":"결제 흐름의 신뢰 경계와 자산","caption":"외부 provider 응답은 서명 검증과 상태 규칙을 지난 뒤에만 내부 원장 변경으로 이어집니다.","rows":[[{"id":"browser","label":"브라우저","detail":["주문·환불 요청"]}],[{"id":"api","label":"결제 API","detail":["주체·권한·원문 검증"]},{"id":"provider","label":"외부 provider","detail":["결제 권위 상태"]}],[{"id":"inbox","label":"Webhook inbox","detail":["event ID·원문"]}],[{"id":"ledger","label":"주문·원장 DB","detail":["금액·상태 무결성"]}]],"edges":[{"from":"browser","to":"api","label":"user input 경계"},{"from":"api","to":"provider","label":"승인 요청"},{"from":"provider","to":"api","label":"callback·webhook"},{"from":"api","to":"inbox","label":"서명 후 접수"},{"from":"inbox","to":"ledger","label":"멱등 변경"}]}
```

provider 메시지가 진짜로 서명됐어도 현재 주문과 대응하는지, 처리된 ID인지, 상태 전이가 허용되는지 다시 확인합니다. 내부 worker도 모든 업무를 할 수 있는 주체가 아니라 해당 inbox 이벤트가 허용한 좁은 변경만 실행하게 합니다.

## STRIDE 적용과 공격 질문

Microsoft Threat Modeling Tool 문서는 STRIDE를 위협 범주를 정리하는 모델로 설명합니다. Spoofing(가장), Tampering(변조), Repudiation(부인), Information Disclosure(정보 노출), Denial of Service(서비스 거부), Elevation of Privilege(권한 상승)입니다. 범주를 외우기보다 DFD의 요소와 flow마다 질문을 붙입니다.

- 브라우저가 다른 사용자를 가장해 환불할 수 있는가? 세션 탈취와 권한 상승을 함께 봅니다.
- provider 응답의 금액·상태가 변조되면 어떤 서명이 깨지는가? 원문 검증은 tampering 완화입니다.
- 누가 언제 환불을 승인했는지 재구성할 증적이 있는가? 감사 로그와 승인 문맥은 repudiation 대응입니다.
- webhook 원문·token·관리자 export가 잘못된 주체에게 보이는가? 최소 응답과 접근 통제는 disclosure를 줄입니다.
- 큰 body와 비싼 검증으로 inbox가 고갈되는가? 크기·시간·큐 예산은 DoS 대응입니다.
- 일반 사용자가 관리자 환불 API에 도달하는가? action·tenant·대상 상태 재검사는 elevation 대응입니다.

한 요소에 하나의 태그만 붙일 필요는 없습니다. 다른 tenant 주문 ID는 elevation, 응답에서 주문 존재를 노출하는 것은 disclosure가 될 수 있습니다. 다만 태그가 늘수록 공격 경로와 자산을 구체화해야 하며 “여섯 개 완료” 체크박스로 끝내지 않습니다.

## 완화책을 검증 가능한 요구로 변환

완화책은 “인증 추가”보다 구체적이어야 합니다. `T-EOP-01: T1 일반 사용자가 T2 주문 환불을 요청`처럼 공격 입력과 보호 자산을 적습니다. 기대 결과는 거절 응답, 원장 행 불변, 최소 감사 증적입니다. 실제 403 또는 404는 존재 은닉 정책에 따라 고정해야 합니다.

| 위협 | 보호 자산 | 완화 | 검증 증거 |
| --- | --- | --- | --- |
| 다른 tenant 환불 | 원장·환불 권한 | tenant 조건부 갱신 | T1→T2에서 0행, 원장 불변 |
| webhook 변조 | 주문 상태 | 원문 서명·시간·ID | 1바이트 변경은 inbox 미기록 |
| 관리자 export 노출 | 개인정보 | 범위·승인·필드 제한 | 승인 없이는 민감 필드 없음 |
| webhook flood | inbox 가용성 | body·시간·큐 예산 | 제한 초과 bounded failure |

정상·변조·재생·경계 밖 tenant·권한 회수·DB 경합을 각각 실행하고 최종 자산 상태를 검사해야 합니다. 완화가 있어도 API, batch worker, 관리자 도구, 복구 스크립트가 PEP를 우회하면 위험은 남습니다.

## 변경 영향과 잔여 위험

새 provider, export 기능, worker를 추가하면 DFD를 다시 계산합니다. 민감 데이터가 외부로 나가는지, 외부 응답이 권위 상태로 승격되는지, 키·로그·rate limit 가정을 깨는지 변경 전후 diff로 봅니다.

잔여 위험은 완화가 있다는 이유로 0이 되지 않습니다. 공격 가능성, 영향 규모, 탐지 가능성, 복구 시간과 비용을 함께 비교합니다. 관리자 export에 승인과 감사 로그를 둬도 계정 탈취 위험은 남습니다. 범위·승인 만료·즉시 회수·사후 대사를 정하고 수용 주체와 재검토 조건을 기록합니다.

## 운영 증적과 한계

위협 ID와 로그·알람·시험 케이스를 연결합니다. 민감한 token 원문 대신 trace ID, key version, event ID 해시, 정책 결과를 남깁니다. 이 장의 provider 사례는 실제 결제망 실행 결과가 아니라 설계 예입니다. Microsoft 본문에서 STRIDE 범주를 확인했지만 provider의 서명 형식·재시도·SLA는 확정하지 않았습니다. STRIDE는 우선순위표나 완화의 자동 증명이 아니며 자산 영향과 시험 결과가 필요합니다.

## 참고 자료와 검증 범위

- [Microsoft Threats - Threat Modeling Tool](https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats) — 2026-09-19 본문 확인. STRIDE 범주와 분류 목적.
- 기존 노트 [인증된 요청의 자원별 권한 검사](/tech-interview/notes/authentication/) — 주체·행동·대상과 조건부 갱신을 대조.
- 기존 노트 [Webhook 서명 검증과 내구 접수·중복 처리](/tech-interview/notes/webhook-intake/) — 원문·inbox·중복 경계를 대조.
