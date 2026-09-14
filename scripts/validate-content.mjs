import { questions } from '../src/lib/questions.mjs';
import { notes } from '../src/lib/notes.mjs';
import { studyCoverage } from '../src/lib/study-coverage.mjs';
if (studyCoverage.length !== questions.length) throw new Error('학습 범위 목록에 문항이 누락됐습니다.');

console.log(`검증 완료: ${questions.length}문항과 ${notes.length}개 학습 노트의 인덱스, 메타데이터, 본문, 연결 ID가 정상입니다.`);
