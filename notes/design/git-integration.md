---
id: git-integration
title: Git Merge·Rebase·복구와 의도 보존
topic: 설계
summary: 부모 이력·새 commit ID·fast-forward를 구분하고 양 부모 diff·range-diff·reflog·보존 참조·공유 이력과 외부 효과 복구의 한계를 설명합니다.
questionIds: [git-merge-rebase, git-conflict-resolution-verification, git-reflog-rebase-recovery]
---

# Git Merge·Rebase·복구와 의도 보존

## 같은 파일 결과도 조상 관계는 다를 수 있습니다

main이 A-B, feature가 A-C-D라면 merge는 B와 D를 부모로 갖는 M을 만들 수 있습니다. rebase는 B 위에 C·D의 변경을 재적용해 C′·D′를 만듭니다. 부모가 달라지므로 내용이 비슷해도 commit ID가 달라집니다. main이 아직 A면 D로 fast-forward할 수 있어 merge가 항상 새 commit을 만드는 것은 아닙니다.

```diagram
{"title":"분기와 Merge Commit의 두 부모","caption":"화살표는 부모에서 자식으로의 이력입니다. rebase는 이 두 계통을 그대로 연결하는 대신 새 부모 위에 다른 ID의 commit을 만듭니다.","rows":[[{"id":"a","label":"A · 공통 조상"}],[{"id":"b","label":"B · main"},{"id":"c","label":"C · feature"}],[{"id":"d","label":"D · feature"}],[{"id":"m","label":"M · B와 D의 merge"}]],"edges":[{"from":"a","to":"b","label":"main 변경"},{"from":"a","to":"c","label":"feature 변경"},{"from":"c","to":"d","label":"다음 변경"},{"from":"b","to":"m","label":"첫 부모"},{"from":"d","to":"m","label":"둘째 부모"}]}
```

## 공유 이력은 보기 좋은 선형성보다 협업 계약이 먼저입니다

아직 공유하지 않은 개인 branch는 rebase로 정리할 수 있지만 다른 작업자가 기준으로 가져간 commit을 재작성하면 그들의 조상과 pull 기준이 달라집니다. 보호 branch·리뷰·팀 정책을 따릅니다. force-with-lease는 예상한 원격 ref가 바뀌었는지 검사하는 보호이지 재작성의 협업 비용이나 의미 충돌을 없애는 허가가 아닙니다.

squash는 하나의 변경으로 합치지만 개별 commit 추적·부분 복구 정보가 줄어듭니다. 공개 변경 취소는 revert로 새로운 역변경을 남길 수 있으나 배포된 DB schema·메일·결제는 Git 파일 되돌리기만으로 복구되지 않습니다.

## 충돌 표시가 없어져도 양쪽 의도가 남았는지 확인합니다

merge M과 양 부모를 각각 비교하면 통합 결과가 각 계통에 무엇을 추가·제거했는지 볼 수 있습니다. 공통 조상에서 양 branch의 원래 변화도 함께 읽어 충돌 해결로 어떤 의도를 선택했는지 기록합니다. 자동 병합된 위치에서도 함수 signature와 새 호출자가 어긋나는 의미 충돌이 가능합니다.

```sh
# 아래 값은 실제로 확인한 commit ID로 대체합니다.
git diff M^1 M
git diff M^2 M
git range-diff OLD_BASE..OLD_TIP NEW_BASE..NEW_TIP
```

range-diff는 rebase 전후 patch series 대응을 보는 도구이며 최종 실행 정확성을 증명하지 않습니다. 빌드·공통 타입·원래 두 기능의 회귀·사용자 흐름을 합친 tree에서 다시 확인합니다. 무관한 format·generated diff는 의도 검토와 구분합니다.

## Reflog를 찾기 전에 현재 작업부터 보존합니다

잘못 rebase했더라도 현재 미커밋 변경과 새 commit을 확인하고 필요한 참조를 먼저 보존합니다. local reflog에서 rebase 이전 tip을 찾고 해당 commit을 inspect한 뒤 recovery branch를 만들면 현재 branch를 즉시 덮지 않고 비교할 수 있습니다. rebase 진행 중인지도 확인하여 abort와 완료 후 복구를 구분합니다.

| 정보 | 보존하는 것 | 한계 |
| --- | --- | --- |
| backup branch/tag | 명시한 commit 도달 가능성 | 미커밋 파일은 별도 |
| reflog | local ref 이동 이력 | 영구·원격 전체 백업 아님 |
| diff/range-diff | 내용·patch 변화 | 실행 계약 검사 아님 |
| test | 검증한 동작 | 모든 외부 효과 복구 아님 |

reflog 만료·GC 뒤에는 옛 객체를 찾지 못할 수 있습니다. 찾았으면 필요한 ref를 보존하고 원래 요구와 현재 결과를 비교합니다. 복구 commit을 원격에 강제로 보내는 것은 별도 승인과 정책을 요구하는 행동입니다.

## 복구의 성공도 파일과 실행으로 확인합니다

rename·삭제·동일 줄 충돌·자동 병합 의미 충돌·rebase 중단을 작은 시험 저장소에서 검증할 수 있습니다. 이 노트의 명령은 설명 예시이며 현재 프로젝트 이력을 재작성하거나 강제 push한 실행 기록이 아닙니다.
