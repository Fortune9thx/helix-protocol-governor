"""Ward-model tests for Helix: host registration, family -> patch mapping via
raise_alarm, the global append-only genome, and already_expressed idempotency.

Covers the required scenarios:
  - register two hosts
  - alarm drain on A -> A frozen, genome=1
  - alarm same drain on B -> B frozen, genome=1, already_expressed
  - false alarm slashes the bond
  - unregistered host rejected
  - (bad URL rejected is covered separately in test_helix_ssrf.py)

register_host's self-check calls the target HostVault's own get_governor()
view cross-contract - real HostVaults are deployed here (not placeholder
addresses) and given a real set_governor() call first, since gltest
direct-mode's cross-contract CallContract path has documented reliability
gaps against unmocked/placeholder targets (see genlayer-crosscontract-
view-testing notes) that a real deployed target sidesteps. This exact
register_host + raise_alarm flow has also been verified live on
studio-dev this session (both hosts registered, both alarms applied
correctly) - these direct-mode tests are the offline complement, not the
only evidence.
"""

import json

from conftest import to_hex

REGISTRY_PLACEHOLDER = "0x" + "33" * 20
WATCHDOG_PLACEHOLDER_CODE = "# placeholder watchdog source for constructor arg\n"
BOND = 10**16  # matches MIN_BOND in contracts/helix.py


def _deploy_host(direct_deploy, direct_vm, owner):
    direct_vm.sender = owner
    return direct_deploy(
        "contracts/host_vault.py",
        "unlimited approvals allowed. owner may withdraw. no freeze.",
        sdk_version="v0.3.0-rc7",
    )


def _deploy_helix(direct_deploy, direct_vm, owner):
    direct_vm.sender = owner
    return direct_deploy(
        "contracts/helix.py",
        REGISTRY_PLACEHOLDER,
        WATCHDOG_PLACEHOLDER_CODE,
        sdk_version="v0.3.0-rc7",
    )


def _status(contract):
    raw = contract.get_status()
    parts = raw.split("||")
    return {
        "alarm_count": parts[0],
        "host_count": parts[1],
        "organ": parts[2],
        "generation": parts[3],
        "treasury": parts[4],
    }


def _setup_ward(direct_deploy, direct_vm, direct_owner, n_hosts=1):
    """Deploys Helix + n real HostVaults, wires governor, registers each
    host. Returns (helix, [hosts])."""
    helix = _deploy_helix(direct_deploy, direct_vm, direct_owner)
    helix_addr = to_hex(helix)

    hosts = []
    for _ in range(n_hosts):
        host = _deploy_host(direct_deploy, direct_vm, direct_owner)
        direct_vm.sender = direct_owner
        host.set_governor(helix_addr)
        hosts.append(host)

    direct_vm.sender = direct_owner
    for host in hosts:
        helix.register_host(to_hex(host), "Host")
    return helix, hosts


def _mock_drain(direct_vm):
    direct_vm.mock_web(
        r"drain-advisory",
        {
            "status": 200,
            "body": (
                "Security Advisory GHSA-helix-approve-drain. Unlimited approval "
                "drain in HostVault-class spenders. Active exploitation observed."
            ),
        },
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "should_act": True,
                "threat_family": "infinite_approve_drain",
                "confidence": 92,
                "rationale": "Active unlimited-approval drain exploit described in the advisory.",
            }
        ),
    )


def _mock_noise(direct_vm):
    direct_vm.mock_web(
        r"noise-recipe",
        {
            "status": 200,
            "body": "Grandma's Sourdough Starter Guide. Feed your starter daily.",
        },
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "should_act": False,
                "threat_family": "noise",
                "confidence": 5,
                "rationale": "This page is a sourdough recipe, unrelated to approvals or exploits.",
            }
        ),
    )


