# 로컬 다중 프로세스 주문 사가 실습

Order·Inventory·Payment·Shipping을 독립 프로세스와 서비스별 SQLite로 실행합니다. 외부 결제망 대신 같은 로컬 DB 안의 모의 결제 원장을 사용합니다. 따라서 실제 provider와 로컬 DB 사이의 분산 거래를 구현한 예제는 아닙니다.

## 실행

저장소 루트에서 실행합니다. Python 표준 라이브러리만 필요합니다.

```sh
cd examples/knowledge/msa-lab
python3 -m unittest discover -s . -p 'test_lab.py' -v
python3 run_demo.py --db-dir .demo-data/normal
python3 run_demo.py --db-dir .demo-data/after --failpoint payment-after-commit --reconcile-restart
python3 run_demo.py --db-dir .demo-data/before --failpoint payment-before-effect --reconcile-restart
python3 run_demo.py --db-dir .demo-data/refund --failpoint shipping-permanent-failure,refund-after-effect --reconcile-restart
```

새 시나리오는 새 DB 디렉터리로 실행합니다. 고정 loopback 포트 18081–18084를 사용하므로 병렬 실행하지 않습니다. 테스트는 임시 디렉터리를 정리하지만 데모 DB는 결과 확인을 위해 남습니다.

## 파일 역할

- `common.py`: SQLite 스키마와 명령·효과·outbox 기록
- `service.py`: 서비스별 HTTP 명령과 모의 승인·환불 원장
- `coordinator.py`: 안정 ID, 불확정 결과 대사, 보상과 종결 상태
- `run_demo.py`: 제한된 시작 대기, 재시작, 프로세스 정리
- `test_lab.py`: 7개 단위·다중 프로세스 회귀 테스트

## 확인 범위

2026-09-18 macOS 27 arm64/Python 3.9.6에서 7개 테스트를 통과했습니다. 명령 충돌, 결제 전후 종료, 보상 재시작, 부재 조회 갱신과 종결 상태 재실행 방지를 검사합니다.

실제 결제 provider, broker relay, consumer inbox 전달, 전원 손실 내구성, hold 만료·generation fencing, schema migration, TLS·인증과 성능은 검증하지 않았습니다. outbox는 로컬 전달 의도만 기록합니다.

[학습 노트](https://c86j224s.github.io/tech-interview/notes/msa-local-saga-lab/)
