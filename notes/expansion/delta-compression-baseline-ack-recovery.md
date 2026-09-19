---
id: delta-compression-baseline-ack-recovery
title: Delta Compression 기준 Snapshot·ACK 복구
topic: 게임 서버
summary: >-
  전체 snapshot 대신 확인된 baseline과 현재 상태의 차이를 보내고, ACK 유실·순서 역전·baseline 부재 시 full
  snapshot으로 복구하는 지식 장입니다.
questionIds: []
prerequisites:
  - datagram-contracts
  - event-stream-recovery
  - wire-format
related:
  - datagram-contracts
  - event-stream-recovery
reviewedAt: '2026-09-19'
---
# Delta Compression 기준 Snapshot·ACK 복구

delta의 기준은 “마지막으로 전송한 상태”가 아니라 수신자가 canonical state로 설치했다고 애플리케이션 계층에서 확인한 baseline입니다. sender가 S10을 보냈다는 사실은 packet loss나 ACK loss 뒤에도 receiver가 S10을 갖고 있다는 증거가 아닙니다. `base=B8,target=S12,schema=3,epoch=e4`처럼 복원 입력을 wire에 넣고, base가 없으면 payload를 현재 값에 대충 합치지 말고 bounded wait 또는 full resync로 경계를 닫습니다.

## Delta 의미

RFC 3284는 source window에서 target window를 복원하는 VCDIFF 형식을 정의합니다. 원문은 target window가 source 또는 target 앞부분에서 얻은 source segment를 참조하고 decoder가 그 데이터를 알고 있어야 한다고 설명합니다. 이것은 게임 baseline의 “source를 실제로 보유해야 한다”는 원리를 뒷받침하지만 게임 ACK·재전송·entity 수명 정책을 정하지 않습니다. field-aware delta를 쓰더라도 직렬화 byte, schema, endian, generation이 동일해야 canonical reconstruction이 가능합니다.

## Baseline 확인

connection 상태를 `confirmed=B8`, `pending={S10,S11}`처럼 분리합니다. receiver가 B8을 검증·설치한 뒤 `applicationAck(B8)`를 보내면 B8 기반 delta를 허용합니다. transport ACK만으로는 소켓이 packet을 받았다는 사실만 알 수 있으므로, state 설치 완료 ACK와 구분해야 합니다. sender가 ACK를 놓쳤지만 receiver가 B8을 가진 경우에는 control exchange로 보유 ID와 schema를 재확인할 수 있습니다. 확인 전까지는 더 오래된 confirmed baseline을 사용하거나 full snapshot을 선택합니다.

## 보류와 전송

`S10`을 마지막으로 보냈어도 ACK가 없고 B8만 확인됐다면 `D12(base=B8,target=S12)`는 복원 가능한 독립 delta일 때만 안전합니다. `D12(base=S10)`은 S10 설치가 증명되지 않았으므로 보내지 않습니다. 각 pending record에는 target ID, base ID, bytes, first-sent time, retry count를 둡니다. 같은 target이 중복 도착하면 이미 설치한 target의 ACK를 재전송해 멱등성을 유지하고, 다른 schema나 epoch는 부분 적용 없이 거절합니다.

## 순서 의존성

target sequence의 크기와 dependency 만족 여부는 별개입니다. 현재 B8일 때 D10(base=B8) 후 D12(base=S10)이 오면 S10을 설치한 다음 S12를 복원할 수 있습니다. D12가 먼저 오면 base S10이 없으므로 bounded pending에 둡니다. 반대로 D11(base=B8)이 늦게 도착해 current가 S12라면 독립 full-like delta인지 chained patch인지에 따라 다릅니다. chained patch라면 늦은 D11을 stale로 버립니다. 독립 delta라면 B8에서 canonical S11을 재구성할 수 있지만 현재 S12를 덮어쓸지 여부는 target ordering 계약이 허용할 때만 atomic replacement로 처리합니다. 현재 S12에 partial patch를 merge하는 것은 금지합니다.

## 필드 의미

