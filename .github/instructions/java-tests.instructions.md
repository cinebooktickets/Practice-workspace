---
applyTo: "**/*Test.java,**/*Tests.java,**/src/test/**"
---
<!-- staged-by: workspace -->
# Java test rules
- JUnit 5 + Mockito. Use `@ExtendWith(MockitoExtension.class)`; no real Spring context in unit tests.
- Mock collaborators with `@Mock`/`@InjectMocks`; verify behavior, not internal call counts, unless the interaction IS the contract.
- Use AssertJ or JUnit assertions with clear messages.
- Coverage via JaCoCo: `mvn test` → report at `target/site/jacoco/`. Never lower thresholds or add JaCoCo excludes to pass.
- No `Thread.sleep`; use Awaitility or an injected `Clock` for time.
