"""GenomeRegistry: patch storage/round-trip and owner-only write access."""


def test_register_and_read_patch(direct_vm, direct_deploy, direct_owner):
    direct_vm.sender = direct_owner
    registry = direct_deploy("contracts/genome_registry.py", sdk_version="v0.3.0-rc7")

    registry.register_patch(
        "SHED_SKIN",
        "Shed Skin",
        "approvals forbidden. vault frozen by Helix after infinite_approve_drain consensus.",
        "# host_vault_v2 source\n",
    )

    patch = registry.get_patch("SHED_SKIN").split("||")
    assert patch[0] == "Shed Skin"
    assert patch[1].startswith("approvals forbidden")
    assert patch[2] == "1"  # has_code

    assert registry.get_constitution("SHED_SKIN").startswith("approvals forbidden")
    assert registry.get_patch_code("SHED_SKIN") == "# host_vault_v2 source\n"


def test_unknown_patch_returns_empty(direct_vm, direct_deploy, direct_owner):
    direct_vm.sender = direct_owner
    registry = direct_deploy("contracts/genome_registry.py", sdk_version="v0.3.0-rc7")

    assert registry.get_constitution("DOES_NOT_EXIST") == ""
    assert registry.get_patch_code("DOES_NOT_EXIST") == ""


def test_register_patch_requires_owner(direct_vm, direct_deploy, direct_owner, direct_bob):
    direct_vm.sender = direct_owner
    registry = direct_deploy("contracts/genome_registry.py", sdk_version="v0.3.0-rc7")

    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("not owner"):
        registry.register_patch("HALT", "Halt", "halted.", "")
