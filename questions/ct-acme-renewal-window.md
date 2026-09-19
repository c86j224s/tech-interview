---
id: ct-acme-renewal-window
title: ACME 인증서 자동 갱신을 어떤 수명 창과 실패 경로로 운영하나요?
difficulty: 중하
category: 보안
tags:
  - ACME
  - 인증서
  - 갱신
related:
  - tls-certificate-validation
---
# ACME 인증서 자동 갱신을 어떤 수명 창과 실패 경로로 운영하나요?

## 구두 답변

ACME 갱신은 만료일만 보고 cron을 돌리는 일이 아니라 `order 생성 → authorization challenge → finalize/발급 → 다운로드 → 모든 진입점 배포 → reload → 실제 handshake`를 각각 관찰하는 lifecycle로 운영하겠습니다. 충분한 창은 CA의 유효 기간·rate limit, challenge와 DNS 전파 지연, 배포·롤백 시간, 장애 대응 시간을 합쳐 정하고 여기서 임의의 고정 일수를 보편 규칙처럼 말하지 않겠습니다.

HTTP-01을 쓰면 모든 CDN·LB 경로가 challenge URL을 올바른 응답으로 라우팅하는지, DNS-01을 쓰면 자동화 계정이 필요한 zone과 TXT record만 변경하는지 확인합니다. authorization이 valid가 된 것은 인증서가 서비스에 로드됐다는 뜻이 아닙니다. 새 인증서를 내려받은 뒤 각 region과 장기 실행 worker의 secret version, 프로세스 reload, 외부 합성 probe에서 hostname·체인·만료를 확인해야 완료입니다.

실패 경로에서는 nonce 거절, challenge 전파 지연, CA 오류, 비밀 저장소·배포·reload 실패를 서로 다른 상태로 남기고 backoff와 최대 retry를 둡니다. 만료가 임박하면 새 order를 무한히 만들기보다 이미 발급된 artifact의 배포와 재개 가능성을 조사합니다. 키 유출 긴급 대응은 정상 중첩 교체와 다르므로 구 인증서를 가용성 때문에 계속 허용할지, 연결 drain·session ticket·재인증을 어떻게 할지 별도 승인과 검증 기준으로 둡니다.


시간축 상태를 예로 들면 `t0 renew_due`, `t1 order_created`, `t2 authorization_valid`, `t3 finalized`, `t4 cert-v8 downloaded`까지는 발급 단계입니다. t5에 서울 LB 배포가 성공했지만 부산 LB reload가 실패했다면 운영 상태는 부분 배포이며, 새 order를 만드는 대신 cert-v8 artifact와 부산 작업을 재개합니다. ACME nonce가 거절되면 새 replay nonce를 받아 해당 요청만 유한하게 재시도하고, HTTP-01 route나 DNS 전파가 실패하면 challenge 상태를 원인으로 기록합니다. 만료까지 남은 시간이 10일이어도 CA rate limit과 배포 관찰에 2일이 필요한 서비스라면 retry budget을 남겨야 합니다. 인증서 다운로드 성공 이벤트만으로 handshake 완료를 선언하지 않고 각 LB의 hostname·chain·notAfter를 외부 probe로 확인합니다. CA별 renewal window와 rate limit은 RFC 8555가 이 서비스에 고정해 주는 값이 아니므로 선택한 CA 문서를 추가로 버전 고정해야 하며, 아래 trace는 실제 발급 실행이 아닌 운영 설계입니다.

## 득점 포인트

- ACME issuance와 실제 서비스 적용을 상태로 분리한다.
- challenge 종류별 control plane과 권한을 설명한다.
- 배포·reload·handshake를 갱신 완료 조건에 포함한다.

## 감점 포인트

- CA가 인증서를 발급했으니 모든 LB가 갱신됐다고 한다.
- 만료 직전에만 시작하고 실패 재시도 정책을 두지 않는다.

## 더 파고들 거리

- 갱신 job의 retry가 CA rate limit과 DNS 전파에 미치는 영향을 어떻게 측정할까요?
- 기존 연결과 TLS session resumption을 긴급 키 교체에서 어떻게 다룰까요?
