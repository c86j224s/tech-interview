# 주제 선정에 참고한 자료

## Interview Question for Beginner

- 참고 저장소: [jbee37142/Interview_Question_for_Beginner](https://github.com/jbee37142/Interview_Question_for_Beginner)
- 확인일: 2026-09-09
- 확인한 리비전: [`26c959a31f279295931130833cb6d0a43592e26e`](https://github.com/jbee37142/Interview_Question_for_Beginner/tree/26c959a31f279295931130833cb6d0a43592e26e)
- 참고 저장소의 라이선스: MIT. 해당 README는 JaeYeopHan의 원본 저장소도 안내합니다.

이 자료의 분야 구성과 질문 주제를 참고하여 기존 200문항에 100문항을 추가했습니다. 질문·답변·예제·점검 포인트는 이 사이트의 작성 기준에 맞게 새로 작성했으며, 원문의 답변이나 코드를 옮긴 번역본이 아닙니다. 참고 자료에 나온 모든 항목을 일대일로 수록한 것은 아닙니다. 기존 문항과 겹치는 항목은 제외하거나 다른 관점으로 나누고, 개념을 연결하는 데 필요한 인접 주제도 보강했습니다.

## 300문항 확장 범위

아래 수는 이번에 추가한 문항만 집계한 것입니다. 사이트의 카테고리와는 구분됩니다. 예를 들어 HTTP는 네트워크, 브라우저는 웹, Java·JavaScript·Python은 언어·런타임으로 분류합니다.

| 주제 묶음 | 추가 문항 | 주요 내용 |
| --- | ---: | --- |
| 자료구조 | 10 | 배열·연결 리스트, 동적 배열의 분할 상환, 스택·큐, BST·레드블랙 트리, 힙, 해시 충돌·확장, 그래프 표현, BFS·DFS |
| 알고리즘 | 10 | 최소 신장 트리, Kruskal·Prim, Union-Find, 정렬 안정성, 퀵·병합·계수·기수 정렬, 이진 탐색 경계, DP·탐욕·분할 정복, 소수 체 |
| 운영체제 | 10 | CPU 스케줄링, 라운드 로빈, 프로세스 상태, 세마포어·뮤텍스, 모니터, 페이징·세그멘테이션, 단편화, TLB, 페이지 교체·스래싱, 시스템 콜 |
| 데이터베이스·분산 이론 | 10 | DBMS와 파일, 정규화 이상, 함수 종속·키, 1~3정규형·BCNF, 역정규화, B-tree·해시 인덱스, 클러스터링, 준비된 문장, CAP |
| HTTP·브라우저 | 10 | GET·POST, TCP 연결, URL 탐색, CORS, 이벤트 위임, 렌더링·레이아웃, SSR·CSR·hydration, CSS cascade·reset, 캐시 재검증 |
| JavaScript | 10 | 이벤트 루프·마이크로태스크, 호이스팅·TDZ, 클로저, this·화살표 함수, Promise 오류·병행 실행, 동등 비교, 프로토타입, 객체 복사 |
| Java | 10 | JVM·JIT, GC 도달 가능성, equals·hashCode, 제네릭 소거, final·불변성, 오버로드·오버라이드, 언박싱, ThreadLocal, volatile·synchronized, 애너테이션 보존 |
| Python | 10 | 제너레이터, MRO·super, GIL, 참조 계수·순환 참조, 가변 기본 인자, 덕 타이핑, PyPy, 정렬 안정성, Celery 재시도, 얕은·깊은 복사 |
| 설계·개발 방식 | 10 | 캡슐화, 상속·조합, Liskov 치환, 의존성 역전, 순수 함수, 불변 데이터 공유, TDD, MVC, 싱글턴, Git merge·rebase |
| iOS·머신러닝 | 10 | 앱·scene·화면 생명주기, ARC, frame·bounds, 이벤트 전달, 손실 함수, 데이터 분할, 과적합, 경사·학습률, 분류 지표 |
| **합계** | **100** | **전체 300문항** |

## 사실 확인과 유지보수

오래된 면접 자료의 설명을 현재 구현의 보편적 계약으로 단정하지 않습니다. 버전과 환경에 따라 달라지는 항목은 적용 범위를 답변 안에 명시합니다. 예를 들어 GIL은 빌드에 따라 다르고, JavaScript 작업 큐 설명은 브라우저 문맥을 구분하며, HTTP/3는 TCP 연결 절차를 사용하지 않습니다.

언어·플랫폼 계약을 확인할 때는 다음 공식 자료를 우선합니다.

- HTTP: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111), TCP: [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293)
- 웹: [Fetch Standard](https://fetch.spec.whatwg.org/), [DOM Standard](https://dom.spec.whatwg.org/), [CSS Cascading and Inheritance](https://www.w3.org/TR/css-cascade-6/), [MDN JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- Java: [Java SE 25 언어 명세](https://docs.oracle.com/javase/specs/jls/se25/html/index.html), [Java SE 25 API](https://docs.oracle.com/en/java/javase/25/docs/api/index.html)
- Python: [Python 문서](https://docs.python.org/3/), [free-threading 안내](https://docs.python.org/3/howto/free-threading-python.html), [Celery 태스크 문서](https://docs.celeryq.dev/en/stable/userguide/tasks.html)
- 데이터베이스: [PostgreSQL 인덱스](https://www.postgresql.org/docs/current/indexes.html), [준비된 문장](https://www.postgresql.org/docs/current/sql-prepare.html)
- iOS: [UIKit](https://developer.apple.com/documentation/uikit), [Swift ARC](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/)
- 머신러닝: [Google Machine Learning Crash Course](https://developers.google.com/machine-learning/crash-course)

문항을 수정할 때는 정의뿐 아니라 예제 결과, 성립 조건, 실패 사례를 함께 확인합니다. 구체적인 코드 실행 환경과 테스트 결과는 해당 변경을 검토할 때 별도로 기록하며, 이 목록 자체가 모든 플랫폼에서 실행 검증했다는 뜻은 아닙니다.
