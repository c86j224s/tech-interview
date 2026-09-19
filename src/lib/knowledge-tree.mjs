import { notes } from './notes.mjs';

// The hierarchy is conceptual, independent of source folders and URL paths.
const group = (id, title, noteIds = '', children = []) => ({ id, title, noteIds: noteIds.split(/\s+/).filter(Boolean), children });
export const knowledgeStructure = group('knowledge', '기술 지식', '', [
  group('computer-science', '컴퓨터 과학', 'computer-science-foundations', [
    group('operating-systems', '운영체제', 'linux-container-isolation cgroup-v2-delegation', [
      group('processes', '프로세스·스레드', 'execution-boundaries cpu-scheduling os-foundations-lab cpu-instruction-pipeline-hazards branch-speculation-correctness process-signals-async-safety exec-environment-descriptors elf-linking-relocation'),
      group('memory', '메모리 관리', 'address-translation virtual-memory page-replacement memory-accounting numa cpu-cache-associativity-replacement mesi-coherence-consistency'),
      group('io', '입출력', 'io-model-selection file-state io-readiness linux-io-bounded-loop windows-io-lab linux-interrupt-deferred-work inode-link-semantics filesystem-journaling-modes direct-io-buffered-boundary', [
        group('epoll', 'epoll', 'epoll-foundations'),
        group('kqueue', 'kqueue', 'kqueue-foundations'),
        group('io-uring', 'io_uring', 'io-uring-foundations io-uring-lifetimes'),
        group('rio', 'Windows RIO', 'rio-foundations'),
        group('iocp', 'IOCP', 'iocp-foundations iocp-completion acceptex iocp-send iocp-scheduling iocp-shutdown'),
      ]),
    ]),
    group('concurrency', '동시성', '', [
      group('ownership', '객체 소유권·참조 카운팅', 'reference-counting-foundations concurrent-ownership ownership-sync-lab'),
      group('synchronization', '동기화', 'synchronization-foundations condition-variables semaphore deadlock linux-futex-paths priority-inversion-inheritance'),
      group('memory-model', '메모리 모델·회수', 'atomic-publication safe-reclamation'),
      group('async', '비동기 실행·수명', 'async-execution cancellation admission-control'),
    ]),
    group('networking', '네트워크', 'network-ethernet-switch-vlan network-arp-resolution network-icmp-errors-traceroute network-dhcp-lease-conflict', [
      group('transport', '전송 계층', 'tcp-handshake tcp tcp-close tcp-throughput small-write-latency datagram-contracts wire-format network-tcp-rtt-retransmission-timers network-tcp-sack-recovery network-tcp-congestion-control network-quic-connection-id-migration'),
      group('http', 'HTTP', 'http-method-retry http-cache http-preconditions http-multiplexing http-pools network-http-content-coding network-websocket-upgrade-framing'),
      group('network-routing', '이름 해석·프록시', 'dns-transition proxy-boundaries dns-balancing-lab network-ipv4-cidr-routing network-ipv6-scope-neighbor-discovery network-dnssec-trust-chain'),
      group('realtime', '실시간 통신', 'event-stream-recovery'),
    ]),
    group('data-structures', '자료구조', '', [
      group('sequences', '선형 자료구조', 'sequence-containers dynamic-array stack-queue'),
      group('trees-hashes', '트리·해시', 'tree-foundations spatial-tree-foundations hash-table balanced-search-tree heap trie'),
      group('graph-structures', '그래프·집합', 'graph-storage union-find'),
      group('specialized-structures', '필터·캐시·타이머', 'bloom-filter cache-policy timing-wheel top-k-ranking'),
    ]),
    group('algorithms', '알고리즘', 'algorithm-strategies', [
      group('search-sort', '탐색·정렬', 'sorting-foundations sorting-lab binary-search sort-stability quicksort radix-sort external-sort kmp-prefix-function z-function-string-matching aho-corasick-multiple-patterns suffix-array-lcp-search rolling-hash-verification'),
      group('graph-algorithms', '그래프 알고리즘', 'graph-search dijkstra astar zero-one-bfs topological-sort minimum-spanning-tree scc-condensation bridges-articulation-lowlink bellman-ford-negative-cycles floyd-warshall-all-pairs bipartite-matching-augmenting-paths max-flow-residual-min-cut binary-lifting-lca'),
      group('range-algorithms', '구간 질의', 'monotonic-stack sliding-window-maximum fenwick-tree lazy-segment-tree'),
      group('dp-number', '동적 계획법·정수론', 'dynamic-programming prime-sieve weighted-interval-dp'),
      group('sampling', '난수·표본 추출', 'uniform-random fisher-yates reservoir-sampling weighted-sampling'),
    ]),
  ]),
  group('languages', '프로그래밍 언어', 'programming-language-foundations', [
    group('rust', 'Rust', 'rust-ownership-borrowing-lifetimes rust-send-sync-thread-contracts rust-trait-objects-generics-monomorphization rust-async-future-polling-pinning'),
    group('typescript', 'TypeScript', 'typescript-structural-narrowing-runtime-validation'),
    group('cpp', 'C++', 'cpp-move cpp-storage-validity cpp-exception-state cpp-shared-ownership cpp-coroutine-lifetime cpp-concepts-constraints-diagnostics cpp-span-string-view-borrowed-views cpp-copy-elision-prvalue-materialization'),
    group('java', 'Java', 'java-collections java-access-contracts java-access-and-collections-lab', [
      group('java-types', '타입·객체', 'java-value-contract java-dispatch-erasure java-equality-immutability java-metadata'),
      group('java-runtime', 'JVM·동시성', 'java-shared-state java-context-lifetime java-execution-lifetime java-resource-reachability jvm-warmup java-class-initialization-failure java-try-with-resources-suppressed'),
    ]),
    group('javascript', 'JavaScript', '', [
      group('js-values', '값·객체·함수', 'js-bindings js-receiver js-object-graph js-value-conversion'),
      group('js-async', '비동기·실행 환경', 'js-promise-state js-scheduling js-task-lifetime'),
    ]),
    group('python', 'Python', '', [
      group('python-values', '객체·프로토콜', 'python-object-state python-iteration python-protocol-mro python-ordering python-resource-lifetime python-descriptor-lookup-precedence'),
      group('python-runtime', '실행 환경·동시성', 'python-runtime-lab python-async-scope python-parallel-boundary pypy-tracing celery-delivery python-import-cache-partial-initialization'),
    ]),
    group('go', 'Go', 'go-slice-storage go-interface-values go-map-state go-channel-lifecycle go-request-lifetime go-runtime-diagnosis go-panic-recover-defer-boundary'),
  ]),
  group('data-systems', '데이터 시스템', 'data-system-foundations', [
    group('databases', '데이터베이스', 'database-models', [
      group('relational-model', '관계 모델', 'functional-dependencies normalization lossless-decomposition unique-identity'),
      group('sql', 'SQL·조회', 'sql-result-semantics sql-binding relational-fetch keyset-pagination sql-join-algorithm-choice sql-recursive-cte-cycle sql-window-frame-semantics'),
      group('db-indexes', '인덱스·실행 계획', 'indexes index-row-layout index-predicates query-plan-evidence partition-boundaries'),
      group('db-transactions', '트랜잭션·동시성', 'transactions mvcc write-skew lock-pressure connection-lifetime db-work-claim multi-tenant-row-level-security'),
      group('db-recovery', '복구·복제·이관', 'wal-recovery replica-read-contract schema-cutover projection-maintenance file-db-cutover sqlite-wal-checkpoint-busy object-erasure-repair-tradeoffs'),
      group('db-engines', '엔진별 구현', 'postgres-retention sqlserver-version-reads lsm-storage-path lsm-compaction-strategy columnar-vectorized-execution sql-exact-monetary-arithmetic database-collation-sort-key postgres-xid-freeze-wraparound postgres-toast-large-values parquet-rowgroup-page-pushdown'),
      group('redis', 'Redis', 'redis-layout-runtime redis-atomic-execution redis-loss-policy redis-persistence redis-replication-failover redis-slot-routing'),
      group('elasticsearch', 'Elasticsearch', 'search-mapping search-publication'),
    ]),
    group('distributed', '분산 시스템', '', [
      group('consistency', '일관성·시계', 'consistency-history logical-clocks crdt-counter time-based-identifiers'),
      group('consensus', '합의', 'consensus-quorum consensus-membership paxos-values', [
        group('raft', 'Raft', 'raft-election raft-commit-read raft-snapshot'),
      ]),
      group('distributed-effects', '분산 작업·중복 처리', 'idempotency fencing distributed-commit transactional-outbox consumer-inbox retry-circuit'),
      group('distributed-data', '캐시·배치·이관', 'cache-refill singleflight shard-placement migration-state'),
      group('messaging', '메시징·스트림', 'event-contracts broker-redelivery stream-time-state', [
        group('kafka', 'Kafka', 'kafka-lab kafka-foundations kafka-application kafka-operations kafka-partition-order kafka-consumer-offset kafka-replication-acks kafka-retained-state kafka-transaction-scope kraft-control-plane'),
        group('pulsar', 'Pulsar', 'pulsar-foundations pulsar-application pulsar-operations pulsar-producer-consumer-lab'),
        group('nats', 'NATS·JetStream', 'nats-routing jetstream-storage'),
      ]),
    ]),
  ]),
  group('software-design', '소프트웨어 설계', 'software-design-foundations', [
    group('msa', '마이크로서비스', 'msa-foundations msa-order-workflow msa-production msa-local-saga-lab'),
    group('object-design', '객체·의존성', 'invariant-boundaries behavioral-subtyping policy-ports singleton-publication'),
    group('state-design', '상태·데이터 모델', 'pure-state snapshot-lifetime state-correction model-ownership identity-representation calendar-time account-rights-merge'),
    group('api-design', 'API·서비스 계약', 'rest-reactive-foundations api-meaning grpc-execution messaging-ownership'),
    group('execution-design', '실행·자원 관리', 'request-task-lifetime shutdown-admission bulkhead-fairness rate-burst health-feedback'),
    group('change-design', '변경·통합', 'config-bundle flag-migration git-integration dependency-lock atomic-file-publication'),
    group('testing', '테스트', 'test-detection controlled-failure protocol-scenarios'),
  ]),
  group('operations', '인프라·운영', 'operations-foundations', [
    group('kubernetes', 'Kubernetes', 'kubernetes-admission-idempotency kubernetes-watch-resource-version', [
      group('k8s-workloads', '워크로드·조정', 'reconciliation probe-contracts rollout-capacity stateful-workload kubernetes-crd-version-storage kubernetes-scheduler-placement kubernetes-cronjob-time-policy'),
      group('k8s-resources', '자원·연결·스토리지', 'resource-budget service-connections configmap-application volume-recovery disruption-budget kubernetes-endpointslice-termination'),
      group('k8s-scaling', '자동 확장·노드 관리', 'hpa-feedback event-autoscaling cold-start-drain node-provisioning node-disruption interruptible-work'),
    ]),
    group('delivery', '빌드·배포', 'reproducible-image gitops-state gitops-deletion migration-orchestration object-publication oci-layer-copy-on-write terraform-state-transaction-boundary ci-provenance-artifact-trust'),
    group('observability', '관측·장애 복구', 'trace-wait-evidence metric-budget log-audit-budget slo-mitigation recovery-evidence'),
    group('performance', '성능', '', [
      group('measurement', '측정·부하 모델', 'latency-capacity load-model'),
      group('resource-performance', '메모리·캐시', 'cacheline-layout memory-headroom cache-freshness'),
      group('service-performance', '분산 처리 성능', 'hedged-read broker-progress subscriber-budget redis-bounded-cleanup'),
    ]),
  ]),
  group('security', '보안', 'security-foundations linux-capability-sets linux-seccomp-boundary threat-modeling-stride-boundaries', [
    group('oauth-oidc', 'OAuth 2.0·OpenID Connect', 'oauth2-foundations oidc-foundations oauth-deployment auth-protocol-lab oauth-dpop-sender-constrained-tokens oauth-par-jar-integrity oauth-token-exchange-delegation oidc-logout-session-correlation'),
    group('identity-security', '인증·계정', 'authentication login-transaction account-linking device-authorization password-verification account-recovery passkey-binding cryptographic-randomness-entropy-tokens webauthn-registration-attestation-trust'),
    group('credentials', '세션·자격 관리', 'session-authority refresh-rotation key-rotation secret-delivery envelope-encryption-key-hierarchy'),
    group('transport-security', '통신·서비스 권한', 'tls-trust early-data-replay nats-authorization workload-policy aead-nonce-associated-data certificate-transparency-acme-lifecycle'),
    group('application-security', '입력·웹 보안', 'browser-request-security input-object-boundary http-boundary-validation server-url-fetch'),
    group('data-security', '파일·외부 연동', 'file-publication presigned-capability webhook-intake hmac-canonicalization-key-separation'),
  ]),
  group('clients', '웹·모바일', 'client-foundations', [
    group('web', '웹', 'web-platform-tooling web-platform-rendering-lab', [
      group('browser', '브라우저·통신', 'browser-navigation cors client-indexeddb-transactions web-service-worker-lifecycle-deployment web-cache-storage-http-cache-boundary browser-bfcache-lifecycle'),
      group('rendering', '스타일·렌더링', 'css-cascade css-reset rendering-layout hydration web-observer-delivery-feedback css-grid-intrinsic-sizing css-flex-minimum-size'),
      group('dom', 'DOM·이벤트', 'event-delegation dom-passive-listener-contract accessible-modal-focus-restoration browser-trusted-types-dom-sinks'),
    ]),
    group('ios', 'iOS', 'ios-runtime-storage ios-initialization-arc-storage view-lifecycle view-coordinates arc-ownership observation-contracts scene-persistence swift-actor-reentrancy swift-sendable-structured-tasks ios-background-urlsession-restoration swiftui-identity-state-lifetime'),
  ]),
  group('game', '게임 서버', 'game-server-foundations', [
    group('simulation', '시뮬레이션·권위', 'simulation-budget tick-overload input-authority world-authority ecs-archetype-sparse-set-structural-changes quaternion-rotation-interpolation-normalization floating-point-deterministic-simulation-limits snapshot-interpolation-network-jitter-buffers delta-compression-baseline-ack-recovery entity-ids-generations-replication-lifecycle rollback-netcode-input-delay-replay deterministic-random-streams-simulation-replay'),
    group('spatial', '공간·충돌', 'spatial-candidates aoi-disclosure continuous-contact rewind-evidence spatial-morton-codes-locality-range-queries'),
    group('pathfinding', '경로 탐색·행동', 'pathfinding-foundations pathfinding-lab navigation-production flow-field-foundations navigation-clearance astar-frontier jump-point-search path-execution space-time-reservations behavior-lifetime navmesh-funnel-corridor-waypoint-extraction orca-reciprocal-velocity-obstacle-local-avoidance'),
    group('voxels', '복셀', 'voxel-pipeline recast-voxel-reference-lab voxel-semantics voxel-version-bundle dda-boundaries'),
    group('game-rewards', '랭킹·보상', 'ranking-entitlement matchmaking-rating-uncertainty-queue-expansion game-inventory-item-identity-stacking-transactions'),
  ]),
  group('ai', '머신러닝·AI 에이전트', 'learning-agent-foundations', [
    group('machine-learning', '머신러닝', 'linear-regression-foundations data-splits gradient-descent loss-objective generalization classification-metrics logistic-regression-logits decision-tree-impurity-pruning random-forest-bagging-subspaces gradient-boosting-residual-fitting feature-scaling-standardization-leakage pca-covariance-eigenvectors kmeans-initialization-distance-quality probability-calibration-reliability-brier embedding-cosine-normalization hnsw-graph-construction-search-recall bm25-term-document-statistics hybrid-retrieval-rrf-reranking transformer-attention-masks-kv-cache'),
    group('agents', 'AI 에이전트', '', [
      group('agent-execution', '실행 구조', 'agent-runtime agent-execution-loop agent-tool-contract agent-durable-effects'),
      group('agent-context', '문맥·검색·메모리', 'agent-context-handoff agent-memory-lineage agent-research-evidence agent-progressive-tools'),
      group('agent-protocols', '연동 프로토콜', 'agent-mcp-contract agent-mcp-authority agent-a2a-lifecycle'),
      group('agent-safety', '권한·격리', 'agent-retrieval-boundary agent-sandbox-supply'),
      group('agent-quality', '협업·평가·비용', 'agent-delegation-integration agent-coding-browser agent-evaluation-outcomes agent-trial-compute agent-routing-cost'),
    ]),
  ]),
]);

export function buildKnowledgeTree(structure, catalog) {
  const byId = new Map(catalog.map(note => [note.id, note]));
  const seenNotes = new Set();
  const seenGroups = new Set();
  const paths = new Map();
  function visit(node, ancestors) {
    if (seenGroups.has(node.id)) throw new Error(`중복 지식 분류: ${node.id}`);
    seenGroups.add(node.id);
    const path = [...ancestors, { id: node.id, title: node.title }];
    const entries = node.noteIds.map(id => {
      if (!byId.has(id) || seenNotes.has(id)) throw new Error(`지식 트리 문서 누락 또는 중복: ${id}`);
      seenNotes.add(id);
      paths.set(id, path);
      return byId.get(id);
    });
    const children = node.children.map(child => visit(child, path));
    return { id: node.id, title: node.title, entries, children, count: entries.length + children.reduce((sum, child) => sum + child.count, 0) };
  }
  const tree = visit(structure, []);
  const missing = catalog.filter(note => !seenNotes.has(note.id));
  if (missing.length) throw new Error(`미분류 문서: ${missing.map(note => note.id).join(', ')}`);
  return { tree, paths };
}

export const { tree: knowledgeTree, paths: knowledgePaths } = buildKnowledgeTree(knowledgeStructure, notes);
