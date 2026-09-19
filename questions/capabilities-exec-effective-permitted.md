---
id: capabilities-exec-effective-permitted
title: >-
  permitted와 effective capability가 다를 때 실행 파일을 바꾸면 어떤 권한 변화가 가능한가요? execve 계산을
  어떻게 추적하나요?
difficulty: 중하
category: 보안
tags:
  - capability
  - execve
  - least privilege
related:
  - authentication-vs-authorization
---
# permitted와 effective capability가 다를 때 실행 파일을 바꾸면 어떤 권한 변화가 가능한가요? execve 계산을 어떻게 추적하나요?

## 구두 답변

`effective`는 현재 권한 검사에 사용되고 `permitted`는 effective로 올릴 수 있는 상한이므로 둘을 같은 집합으로 읽으면 안 됩니다. 실행 직전 `E=∅`이어도 `I`, `B`, `A`와 실행 파일의 `F(I)`, `F(P)`, file effective bit가 execve 뒤 새 상태를 만들 수 있습니다. 핵심 계산은 `P'(P)=(P(I)&F(I)) | (F(P)&P(B)) | P'(A)`이고, privileged file이 아니면 `P'(A)=P(A)`, file effective bit가 켜지면 `P'(E)=P'(P)`, 아니면 `P'(E)=P'(A)`입니다. 설명용 상태를 `I={NET_RAW}`, `B={NET_RAW,CHOWN}`, `A=∅`, `E=∅`, 파일 `F(I)={NET_RAW}`, `F(P)={CHOWN}`, effective bit=1로 두면 첫 항은 NET_RAW, 둘째 항은 CHOWN이어서 실행 뒤 `P'=E'={NET_RAW,CHOWN}`입니다. B에서 CHOWN을 drop하면 결과는 `{NET_RAW}`입니다. 이 계산은 문서 기반 예상 trace입니다. 실제 진단은 같은 TID의 `/proc/.../status`를 exec 전후 저장하고 `getcap`/security.capability, mount `nosuid`, filesystem 지원, set-user-ID 여부, user namespace와 LSM을 같이 확인합니다. `getcap`은 파일 입력이지 실행 후 effective 결과가 아닙니다. 권한을 줄일 때 E만 0으로 만들면 permitted나 file capability 경로가 남을 수 있으므로 P와 B를 함께 줄이는지 검토하겠습니다. 다만 loader와 종료 경로를 먼저 막아 서비스가 자기 정책으로 죽지 않는지 Linux 대상에서 검증해야 합니다.

## 득점 포인트

- E·P의 역할을 구분하고 I·B·A·file capability를 포함한 execve 식을 적용합니다.
- NET_RAW/CHOWN 집합의 중간 계산과 bounding drop 후 결과를 정확히 보여 줍니다.
- 파일 xattr 결과와 실행 후 per-thread Cap*를 구분하고 nosuid·LSM 조건을 확인합니다.

## 감점 포인트

- 현재 E가 비어 있으므로 execve 뒤에도 항상 무권한이라고 단정합니다.
- getcap 출력만으로 실행 후 E를 확정하거나 file effective bit를 무시합니다.
- E drop과 B drop을 같은 비가역 조치로 설명합니다.

## 더 파고들 거리

- file effective bit가 꺼진 파일에서 P'에 capability가 있어도 E'가 비는 이유를 설명해 보세요.
- 멀티스레드에서 한 TID만 capset을 바꿨을 때 관찰 파일과 exec 대상의 차이를 말해 보세요.
