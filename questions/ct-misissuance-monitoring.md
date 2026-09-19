---
id: ct-misissuance-monitoring
title: CT 로그에서 우리 도메인의 오발급을 어떻게 탐지하나요?
difficulty: 중하
category: 보안
tags:
  - Certificate Transparency
  - 모니터링
  - 오발급
related:
  - certificate-pinning-rotation-recovery
---
# CT 로그에서 우리 도메인의 오발급을 어떻게 탐지하나요?

## 구두 답변

도메인별로 승인된 CA, 정확한 이름·wildcard 범위, 예상 SAN, 공개키 또는 SPKI 정책을 저장하고 CT 관측 결과와 비교하겠습니다. 새로운 leaf에서 issuer·SAN·fingerprint·SPKI가 정책에 맞지 않으면 먼저 “승인된 갱신인데 inventory가 늦은 것인지”와 “실제 미승인 발급인지”를 분류합니다. CT는 사후 가시성을 높이는 장치이므로 알림만으로 이미 발급된 인증서가 무효화된다고 생각하지 않습니다.

예를 들어 `api.example`에 대해 승인된 CA와 두 개의 SPKI만 있는데 `*.example` 또는 낯선 CA 인증서가 보이면, 해당 발급 시각과 로그, ACME account 활동, DNS 변경, 어느 서비스가 이를 제공했는지를 함께 조사합니다. SCT와 로그 조회를 확인하되, 모니터가 모든 로그를 즉시 완전하게 수집한다고 가정하지 않고 수집 지연·로그 목록·중복 알림을 관리합니다. 로그 데이터는 인증서 공개정보 중심으로 저장하고 account key나 private key는 기록하지 않습니다.

대응은 CA 철회 요청, 새 키·인증서 발급과 배포, 기존 키 접근 로그 조사, 영향을 받은 hostname·기간 계산, pinning·mTLS allowlist 영향 확인으로 나눕니다. 오발급 인증서가 실제 서비스에 사용되지 않았어도 노출된 private key가 있는지 확인해야 하고, 사용 중이었다면 연결 drain과 세션 재인증을 검토합니다. 모니터링 정책은 승인 목록이 바뀔 때 함께 갱신하고, 정상 갱신을 오탐으로 만들지 않는 변경 승인 경계를 둡니다.


사건 처리 순서는 수집 지연과 실제 오발급을 먼저 가릅니다. 예를 들어 승인 inventory에는 `api.example`, CA-A, SPKI-1·2만 있는데 새 leaf가 CA-Z, `*.example`, SPKI-9로 관측되면 fingerprint와 log 시각을 저장하고 다른 로그의 재수집으로 누락·지연 여부를 확인합니다. 동시에 승인된 ACME account/order와 DNS 변경을 대조해 정상 갱신인지 분류하고, 실제 LB handshake에서 그 인증서를 제공하는지 조사합니다. 서비스가 제공 중이면 CA 철회 요청과 새 키 발급·배포를 병렬로 준비하되, 철회 완료를 기다리는 동안 영향 hostname과 연결 경로를 제한합니다. private key나 account key는 모니터 데이터에 복사하지 않고 접근 감사만 남깁니다. 수집 지연 때문에 알림이 늦을 수 있고, 철회가 모든 클라이언트에서 즉시 적용된다고도 말할 수 없으므로 키 교체·pinning·mTLS allowlist와 재인증을 별도 상태로 기록합니다. 승인 inventory 변경은 인증서 발급과 원자적으로 갱신하지 않으면 정상 배포가 오탐으로 보일 수 있습니다.

## 득점 포인트

- 승인 CA·SAN·SPKI 정책과 CT 관측을 비교한다.
- 탐지와 철회·키 교체·영향 조사을 별도 단계로 둔다.
- SCT와 모니터 수집 지연의 한계를 설명한다.

## 감점 포인트

- CT 알림만으로 인증서가 즉시 무효화된다고 한다.
- 모든 로그를 실시간·완전하게 본다고 단정한다.

## 더 파고들 거리

- 도메인 inventory와 승인된 ACME account를 어떤 원자적 변경 흐름으로 맞출까요?
- 오탐·누락을 구분하기 위한 모니터러의 재처리와 감사 로그는 무엇일까요?
