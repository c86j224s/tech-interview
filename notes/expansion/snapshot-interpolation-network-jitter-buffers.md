---
id: snapshot-interpolation-network-jitter-buffers
title: Snapshot 보간·Jitter Buffer
topic: 게임 서버
summary: >-
  권위 서버 snapshot을 즉시 표시하지 않고 지연 버퍼에서 두 시점 사이를 보간해 네트워크 jitter와 late packet을 다루는
  제안입니다.
questionIds: []
prerequisites:
  - datagram-contracts
  - rewind-evidence
  - input-authority
related:
  - datagram-contracts
  - rewind-evidence
  - input-authority
reviewedAt: '2026-09-19'
---
# Snapshot 보간·Jitter Buffer

snapshot interpolation은 패킷을 받은 즉시 화면에 찍는 기능이 아니라, 서버 simulation timeline의 과거 한 지점을 선택해 그 앞뒤 상태를 연결하는 렌더링 정책입니다. 서버가 20Hz로 50ms마다 snapshot을 만들고 도착 지연이 흔들린다고 하겠습니다. client가 최신 도착본을 즉시 쓰면 40ms, 80ms 간격이 움직임 속도의 변화처럼 보입니다. 반대로 `renderServerTime = estimatedServerNow - bufferDelay`를 사용하면 arrival time은 보관과 통계에만 남고, 실제 보간 비율은 서버 timestamp 차이로 계산됩니다. 이 결과는 client prediction이나 서버 rewind가 아니므로 충돌·보상·권한 판정에 재사용하지 않습니다.

## 적용 범위

이 장의 대상은 원격 entity의 관찰용 pose입니다. 입력을 보내고 아직 확정되지 않은 로컬 캐릭터를 되돌려 맞추는 reconciliation, 과거 tick hitbox로 명중을 판정하는 rewind, 내구성이 필요한 destroy·보상 event는 별도 계약입니다. 이 경계를 먼저 선언해야 buffer가 길어졌다는 이유로 전투 판정을 150ms 뒤 화면 위치에 맞추는 실수가 생기지 않습니다.

## 시간축 정렬

snapshot에는 `serverTick` 또는 simulation timestamp, sequence, world/connection epoch, entity generation을 넣습니다. 서버가 `S100(t=5.000,x=10)`, `S101(t=5.050,x=12)`를 만들고 각각 5.034초와 5.081초에 도착해도 simulation 간격은 50ms입니다. 렌더 시각이 5.025이면 두 sample을 확보한 뒤 `α=(5.025-5.000)/(5.050-5.000)=0.5`, `x=10+(12-10)*0.5=11`입니다. arrival 간격 47ms를 분모로 쓰지 않습니다. 서버-클라이언트 clock mapping의 offset과 drift가 크면 보간보다 먼저 추정 오차를 상한 안으로 관리해야 합니다.

## 버퍼 선택

bufferDelay는 late sample을 기다리는 여유와 화면 지연의 교환점입니다. snapshot 주기가 50ms이고 한 방향 arrival delay p95가 48ms라면 30ms buffer는 burst마다 다음 sample이 비어 gap을 낼 수 있습니다. 100ms로 늘리면 대기 여유는 커지지만 서버에서 방금 바뀐 문이 최대 약 70ms 더 늦게 보일 수 있습니다. 이것은 원격 표시 지연의 차이지 로컬 입력 반응이 70ms 둔해진다는 뜻은 아닙니다. 운영 지표는 gap 비율, extrapolation 누적시간, p95/p99 표시 지연, correction 크기, 연결별 메모리입니다. 평균 RTT만으로 값을 고정하지 않습니다.

## 샘플 보간

위치가 연속 이동이라는 계약일 때만 `p=(1-α)p0+αp1`을 적용합니다. 회전은 Euler 차이를 직접 빼지 않고 quaternion 내적의 부호로 짧은 경로를 선택한 뒤 slerp하고 결과를 정규화합니다. 359도에서 1도로 바뀌는 회전을 단순 차분하면 358도 회전이 되지만, shortest-path 규칙은 2도 경로를 선택합니다. pose·stance·velocity가 서로 다른 sequence에서 섞이지 않도록 sample 단위로 version을 검사합니다.

## 결측과 외삽

