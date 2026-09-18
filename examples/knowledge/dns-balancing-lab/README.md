# DNS·프록시 분산 시뮬레이터

## 저장소 루트 실행

저장소 루트에서 실행합니다.

```sh
cd examples/knowledge/dns-balancing-lab
npm test
npm run build
npm run run > run-output.json
```

Node.js `>=22.12.0`이 필요합니다. 런타임 의존성은 없습니다. `npm install`은 필요하지 않습니다.

## 모델 입력

`src/lab.mjs`의 `DEFAULTS`는 다음을 고정합니다.

- 요청 도착 시각 `0..11`
- 요청별 처리 시간 `[8,1,7,2,6,2,9,1,5,3,4,2]`
- 시각 0의 DNS 답 `A,B`, TTL 5
- 시각 7 이후 DNS 답 `B,C`, TTL 5
- backend weight `A=5`, `B=1`, `C=1`
- 연결의 재사용 기한 20과 HTTP/2-style stream capacity 2

`npm run run`은 DNS 선택, weighted proxy 선택, least-connections 선택을 모두 JSON으로 출력합니다. 각 요청에는 DNS 반환 목록, DNS cache 만료 시각, 실제 선택 backend, 재사용 여부, connection ID, active 상태와 완료 시각이 포함됩니다.

## 구현 경계

`dns` 전략은 DNS가 반환한 주소를 순환 선택하고, cache가 유효하면 새 DNS 답을 반영하지 않습니다. backend가 unhealthy여도 DNS 답에서 제거하지 않으므로 오류가 발생합니다. 이는 DNS 답과 health-aware proxy routing을 구별하기 위한 의도된 실패입니다.

`proxy-weighted` 전략은 proxy가 health-filtered backend에서 weighted slot을 선택합니다. `proxy-least` 전략은 처리 중 active request 수를 weight로 정규화해 가장 낮은 값을 선택하고 동률은 backend ID로 결정합니다. 실제 NGINX/HAProxy tie-break와 모든 기능을 재현하는 구현이 아닙니다.

연결 재사용은 같은 address·유효 수명·stream capacity를 만족하는 연결을 재사용합니다. HTTP/2 frame, SETTINGS, TCP head-of-line blocking, TLS, 실제 socket은 구현하지 않습니다. 같은 시각에 세 번째 장기 요청이 들어오면 capacity가 찬 기존 연결 대신 새 연결을 만듭니다.

## 검증 경계

`npm test`는 7개의 assertion으로 TTL cache, 주소 변경, weighted selection, least-connections, unhealthy DNS answer, 잘못된 입력과 ID 충돌, long-lived stream capacity를 검증합니다. 이 테스트는 실제 DNS·프록시·HTTP/2 통합 성공을 증명하지 않습니다.
