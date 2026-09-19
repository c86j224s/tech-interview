---
id: client-indexeddb-transactions
title: IndexedDB 트랜잭션과 버전 업그레이드
topic: 웹·클라이언트
summary: 일반 트랜잭션과 versionchange 업그레이드 잠금·blocked 복구를 분리합니다.
questionIds: []
prerequisites:
  - client-foundations
related:
  - transactions
  - schema-cutover
  - browser-navigation
reviewedAt: '2026-09-19'
---
# IndexedDB 트랜잭션과 버전 업그레이드

IndexedDB에서 레코드 한 건을 바꾸는 작업과 object store 자체를 바꾸는 작업은 같은 잠금으로 설명할 수 없습니다. `readonly`·`readwrite`는 현재 스키마 안에서 요청을 실행하고, `versionchange`는 연결된 다른 탭이 새 스키마를 보지 못한 상태에서 구조를 바꾸는 전환입니다. 따라서 “두 탭이 동시에 파일을 잡았다”보다 연결, 이벤트, 커밋이라는 세 경계를 추적해야 `blocked`와 롤백을 정확히 설명할 수 있습니다.

## 연결·버전 소유권

`indexedDB.open(name, version)`에서 더 높은 버전을 요청하면 브라우저는 일반 트랜잭션을 하나 더 만드는 대신 업그레이드 절차를 시작합니다. 기존 연결은 `versionchange` 통지를 받고, 닫히지 않은 연결이 남아 있으면 업그레이드가 대기합니다. W3C IndexedDB 본문은 이 상황에서 새 요청이 `blocked`를 관찰해 다른 클라이언트가 연결을 붙잡고 있음을 표시하도록 설명합니다. 이 이벤트는 영구 거절이 아니라 연결 종료라는 선행 조건이 아직 충족되지 않았다는 뜻입니다.

## 일반 트랜잭션 수명

일반 트랜잭션은 JavaScript 변수의 수명만큼 유지되지 않습니다. 요청을 만들고 결과 이벤트를 처리하는 활성 구간에는 다음 IDB 요청을 추가할 수 있지만, 이벤트 처리가 끝난 뒤 임의의 타이머나 네트워크 콜백에서 같은 객체를 다시 사용한다고 보장할 수 없습니다. 그래서 `get()` 성공 직후 같은 이벤트 안에서 `put()`하는 코드와 `await fetch()` 뒤 `put()`하는 코드는 서로 다른 계약을 가집니다.

```js
const tx = db.transaction('drafts', 'readwrite');
const req = tx.objectStore('drafts').get(7);
req.onsuccess = () => tx.objectStore('drafts').put({id: 7, text: '수정'});
tx.oncomplete = () => console.log('DB 변경 커밋');
```

여기서 `req.onsuccess`는 한 요청의 성공이지 디스크에 최종 반영됐다는 신호가 아닙니다. 마지막 판단은 `complete`이고, 오류가 전파되거나 `abort()`가 호출되면 `abort`입니다. 안전한 로깅은 요청별 success/error와 트랜잭션 complete/abort를 분리합니다.

## 버전 업그레이드·blocked

A 탭이 버전 3 연결을 열고 B 탭이 버전 4를 요청한다고 합시다. B의 open은 A에 `versionchange`를 보냅니다. A가 `db.close()`하면 B가 `upgradeneeded`로 진입할 수 있지만, A가 편집 화면 때문에 연결을 계속 쓰면 B는 `blocked`에 머뭅니다. 이때 B가 1초마다 open을 재시도해도 A의 연결을 닫지 않는 한 원인은 사라지지 않습니다. A는 새 요청을 받지 않는 상태로 전환하고 미저장 입력을 저장·취소하도록 안내한 뒤 닫아야 합니다.

```diagram
{"title":"업그레이드 대기와 커밋 경계","caption":"기존 연결이 모두 닫혀야 versionchange가 시작되고, 스키마 변경은 최종 커밋까지 잠정 상태입니다.","rows":[[{"id":"open","label":"높은 버전 open","detail":["version 4 요청"]}],[{"id":"notify","label":"기존 연결 통지","detail":["versionchange"]}],[{"id":"close","label":"연결 종료"},{"id":"blocked","label":"연결 잔존","detail":["blocked 대기"]}],[{"id":"upgrade","label":"versionchange 실행","detail":["upgradeneeded"]}],[{"id":"commit","label":"새 버전 커밋"}]],"edges":[{"from":"open","to":"notify","label":"업그레이드 감지"},{"from":"notify","to":"close","label":"협력적 close"},{"from":"notify","to":"blocked","label":"닫지 않음"},{"from":"close","to":"upgrade","label":"선행 조건 충족"},{"from":"upgrade","to":"commit","label":"complete까지 확정"}]}
```