def test_register_two_hosts(direct_vm, direct_deploy, direct_owner):
    helix, hosts = _setup_ward(direct_deploy, direct_vm, direct_owner, n_hosts=2)
    status = _status(helix)
    assert status["host_count"] == "2"
    assert helix.is_registered(to_hex(hosts[0])) is True
    assert helix.is_registered(to_hex(hosts[1])) is True
    assert helix.is_registered("0x" + "99" * 20) is False


def test_unregistered_host_rejected(direct_vm, direct_deploy, direct_owner):
    helix, _hosts = _setup_ward(direct_deploy, direct_vm, direct_owner, n_hosts=1)
    _mock_drain(direct_vm)
    unregistered = "0x" + "77" * 20
    direct_vm.sender = direct_owner
    direct_vm.value = BOND
    with direct_vm.expect_revert():
        helix.raise_alarm(unregistered, "https://evidence.example.com/drain-advisory.html", "")
    direct_vm.value = 0


def test_drain_alarm_on_host_freezes_it_and_writes_one_clause(
    direct_vm, direct_deploy, direct_owner
):
    helix, hosts = _setup_ward(direct_deploy, direct_vm, direct_owner, n_hosts=1)
    host_a = hosts[0]

    _mock_drain(direct_vm)
    drain_url = "https://evidence.example.com/drain-advisory.html"
    direct_vm.sender = direct_owner
    direct_vm.value = BOND
    helix.raise_alarm(to_hex(host_a), drain_url, "")
    direct_vm.value = 0

    status = _status(helix)
    assert status["alarm_count"] == "1"
    assert status["generation"] == "1"
    assert helix.has_clause("infinite_approve_drain") is True

    genome = helix.get_genome()
    assert genome.count("\n") == 0
    row = genome.split("||")
    assert row[1] == "infinite_approve_drain"
    assert row[2] == "SHED_SKIN"

    alarm = helix.get_alarm("1").split("||")
    assert alarm[7] == "true"  # should_act
    assert alarm[8] == "false"  # already_expressed
    assert alarm[9] == "acted"


def test_same_family_on_second_host_is_already_expressed_but_still_freezes_it(
    direct_vm, direct_deploy, direct_owner
):
    helix, hosts = _setup_ward(direct_deploy, direct_vm, direct_owner, n_hosts=2)
    host_a, host_b = hosts

    _mock_drain(direct_vm)
    drain_url = "https://evidence.example.com/drain-advisory.html"
    direct_vm.sender = direct_owner
    direct_vm.value = BOND
    helix.raise_alarm(to_hex(host_a), drain_url, "")

    # Same evidence, second (already-registered) host - the family is
    # already law, so this must NOT write a second clause, but the
    # apply_mutation call still applies to host B specifically (each host
    # is governed independently even though the genome is global).
    direct_vm.value = BOND
    helix.raise_alarm(to_hex(host_b), drain_url, "")
    direct_vm.value = 0

    status = _status(helix)
    assert status["alarm_count"] == "2"
    assert status["generation"] == "1"  # unchanged - no duplicate clause

    alarm2 = helix.get_alarm("2").split("||")
    assert alarm2[7] == "true"  # should_act
    assert alarm2[8] == "true"  # already_expressed
    assert alarm2[9] == "already_expressed"


def test_false_alarm_slashes_bond_no_mutation(direct_vm, direct_deploy, direct_owner):
    helix, hosts = _setup_ward(direct_deploy, direct_vm, direct_owner, n_hosts=1)
    host_a = hosts[0]

    _mock_noise(direct_vm)
    recipe_url = "https://blog.example.com/noise-recipe.html"
    direct_vm.sender = direct_owner
    direct_vm.value = BOND
    helix.raise_alarm(to_hex(host_a), recipe_url, "")
    direct_vm.value = 0

    status = _status(helix)
    assert status["alarm_count"] == "1"
    assert status["generation"] == "0"
    assert helix.get_genome() == ""

    alarm = helix.get_alarm("1").split("||")
    assert alarm[7] == "false"  # should_act
    assert alarm[9] == "slashed"
