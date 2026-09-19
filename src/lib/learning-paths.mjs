import { notes } from './notes.mjs';
import { knowledgeTree, knowledgePaths } from './knowledge-tree.mjs';

const paths = [
  ['server-io', '서버 입출력', '소켓의 기본 동작에서 운영체제별 이벤트 루프와 버퍼 수명으로 이어집니다.', 'iocp-foundations io-model-selection epoll-foundations kqueue-foundations io-uring-foundations io-uring-lifetimes iocp-completion rio-foundations linux-io-bounded-loop windows-io-lab'],
  ['ownership-sync', '객체 수명과 동기화', '소유 그래프와 공유 상태를 구분하고 안전한 참조 획득·종료를 설계합니다.', 'programming-language-foundations reference-counting-foundations synchronization-foundations concurrent-ownership atomic-publication safe-reclamation cancellation ownership-sync-lab'],
  ['trees-paths', '트리와 길찾기', '트리 순회와 그래프 비용 모델을 익힌 뒤 실제 이동과 다중 에이전트로 확장합니다.', 'tree-foundations spatial-tree-foundations pathfinding-foundations dijkstra astar navigation-production flow-field-foundations pathfinding-lab'],
  ['voxel-world', '복셀 월드', '원본 저장·표면 생성·충돌·이동 공간의 서로 다른 책임을 연결합니다.', 'game-server-foundations voxel-pipeline voxel-semantics dda-boundaries navigation-clearance voxel-version-bundle recast-voxel-reference-lab'],
  ['identity', '인증과 권한 위임', 'OAuth의 권한 위임과 OIDC의 인증을 나누고 제품 배치·갱신·회수를 다룹니다.', 'security-foundations oauth2-foundations oidc-foundations oauth-deployment login-transaction refresh-rotation key-rotation auth-protocol-lab'],
  ['services', '서비스 아키텍처', '모듈 경계에서 출발해 분산 주문·중복 처리·배포와 장애 복구를 설계합니다.', 'software-design-foundations rest-reactive-foundations msa-foundations msa-order-workflow transactional-outbox consumer-inbox msa-production msa-local-saga-lab dns-balancing-lab'],
  ['event-platforms', 'Kafka와 Pulsar', '로그와 구독의 기본 모델을 이해하고 생산·소비 구현과 운영 보장을 비교합니다.', 'data-system-foundations kafka-foundations kafka-application kafka-operations kafka-lab pulsar-foundations pulsar-application pulsar-operations pulsar-producer-consumer-lab'],
  ['core', '자료구조·데이터·언어 기반', '알고리즘 선택과 데이터 모델, Java의 자료구조·공개 경계를 연결합니다.', 'computer-science-foundations sorting-foundations algorithm-strategies database-models programming-language-foundations java-collections java-access-contracts java-access-and-collections-lab sorting-lab os-foundations-lab python-runtime-lab'],
  ['clients-learning', '클라이언트와 모델 학습', '플랫폼 실행·호환성·저장과 데이터 기반 학습의 기본 흐름을 살펴봅니다.', 'client-foundations web-platform-tooling ios-runtime-storage learning-agent-foundations linear-regression-foundations web-platform-rendering-lab ios-initialization-arc-storage'],
  ["machine-kernel", "CPU와 커널", "명령 실행과 캐시에서 인터럽트·동기화·신호·파일시스템으로 이어집니다.", "cpu-instruction-pipeline-hazards branch-speculation-correctness cpu-cache-associativity-replacement mesi-coherence-consistency linux-interrupt-deferred-work linux-futex-paths priority-inversion-inheritance process-signals-async-safety exec-environment-descriptors elf-linking-relocation inode-link-semantics filesystem-journaling-modes direct-io-buffered-boundary"],
  ["network-protocols", "네트워크 프로토콜", "링크와 주소 해석에서 전송 복구·경로 이동·웹 프로토콜로 이어집니다.", "network-ethernet-switch-vlan network-arp-resolution network-ipv4-cidr-routing network-ipv6-scope-neighbor-discovery network-icmp-errors-traceroute network-dhcp-lease-conflict network-tcp-rtt-retransmission-timers network-tcp-sack-recovery network-tcp-congestion-control network-quic-connection-id-migration network-dnssec-trust-chain network-http-content-coding network-websocket-upgrade-framing"],
  ["strings-graphs", "문자열과 그래프", "접두 구조·연결 요소·최단 경로·매칭·유량을 상태 추적으로 학습합니다.", "kmp-prefix-function z-function-string-matching aho-corasick-multiple-patterns suffix-array-lcp-search rolling-hash-verification scc-condensation bridges-articulation-lowlink bellman-ford-negative-cycles floyd-warshall-all-pairs bipartite-matching-augmenting-paths max-flow-residual-min-cut weighted-interval-dp binary-lifting-lca"],
  ["storage-query", "저장 엔진과 SQL", "로그 구조와 열 저장에서 SQL 연산·데이터 표현·복구로 이어집니다.", "lsm-storage-path lsm-compaction-strategy columnar-vectorized-execution sql-join-algorithm-choice sql-recursive-cte-cycle sql-window-frame-semantics sql-exact-monetary-arithmetic database-collation-sort-key postgres-xid-freeze-wraparound postgres-toast-large-values sqlite-wal-checkpoint-busy object-erasure-repair-tradeoffs parquet-rowgroup-page-pushdown"],
  ["language-semantics", "언어 타입과 실행", "Rust·C++·Java·Python·Go·TypeScript의 타입·수명·초기화 경계를 비교합니다.", "rust-ownership-borrowing-lifetimes rust-send-sync-thread-contracts rust-trait-objects-generics-monomorphization rust-async-future-polling-pinning cpp-concepts-constraints-diagnostics cpp-span-string-view-borrowed-views cpp-copy-elision-prvalue-materialization java-class-initialization-failure java-try-with-resources-suppressed python-descriptor-lookup-precedence python-import-cache-partial-initialization go-panic-recover-defer-boundary typescript-structural-narrowing-runtime-validation"],
  ["platform-control", "플랫폼 격리와 제어", "컨테이너 격리와 Kubernetes 제어에서 인프라 변경·빌드 신뢰로 이어집니다.", "linux-container-isolation linux-capability-sets linux-seccomp-boundary oci-layer-copy-on-write cgroup-v2-delegation kubernetes-crd-version-storage kubernetes-admission-idempotency kubernetes-watch-resource-version kubernetes-scheduler-placement kubernetes-cronjob-time-policy kubernetes-endpointslice-termination terraform-state-transaction-boundary ci-provenance-artifact-trust"],
  ["security-protocols", "암호와 신뢰 경계", "위협 모델·암호·키 계층에서 위임·로그아웃·행별 인가로 확장합니다.", "threat-modeling-stride-boundaries aead-nonce-associated-data envelope-encryption-key-hierarchy hmac-canonicalization-key-separation cryptographic-randomness-entropy-tokens certificate-transparency-acme-lifecycle oauth-dpop-sender-constrained-tokens oauth-par-jar-integrity oauth-token-exchange-delegation oidc-logout-session-correlation webauthn-registration-attestation-trust browser-trusted-types-dom-sinks multi-tenant-row-level-security"],
  ["client-lifecycles", "브라우저와 앱 수명", "브라우저 저장·캐시·레이아웃과 Swift 격리·화면 상태 수명을 연결합니다.", "client-indexeddb-transactions web-service-worker-lifecycle-deployment web-cache-storage-http-cache-boundary browser-bfcache-lifecycle dom-passive-listener-contract web-observer-delivery-feedback css-grid-intrinsic-sizing css-flex-minimum-size accessible-modal-focus-restoration swift-actor-reentrancy swift-sendable-structured-tasks ios-background-urlsession-restoration swiftui-identity-state-lifetime"],
  ["simulation-replication", "시뮬레이션과 복제", "ECS·회전·결정성에서 상태 복제·rollback·경로·매칭으로 이어집니다.", "ecs-archetype-sparse-set-structural-changes quaternion-rotation-interpolation-normalization floating-point-deterministic-simulation-limits snapshot-interpolation-network-jitter-buffers delta-compression-baseline-ack-recovery entity-ids-generations-replication-lifecycle rollback-netcode-input-delay-replay deterministic-random-streams-simulation-replay navmesh-funnel-corridor-waypoint-extraction orca-reciprocal-velocity-obstacle-local-avoidance spatial-morton-codes-locality-range-queries matchmaking-rating-uncertainty-queue-expansion game-inventory-item-identity-stacking-transactions"],
  ["learning-retrieval", "학습 모델과 검색", "분류·군집·확률 보정에서 임베딩·검색 결합·attention으로 이어집니다.", "logistic-regression-logits decision-tree-impurity-pruning random-forest-bagging-subspaces gradient-boosting-residual-fitting feature-scaling-standardization-leakage pca-covariance-eigenvectors kmeans-initialization-distance-quality probability-calibration-reliability-brier embedding-cosine-normalization hnsw-graph-construction-search-recall bm25-term-document-statistics hybrid-retrieval-rrf-reranking transformer-attention-masks-kv-cache"],
];
const byId = new Map(notes.map(note => [note.id, note]));
export const learningPaths = paths.map(([id, title, summary, list]) => ({
  id, title, summary, notes: list.split(' ').map(noteId => {
    if (!byId.has(noteId)) throw new Error(`학습 경로 대상 누락: ${noteId}`);
    return byId.get(noteId);
  }),
}));
const groups = new Map();
function collect(node) { groups.set(node.id, node); node.children.forEach(collect); }
collect(knowledgeTree);
export function learningContext(note) {
  const path = knowledgePaths.get(note.id);
  const group = groups.get(path.at(-1).id);
  const routes = learningPaths.filter(route => route.notes.some(item => item.id === note.id));
  const prerequisites = note.prerequisites.map(id => byId.get(id));
  const followups = notes.filter(item => item.prerequisites.includes(note.id));
  const related = [...new Map([
    ...note.related.map(id => byId.get(id)),
    ...notes.filter(item => item.related.includes(note.id)),
    ...group.entries,
  ].filter(item => item.id !== note.id && !prerequisites.includes(item) && !followups.includes(item))
    .map(item => [item.id, item])).values()];
  return { path, routes, prerequisites, followups, related };
}
