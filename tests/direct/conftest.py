"""Shared helpers for direct mode tests."""

import os

# gltest's direct-mode WASI mock auto-parses a mock_llm JSON string into a
# dict, matching the OLD (v0.2.x) exec_prompt(response_format="json") which
# returned a dict directly. This SDK generation (v0.6 RC) changed that: the
# real decode path (genlayer.nondet._decode_nondet_json) expects the raw
# "ok" value to still be str/bytes and JSON-parses it itself, so a
# pre-parsed dict now fails with "JSON result is not text". Patch the mock
# to stop auto-parsing so mock_llm(pattern, json.dumps(...)) round-trips the
# same way a real exec_prompt response does. See genlayer-test-toolchain
# memory for the sibling gaps this same module has needed patched before.
import gltest.direct.wasi_mock as _wasi_mock


def _handle_llm_request_no_autoparse(vm, data):
    from gltest.direct.wasi_mock import MockNotFoundError

    prompt = data.get("prompt", "")
    response = vm._match_llm_mock(prompt)
    if response is not None:
        return {"ok": response}

    strict = getattr(vm, "_strict_mock_mode", False)
    if strict:
        registered = [p.pattern for p, _ in vm._llm_mocks]
        raise MockNotFoundError(
            f"[strict] No LLM mock for prompt: {prompt[:100]}...\n"
            f"  Registered: {registered or '(none)'}"
        )

    live_handler = getattr(vm, "_live_llm_handler", None)
    if live_handler is not None:
        return live_handler(data)

    registered = [p.pattern for p, _ in vm._llm_mocks]
    raise MockNotFoundError(
        f"No LLM mock for prompt: {prompt[:100]}...\n"
        f"  Registered: {registered or '(none)'}"
    )


_wasi_mock._handle_llm_request = _handle_llm_request_no_autoparse


def to_hex(addr_bytes):
    """Convert address bytes to checksummed hex matching contract output.

    Call after direct_deploy so the SDK is on sys.path.
    """
    if hasattr(addr_bytes, "as_hex"):
        return addr_bytes.as_hex
    from genlayer.types import Address

    return Address(addr_bytes).as_hex


# Windows: a temp fd still open via os.dup2 can raise PermissionError on
# os.unlink even though the mock's own cleanup expects POSIX semantics.
# Swallow it here rather than letting an unrelated OS quirk fail contract
# tests. See genlayer-test-toolchain memory / genlayer-testing-suite direct
# mode fd handling.
_original_unlink = os.unlink


def _safe_unlink(path, *args, **kwargs):
    try:
        _original_unlink(path, *args, **kwargs)
    except PermissionError:
        pass


os.unlink = _safe_unlink
