---
applyTo: "**/*.test.tsx,**/*.test.jsx,**/*.spec.tsx,**/*.spec.jsx,**/__tests__/**/*.tsx,**/__tests__/**/*.jsx"
---
<!-- staged-by: workspace -->
# React / Next.js test rules
- CO-LOCATE: create `X.test.tsx` in the same directory as `X.tsx` — never in a central test/ directory. (APIs/services keep central test dirs; React components do not.)
- Jest + React Testing Library. Query by role/text/label, not by test IDs or class names.
- Test behavior from the user's perspective; do not assert on component internals/state.
- Avoid snapshot tests except for small, stable presentational output; never large auto-snapshots that "always pass". Prefer explicit assertions.
- Mock `next/router`, `next/navigation`, `fetch`, and network with fixtures; use `jest.useFakeTimers()` for time.
- Use `findBy*`/`waitFor` for async — never arbitrary timeouts.
- Coverage via `npm test -- --coverage`; never edit `coverageThreshold` to pass.
