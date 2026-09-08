"""Every validator independently fetches caller-supplied evidence URLs, so
ingest_threat must refuse anything pointed at localhost/private/loopback
infrastructure before it ever reaches gl.nondet.web.* - this is deterministic
string validation, runs before the nondet block, and needs no web/LLM mocks
since it should raise before any fetch is attempted.
"""

import json

import pytest

WATCHDOG_PLACEHOLDER_CODE = "# placeholder watchdog source for constructor arg\n"
HOST_PLACEHOLDER = "0x" + "22" * 20
REGISTRY_PLACEHOLDER = "0x" + "33" * 20


def _deploy_helix(direct_deploy, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    return direct_deploy(
        "contracts/helix.py",
        HOST_PLACEHOLDER,
        REGISTRY_PLACEHOLDER,
        WATCHDOG_PLACEHOLDER_CODE,
        sdk_version="v0.3.0-rc7",
    )


BLOCKED_URLS = [
    "http://localhost/evil.html",
    "http://127.0.0.1/evil.html",
    "http://0.0.0.0/evil.html",
    "http://169.254.169.254/latest/meta-data/",  # cloud metadata endpoint
    "http://[::1]/evil.html",
    "http://10.0.0.5/evil.html",
    "http://192.168.1.1/evil.html",
    "http://2130706433/evil.html",  # decimal-encoded 127.0.0.1
    "http://user:pass@example.com/evil.html",  # embedded credentials
    "ftp://example.com/evil.html",  # non-http(s) scheme
    "not-a-url",
]


@pytest.mark.parametrize("bad_url", BLOCKED_URLS)
def test_blocked_evidence_url_reverts_before_any_fetch(
    direct_vm, direct_deploy, direct_owner, bad_url
):
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)
    direct_vm.sender = direct_owner
    # No mocks registered at all - if the contract tried to fetch, this
    # would raise MockNotFoundError instead of the expected validation error.
    with direct_vm.expect_revert():
        contract.ingest_threat(bad_url, "")


def test_blocked_url_as_second_argument_also_reverts(
    direct_vm, direct_deploy, direct_owner
):
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert():
        contract.ingest_threat("https://example.com/advisory.html", "http://localhost/x")


def test_legitimate_https_url_passes_validation(
    direct_vm, direct_deploy, direct_owner
):
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)
    direct_vm.sender = direct_owner
    direct_vm.mock_web(
        r"example\.com",
        {"status": 200, "body": "Grandma's Sourdough Starter Guide"},
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "should_act": False,
                "threat_family": "noise",
                "confidence": 5,
                "rationale": "Unrelated recipe page.",
            }
        ),
    )
    # Should reach the leader/validator round rather than reverting at
    # validation - proves legitimate public URLs are never blocked.
    contract.ingest_threat("https://example.com/advisory.html", "")
    status = contract.get_status().split("||")
    assert status[1] == "noise"
