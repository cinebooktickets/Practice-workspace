---
applyTo: "**/*.test.ts,**/*.test.js,**/*.test.mjs,**/*.spec.ts,**/*.spec.js,**/__tests__/**"
---
<!-- staged-by: workspace -->
# Node.js test rules
- React component tests (`.tsx`/`.jsx` files) follow the react rules file instead.
- Use the repo's existing runner (Jest, Vitest, or node:test) and its config — never introduce a second runner.
- HTTP handlers/APIs: test in-process (e.g. supertest against the app instance); never bind real ports or hit live services.
- Mock modules with `jest.mock`/`vi.mock`; network via fixtures (nock/msw or injected fakes); time via fake timers.
- Async: await promises and use the runner's async utilities — no arbitrary `setTimeout` waits.
- No `process.env` mutation without restoring it after each test.
- Coverage via `npm test -- --coverage` (or `vitest run --coverage`). Never weaken `coverageThreshold` to pass.
