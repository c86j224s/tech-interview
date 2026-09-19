# 500노트·1,500질답 확충

## 범위와 구성

2026-09-19 확충입니다. 기존 학습노트 370개에 **130개**를 추가해 **500개**, 질문·답변 1,000쌍에 **500쌍**을 추가해 **1,500쌍**으로 확장했습니다. 기존 문서를 분할하거나 삭제해 수를 맞추지 않았습니다. 기존 1,000개 질답과 370개 노트의 본문은 보존하고 새 파일을 추가했습니다.

추가 노트는 `notes/expansion/`, 질답은 기존과 같은 `questions/`에 있습니다. 노트는 `questionIds: []`인 독립 장이며, 먼저 읽을 개념·관련 개념·도식·과정·실패 조건을 갖습니다. 별도 질답은 상황에 직접 답하는 구두 답변과 득점·감점·심화 항목을 제공합니다. 새 질답에 실측하지 않은 5분 표지나 기존 꼬리 질문 승격 표지를 붙이지 않았습니다.

| 분야 | 노트 | 질답 | 주요 범위 |
| --- | ---: | ---: | --- |
| CPU·커널 | 13 | 50 | 파이프라인·캐시·MESI·인터럽트·futex·신호·ELF·파일시스템 |
| 네트워크 | 13 | 50 | Ethernet·ARP·CIDR·IPv6·DHCP·RTT·SACK·QUIC·DNSSEC |
| 알고리즘 | 13 | 50 | KMP·Z·Aho-Corasick·suffix array·SCC·low-link·유량·LCA |
| 저장·SQL | 13 | 50 | LSM·compaction·컬럼 저장·조인·CTE·window·TOAST·Parquet |
| 언어 | 13 | 50 | Rust 소유권·Send/Sync·Future, C++ concepts/view, Java 초기화, Python descriptor, Go recover, TypeScript |
| 플랫폼 | 13 | 50 | namespace·capability·seccomp·OCI·cgroup·Kubernetes API·Terraform·provenance |
| 보안 | 13 | 50 | 위협 모델·AEAD·DEK/KEK·HMAC·CSPRNG·DPoP·PAR/JAR·RLS |
| 웹·앱 | 13 | 50 | IndexedDB·Service Worker·bfcache·observer·Grid/Flex·modal·Swift 격리·SwiftUI |
| 게임 | 13 | 50 | ECS·quaternion·결정성·보간·delta·rollback·funnel·ORCA·Morton·매칭·인벤토리 |
| 학습·검색 | 13 | 50 | 로지스틱·트리·forest·boosting·PCA·군집·보정·임베딩·HNSW·BM25·attention |
| 합계 | **130** | **500** | |

전체 ID 목록은 [확충 manifest](expansion-500-1500.json)에 있습니다. 기존 개념 트리에 분류하고 Rust·TypeScript 그룹을 추가했습니다. 신규 분야별 학습 경로 10개를 더해 전체 경로는 19개입니다. 질문 카테고리는 기존 17개 체계를 유지합니다.

## 조사와 교정

기존 전체 질문 인덱스와 노트 목록을 대조한 뒤 10개 분야의 후보를 조사했습니다. 40개 묶음으로 초안과 별도 검증을 수행하고, 교정본을 통합하면서 수치·인덱스·API 조건·형식을 다시 점검했습니다. 루나는 조사·초안·검증 제안을 담당했고 최종 선택과 저장소 통합은 호스트가 수행했습니다.

검증 보고서도 정답으로 취급하지 않았습니다. 예를 들어 잘못 제안된 cosine 순위 반례, IPv6 DAD 응답 해석, KMP 구분자 충돌의 단순 `>=` 처방, 매칭의 대칭 차 해석은 그대로 적용하지 않았습니다. 최종 통합에서는 다음과 같은 문제를 추가로 고쳤습니다.

- Z append와 구분자 충돌의 실제 위치, Kasai 이웃 방향·rank 인덱스
- suffix-array doubling의 counting/radix 정렬 전제와 비교 정렬 비용
- trie 노드 수보다 많은 간선을 둔 메모리 예제
- PCA 평균, K-means 거리 반전, 확률 보정 bin의 포함 범위
- C++ view가 dangling이 된 뒤 복사하는 잘못된 해결책, compound requirement의 noexcept
- AEAD의 신뢰한 기대 AAD와 저장 메타데이터, nonce 예약·seal의 불확정 경계
- CPU load-use stall 사이클, LRU 전제, SACK 바이트 순번
- RLS 기본 deny, OIDC logout의 sub/sid, SLSA v1 필드명
- 게임 평가 불릿의 문장 조합 오류, 같은 답변 안에 반복된 문단
- 질문·노트 namespace 혼합, H1 누락, 도식 fence, 문장형 소제목과 잘못된 상대 링크

## 검증

- 콘텐츠 검증: **500개 노트·1,500개 질답**의 ID·제목·메타데이터·본문 구조·연결 확인
- 콘텐츠 회귀: **54개** — 기존 검사와 신규 manifest·계산 예제 검사
- 데스크톱·모바일 브라우저: **56개** — 전체 문항 주소, 노트 읽기, 도식, 검색·필터, JavaScript 비활성 경로
- 기존 본문 보존: 이전 배포 리비전과 기존 문서의 diff 확인

`tests/expansion-examples.test.mjs`는 Z/KMP 경계 사례, suffix/LCP, rolling hash, PCA 중심, cosine 순위, Brier 점수, K-means 축 가중 반전, binary32 합산, cache set, Morton code, 재고 수량과 RTT 갱신을 작은 계산으로 검사합니다. 이 검사는 문서의 수치 모델을 대조하는 것이며 해당 커널·브로커·암호·브라우저·ML 라이브러리 전체의 실행 검증이 아닙니다.

```sh
npm run validate
npm run test:content
npm run build
npx playwright test
```

## 출처와 적용 한계

본문마다 공식 표준·벤더 문서·언어 참조·알고리즘 참고 자료를 연결하고 적용 범위와 확인일을 구분했습니다. 움직이는 문서 URL의 확인일은 최신 안정 버전이나 특정 배포 환경의 동작 보증이 아닙니다. 본문을 충분히 읽지 못한 자료는 추가 확인 경로로 표시하고 그 자료의 제목만으로 세부 동작을 검증했다고 주장하지 않았습니다.

이번 확충의 대부분 코드·상태표는 설명용 예제입니다. 별도 실행 기록이 없는 Linux·Windows 커널, iOS 기기, Kubernetes cluster, DB engine, 검색 engine, 암호 제공자와 성능 benchmark는 실행했다고 표시하지 않습니다. 이전 16개 실습의 실제 실행 범위는 [실습 검증 기록](practical-knowledge-review.md)에 남아 있으며, 새 노트의 플랫폼 검증으로 소급하지 않습니다. 자료 수가 늘었다는 사실을 모든 기능의 완전한 검증이나 숙련도 보증으로 해석하지 않습니다.
