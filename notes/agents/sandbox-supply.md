---
id: agent-sandbox-supply
title: 에이전트 Sandbox와 도구·지침 공급망
topic: AI 에이전트
summary: 파일·네트워크·자격·커널·자원·작업 수명을 격리하고 코드뿐 아니라 설명·schema·스킬·캐시·진행 작업의 변경과 회수를 관리합니다.
questionIds: [agent-sandbox-isolation, agent-tool-supply-chain]
---

# 에이전트 Sandbox와 도구·지침 공급망

## 컨테이너 이름과 실제 노출 범위

작업 컨테이너에 host home·SSH key·cloud credential·container 관리 socket을 mount하면 격리의 가치가 크게 줄어듭니다. 생성 코드뿐 아니라 저장소 install hook·test script·의존성도 비신뢰 실행에 포함합니다. 위협 모델과 보호 대상에 따라 제한된 container 또는 더 강한 VM/microVM 경계를 선택합니다.

실행 컨테이너에는 필요한 repository만 mount하고, 사용하지 않는 `privilege`와 `system capability`를 제거합니다. secret 파일이 read-only여도 실행 코드가 그 값을 읽어 네트워크로 보낼 수 있으므로, 쓰기 금지만으로 기밀성이 보장되지는 않습니다.

## 실행·반입·반출·재사용 통제

| 경계 | 통제 |
| --- | --- |
| 파일 | 필요한 경로만·host 자격 제외 |
| 네트워크 | 허용 목적지·행동·metadata/관리망 차단 |
| 자격 | 단기·최소 scope·실행기에만 전달 |
| 자원 | CPU·memory·disk·PID·output·시간 한도 |
| 수명 | process group·자식·원격 task 추적 |
| 산출물 | 경로·크기·형식 검사 후 별도 반영 |
| 공유 cache | 신뢰 출처·쓰기 제한·사용자 데이터 격리 |

생성된 archive는 허용한 경로인지와 내용을 먼저 확인한 뒤 풀고, 그 안의 executable을 host에서 자동 실행하지 않습니다. 한 `trial`에서 나온 정답·비밀·오염된 package가 다음 trial의 파일이나 `cache`로 넘어가지 않도록 실행 환경을 분리합니다. 채점기와 정답은 agent가 쓸 수 없는 별도 영역에 두어, 산출물을 만드는 쪽이 평가 기준을 바꾸지 못하게 합니다.

```diagram
{"title":"격리된 실험에서 검토된 산출물만 반영합니다","caption":"화살표는 입력·실행·반출 경계입니다. sandbox 성공이 운영 게시나 외부 변경 권한을 자동 부여하지 않습니다.","rows":[[{"id":"input","label":"검토된 입력·제한된 자격"}],[{"id":"sandbox","label":"파일·네트워크·자원 제한 실행"}],[{"id":"output","label":"산출물 경로·크기·내용 검사"}],[{"id":"approve","label":"별도 승인·현재 대상 조건"}],[{"id":"apply","label":"허용된 반영·결과 검증"}]],"edges":[{"from":"input","to":"sandbox","label":"최소 권한"},{"from":"sandbox","to":"output","label":"자동 실행 금지"},{"from":"output","to":"approve","label":"실제 diff"},{"from":"approve","to":"apply","label":"승인 범위"}]}
```

대화 deadline이 끝나도 자식 process는 남을 수 있습니다. 실제 종료·file/port 정리·budget 반환을 확인하고 원격 효과는 별도 조회합니다. 외부 네트워크를 전부 막으면 필요한 정상 시험도 안 될 수 있으므로 허용 동작이 실제 가능한지 양성 시험을 포함합니다.

## 도구 설명의 공급망 신뢰 경계

조회만 하던 도구의 설명이 어느 날 “먼저 로그를 업로드”로 바뀌거나, `skill` 예제가 새 `shell script`를 실행하게 되면 실행 코드에 diff가 없어도 실제 행동이 달라집니다. 그래서 이름과 `description`, `schema`, `default`, `read-only`·`idempotent` 주석, 참고 자료, script, 의존성을 한 묶음으로 비교합니다. 서명은 누가 배포했는지는 보여 주지만, 그 내용이 안전하거나 현재 과제에 맞는다는 사실까지 증명하지는 않습니다.

package version·hash·소유자·source를 고정하고 필요한 보안 업데이트는 검토·격리 시험·점진 적용합니다. 원격 endpoint가 같은 주소에서 바뀌면 로컬 lockfile만으로 재현되지 않으므로 관측한 정의 hash·지원 version·server identity·계약 시험을 남깁니다.

## 도구 회수와 실행기 차단 범위

오래된 세션이 예전에 cache한 도구 `schema`를 갖고 있으면, 최신 목록에서 그 도구를 숨겨도 해당 세션은 그 schema로 계속 호출할 수 있습니다. 긴급 차단은 실행기에서 해당 `version`이나 행동을 거절하고, 자격·진행 중인 `task`·재시도·`cache`를 함께 처리해야 합니다. 이미 외부 효과가 생겼다면 차단만으로 그 효과가 롤백되지는 않습니다. `rollback`할 때는 코드뿐 아니라 `schema`, 설정, `memory`, 오래된 `workflow state`와 새 버전의 호환도 확인합니다.

합성 비밀·격리 목적지에서 금지 파일 접근·egress·process 잔존·자원 포화·악성 설명·업데이트 후 의미 변경을 검사합니다. 현재 작업에서 실제 sandbox 탈출 시험이나 원격 공급망 공격을 수행한 것은 아닙니다. 이 노트는 방어 설계와 검증 범위입니다.
