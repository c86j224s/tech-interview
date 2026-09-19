---
id: elf-static-dynamic
title: 정적 링크와 동적 링크를 비교할 때 실행 파일에 무엇이 포함되고 실행 시 어떤 resolver가 추가로 필요하다고 설명하나요?
difficulty: 하
category: 운영체제
tags:
  - ELF
  - static linking
  - dynamic linking
  - loader
related:
  - process-vs-thread
---
# 정적 링크와 동적 링크를 비교할 때 실행 파일에 무엇이 포함되고 실행 시 어떤 resolver가 추가로 필요하다고 설명하나요?

## 구두 답변

결론부터 말하면 정적 링크는 link editor가 필요한 object·archive 구현을 실행 image에 결합해 실행 시 해당 archive를 다시 찾지 않게 하는 방식이고, 동적 링크는 실행 파일에 shared object 의존성과 dynamic symbol·relocation 정보를 남겨 runtime linker의 추가 처리를 필요로 합니다. 예를 들어 `main.o`가 `parse`를 참조하고 `libparse.a`의 한 member가 정의를 제공하면 link editor가 그 member를 선택하고 image 안의 section 배치와 내부 relocation을 정리합니다. 이때 정적이라는 말은 해당 라이브러리 결합 경계를 뜻하지, startup code나 syscall 사용이 사라진다는 뜻은 아닙니다. 반대로 `libparse.so`를 선택하면 실행 파일에는 `NEEDED` 같은 의존성 정보와 동적 lookup에 필요한 심볼이 남습니다. loader가 실행 파일과 의존 object를 매핑한 뒤 runtime linker가 실제 load bias를 반영해 symbol을 찾고 relocation을 적용합니다. 라이브러리가 없거나 ABI가 맞지 않으면 link 성공 뒤 load 단계에서 실패할 수 있습니다. 같은 호출의 상태를 시간순으로 보면 archive 경로는 `main.o 참조 → link 시 member 선택 → image 내부 주소 확정`이고, shared object 경로는 `main.o 참조 → 의존성 기록 → load → lookup/relocation → 호출`입니다. 동적 링크도 relocation을 하며, 반대로 정적 링크에도 link 시점에 처리할 relocation이 있을 수 있습니다. section 이름만 보고 결론내리지 않고 `readelf -d`의 의존성, `readelf -r`의 relocation, 대상 ABI의 lookup 규칙을 함께 봅니다. gABI 일반 문서는 이 구조를 설명하지만 특정 CPU의 relocation 식과 모든 loader의 symbol 우선순위까지 보장하지 않으므로 플랫폼 범위를 명시해야 합니다.

## 득점 포인트

- 정적 경로의 archive member 선택과 동적 경로의 shared object 의존성 기록을 서로 다른 입력으로 설명합니다.
- 실행 시 runtime linker가 load bias·symbol·relocation을 처리한다는 시간 경계를 구체적인 `parse()` 상태로 보여 줍니다.
- gABI 공통 구조와 target ABI의 lookup·relocation 정책을 구분해 과도한 보편화를 피합니다.

## 감점 포인트

- 정적 링크에는 relocation이 전혀 없고 동적 링크에는 relocation이 없다고 말하면 두 경계를 동시에 거꾸로 설명한 것입니다.
- section 이름만 보고 static 또는 dynamic 여부를 결정하거나 runtime linker를 kernel syscall table과 동일시하면 안 됩니다.
- library 부재나 ABI 오류가 link가 아니라 load 단계에서 드러날 수 있다는 실패 지점을 빼면 답변이 불완전합니다.

## 더 파고들 거리

- `readelf -d`, `readelf -r`, 대상 ABI supplement를 연결해 의존성·relocation·플랫폼 계산식을 확인합니다.
- 정적 결합의 배포 단순성과 image별 보안 업데이트 비용을 동적 결합의 공유와 startup 비용과 비교합니다.
- 실행하지 않은 Linux loader trace나 특정 relocation 번호를 실제 측정값처럼 제시하지 않습니다.
