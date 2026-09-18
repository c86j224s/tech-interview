# 지식노트 보강과 실습 검증

## 범위와 기준일

2026-09-18 보강 기록입니다. 기존 318개 심화 노트에 선행 개념·중간 상태·구현 판단을 추가하고, 독립 기초 장 36개에 이어 실습 장 16개를 추가했습니다. 전체 노트는 354개에서 **370개**가 되었습니다. 질문·답변 1,000개는 변경하지 않았습니다.

9개 학습 경로와 전체 개념 트리에 실습을 연결했습니다. 선행·연관 링크, 명사형 제목, 도식, canonical URL을 검사합니다. 질문 기반 coverage 표는 기존 질문 연결 검토 기록으로 유지하며, 실습 추가를 전체 기술 숙련도의 증명으로 해석하지 않습니다.

## 보강 내용

| 영역 | 추가 실행 경계 |
| --- | --- |
| Linux 입출력 | epoll ET·ONESHOT, 예산·재실행 큐, io_uring 부분 송수신·취소 완료·종료 |
| Windows 입출력 | overlapped IOCP framing·송신 잔량·CancelIoEx drain, RIO notification·CQ·버퍼 수명 |
| C++ 소유권·동기화 | strong cycle, weak 획득, bounded queue drain/cancel, refcount·ABA 모델 |
| Java | 접근 qualifier, private nest, public 상속 멤버, exports/opens, final, 컬렉션 순회 |
| 길찾기 | BFS·Dijkstra·A*, LPA* 비용 변경, D* Lite 이동 시작점과 km |
| 복셀·Recast | halo·세대·AABB, 평면 2:1 stitch, 실제 TileCache 장애물 추가·제거 |
| OAuth·OIDC | code·PKCE·state·nonce·claim·JWKS, refresh rotation·family 회수·응답 유실 |
| MSA | 서비스별 SQLite, 결제 불확정 대사, 보상 재시작, 종결 상태 |
| Kafka | 파일 inbox·연속 offset, consumer 재시작, RF3/ISR 감소·복귀 실행기 |
| Pulsar | durable ledger·ACK, Shared/Key_Shared, 연결된 broker/bookie 구성과 장애 실행기 |
| 운영체제 | FCFS·SJF·SRTF·RR·priority/aging의 timeline·응답·대기 계산 |
| DNS·분산 | TTL·주소 변경, 가중 선택·최소 활성 요청, 연결·stream capacity 모델 |
| 정렬 | 병합·힙·삽입·선택·버블, 안정성·다중집합·비교자·trace |
| 웹 | DOM·계산 스타일·기하·ARIA 불일치와 복구, 400px viewport |
| Python | 결정적인 lost update·lock, C API strong reference와 확장 호환 표지 |
| Apple 플랫폼 | Swift 초기화·ARC, Objective-C dispatch/selector, plist·SQLite·Core Data 이전 |

## 실제 실행 결과

환경은 macOS 27 arm64, Node 26.8.2, Python 3.9.6, 일반 CPython 3.14.7, Homebrew JDK 17·21입니다. Maven 3.9.9는 임시 디렉터리에 준비했고 Gradle 9.6.0은 기존 캐시의 실행 파일을 사용했습니다. 시스템 전역 도구 설치는 하지 않았습니다.

| 대상 | 실제 결과 | 해석 제한 |
| --- | --- | --- |
| 콘텐츠 회귀 | 50개 통과 | 메타데이터·링크·도식·제목·기존 예제 계약 |
| 사이트 브라우저 | desktop/mobile 56개 통과 | 최신 정적 빌드 기준, JavaScript 비활성 경로 포함 |
| 웹 실습 | Chrome 4개 통과 | Firefox/WebKit·실기기·스크린리더 미검증 |
| C++ | 일반 실행, ASan·UBSan, TSan 통과 | 실행한 스케줄의 검사이지 동시성 증명 아님 |
| Java | JDK 21 컴파일·의도된 거절·실행 통과 | Java SE 25 문서와 실행 JDK 21 구분 |
| 길찾기 | Python 8개 통과 | 소형 그래프, 엔진 이동·충돌 미통합 |
| 스케줄링 | Python 5개 통과 | 커널 스케줄러가 아닌 논리 모델 |
| DNS | Node 7개 통과 | 실제 resolver·NGINX·HAProxy·HTTP/2 아님 |
| 정렬 | Python 7개 통과 | 유한 입력 속성 검사, 성능 승인 아님 |
| 인증 | Node 8개 테스트 그룹 통과 | loopback mock, 실제 provider·TLS·RS 아님 |
| 사가 | Python 7개 통과 | 실제 다중 프로세스, provider 원장은 로컬 모의 구현 |
| Kafka | Gradle compile·JUnit 4개·installDist 통과 | broker 연결 없음; Maven도 별도 4개 통과 |
| Kafka 보조 검사 | Python 6개 통과 | checkpoint 모델·파일 형식, Kafka 프로토콜 아님 |
| Pulsar | 실제 client compile·JUnit 5개 통과 | Maven/JDK17, broker 연결 없음 |
| Recast | v1.6.0 소스 빌드·query·layer·장애물 재빌드 통과 | 단일 타일; allocator 실패·동시 reader 미검증 |
| 복셀 | 좌표·face·halo·AABB·stitch·세대 검사 통과 | 일반 LOD renderer·물리 엔진 아님 |
| Python 런타임 | unsafe=1/safe=2, 일반3.14 C 확장 build/import 통과 | free-threaded runtime 미실행 |
| Apple CLI | Swift·ObjC·plist·SQLite·Core Data 통과 | UIKit은 NOT_RUN |
| Linux·Windows | client 문법·runner 구문·소스 점검 | 대상 OS compile/runtime은 NOT_RUN |

