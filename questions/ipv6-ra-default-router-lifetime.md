---
id: ipv6-ra-default-router-lifetime
title: IPv6 Router Advertisement의 Router Lifetime이 0이면 prefix 정보도 모두 무효가 되나요?
difficulty: 중하
category: 네트워크
tags:
  - IPv6
  - Router Advertisement
  - default router
  - NDP
related: []
---
# IPv6 Router Advertisement의 Router Lifetime이 0이면 prefix 정보도 모두 무효가 되나요?

## 구두 답변

아닙니다. Router Lifetime 0은 그 RA를 보낸 라우터를 default router 후보에서 제외하라는 의미이지, RA에 함께 담긴 모든 prefix와 configuration 정보를 무효화한다는 뜻은 아닙니다. RFC 4861은 Router Lifetime이 라우터의 default-router 유용성에만 적용되고 다른 message field나 option에는 적용되지 않는다고 명시합니다. 따라서 default route와 Prefix Information Option을 서로 다른 상태로 처리해야 합니다.

예를 들어 RA에 `2001:db8:1::/64` prefix와 Router Lifetime 0이 함께 있다고 하겠습니다. 호스트는 해당 라우터를 기본 경로 목록에 넣지 않지만 prefix option에 적힌 on-link 판단이나 address autoconfiguration 관련 정보는 그 option의 flag와 valid/preferred lifetime에 따라 별도로 평가합니다. prefix의 valid lifetime까지 0인지, A/L flag가 무엇인지, 이미 생성된 주소의 상태가 무엇인지는 Router Lifetime만 보고 결정할 수 없습니다.

실제 자동 설정은 RFC 4862와 운영체제 정책도 관여하므로 “prefix가 반드시 계속 남는다”라고도 단정하지 않겠습니다. 진단할 때는 RA의 Router Lifetime, prefix option의 valid/preferred lifetime, M/O flag, 현재 default route와 주소 상태를 각각 캡처합니다. 그러면 기본 라우터가 사라진 것과 주소·on-link 정보가 만료된 것을 구분할 수 있습니다.

특히 라우터가 기본 경로에서 빠졌다고 해서 그 RA의 prefix가 패킷에서 즉시 삭제되는 것은 아닙니다. 반대로 prefix가 남아 있어도 remote destination을 보낼 default route가 없으면 외부 통신은 실패할 수 있습니다. 두 현상을 같은 route table 한 줄로 기록하지 말고, default-router list와 prefix/address list를 나눠 관찰합니다.

## 득점 포인트

- Router Lifetime과 prefix option lifetime을 독립 필드로 설명합니다.
- 메커니즘의 중간 상태와 실패 경계를 실제 패킷 또는 상태 값으로 설명합니다.

## 감점 포인트

- Lifetime 0을 RA 전체 무효화로 단정하지 않습니다.
- 표준이 정하지 않은 구현 정책을 모든 운영체제의 고정 규칙으로 일반화하지 않습니다.

## 더 파고들 거리

- Router Lifetime만 0인 상태와 prefix valid lifetime 0을 비교해 보세요.
- 정상 관찰과 오류 부재를 구분하는 추가 로그나 캡처 항목을 제시해 보세요.
