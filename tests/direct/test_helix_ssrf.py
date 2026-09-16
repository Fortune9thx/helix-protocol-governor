"""Every validator independently fetches caller-supplied evidence URLs, so
raise_alarm must refuse anything pointed at localhost/private/loopback
infrastructure before it ever reaches gl.nondet.web.* - this is deterministic
string validation, runs before the nondet block, and needs no web/LLM mocks
since it should raise before any fetch is attempted.

raise_alarm checks host-registered and bond-sufficient before URL validation
(see contracts/helix.py), so these tests register a real host and pass a
sufficient bond first - otherwise every case would revert on the wrong
precondition and never actually exercise the SSRF guard.
"""

import json

import pytest

from conftest import to_hex

WATCHDOG_PLACEHOLDER_CODE = "# placeholder watchdog source for constructor arg\n"
REGISTRY_PLACEHOLDER = "0x" + "33" * 20
BOND = 10**16  # matches MIN_BOND in contracts/helix.py


def _deploy_ward(direct_deploy, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    helix = direct_deploy(
        "contracts/helix.py",
        REGISTRY_PLACEHOLDER,
        WATCHDOG_PLACEHOLDER_CODE,
        sdk_version="v0.3.0-rc7",
    )
    host = direct_deploy(
        "contracts/host_vault.py",
        "unlimited approvals allowed. owner may withdraw. no freeze.",
        sdk_version="v0.3.0-rc7",
    )
    direct_vm.sender = direct_owner
    host.set_governor(to_hex(helix))
    helix.register_host(to_hex(host), "Host")
    return helix, host


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
    helix, host = _deploy_ward(direct_deploy, direct_vm, direct_owner)
    direct_vm.sender = direct_owner
    direct_vm.value = BOND
    # No mocks registered at all - if the contract tried to fetch, this
    # would raise MockNotFoundError instead of the expected validation error.
    with direct_vm.expect_revert():
        helix.raise_alarm(to_hex(host), bad_url, "")
    direct_vm.value = 0


def test_blocked_url_as_second_argument_also_reverts(
    direct_vm, direct_deploy, direct_owner
):
    helix, host = _deploy_ward(direct_deploy, direct_vm, direct_owner)
    direct_vm.sender = direct_owner
    direct_vm.value = BOND
    with direct_vm.expect_revert():
        helix.raise_alarm(to_hex(host), "https://example.com/advisory.html", "http://localhost/x")
    direct_vm.value = 0


def test_legitimate_https_url_passes_validation(
    direct_vm, direct_deploy, direct_owner
):
    helix, host = _deploy_ward(direct_deploy, direct_vm, direct_owner)
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
    direct_vm.value = BOND
    helix.raise_alarm(to_hex(host), "https://example.com/advisory.html", "")
    direct_vm.value = 0
    status = helix.get_status().split("||")
    assert status[0] == "1"  # alarm_count