field mask가 health를 포함하고 payload가 0이면 명시적 `health=0`입니다. mask에 health가 없으면 B8의 health를 유지합니다. `{health:80,ammo:3}`에 `mask=health,value=0`을 적용한 결과는 `{health:0,ammo:3}`이고, `mask=ammo,value=0`이면 `{health:80,ammo:0}`입니다. 빈 문자열·false·null도 값일 수 있습니다. mask 길이, unknown bit, payload length, type/version을 검증하고 full snapshot의 생략 의미와 partial delta의 unchanged 의미를 message kind로 분리합니다.

## 복구 경계

pending age, total bytes, retry count, decoder error를 상한으로 둡니다. 예를 들어 S20 ACK가 없고 pending이 2MB를 넘으면 S21을 무한 누적하지 않고 resync token을 발급합니다. full snapshot에는 새 snapshot ID, schema, entity generation, 공개 field set을 넣고 설치 완료 뒤 새 baseline ACK를 받습니다. `resetBefore=S23` 또는 stream epoch로 old delta가 full state 뒤에 덮이지 않게 합니다. AOI 재진입 entity는 과거 delta를 재생하기보다 현재 full create를 보내는 것이 baseline과 공개 경계를 단순하게 만듭니다.

## 처리 도식

```diagram
{"title":"확인된 baseline과 복구 경계","caption":"송신 기록과 수신 설치를 분리하고, 의존성을 만족하지 못하면 제한된 보관 뒤 full resync로 전환합니다.","rows":[[{"id":"current","label":"현재 target","detail":["S12 canonical","schema·epoch 포함"]}],[{"id":"confirmed","label":"ACK baseline","detail":["B8 설치 확인","decoder source"]}],[{"id":"delta","label":"검증 delta","detail":["B8→S12","mask·length 검사"]}],[{"id":"recover","label":"resync 경계","detail":["age·bytes 상한","새 baseline ACK"]}]],"edges":[{"from":"current","to":"delta","label":"target 생성"},{"from":"confirmed","to":"delta","label":"복원 source"},{"from":"delta","to":"recover","label":"base 불일치·만료"}]}
```

## 구현 추적

설명용 예상 trace는 다음과 같습니다.

```text
receiver: installed=B8, confirmed=B8, pending=0
D10(base=B8,target=S10) -> install S10, applicationAck(S10)
D12(base=S10,target=S12) -> install S12, applicationAck(S12)
D11(base=B8,target=S11) -> stale target, drop
D14(base=S13,target=S14) -> missing base, bounded wait then resync
```

시험에서는 transport ACK만 받은 경우, application ACK 유실, duplicate, D12 선행, schema mismatch, generation 교체, sequence wrap을 나눠 canonical state와 pending bytes를 비교합니다. RFC 3284를 읽고도 게임 ACK 정책을 표준의 보장으로 오해하지 않습니다. 실제 게임 transport 실행은 하지 않았고 위는 설계 trace입니다.

## 비용과 한계

delta는 위치가 매 tick 바뀌거나 spawn이 몰릴 때 full보다 작지 않을 수 있습니다. per-connection baseline과 pending 보관은 메모리와 CPU를 늘리지만 AOI별 공개 필드가 다른 client를 안전하게 분리합니다. 선택 지표는 bytes 절감률 하나가 아니라 p99 decode 시간, pending 상한 초과율, resync bytes, reconnect 수렴 시간, baseline 부재 오류율입니다. 무한 chain은 압축률보다 장애 복구 지연이 커지므로 bounded state가 우선입니다.

## 참고 자료와 확인 범위

https://www.rfc-editor.org/rfc/rfc3284 (RFC 3284 full text, 2026-09-19 확인)의 source/target window와 decoder source 요구를 근거로 삼았습니다. RFC는 게임 ACK나 재전송을 정의하지 않습니다. 저장소 `notes/networking/wire-format.md`는 field boundary와 golden vector 검증, `notes/networking/datagram-contracts.md`는 최신 snapshot과 순서 의존 command의 분리를 다루며, `notes/networking/event-stream-recovery.md`는 snapshot+cursor 복구의 인접 원칙을 제공합니다.
