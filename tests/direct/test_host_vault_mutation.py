"""HostVault mutation mechanics, tested directly against the contract (not
through Helix's cross-contract wiring, which direct mode can't meaningfully
simulate for a single-process test). This exercises exactly the state
transition the live demo depends on:

  approve() works while unfrozen
  -> a governor-issued apply_mutation(freeze=True, ...) flips frozen/version/constitution
  -> a subsequent approve() reverts with FROZEN_BY_HELIX
"""

from tests.direct.conftest import to_hex

GENESIS_CONSTITUTION = "unlimited approvals allowed. owner may withdraw. no freeze."
SHED_SKIN_CONSTITUTION = (
    "approvals forbidden. vault frozen by Helix after infinite_approve_drain consensus."
)


def _deploy_host(direct_deploy, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    return direct_deploy("contracts/host_vault.py", GENESIS_CONSTITUTION, sdk_version="v0.2.16")


def test_genesis_state_and_approve_before_mutation(direct_vm, direct_deploy, direct_owner, direct_bob):
    host = _deploy_host(direct_deploy, direct_vm, direct_owner)

    state = host.get_state().split("||")
    assert state[0] == "1"  # genome_version
    assert state[1] == "0"  # frozen
    assert state[3] == GENESIS_CONSTITUTION

    direct_vm.sender = direct_owner
    host.approve(to_hex(direct_bob), 100 * 10**18)
    assert int(host.get_allowance(to_hex(direct_bob))) == 100 * 10**18


def test_set_governor_requires_owner_or_current_governor(
    direct_vm, direct_deploy, direct_owner, direct_bob, direct_charlie
):
    host = _deploy_host(direct_deploy, direct_vm, direct_owner)

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not authorized"):
        host.set_governor(to_hex(direct_charlie))


def test_apply_mutation_freezes_and_bumps_version(
    direct_vm, direct_deploy, direct_owner, direct_charlie
):
    host = _deploy_host(direct_deploy, direct_vm, direct_owner)

    # Wire the "Helix" governor (direct_charlie stands in for Helix's address).
    direct_vm.sender = direct_owner
    host.set_governor(to_hex(direct_charlie))

    # Only the governor may apply a mutation.
    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("not governor"):
        host.apply_mutation(
            "SHED_SKIN", "infinite_approve_drain", "unauthorized attempt",
            SHED_SKIN_CONSTITUTION, "", True, 0, True,
        )

    direct_vm.sender = direct_charlie
    host.apply_mutation(
        "SHED_SKIN",
        "infinite_approve_drain",
        "Independent validator consensus confirmed an active unlimited-approval drain.",
        SHED_SKIN_CONSTITUTION,
        "",
        True,
        0,
        True,
    )

    state = host.get_state().split("||")
    assert state[0] == "2"  # genome_version bumped
    assert state[1] == "1"  # frozen
    assert state[2] == "0"  # max_approval
    assert state[3] == SHED_SKIN_CONSTITUTION
    assert state[4] == "SHED_SKIN"
    assert state[5] == "infinite_approve_drain"


def test_approve_reverts_frozen_by_helix_after_mutation(
    direct_vm, direct_deploy, direct_owner, direct_charlie, direct_bob
):
    host = _deploy_host(direct_deploy, direct_vm, direct_owner)

    direct_vm.sender = direct_owner
    host.set_governor(to_hex(direct_charlie))

    direct_vm.sender = direct_charlie
    host.apply_mutation(
        "SHED_SKIN", "infinite_approve_drain", "frozen by consensus",
        SHED_SKIN_CONSTITUTION, "", True, 0, True,
    )

    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("FROZEN_BY_HELIX"):
        host.approve(to_hex(direct_bob), 50 * 10**18)

    with direct_vm.expect_revert("FROZEN_BY_HELIX"):
        host.withdraw(to_hex(direct_bob), 1)


def test_register_organ_increments_count(direct_vm, direct_deploy, direct_owner, direct_charlie, direct_bob):
    host = _deploy_host(direct_deploy, direct_vm, direct_owner)

    direct_vm.sender = direct_owner
    host.set_governor(to_hex(direct_charlie))

    direct_vm.sender = direct_charlie
    host.register_organ(to_hex(direct_bob))

    state = host.get_state().split("||")
    assert state[7] == "1"  # organ_count
    assert to_hex(host.get_organ("0")) == to_hex(direct_bob)
