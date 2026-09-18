# Java 접근·컬렉션 계약 실습

실습 코드와 학습 노트의 위치입니다.

```text
notes/knowledge/java-access-and-collections-lab.md
examples/knowledge/java-access-and-collections-lab/
```

## 구성

- `access/src`: `protected` qualifier, private nest, package-private top-level type의 컴파일 경계
- `modules`: `exports`와 `opens`의 차이를 소스 접근과 reflection 접근으로 분리할 수 있는 최소 모듈 예제
- `final/src`: final class와 final method의 확장·재정의 거절
- `collections/src`: `Collections.synchronizedList`, `Vector`, `Hashtable`, `CopyOnWriteArrayList`, `ConcurrentLinkedQueue`의 순회 계약
- `run.sh`: 성공 예제와 의도된 컴파일 실패를 모두 확인하는 harness

## 실행

저장소 루트에서 실행합니다.

```sh
sh examples/knowledge/java-access-and-collections-lab/run.sh
```

2026-09-18 Homebrew OpenJDK 21.0.12.1에서 실행했습니다. 기본 Java가 runtime을 찾지 못하면 설치된 JDK를 PATH에 추가합니다. `run.sh`는 두 도구의 버전을 기록하고 다음을 검증합니다.

1. 외부 패키지 하위 클래스에서 `Sub` qualifier를 쓴 protected 접근은 통과하고, `Base` qualifier는 거절됩니다.
2. 같은 최상위 타입의 nested class는 private 멤버에 접근하지만, 별도 클래스는 거절됩니다.
3. package-private top-level type은 다른 패키지에서 거절됩니다.
4. 모듈의 exported public API는 consumer에서 실행되고, non-exported package는 consumer 컴파일에서 거절됩니다.
5. final class 확장과 final method 재정의는 거절됩니다.
6. synchronized wrapper의 순회, legacy collection의 fail-fast 또는 undefined enumeration, copy-on-write snapshot, weakly consistent queue iterator를 확인합니다.

`Bad*.java`와 `BadMain.java`는 정상 실행 대상이 아니라 harness가 반드시 컴파일 실패를 확인하는 입력입니다. 오류가 나야 하는 입력이 성공하면 harness는 실패합니다.

## 범위

이 실습은 Java SE 25 API 문서에서 확인한 접근·모듈·컬렉션 계약의 작은 실행 예제입니다. JLS 전문이 이 환경에서 회수되지 않아 JLS의 정확한 문장을 재현한다고 주장하지 않습니다. 추가 fixture는 접근 불가능한 상위 클래스의 public 멤버를 public 하위 타입으로 호출하고, private reflection이 기본 경계에서는 거절되지만 `--add-opens` 뒤 허용되는지 각각 검사합니다. 모든 module-layer, class loader, security policy, reflection framework, JMM 동시성 스케줄, 성능 수치를 포괄하지 않습니다.
