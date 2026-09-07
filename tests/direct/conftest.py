"""Shared helpers for direct mode tests."""

import os


def to_hex(addr_bytes):
    """Convert address bytes to checksummed hex matching contract output.

    Call after direct_deploy so the SDK is on sys.path.
    """
    if hasattr(addr_bytes, "as_hex"):
        return addr_bytes.as_hex
    from genlayer.py.types import Address

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
