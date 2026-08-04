---
agent: agent
description: Create mocks/stubs for a unit's external dependencies
---
<!-- staged-by: workspace -->
Re-read the guardrails. For ${input:target:unit}, create mocks/stubs for its external dependencies
(network, DB, filesystem, time, randomness, third-party clients).
Java: Mockito @Mock/@InjectMocks. React/Node: jest.mock/vi.mock for modules, fake timers for time, fixtures for fetch/router.
Python: pytest-mock (`mocker`) or `monkeypatch` — patch where the name is used.
No real I/O, no secrets — use fakes/fixtures. Reset all mocks after each test.
Don't mock the unit under test or simple value objects.
