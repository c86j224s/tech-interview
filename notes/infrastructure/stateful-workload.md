---
id: stateful-workload
title: StatefulSet의 안정 식별자와 클러스터 시작
topic: 인프라
summary: Pod·Deployment·StatefulSet의 역할을 나누고 ordinal DNS·발견·readiness·합의 멤버십·순차 시작의 quorum 교착을 설명합니다.
questionIds: [k8s-pod-deployment-statefulset, statefulset-headless-member-discovery, statefulset-startup-quorum-order]
---

# StatefulSet의 안정 식별자와 클러스터 시작

## Pod 이름 재사용과 메모리 상태 비보존

Deployment의 API Pod가 죽어 다른 이름의 Pod로 교체되어도 같은 요청을 처리하면 역할을 대체할 수 있습니다. StatefulSet의 db-0은 재생성 뒤 ordinal 이름과 연결된 저장소를 유지하는 데 도움이 됩니다. 하지만 프로세스 메모리·현재 리더·최신 로그까지 자동으로 보존되는 것은 아닙니다.

Pod는 컨테이너들을 함께 배치하고 네트워크·볼륨을 사용할 실행 단위입니다. Deployment·StatefulSet은 Pod 집합의 원하는 상태를 유지하는 관리자입니다. Service는 접근과 발견을 제공하며 데이터 복제나 합의 프로토콜이 아닙니다.

| 구성 | 제공하는 역할 | 제공하지 않는 것 |
| --- | --- | --- |
| Pod | 결합된 컨테이너 실행·배치 | 독립 장애 복제 |
| Deployment | 교체 가능한 replica·rollout | 인스턴스별 영구 정체성 |
| StatefulSet | ordinal·안정 네트워크 식별·PVC 연결 | DB 복제·리더 선출 |
| Headless Service | 개별 주소 발견 | 투표자 자격·최신 데이터 |

메모리 캐시가 있다는 이유만으로 StatefulSet이 필요한 것은 아닙니다. 외부 DB를 쓰는 프런트엔드는 Deployment로 대체 가능한 프로세스를 운영할 수 있습니다. 실제 프로토콜에서 인스턴스별 식별·저장 수명이 필요한지를 기준으로 고릅니다.

## Ordinal DNS의 발견 식별자와 실행 권한 분리

db-0의 안정적인 DNS 이름은 멤버를 찾는 데 유용하지만 현재 주소·Ready·인증서·로그 세대·합의 멤버십은 별도로 확인해야 합니다. 같은 이름으로 새 프로세스가 떴어도 옛 로그를 가진 replica가 바로 leader가 되어도 되는 것은 아닙니다.

Headless Service의 endpoint 공개는 readiness 및 publishNotReadyAddresses 같은 설정에 영향을 받습니다. bootstrap에서 준비 전 멤버 발견이 필요할 수 있지만, 준비 전 주소를 게시했다고 일반 사용자 요청까지 처리 가능하다는 뜻은 아닙니다. DNS negative cache·TTL·client resolver가 생성 직후 이름 발견을 늦출 수 있습니다.

```diagram
{"title":"발견과 클러스터 가입과 서비스 준비를 나눕니다","caption":"화살표는 상태 저장 멤버의 개념적 시작 순서입니다. 이름을 찾았다고 합의 투표 권한이나 최신 상태가 확보된 것은 아닙니다.","rows":[[{"id":"name","label":"ordinal 이름·주소 발견"}],[{"id":"identity","label":"세대·자격·로그 확인"}],[{"id":"join","label":"프로토콜상 가입·복구"}],[{"id":"ready","label":"요청 처리 준비"}]],"edges":[{"from":"name","to":"identity","label":"접속 대상 확인"},{"from":"identity","to":"join","label":"허용된 멤버 절차"},{"from":"join","to":"ready","label":"상태 동기화 조건"}]}
```

## 순차 시작과 Quorum Readiness의 순환 대기

OrderedReady 정책에서 db-0이 Ready가 되어야 db-1을 시작하는데, db-0의 readiness가 3개 중 2개 quorum을 요구한다고 합시다. 두 번째 Pod가 시작되지 않아 첫 번째가 영원히 Ready가 되지 않는 순환 대기가 생길 수 있습니다.

시작 절차에서는 서비스 발견·프로세스 시작·클러스터 초기화·기존 로그 복구·사용자 트래픽 readiness를 서로 다른 단계로 구분하고, readiness를 언제 올릴지는 데이터 서비스가 정한 초기화·복구 조건으로 판단합니다. Parallel Pod 관리나 별도 bootstrap(클러스터를 구성하기 위한 초기 절차)을 사용할 수 있지만, readiness를 항상 true로 바꾸면 아직 복구되지 않은 노드에도 사용자 요청이 들어갈 수 있습니다.

따라서 데이터 서비스가 동시 시작, 기존 로그 복구, 한 번만 수행하는 bootstrap을 어떤 순서와 조건으로 지원하는지 제품의 실제 절차로 확인합니다.

Parallel 정책도 StatefulSet의 모든 업데이트·종료 동작이 무조건 무순서가 된다는 뜻으로 확대하지 않습니다. Pod 관리 정책과 updateStrategy·partition 등의 실제 버전별 계약을 나눕니다. 초기 생성과 일부 재시작·전체 복구는 서로 다른 테스트입니다.

## 저장소 재연결과 옛 Writer 종료·fencing

db-0 이름과 PVC를 재사용해도 옛 노드가 아직 디스크에 쓰고 있으면 split-brain 위험이 남습니다. 강제 Pod 삭제와 새 생성만으로 옛 프로세스를 중단했다고 증명할 수 없습니다. 스토리지 attach·detach, 노드 격리, 앱 fencing과 세대 검증을 함께 설계합니다.

PVC retention과 PV reclaim 정책·백업도 별도입니다. replica 감소·StatefulSet 삭제가 어떤 PVC를 남기거나 지우는지 실제 설정을 확인합니다. 메모리 상태를 디스크에 저장하지 않았다면 안정 이름은 그 상태를 복구하지 못합니다.

## ordinal 이름과 실제 상태 기반 성공 판정

격리된 테스트 클러스터에서 초기 3개 시작, 전체 재시작, 한 멤버 로그 지연, DNS 늦은 갱신, 옛 노드 격리를 재현합니다. ordinal 유지뿐 아니라 허용된 멤버 집합·leader·읽은 마지막 상태·새 쓰기 허가를 확인합니다.

현재 작업에서 StatefulSet·합의 클러스터를 실행하지 않았습니다. 본문은 실행·발견·데이터 프로토콜의 책임을 설명하는 학습 노트입니다.
