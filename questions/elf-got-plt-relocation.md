---
id: elf-got-plt-relocation
title: >-
  위치 독립 코드가 외부 함수 주소를 매번 고정하지 않고 호출합니다. GOT/PLT와 lazy relocation을 어떤 실행 시점 경계로
  설명하나요?
difficulty: 중하
category: 운영체제
tags:
  - ELF
  - GOT
  - PLT
  - PIC
  - lazy binding
related:
  - syscall-user-kernel
---
# 위치 독립 코드가 외부 함수 주소를 매번 고정하지 않고 호출합니다. GOT/PLT와 lazy relocation을 어떤 실행 시점 경계로 설명하나요?

## 구두 답변

PIC의 핵심은 실행 시 확정될 외부 주소를 명령어 곳곳에 절대값으로 박지 않고 indirection을 두는 것입니다. 대표적인 경로에서 caller는 PLT stub로 분기하고, stub는 GOT slot을 이용해 외부 함수 주소로 이동합니다. lazy binding이 허용된 첫 호출이라면 GOT slot이 아직 resolver 경로를 가리킬 수 있습니다. 흐름은 `caller → PLT → runtime resolver → symbol lookup → GOT slot 갱신 → target`이고, 이후 호출은 갱신된 slot을 사용하므로 매번 전체 lookup을 반복하지 않습니다. 예를 들어 첫 `puts` 호출 전 slot이 resolver entry이고 resolver가 target `0x71001230`을 찾았다면 slot을 그 값으로 바꾼 뒤 반환합니다. 두 번째 호출은 같은 PLT/GOT 경로에서 이미 기록된 target으로 가므로 첫 호출의 lookup 비용이 반복되지 않습니다. eager binding은 이 relocation 처리를 startup으로 앞당겨 첫 호출 지연과 실행 중 writable-GOT 변경 창을 줄이는 대신 시작 시간과 초기 relocation 비용을 부담합니다. 다만 정확한 PLT 명령 형식, GOT 위치, relocation type과 lazy 정책은 processor ABI·loader·RELRO 같은 보안 설정에 따라 달라집니다. 따라서 모든 ELF가 동일한 layout을 가진다고 말하지 않습니다. runtime linker가 user-space에서 이 작업을 한다는 것은 함수 호출마다 kernel syscall을 한다는 뜻도 아닙니다. 진단할 때는 relocation table, dynamic dependency, 실제 GOT 권한과 binding 옵션을 따로 확인하고, 이 환경에서 실행하지 않은 loader trace를 성공 측정처럼 꾸미지 않습니다.

## 득점 포인트

- PIC가 절대 주소를 명령어에 박는 대신 GOT indirection과 PLT stub를 사용하는 목적을 설명합니다.
- 첫 호출의 `resolver → GOT 갱신`과 두 번째 호출의 갱신된 slot 사용을 시간순으로 말합니다.
- lazy의 첫 호출 지연과 eager의 startup·보안 변경 창 비용을 함께 비교합니다.

## 감점 포인트

- 모든 호출마다 resolver가 다시 실행되거나 PLT가 kernel syscall table이라는 설명은 잘못된 경계입니다.
- 모든 ELF CPU에서 같은 GOT/PLT layout과 lazy policy가 제공된다고 일반화하지 않습니다.
- RELRO와 loader 설정을 무시하고 lazy binding이 항상 writable GOT를 남긴다고 단정하면 안 됩니다.

## 더 파고들 거리

- 대상 ABI의 PLT instruction과 relocation type을 읽은 뒤 실제 layout을 확정합니다.
- 첫 호출과 후속 호출을 trace에서 구분해 lookup 비용이 반복되지 않는지 확인합니다.
- 실제 loader 실행을 하지 않았다면 주소와 trace를 예상 상태로 표시하고 측정 결과로 포장하지 않습니다.
