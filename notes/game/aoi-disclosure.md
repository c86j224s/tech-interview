---
id: aoi-disclosure
title: AOI 공개 정책·증분 경계·Snapshot 순서
topic: 게임 서버
summary: 공간 후보와 필드/이벤트 공개를 나누고 큰 형상 반경·같은 cell 내 거리/시야 변화·hysteresis·생성/증분/삭제 세대·재동기화·송신 budget을 설명합니다.
questionIds: [aoi-interest-management, aoi-incremental-boundary-check, aoi-large-object-candidates]
---

# AOI 공개 정책·증분 경계·Snapshot 순서

이 노트는 AOI를 단순한 거리 필터가 아니라 후보 생성, 관계·권한 판정, 필드별 공개, 버전 있는 전송이 이어지는 상태 수렴 문제로 다룹니다. 공간 index가 후보를 찾는 데 성공해도 공개 권한을 부여한 것은 아니며, 생성·증분·삭제의 세대 순서가 어긋나면 숨겨야 할 상태가 다시 나타날 수 있습니다.

## 근접 객체와 필드별 공개 정책의 분리

위치·외형은 주변에, 체력은 전투 참여자에게, inventory·숨은 목표는 허용 주체에게만 공개할 수 있습니다. **AOI**는 전송 최적화이면서 누가 어느 시점에 무엇을 볼 수 있는지의 규칙입니다. client가 화면에서 숨겨도 이미 받은 비밀을 회수할 수 없습니다.

수신자를 판정할 때 같은 instance인지 구분하고, 거리·시야·지형·팀/파티·전투 관계를 함께 적용합니다. 따라서 가까운 객체라는 이유만으로 모든 필드가 공개되는 것이 아니라, 공개 대상과 필드를 각각 판단합니다. 보상·전투 결과처럼 거리 밖에서도 필요한 event는 위치 최신성 stream과 섞지 않고 별도의 전달·복구 계약으로 보냅니다.

AOI 판정의 선행 조건은 수신자·객체가 동일한 world와 instance에 속하는지, 그리고 필드별 권한의 권위가 어디에 있는지 정하는 것입니다. 공간 후보는 “검토해야 할 객체” 목록일 뿐 허가 목록이 아니며, 한 번 공개된 비밀은 client의 렌더링 상태를 지워도 회수되지 않습니다.

## 공간 Index와 보수적 후보 생성

큰 boss의 중심이 R 밖이어도 형상의 표면이 공개 반경과 닿을 수 있습니다. 중심 index라면 객체 extent를 포함해 query를 확장하거나 AABB 다중 cell 등록·계층 구조를 사용합니다. 여러 cell/level에서 나온 후보는 ID+generation으로 dedup합니다. 이후 정확한 거리 기준점·bounding volume·시야·인가를 검사합니다.

| 단계 | 검사 |
| --- | --- |
| 후보 | 수신 반경+형상 extent·관련 cell/level |
| 관계 | 같은 world·거리·시야·팀 |
| 필드 | 각각의 공개 권한 |
| event | 별도 대상 자격·내구 전달 필요 |
| 송신 | snapshot/version·budget·누락 표시 |

실행 흐름은 `index query → 후보 dedup → 정확한 형상 거리/시야 → 관계 권한 → 필드 선택` 순서입니다. 큰 객체의 중심만 query하면 표면이 반경에 닿는 경계 사례를 누락하므로 extent를 포함한 보수적 후보를 만든 뒤 정확한 검사에서 제거합니다. 이 순서를 바꾸어 index 결과를 곧바로 송신하면 false positive가 정보 공개로 바뀔 수 있습니다.

## Cell 이동 외 AOI 관계 변화

한 cell 안에서 49m→51m로 움직이거나 문이 닫히거나 팀이 바뀌면 수신 집합이 달라집니다. cell crossing은 후보 목록 갱신 계기일 뿐 정밀 관계 변경의 유일한 사건이 아닙니다. 위치·시야 장애물·팀/권한·형상/반경 변경의 영향을 받는 후보를 다시 검사합니다.

