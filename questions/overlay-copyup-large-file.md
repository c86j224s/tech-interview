---
id: overlay-copyup-large-file
title: lower layer의 큰 파일 한 바이트를 수정할 때 writable layer가 커질 수 있는 이유와 피하는 경로를 설명하세요.
difficulty: 중하
category: 인프라
tags:
  - OCI
  - layer
  - whiteout
related:
  - container-image-reproducibility
---
# lower layer의 큰 파일 한 바이트를 수정할 때 writable layer가 커질 수 있는 이유와 피하는 경로를 설명하세요.

## 구두 답변
overlay 계열에서 lower는 읽기 전용이고 upper가 실행 중 쓰기 영역이므로, lower 파일을 처음 수정할 때 copy-up이 먼저 일어날 수 있습니다. `/opt/data.bin`이 lower에 512MiB로 있고 프로세스가 offset 10의 한 바이트를 바꾸면 논리적 delta는 1바이트지만, 구현이 upper에 파일 사본을 만든 뒤 그 위치를 수정하는 경로라면 upper 사용량과 첫 write 지연은 512MiB에 가까워질 수 있습니다. 이는 OCI layer가 diff라는 사실과 모순되지 않습니다. OCI diff는 이미지 생성·commit 시 표현이고, copy-up은 실행 중 mount driver가 쓰기 가능성을 만드는 임시 상태입니다.

상태를 세 단계로 나누면 정확합니다. 이미지 시점에는 L0 blob에 큰 파일이 있고, 컨테이너 시작 후 lower/upper가 합쳐져 `/opt/data.bin`이 보입니다. 첫 write에서 upper에 copy-up된 사본과 수정 결과가 생기며, 이후 같은 파일의 쓰기는 이미 지불한 비용 위에서 진행될 수 있습니다. commit을 하면 upper의 최종 결과가 새 OCI diff tar로 포장됩니다. overlayfs의 mount 옵션, metacopy·redirect, rootless 구성, snapshotter와 파일 종류에 따라 데이터 전체 또는 메타데이터 중심 처리가 달라질 수 있으므로 “항상 전체 복사”를 OCI 규칙으로 말하지 않습니다.

피할 경로는 자주 변하는 큰 데이터를 image lower에 넣지 않는 것입니다. DB, 로그, cache, 업로드 결과를 named volume·별도 writable filesystem·외부 저장소로 보내면 수명과 쓰기 비용을 image upper에서 분리할 수 있습니다. 레이어를 더 쪼개는 것만으로는 같은 lower 경로의 첫 쓰기를 없애지 못합니다. 진단에서는 volume mount 여부, 파일이 이미 upper에 있는지, read-only 여부, upperdir 전후 사용량, 첫 write latency를 함께 기록해야 합니다. 이 환경에서는 실제 overlay mount를 실행하지 않았으므로 512MiB는 설명용 예상치입니다.

## 득점 포인트
- 1바이트 논리 변경과 copy-up의 물리적 사본 크기가 다를 수 있음을 중간 상태로 추적합니다.
- 이미지 build/commit diff와 실행 writable upper를 별도의 저장 단계로 구별합니다.
- volume 선택과 driver·mount 옵션별 실측을 피할 경로와 검증 경로로 제시합니다.

## 감점 포인트
- OCI 규격이 모든 runtime의 copy-up 단위를 정한다고 말하면 구현 경계를 넘습니다.
- 레이어 수 감소가 이미 lower에 있는 큰 파일의 첫 쓰기 비용을 자동 제거한다고 하면 틀립니다.
- read-only lower, upper 사본, commit 후 새 layer를 하나의 파일로 설명하면 비용 시점이 섞입니다.

## 더 파고들 거리
- 같은 workload에서 첫 write 전후 upperdir 사용량과 latency를 어떤 mount 옵션 조합으로 비교할지 설계합니다.
- 이미 upper에 있는 파일, volume 파일, read-only 파일의 실패·성공 경로를 별도 fixture로 나눕니다.
