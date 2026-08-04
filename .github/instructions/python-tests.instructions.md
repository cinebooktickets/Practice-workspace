---
applyTo: "**/test_*.py,**/*_test.py,**/tests/**,**/conftest.py"
---
<!-- staged-by: workspace -->
# Python test rules
- pytest with plain functions + fixtures; use the repo's existing runner/config — never add a second one.
- Patch with `mocker` (pytest-mock) or `monkeypatch`; patch where the name is USED, not where it is defined.
- No real I/O: `tmp_path` for files, `monkeypatch`/freezegun for time, injected fakes for network/DB.
- `pytest.mark.parametrize` for edge-case tables instead of copy-pasted tests.
- Async code: use the project's existing pytest-asyncio/anyio setup; never add `time.sleep`.
- Coverage via `pytest --cov`. Never lower `fail_under` or add omit/exclude entries to pass.
