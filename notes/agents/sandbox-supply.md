---
id: agent-sandbox-supply
title: 에이전트 Sandbox와 도구·지침 공급망
topic: AI 에이전트
summary: 파일·네트워크·자격·커널·자원·작업 수명을 격리하고 코드뿐 아니라 설명·schema·스킬·캐시·진행 작업의 변경과 회수를 관리합니다.
questionIds: [agent-sandbox-isolation, agent-tool-supply-chain]
---

# 에이전트 Sandbox와 도구·지침 공급망

## 컨테이너 이름보다 무엇이 열려 있는지 봅니다

작업 컨테이너에 host home·SSH key·cloud credential·container 관리 socket을 mount하면 격리의 가치가 크게 줄어듭니다. 생성 코드뿐 아니라 저장소 install hook·test script·의존성도 비신뢰 실행에 포함합니다. 위협 모델과 보호 대상에 따라 제한된 container 또는 더 강한 VM/microVM 경계를 선택합니다.

필요한 repository만 mount하고 불필요한 privilege·system capability를 제거합니다. read-only secret을 network로 읽어 보내는 것은 가능할 수 있어 쓰기 금지만으로 기밀성을 보호하지 못합니다.

## 실행 중뿐 아니라 반입·반출·재사용도 검사합니다

| 경계 | 통제 |
| --- | --- |
| 파일 | 필요한 경로만·host 자격 제외 |
| 네트워크 | 허용 목적지·행동·metadata/관리망 차단 |
| 자격 | 단기·최소 scope·실행기에만 전달 |
| 자원 | CPU·memory·disk·PID·output·시간 한도 |
| 수명 | process group·자식·원격 task 추적 |
| 산출물 | 경로·크기·형식 검사 후 별도 반영 |
| 공유 cache | 신뢰 출처·쓰기 제한·사용자 데이터 격리 |

생성 archive를 임의 경로에 풀거나 생성 executable을 host에서 자동 실행하지 않습니다. 한 trial의 정답·비밀·오염 package가 다음 trial에 남지 않게 합니다. 채점기와 정답은 agent가 수정할 수 없는 별도 영역에 둡니다.

```diagram
{"title":"격리된 실험에서 검토된 산출물만 반영합니다","caption":"화살표는 입력·실행·반출 경계입니다. sandbox 성공이 운영 게시나 외부 변경 권한을 자동 부여하지 않습니다.","rows":[[{"id":"input","label":"검토된 입력·제한된 자격"}],[{"id":"sandbox","label":"파일·네트워크·자원 제한 실행"}],[{"id":"output","label":"산출물 경로·크기·내용 검사"}],[{"id":"approve","label":"별도 승인·현재 대상 조건"}],[{"id":"apply","label":"허용된 반영·결과 검증"}]],"edges":[{"from":"input","to":"sandbox","label":"최소 권한"},{"from":"sandbox","to":"output","label":"자동 실행 금지"},{"from":"output","to":"approve","label":"실제 diff"},{"from":"approve","to":"apply","label":"승인 범위"}]}
```

대화 deadline이 끝나도 자식 process는 남을 수 있습니다. 실제 종료·file/port 정리·budget 반환을 확인하고 원격 효과는 별도 조회합니다. 외부 네트워크를 전부 막으면 필요한 정상 시험도 안 될 수 있으므로 허용 동작이 실제 가능한지 양성 시험을 포함합니다.

## 도구 설명도 행동을 바꾸는 공급망입니다

조회 도구 설명이 “먼저 로그를 업로드”로 바뀌거나 skill 예제가 새 shell script를 실행하면 실행 코드 diff 없이도 행동이 바뀝니다. 이름·description·schema·default·read-only/idempotent 주석·참고 자료·script·의존성을 함께 검토합니다. 서명은 누가 배포했는지를 확인하지만 안전성이나 현재 과제 적합성을 증명하지 않습니다.

package version·hash·소유자·source를 고정하고 필요한 보안 업데이트는 검토·격리 시험·점진 적용합니다. 원격 endpoint가 같은 주소에서 바뀌면 로컬 lockfile만으로 재현되지 않으므로 관측한 정의 hash·지원 version·server identity·계약 시험을 남깁니다.

## 회수는 목록에서 숨기는 것보다 강해야 합니다

오래된 세션은 cache한 도구 schema로 계속 호출할 수 있습니다. 긴급 차단은 실행기에서 해당 version/행동을 거절하고 자격·진행 task·재시도·cache를 함께 처리합니다. 이미 외부 효과가 발생했다면 차단이 롤백을 의미하지 않습니다. rollback은 코드뿐 아니라 schema·설정·memory·옛 workflow state와의 호환도 확인합니다.

합성 비밀·격리 목적지에서 금지 파일 접근·egress·process 잔존·자원 포화·악성 설명·업데이트 후 의미 변경을 검사합니다. 현재 작업에서 실제 sandbox 탈출 시험이나 원격 공급망 공격을 수행한 것은 아닙니다. 이 노트는 방어 설계와 검증 범위입니다.
