---
id: dnssec-ds-dnskey-chain
title: 부모 zone의 DS 레코드와 자식 zone의 DNSKEY는 DNSSEC 신뢰 사슬에서 어떤 역할을 하나요?
difficulty: 하
category: 네트워크
tags:
  - DNSSEC
  - DS
  - DNSKEY
  - trust anchor
related: []
---
# 부모 zone의 DS 레코드와 자식 zone의 DNSKEY는 DNSSEC 신뢰 사슬에서 어떤 역할을 하나요?

## 구두 답변

DS는 부모 zone의 delegation 지점에 저장된 child DNSKEY digest이고, DNSKEY는 자식 zone이 공개하는 검증 키입니다. validator는 미리 신뢰한 root anchor/root DNSKEY로 부모가 서명한 `.com DS`를 검증하고, 일치하는 `.com DNSKEY`로 그 zone의 다음 delegation을 확인합니다. 이어 `.com`이 서명한 `example.com DS`를 읽어 자식 DNSKEY의 digest를 비교한 뒤, 일치한 `example.com DNSKEY`로 `www.example.com` RRset의 RRSIG를 검증합니다. 따라서 chain은 `root anchor → root-authenticated .com DS → .com DNSKEY → .com-authenticated example.com DS → example.com DNSKEY → data RRSIG` 순서입니다.

RFC 4033의 일반 형태인 `DNSKEY → [DS → DNSKEY]* → RRset`처럼 DS는 부모에, child DNSKEY는 자식에 있습니다. 자식이 DNSKEY를 게시하고 자기 DNSKEY RRset을 서명했다는 사실은 키의 내부 일관성을 보여주지만, 부모 DS와 digest가 맞지 않으면 외부 trust chain은 완성되지 않습니다.

예를 들어 `example.com DS`가 K2를 가리키는데 자식이 K3만 반환하면 digest 비교 단계에서 중단합니다. K2가 맞더라도 데이터 RRSIG가 만료되거나 A RRset이 바뀌면 마지막 서명 검증에서 실패합니다. 반대로 부모가 DS 부재를 서명된 NSEC로 증명한 위임은 secure delegation 불일치와 구분해 insecure 상태로 판단합니다.


실패 원인을 관찰할 때는 DS 자체의 부재, DS는 있지만 digest가 맞지 않는 경우, DNSKEY는 맞지만 RRSIG가 만료된 경우를 나눕니다. 첫 번째는 부모가 insecure delegation임을 증명한 상태일 수 있지만, 두 번째와 세 번째는 secure chain에서 bogus가 될 수 있습니다. 이 구분이 있어야 key rollover 중 일시적 불일치와 공격·설정 오류를 같은 장애로 처리하지 않습니다.
## 득점 포인트

- DS가 부모 delegation에 저장된 child DNSKEY digest라는 점과 DNSKEY가 자식 공개 키라는 점을 구분합니다.
- `root → .com DS → .com DNSKEY → example DS → example DNSKEY → RRset RRSIG`의 부모-자식 순서를 정확히 추적합니다.
- DS/DNSKEY 불일치, RRSIG 만료, 서명된 DS 부재를 서로 다른 검증 결과로 나눕니다.

## 감점 포인트

- `root → .com DNSKEY → example.com DS`처럼 DS를 자식 키 다음 단계에 두어 부모 인증 방향을 뒤집습니다.
- DNSKEY가 자기 자신을 서명하면 곧바로 인터넷 전체가 신뢰한다고 설명합니다.
- DS가 부모에 공개 키 전체를 복사한다고 하거나 trust anchor를 DNS 응답에서 자동 획득한다고 말합니다.

## 더 파고들 거리

- DS가 없는 위임의 signed denial과 secure delegation에서 digest가 틀린 bogus를 resolver는 어떻게 구분하나요?
- key-signing key와 zone-signing key를 함께 사용할 때 DNSKEY RRset과 data RRset의 서명 단계를 어떻게 기록하나요?