초기 사이트 브라우저 실행은 옛 354개 빌드를 읽어 개수 비교 4개가 실패했습니다. 370개로 다시 빌드한 뒤 전체 56개를 재실행해 통과했습니다. 웹 실습의 최초 번들 Chromium 실행도 브라우저 미설치로 실패했으며, 설치된 Chrome 채널로 4개를 다시 실행했습니다. Recast 빌드에는 upstream 정수 변환 및 중복 라이브러리 경고가 있었습니다.

## 재현 명령

```sh
npm run test:content
python3 scripts/verify-practical-labs.py
npm run build
npx playwright test
npx playwright test --config=examples/knowledge/web-platform-lab/playwright.config.mjs
```

`verify-practical-labs.py`는 의존성 없는 모델과 로컬 사가를 검사합니다. 인증 실습은 해당 디렉터리에서 `npm ci --ignore-scripts`를 먼저 실행해야 합니다. C++·JDK·Apple·Recast는 각 README의 별도 명령을 사용합니다. 실패 출력을 유지하고 명령의 exit code를 확인합니다. 여러 명령을 세미콜론으로 잇고 마지막 성공 코드만 전체 결과로 보고하지 않습니다.

## 검토 중 수정한 결함

원고와 코드의 검증 보고서를 그대로 수용하지 않고 변경 본문과 최종 소스를 대조했습니다. 주요 수정은 다음과 같습니다.

- 표본 추출 입력 추적, 0가중치 경계, 토큰 버킷 산술, write-skew 읽기·쓰기 집합
- BFS 조기 종료 조건, Go select 동시 readiness, Dijkstra 거리 추정의 의미
- epoll half-close를 EOF로 오인하는 처리, local rerun starvation, 출력 포화 관심 마스크
- io_uring 부분 send 손실, 불확정 submit 뒤 operation 재사용, accept shutdown FD 회수
- IOCP operation 해제 뒤 접근, 4바이트 payload의 header 혼동, pending 없는 제출 실패
- RIO 부분 완료 누적과 status 검사, 등록 메모리의 outstanding guard
- Kafka 파일 형식 변경 후 assertion 불일치, broker 내부 listener, 직접 Java 종료 코드
- Pulsar의 잘못된 listener 설정 키, bookie 설정 전달, owner 고정 가정, worker별 독립 원장
- 사가 부재 조회 영구 캐시, terminal workflow 재시작, 결제·배송 불확정 결과 혼합
- Recast annotated tag와 checkout commit 혼동, allocator 호출·tile pointer 타입·mesh 정점
- 정렬의 비-trace 실행에서 배열 스냅샷을 계속 만드는 비용, 입력 상한
- 문서의 임시 경로·가짜 canonical URL·오래된 NOT_RUN·누락된 도식

## 미실행 환경과 확장 한계

Docker, Linux kernel/liburing, Windows SDK·RIO provider, iOS simulator/device, free-threaded CPython은 현재 환경에 없습니다. 이 항목은 소스 제공·문서 대조와 실제 실행을 명확히 분리합니다. 브로커 장애 실행기가 존재하더라도 해당 장애 시험을 통과했다는 뜻이 아닙니다.

MSA outbox relay·실제 consumer inbox 전달, 외부 결제 원자성, 운영 TLS·인증, 예약 만료·fencing, 일반 Transvoxel·물리 seam, Recast 다중 타일·동시 reader, LPA*/D* Lite 전체 수학적 증명과 모든 동시성 스케줄은 이 작은 실습의 범위가 아닙니다. 모든 공식 기능을 완전히 검증했다는 표현을 사용하지 않습니다.