## 활성 구간과 비동기 공백

`readwrite` 안에서 로컬 레코드를 읽고 원격 정책을 기다린 뒤 쓰려는 설계가 흔한 실패입니다. t0에 `get(7)`을 접수하고 t1의 성공 콜백에서 `await fetch()`를 만나면, 이벤트 태스크가 끝난 뒤 트랜잭션이 inactive가 될 수 있습니다. t2에 `put()`을 넣으면 `TransactionInactiveError` 경계가 생깁니다. 이 문서의 trace는 설명용 예상 결과이며, 대상 엔진의 실제 이벤트 로그를 별도로 확인해야 합니다.

해법은 네트워크를 트랜잭션 밖으로 빼는 것입니다. 먼저 `{id:7, version:3, amount:100}`을 읽고, 원격 결과가 도착하면 새 `readwrite` 트랜잭션에서 `version === 3`을 조건으로 다시 읽습니다. 다른 탭이 version 4로 바꿨다면 저장을 중단하고 최신 값을 다시 계산합니다. 이 조건부 검사가 없으면 새 환율을 옛 값 위에 덮는 lost update가 됩니다.

## 원자적 업그레이드·롤백

`onupgradeneeded`에서 `createObjectStore('users')`가 성공한 다음 index 이름 충돌이 발생해 versionchange가 abort되면 첫 번째 store도 중간 상태로 남지 않습니다. 업그레이드 전체가 마지막 커밋 버전으로 돌아가며, 다음 open은 부분 적용을 전제로 하지 않고 이전 `oldVersion`에서 다시 마이그레이션을 실행합니다. 따라서 `upgradeneeded` 진입이나 개별 요청 success를 성공 기준으로 삼으면 안 되고, 새 스키마 사용 허용은 최종 `complete` 뒤로 미뤄야 합니다.

마이그레이션 함수는 각 버전 단계가 재시도 가능하도록 작성합니다. 오류를 처리해 계속 진행할지 기본 abort를 유지할지는 데이터 불변식으로 결정합니다. 큰 레코드 백필은 스키마 cutover와 분리해 먼저 구버전 코드도 읽을 수 있는 필드를 만들고, 이후 짧은 일반 readwrite 작업으로 채우는 편이 upgrade 잠금 시간을 줄입니다.

## 닫힘 통지·복구 절차

`versionchange`를 받은 탭은 자동으로 새 DB가 되지 않습니다. 저장소 접근 계층에 `closing` 상태를 두고 새 요청을 거절하거나 큐에 보류하며, 진행 중 트랜잭션이 `complete` 또는 `abort`로 끝난 뒤 `close()`합니다. close 후 낡은 `IDBDatabase` 객체를 DAO가 계속 사용하지 않도록 연결 세대를 바꿔야 합니다. 자동 새로고침은 폼과 낙관적 화면을 버릴 수 있으므로, 문서가 유휴 상태일 때만 허용하는 것이 안전합니다.

진단에는 open 요청 버전, versionchange 수신 시각, 각 탭의 close 시각, blocked 지속 시간, upgradeneeded 진입, 요청별 error, 최종 complete/abort를 남깁니다. `blocked`가 사라졌다는 사실만으로 사용자 입력 보존이나 스키마 검증이 끝났다고 해석하지 않습니다.

## 비용·한계·검증

짧은 일반 트랜잭션은 실패 범위가 작지만, 버전 업그레이드는 오래 열린 탭을 모두 협력시켜야 합니다. 반대로 매번 새 연결을 열면 연결 관리와 화면 일관성 비용이 커집니다. 대상 브라우저에서 두 탭 업그레이드, 네트워크 await, 업그레이드 중 index 실패, 비정상 탭 종료를 재현해 이벤트 순서를 기록해야 합니다. IndexedDB 3.0 Editor’s Draft의 연결·blocked·트랜잭션·업그레이드 절을 기준으로 정리했으며, 특정 엔진의 내구성·타이밍까지 보증하지 않습니다.

참고자료: [Indexed Database API 3.0](https://w3c.github.io/IndexedDB/) (연결과 blocked 예제, transaction lifecycle, upgrade/abort 알고리즘; 2026-09-19 확인).