앞뒤 sample이 모두 있으면 보간하고, 앞 sample만 있으면 대기·정지·짧은 외삽 중 정책을 택합니다. `maxExtrapolation=50ms`이고 100ms 동안 snapshot이 없으면 마지막 속도를 50ms까지만 표시용으로 연장하고 나머지는 stale 또는 fade로 전환합니다. 외삽은 서버 확정이 아니며 가속·충돌·방향전환을 모르는 `p=p0+v*t`는 장시간 손실에서 벽을 통과한 뒤 큰 correction을 만듭니다. entity 종류별 허용 window를 다르게 둘 수 있지만, 그 결과를 authoritative state로 승격하지 않습니다.

## 생명주기 불연속

spawn은 새 generation의 full create를 받은 뒤 그 sample부터 보간해야 합니다. destroy marker가 있는 sample을 위치와 섞어 마지막 좌표에서 유령을 남기지 않고 lifecycle event를 먼저 반영합니다. teleport, respawn, portal, 문 개폐로 hitbox가 바뀌는 사건은 discontinuity marker로 segment를 끊습니다. `x=10`에서 `x=1000`으로 teleport한 두 sample을 50% 보간하면 505라는 허구의 위치와 벽을 관통하는 궤적이 생깁니다. marker 뒤 새 pose로 즉시 전환하거나 별도 효과를 표시하며, 이전 generation sample과 연결하지 않습니다.

## 구현 추적

```diagram
{"title":"서버 시간과 lifecycle 경계를 보존하는 보간","caption":"도착 순서가 흔들려도 timestamp로 bracket하고, 불연속 event는 일반 위치 보간을 끊습니다.","rows":[[{"id":"server","label":"서버 timeline","detail":["S100 5.000 x=10","S101 5.050 x=12"]}],[{"id":"buffer","label":"정렬 buffer","detail":["sequence 검사","arrival은 통계"]}],[{"id":"render","label":"렌더 시각","detail":["server now-delay","두 sample bracket"]}],[{"id":"life","label":"lifecycle 경계","detail":["spawn·destroy·teleport","segment 중단"]}]],"edges":[{"from":"server","to":"buffer","label":"timestamp·sequence"},{"from":"buffer","to":"render","label":"앞뒤 sample 선택"},{"from":"render","to":"life","label":"불연속이면 전환"}]}
```

자료구조는 연결별 정렬 ring buffer와 entity별 `currentGeneration`, `previous`, `next`, `lastAuthoritative`, `discontinuity`를 분리합니다. 오래된 sequence는 폐기하고, 높은 sequence라도 delta dependency나 spawn baseline이 없으면 적용하지 않습니다. 설명용 trace로 `S100→S102`가 먼저 구성되고 `S101`이 늦게 오면 전체 snapshot은 정책상 S100·S102를 bracket할 수 있지만, S101에 필수 이벤트가 있었다면 gap을 건너뛰지 않고 대기 또는 resync해야 합니다. 실제 네트워크 실험은 하지 않았으므로 이 trace는 예상 결과이며, 검증에서는 burst jitter·loss·reorder·spawn/despawn·teleport별로 선택 sequence와 correction을 기록합니다.

## 비용과 한계

20Hz에서 render delay가 150ms이고 이상적인 `latest=200ms`까지 보려면 50,100,150,200ms 시점처럼 최소 4개의 경계 sample이 필요합니다. 다만 sampling/render convention이 다르면 retained set은 달라지므로 “항상 네 개”를 보편 규칙으로 만들지 않습니다. entity 10,000개에 sample payload 32바이트면 한 시점은 320KB이고 5시점은 단순 payload 1.6MB입니다. ring metadata·allocator·압축 비용은 별도입니다. buffer를 늘리는 선택은 p99 gap이 줄어드는지와 화면 지연 예산이 맞는지 함께 검증할 때만 정당화됩니다.

## 참고 자료와 확인 범위

저장소 `notes/networking/datagram-contracts.md`는 최신 snapshot과 순서가 필요한 명령의 전달 계약을 구분하고, `notes/game/rewind-evidence.md`는 보간 상태와 판정용 tick history를 분리합니다. 읽을 수 있는 교육용 참고는 https://gafferongames.com/post/snapshot_interpolation/ (2026-09-19 확인)이며 sequence 기반 stale discard, buffering의 latency/smoothness trade-off, loss·jitter 흡수, extrapolation 한계를 확인하는 데 사용했습니다. 이 글의 350ms·50–250ms 같은 경험칙은 제품 기본값이나 표준으로 일반화하지 않습니다. Valve 문서는 challenge HTML만 반환되어 특정 엔진 기본값의 근거로 사용하지 않았습니다.
