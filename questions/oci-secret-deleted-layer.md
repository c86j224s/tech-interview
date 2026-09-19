---
id: oci-secret-deleted-layer
title: 빌드 레이어에서 secret 파일을 만든 뒤 삭제했습니다. 최종 rootfs에 없다는 것만으로 안전하지 않은 이유는 무엇인가요?
difficulty: 중하
category: 인프라
tags:
  - OCI
  - layer
  - whiteout
related:
  - container-image-reproducibility
---
# 빌드 레이어에서 secret 파일을 만든 뒤 삭제했습니다. 최종 rootfs에 없다는 것만으로 안전하지 않은 이유는 무엇인가요?

## 구두 답변
최종 merged rootfs에서 secret 파일이 사라졌다는 것은 현재 view에서 경로가 가려졌다는 뜻이지 모든 저장 복사본이 폐기됐다는 뜻이 아닙니다. 예를 들어 L0에서 `/tmp/token`을 만들고 다음 L1에서 삭제하면 L1에는 `.wh.token`이 남고 L0 blob에는 token의 원문 바이트가 남을 수 있습니다. registry가 L0을 보관하고 pull 권한이나 cache 접근권한을 가진 주체가 있으면 `find / -name token`의 실패와 무관하게 내용을 회수할 수 있습니다. 같은 RUN에서 생성과 사용과 삭제를 처리하면 최종 diff에 덜 남을 수 있지만 명령 인자·환경·로그·builder cache까지 자동으로 안전해지는 것은 아닙니다.

whiteout은 lower path를 merged view에서 숨기는 이미지 표현입니다. 따라서 새 digest를 만들거나 상위 레이어에서 파일을 제거해도 이미 push된 과거 blob의 접근권한과 보존기간은 바뀌지 않습니다. multi-stage build도 최종 stage에 파일을 복사하지 않는 설계에는 유용하지만, 중간 stage blob과 원격 cache exporter가 보관하는 명령·파일은 별도로 폐기·보호해야 합니다. 이 질문의 실패 경계는 “최종 파일 부재”와 “비밀의 모든 흔적과 권한 회수”를 동일시하지 않는 데 있습니다.

안전한 구현은 builder가 제공하는 secret mount 또는 비영속 secret 전달을 사용하고, token을 `ARG`, `ENV`, shell history, 명령 로그, provenance에 넣지 않는 것입니다. 이미 노출한 경우에는 새 이미지를 만드는 것만으로 끝내지 말고 자격 회전, registry와 cache의 접근권한·보존·삭제 정책, build log와 artifact fork를 함께 조사합니다. 검증 순서는 각 layer tar와 config/history 검색, cache manifest 확인, 최종 rootfs 검사로 나누고, 압축 blob을 해제해 원문·부분문자열·파생 파일도 확인합니다. 실제 builder/cache를 여기서 실행하지 않았으므로 특정 도구가 완전한 은닉을 보장한다고 말하지 않습니다.

## 득점 포인트
- L0 원문과 L1 whiteout, merged rootfs, registry/cache를 시간축으로 분리합니다.
- secret mount의 장점과 multi-stage의 한계, 이미 노출된 자격 회전까지 연결합니다.
- 삭제 검사와 보안 폐기 검사를 서로 다른 증거 집합으로 설계합니다.

## 감점 포인트
- 최종 이미지에 파일이 없으니 과거 blob도 읽을 수 없다고 말하면 보존 경계를 무시합니다.
- multi-stage 또는 whiteout 하나만으로 cache·history·log의 secret까지 제거된다고 단정하면 안 됩니다.
- digest 변경을 credential revoke나 registry 접근권한 회수와 같은 조치로 설명하면 안 됩니다.

## 더 파고들 거리
- 압축 layer tar, config history, 원격 cache metadata에서 원문과 파생값을 찾을 때 false negative를 줄이는 방법을 정합니다.
- 노출 직후 자격 회전과 artifact 접근차단을 먼저 수행하고, 이후 보존정책·삭제 확인을 어떤 순서로 남길지 정합니다.
