"""Family -> patch mapping tests for Helix.ingest_threat, with mocked web/LLM.

Covers the three required scenarios:
  - drain advisory        -> infinite_approve_drain -> SHED_SKIN
  - permit phishing kit    -> permit_phishing_kit    -> GROW_ORGAN
  - unrelated recipe page  -> noise                  -> NONE (no mutation)

Helix's cross-contract calls to the host/registry (gl.get_contract_at(...).emit()
/.view()) are fire-and-forget / failure-swallowing at the SDK level in direct
mode (PostMessage's result is never inspected, CallContract resolves to None
on an unmocked target instead of raising) - see genlayer/gl/genvm_contracts.py.
So these tests use placeholder addresses for host/registry and assert purely
on Helix's own recorded decision state via get_status(), which is exactly the
"family -> patch mapping" surface the contract needs to get right.
"""

import json

WATCHDOG_PLACEHOLDER_CODE = "# placeholder watchdog source for constructor arg\n"

# Fixed placeholder address strings (no need to derive from a test fixture -
# Helix's cross-contract touchpoints to host/registry are fire-and-forget /
# failure-swallowing in direct mode regardless of what they point at, see
# module docstring above).
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


def _status(contract):
    raw = contract.get_status()
    parts = raw.split("||")
    return {
        "mutation_count": parts[0],
        "family": parts[1],
        "patch": parts[2],
        "rationale": parts[3],
        "urls": parts[4],
        "organ": parts[5],
        "generation": parts[6],
        "already_expressed": parts[7],
    }


def test_drain_advisory_maps_to_shed_skin(direct_vm, direct_deploy, direct_owner):
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)

    drain_url = "https://evidence.example.com/drain-advisory.html"
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

    contract.ingest_threat(drain_url, "")

    status = _status(contract)
    assert status["mutation_count"] == "1"
    assert status["family"] == "infinite_approve_drain"
    assert status["patch"] == "SHED_SKIN"
    assert drain_url in status["urls"]
    assert status["generation"] == "1"
    assert status["already_expressed"] == "false"
    assert contract.has_clause("infinite_approve_drain") is True
    genome = contract.get_genome()
    assert genome.count("\n") == 0  # exactly one clause, no line break yet
    row = genome.split("||")
    assert row[0] == "1"
    assert row[1] == "infinite_approve_drain"
    assert row[2] == "SHED_SKIN"


def test_phishing_kit_maps_to_grow_organ(direct_vm, direct_deploy, direct_owner):
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)

    phish_url = "https://evidence.example.com/phishing-kit.html"
    direct_vm.mock_web(
        r"phishing-kit",
        {
            "status": 200,
            "body": (
                "Permit phishing kit 2026.09. Permit2 / typed-signature phishing "
                "kit circulating. Victims sign permit authorizations against a "
                "hostile spender."
            ),
        },
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "should_act": True,
                "threat_family": "permit_phishing_kit",
                "confidence": 88,
                "rationale": "Live permit-phishing kit targeting typed signatures.",
            }
        ),
    )

    contract.ingest_threat(phish_url, "")

    status = _status(contract)
    assert status["family"] == "permit_phishing_kit"
    assert status["patch"] == "GROW_ORGAN"
    assert status["generation"] == "1"
    assert status["already_expressed"] == "false"


