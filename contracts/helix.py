# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

ALLOWED_FAMILIES = {
    "infinite_approve_drain",
    "permit_phishing_kit",
    "active_exploit_unknown",
    "noise",
}
ALLOWED_PATCHES = {"NONE", "HALT", "TIGHTEN", "SHED_SKIN", "GROW_ORGAN"}
FAMILY_TO_PATCH = {
    "infinite_approve_drain": "SHED_SKIN",
    "permit_phishing_kit": "GROW_ORGAN",
    "active_exploit_unknown": "HALT",
    "noise": "NONE",
}

PROMPT = """You are Helix, an onchain immune system for a host vault.
The host currently allows large approvals unless already frozen.

You are given live public evidence (page text and optionally a screenshot).
Decide if the evidence describes an ACTIVE exploit class against unlimited approvals or permit phishing.

Return JSON only:
{
  "should_act": true or false,
  "threat_family": "infinite_approve_drain" | "permit_phishing_kit" | "active_exploit_unknown" | "noise",
  "confidence": integer 0-100,
  "rationale": "one or two sentences"
}

Rules:
- Security advisory / drain report about unlimited approve, allowance, spender: threat_family = infinite_approve_drain, should_act = true.
- Permit/phishing signature kits, permit2 drain, fake permit sites: threat_family = permit_phishing_kit, should_act = true.
- Clearly an exploit but unclassified: active_exploit_unknown.
- Unrelated pages: noise, should_act = false.
- Do not invent extra families.
- confidence must be a bare JSON integer with no decimal point.
"""


class Helix(gl.Contract):
    owner: Address
    host: Address
    registry: Address
    mutation_count: u256
    last_family: str
    last_patch: str
    last_rationale: str
    last_urls: str
    last_organ: Address
    watchdog_code: str

    def __init__(self, host: str, registry: str, watchdog_code: str):
        self.owner = gl.message.sender_address
        self.host = Address(host)
        self.registry = Address(registry)
        self.mutation_count = u256(0)
        self.last_family = ""
        self.last_patch = "NONE"
        self.last_rationale = ""
        self.last_urls = ""
        self.last_organ = Address("0x" + "00" * 20)
        self.watchdog_code = watchdog_code
        root = gl.storage.Root.get()
        root.upgraders.get().append(gl.message.sender_address)

    @gl.public.write
    def ingest_threat(self, url_a: str, url_b: str) -> None:
        url_a_local = url_a.strip()
        url_b_local = url_b.strip()

        def normalize(raw: dict) -> dict:
            family = str(raw.get("threat_family", "noise"))
            if family not in ALLOWED_FAMILIES:
                family = "noise"
            should = bool(raw.get("should_act", False))
            if family == "noise":
                should = False
            patch = FAMILY_TO_PATCH[family]
            if not should:
                patch = "NONE"
            try:
                conf = int(raw.get("confidence", 0))
            except Exception:
                conf = 0
            conf = max(0, min(100, conf))
            rationale = str(raw.get("rationale", ""))[:500]
            return {
                "should_act": should,
                "threat_family": family,
                "patch_id": patch,
                "confidence": conf,
                "rationale": rationale,
            }

        def merge(a: dict, b: dict) -> dict:
            if a["should_act"] and not b["should_act"]:
                return a
            if b["should_act"] and not a["should_act"]:
                return b
            return a if a["confidence"] >= b["confidence"] else b

        def leader_fn() -> dict:
            normalized = []
            for url in (url_a_local, url_b_local):
                if not url:
                    continue
                page_text = ""
                shot = None
                try:
                    page_text = gl.nondet.web.render(url, mode="text")
                except Exception:
                    try:
                        res = gl.nondet.web.get(url)
                        page_text = res.body.decode("utf-8", errors="ignore")[:12000]
                    except Exception:
                        page_text = ""
                try:
                    shot = gl.nondet.web.render(url, mode="screenshot")
                except Exception:
                    shot = None
                excerpt = (page_text or "")[:8000]
                prompt = PROMPT + "\n\nEVIDENCE URL:\n" + url + "\n\nPAGE TEXT EXCERPT:\n" + excerpt
                if shot is not None:
                    raw = gl.nondet.exec_prompt(prompt, image=shot, response_format="json")
                else:
                    raw = gl.nondet.exec_prompt(prompt, response_format="json")
                if isinstance(raw, str):
                    raw = json.loads(raw)
                normalized.append(normalize(raw))
            if len(normalized) == 2:
                return merge(normalized[0], normalized[1])
            return normalized[0]

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            data = leader_result.calldata
            if not isinstance(data, dict):
                return False
            if data.get("threat_family") not in ALLOWED_FAMILIES:
                return False
            if data.get("patch_id") not in ALLOWED_PATCHES:
                return False
            expected = FAMILY_TO_PATCH.get(data.get("threat_family"), "NONE")
            if data.get("should_act") and data.get("patch_id") != expected:
                return False
            if (not data.get("should_act")) and data.get("patch_id") != "NONE":
                return False
            mine = leader_fn()
            return (
                mine["should_act"] == data["should_act"]
                and mine["threat_family"] == data["threat_family"]
                and mine["patch_id"] == data["patch_id"]
            )

        decision = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.last_family = str(decision["threat_family"])
        self.last_patch = str(decision["patch_id"])
        self.last_rationale = str(decision["rationale"])
        self.last_urls = url_a_local + " " + url_b_local
        self.mutation_count = self.mutation_count + u256(1)

        if (not decision["should_act"]) or decision["patch_id"] == "NONE":
            return

        registry = gl.get_contract_at(self.registry)
        new_constitution = registry.view().get_constitution(decision["patch_id"])
        new_code = ""
        freeze = decision["patch_id"] in ("HALT", "SHED_SKIN")
        new_max = 0 if freeze or decision["patch_id"] == "TIGHTEN" else -1
        if decision["patch_id"] == "SHED_SKIN":
            new_code = registry.view().get_patch_code("SHED_SKIN")

        host = gl.get_contract_at(self.host)
        host.emit(on="accepted").apply_mutation(
            decision["patch_id"],
            decision["threat_family"],
            decision["rationale"],
            new_constitution,
            new_code,
            freeze,
            new_max,
            True,
        )

        if decision["patch_id"] == "GROW_ORGAN":
            try:
                salt = self.mutation_count if int(self.mutation_count) > 0 else u256(1)
                organ = gl.deploy_contract(
                    code=self.watchdog_code.encode("utf-8"),
                    args=[self.host.as_hex, decision["threat_family"]],
                    salt_nonce=salt,
                )
                self.last_organ = organ
                host.emit(on="accepted").register_organ(organ.as_hex)
            except Exception:
                pass

    @gl.public.write
    def set_fallback_organ(self, organ: str) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("not owner")
        self.last_organ = Address(organ)
        host = gl.get_contract_at(self.host)
        host.emit(on="accepted").register_organ(organ)

    @gl.public.view
    def get_status(self) -> str:
        organ = self.last_organ.as_hex if self.last_organ else ""
        return (
            str(self.mutation_count)
            + "||" + self.last_family
            + "||" + self.last_patch
            + "||" + self.last_rationale
            + "||" + self.last_urls
            + "||" + organ
        )
