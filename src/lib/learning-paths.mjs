import { notes } from './notes.mjs';
import { knowledgeTree, knowledgePaths } from './knowledge-tree.mjs';

const paths = [
  ['server-io', '서버 입출력', '소켓의 기본 동작에서 운영체제별 이벤트 루프와 버퍼 수명으로 이어집니다.', 'iocp-foundations io-model-selection epoll-foundations kqueue-foundations io-uring-foundations io-uring-lifetimes iocp-completion rio-foundations'],
  ['ownership-sync', '객체 수명과 동기화', '소유 그래프와 공유 상태를 구분하고 안전한 참조 획득·종료를 설계합니다.', 'programming-language-foundations reference-counting-foundations synchronization-foundations concurrent-ownership atomic-publication safe-reclamation cancellation'],
  ['trees-paths', '트리와 길찾기', '트리 순회와 그래프 비용 모델을 익힌 뒤 실제 이동과 다중 에이전트로 확장합니다.', 'tree-foundations spatial-tree-foundations pathfinding-foundations dijkstra astar navigation-production flow-field-foundations'],
  ['voxel-world', '복셀 월드', '원본 저장·표면 생성·충돌·이동 공간의 서로 다른 책임을 연결합니다.', 'game-server-foundations voxel-pipeline voxel-semantics dda-boundaries navigation-clearance voxel-version-bundle'],
  ['identity', '인증과 권한 위임', 'OAuth의 권한 위임과 OIDC의 인증을 나누고 제품 배치·갱신·회수를 다룹니다.', 'security-foundations oauth2-foundations oidc-foundations oauth-deployment login-transaction refresh-rotation key-rotation'],
  ['services', '서비스 아키텍처', '모듈 경계에서 출발해 분산 주문·중복 처리·배포와 장애 복구를 설계합니다.', 'software-design-foundations rest-reactive-foundations msa-foundations msa-order-workflow transactional-outbox consumer-inbox msa-production'],
  ['event-platforms', 'Kafka와 Pulsar', '로그와 구독의 기본 모델을 이해하고 생산·소비 구현과 운영 보장을 비교합니다.', 'data-system-foundations kafka-foundations kafka-application kafka-operations pulsar-foundations pulsar-application pulsar-operations'],
  ['core', '자료구조·데이터·언어 기반', '알고리즘 선택과 데이터 모델, Java의 자료구조·공개 경계를 연결합니다.', 'computer-science-foundations sorting-foundations algorithm-strategies database-models programming-language-foundations java-collections java-access-contracts'],
  ['clients-learning', '클라이언트와 모델 학습', '플랫폼 실행·호환성·저장과 데이터 기반 학습의 기본 흐름을 살펴봅니다.', 'client-foundations web-platform-tooling ios-runtime-storage learning-agent-foundations linear-regression-foundations'],
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