def test_unrelated_page_maps_to_noise_no_mutation(direct_vm, direct_deploy, direct_owner):
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)

    recipe_url = "https://blog.example.com/noise-recipe.html"
    direct_vm.mock_web(
        r"noise-recipe",
        {
            "status": 200,
            "body": (
                "Grandma's Sourdough Starter Guide. Feed your starter equal parts "
                "flour and water every 24 hours."
            ),
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

    contract.ingest_threat(recipe_url, "")

    status = _status(contract)
    assert status["mutation_count"] == "1"
    assert status["family"] == "noise"
    assert status["patch"] == "NONE"
    # No organ was ever spawned for a no-act decision.
    assert status["organ"] == "0x" + "00" * 20 or status["organ"] == ""
    # Noise never writes a clause - the genome stays empty, not a fake entry.
    assert status["generation"] == "0"
    assert contract.get_genome() == ""


def test_same_family_twice_is_already_expressed_not_a_second_mutation(
    direct_vm, direct_deploy, direct_owner
):
    """The second ingest of the same already-lawed family must not mutate
    the host again or append a duplicate clause - it should only flip
    already_expressed on the status dump."""
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)

    drain_url = "https://evidence.example.com/drain-advisory.html"
    direct_vm.mock_web(
        r"drain-advisory",
        {"status": 200, "body": "Unlimited approval drain. Active exploitation observed."},
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "should_act": True,
                "threat_family": "infinite_approve_drain",
                "confidence": 92,
                "rationale": "Drain advisory.",
            }
        ),
    )

    contract.ingest_threat(drain_url, "")
    first = _status(contract)
    assert first["already_expressed"] == "false"
    assert first["generation"] == "1"

    contract.ingest_threat(drain_url, "")
    second = _status(contract)
    assert second["already_expressed"] == "true"
    # mutation_count still records that an ingest happened...
    assert second["mutation_count"] == "2"
    # ...but the genome and generation counter did not grow.
    assert second["generation"] == "1"
    assert contract.get_genome().count("\n") == 0


def test_second_distinct_family_appends_a_second_clause(
    direct_vm, direct_deploy, direct_owner
):
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)

    drain_url = "https://evidence.example.com/drain-advisory.html"
    direct_vm.mock_web(
        r"drain-advisory",
        {"status": 200, "body": "Unlimited approval drain. Active exploitation observed."},
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "should_act": True,
                "threat_family": "infinite_approve_drain",
                "confidence": 92,
                "rationale": "Drain advisory.",
            }
        ),
    )
    contract.ingest_threat(drain_url, "")

    phish_url = "https://evidence.example.com/phishing-kit.html"
    direct_vm.clear_mocks()
    direct_vm.mock_web(
        r"phishing-kit",
        {"status": 200, "body": "Permit phishing kit circulating against typed signatures."},
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "should_act": True,
                "threat_family": "permit_phishing_kit",
                "confidence": 88,
                "rationale": "Permit phishing kit.",
            }
        ),
    )
    contract.ingest_threat(phish_url, "")

    status = _status(contract)
    assert status["already_expressed"] == "false"
    assert status["generation"] == "2"
    genome = contract.get_genome()
    assert genome.count("\n") == 1
    assert contract.has_clause("infinite_approve_drain") is True
    assert contract.has_clause("permit_phishing_kit") is True
    assert contract.has_clause("active_exploit_unknown") is False


def test_validator_agrees_with_independent_reexecution(
    direct_vm, direct_deploy, direct_owner
):
    """Equivalence check: validator_fn re-runs leader_fn against the SAME
    mocked evidence and must agree on should_act + threat_family + patch_id
    (never on the free-text rationale). This is GenLayer's actual consensus
    mechanism, not a structural/shape-only check - see
    genlayer-portal-rejection-patterns memory point 4."""
    contract = _deploy_helix(direct_deploy, direct_vm, direct_owner)

    drain_url = "https://evidence.example.com/drain-advisory.html"
    direct_vm.mock_web(
        r"drain-advisory",
        {"status": 200, "body": "Unlimited approval drain. Active exploitation observed."},
    )
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "should_act": True,
                "threat_family": "infinite_approve_drain",
                "confidence": 90,
                "rationale": "Drain advisory.",
            }
        ),
    )

    contract.ingest_threat(drain_url, "")

    # Same mocks are still registered, so the validator's independent
    # leader_fn() re-run sees identical evidence and must agree.
    agrees = direct_vm.run_validator()
    assert agrees is True
