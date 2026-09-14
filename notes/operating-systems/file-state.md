---
id: file-state
title: 파일 디스크립터·매핑·내구 교체의 경계
topic: 운영체제
summary: dup·fork의 열린 파일 상태 공유, mmap·page cache·COW와 파일 내용·이름 교체의 내구성을 구분합니다.
questionIds: [os-file-descriptor-sharing, os-mmap-pagecache, os-fsync-directory, os-copy-on-write-fork]
---

# 파일 디스크립터·매핑·내구 교체의 경계

## FD 숫자는 열린 파일 상태 자체가 아닙니다

파일 `ABCDE`를 열고 fd2=dup(fd1)을 만든 뒤 fd1에서 두 바이트를 읽으면 `AB`를 얻습니다. fd2에서 다음 두 바이트를 읽으면 일반적인 공유 열린 파일 상태에서는 `CD`를 얻습니다. 두 descriptor가 같은 커널의 열린 파일 설명과 offset을 공유하기 때문입니다.

반면 같은 경로를 별도로 open하면 독립 offset을 가질 수 있습니다. pread처럼 offset을 지정하는 연산은 공유 현재 위치를 이동시키지 않고 읽는 대안입니다. descriptor 번호가 같거나 다르다는 것만으로 공유 여부를 판단하지 않습니다.

```diagram
{"title":"두 FD가 하나의 열린 파일 위치를 가리킵니다","caption":"화살표는 커널 객체 참조입니다. dup과 fork로 물려받은 참조는 열린 파일 설명을 공유할 수 있고, 한 참조의 close가 다른 참조까지 자동 제거하지 않습니다.","rows":[[{"id":"fd1","label":"fd1"},{"id":"fd2","label":"fd2 = dup(fd1)"}],[{"id":"open","label":"열린 파일 설명","detail":["공유 offset · 일부 상태"]}],[{"id":"file","label":"파일 데이터"}]],"edges":[{"from":"fd1","to":"open","label":"참조"},{"from":"fd2","to":"open","label":"참조"},{"from":"open","to":"file","label":"현재 위치 읽기"}]}
```

한 descriptor를 닫아도 다른 참조가 남으면 자원이 유지됩니다. 자식 프로세스에 소켓 FD가 새면 부모 close 후에도 peer가 EOF를 못 볼 수 있습니다. close-on-exec를 생성 시점의 race 없는 옵션으로 설정하고 자식의 불필요한 descriptor를 정리합니다.

## mmap은 파일 전체를 즉시 RAM에 올리지 않습니다

mmap은 파일을 가상 주소 공간에 연결합니다. 처음 접근할 때 page fault가 생길 수 있고 page cache에 없으면 실제 읽기가 필요합니다. 이미 cache에 있으면 매핑만 준비할 수 있습니다. read와 mmap 모두 page cache 영향을 받으므로 syscall 수만 비교하면 비용을 놓칩니다.

| 경로 | 이점 | 남는 비용·위험 |
| --- | --- | --- |
| 큰 buffered read | 순차 읽기·명시적 오류 처리 | 버퍼 복사·호출 |
| mmap | 주소로 임의 접근·일부 복사 감소 | fault·TLB·매핑 수명 |
| 공유 쓰기 매핑 | 파일과 변경 공유 | 동기화·flush·내구성 |
| private 매핑 | 변경을 사적으로 유지 | COW·별도 메모리 증가 |

다른 프로세스가 파일을 축소하면 매핑 접근이 일반 read 반환 오류와 다른 신호·예외로 실패할 수 있습니다. 파일 크기와 수명을 통제하고 매핑 바이트를 임의 객체 포인터처럼 읽지 않습니다. 정렬·길이·유효 표현 검사는 그대로 필요합니다.

## fork의 COW는 복사를 미룹니다

부모와 자식이 초기 페이지를 공유하다 어느 쪽이 쓰면 필요한 페이지를 복사하는 것이 copy-on-write입니다. 작은 필드 변경도 페이지 단위의 사본을 만들 수 있습니다. 자식 snapshot 작업이 오래 살아 있고 부모의 쓰기율이 높으면 그 기간의 메모리 피크가 커집니다.

fork 자체에도 페이지 테이블·정지 시간이 들 수 있습니다. RSS 합은 공유 페이지를 중복 셀 수 있어 PSS·공유·private 지표를 함께 봅니다. COW가 있다고 멀티스레드 부모의 잠금·라이브러리 상태를 자식에서 안전하게 사용할 수 있다는 뜻은 아닙니다. fork 뒤 허용된 실행 경로를 별도로 지켜야 합니다.

## 원자 이름 교체와 전원 장애 내구성은 다릅니다

새 내용을 임시 파일에 쓰고 같은 파일시스템에서 rename으로 교체하면 독자가 반쪽 내용을 보는 문제를 줄일 수 있습니다. 그러나 write 성공은 디스크 기록 완료가 아니고 rename 성공도 새 이름의 디렉터리 항목까지 모든 장애에서 보존됐다는 뜻은 아닙니다.

```text
prepare temporary file beside target
write complete content, handling partial writes
flush userspace buffers
fsync temporary file according to platform contract
atomically replace target name
fsync parent directory where required and supported
report committed only after required durability steps
```

이 절차는 POSIX 계열에서 흔한 설계 모형이며 모든 OS·파일시스템·장치의 보장을 동일하게 주장하지 않습니다. 각 오류를 처리하고 파일 권한·소유자·심볼릭 링크·동시 writer의 기준 버전을 확인합니다. 다른 파일시스템 사이 이동은 같은 rename 원자성으로 볼 수 없습니다.

## 여러 파일은 완료 집합을 마지막에 공개합니다

본문·색인·메타데이터 세 파일을 각자 교체하면 독자가 새 본문과 옛 색인을 섞을 수 있습니다. 고유 버전 디렉터리에 완성 집합을 만들고 검증한 뒤 그 집합을 가리키는 manifest 또는 포인터를 마지막에 바꾸는 구조를 사용할 수 있습니다. 옛 독자가 참조하는 집합은 곧바로 삭제하지 않습니다.

체크섬과 버전은 복구 시 유효본을 판단하는 단서지만 동시 writer·접근권한·진위까지 해결하지 않습니다. 중단된 임시 파일을 최종 결과로 오인하지 않도록 완료 표식과 정리 기준을 둡니다.

## 정상 종료만으로 장애 복구를 증명하지 않습니다

dup·별도 open·pread의 위치를 작은 파일로 비교하고, mmap의 cold·warm·순차·무작위 접근을 나눠 측정합니다. COW는 읽기만 하는 경우와 최대 쓰기율·느린 자식을 비교합니다.

저장 절차는 각 단계 뒤 중단·디스크 부족·동시 갱신을 시험하고 재시작 후 옛·새·부분 파일을 확인합니다. 프로세스 종료만으로 OS page cache를 잃는 전원 장애를 재현한 것은 아니므로 장애 종류를 구분해야 합니다. 수명·가시성·내구성은 각각 다른 검증 결과입니다.