작은 world에서 매 tick 전수 AOI를 기준으로 증분 결과를 대조하면 누락을 찾을 수 있습니다. 시야 장애물 변경은 움직이지 않은 두 객체 사이에도 영향을 주므로 의존/영향 영역을 포함합니다.

```diagram
{"title":"후보와 공개 집합의 변화로 메시지를 만듭니다","caption":"화살표는 데이터 흐름입니다. 같은 cell이어도 관계를 다시 검사하며 거리 hysteresis는 비밀 공개를 늘리는 허가가 아닙니다.","rows":[[{"id":"change","label":"위치·시야·팀·반경 변화"}],[{"id":"candidate","label":"보수 공간 후보·영향 관계"}],[{"id":"aoi","label":"현재 필드/event 공개 집합"}],[{"id":"diff","label":"이전 집합과 diff·snapshot/version"}],[{"id":"send","label":"생성·증분·삭제·필수 event"}]],"edges":[{"from":"change","to":"candidate","label":"cell 이동 외 사건 포함"},{"from":"candidate","to":"aoi","label":"정밀 정책"},{"from":"aoi","to":"diff","label":"관계 전이"},{"from":"diff","to":"send","label":"순서·세대 보존"}]}
```

## Hysteresis의 경계 진동 완화와 권한 철회 지연 금지

50m 진입·55m 이탈을 사용하면 몇 cm 왕복 때 생성/삭제 반복을 줄일 수 있습니다. 단, 허용된 표시 범위 안에서만 적용하고 보안상 비공개 전환은 현재 정책에 따라 즉시 차단합니다. teleport는 이전 집합 이탈과 새 집합 진입의 상태 전이를 정의합니다.

## 생성 Snapshot과 증분 적용 순서

예를 들어 객체 generation 4의 기준 version20을 받은 뒤에만 version21 이후 증분을 그 객체에 적용합니다. version19는 stale로 버리고, 아직 기준 snapshot이 없다면 bounded buffer에 보관한 뒤 재요청하거나 resync하는 정책을 사용합니다. 객체 삭제 뒤 도착한 옛 generation 갱신은 버려 객체를 되살리지 않으며, 재접속 때는 현재 AOI snapshot ID와 객체 세대를 기준으로 상태를 수렴시킵니다.

필수/선택 snapshot 필드를 나누면 선택값 미도착을 확정 default로 오해하지 않도록 표현합니다. 위치 stream은 중간 update를 합쳐 최신값으로 갈 수 있어도 보상 event는 같은 방식으로 버릴 수 없습니다.

객체 하나를 `generation=4, snapshot version=20`으로 생성한 뒤 version 21, 22를 적용하는 추적을 기준으로 합니다. 19는 버리고 23이 먼저 오면 snapshot 부재 정책에 따라 보관·재요청·resync 중 하나를 선택해야 합니다. generation 5가 시작된 뒤 generation 4의 늦은 update를 적용하지 않는 조건이 없으면 삭제된 객체가 옛 상태로 되살아납니다.

## Hotspot 송신량과 공개 누락의 동시 관리

객체 중요도·갱신 주기·bytes·queue 상한을 정하고 권위 전투 규칙과 송신 품질 저하를 분리합니다. 경계 왕복·큰 boss·teleport·팀 변경·동적 문·재정렬·늦은 삭제를 전수 기준과 비교합니다. 후보/query 시간·사용자별 p99 bytes·churn·재동기화·미공개 정보 누출을 검사합니다. 이 노트는 AOI 설계이며 실제 multiplayer 전송 실험 결과는 아닙니다.

선택 기준은 후보 계산 비용, 사용자별 송신 budget, 필수 event의 전달 의미를 분리하는 것입니다. 위치 update는 최신값으로 합칠 수 있지만 보상 event는 누락을 허용할 수 없으므로 같은 queue 정책을 적용하지 않습니다. 검증에서는 전수 AOI와 증분 diff의 집합 차이, generation 역전, 권한 철회 지연, 사용자별 p99 bytes를 함께 비교합니다.
