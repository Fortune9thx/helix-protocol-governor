# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer.types import *


class HostVault(gl.contract.Contract):
    owner: Address
    governor: Address
    frozen: bool
    genome_version: u256
    max_approval: u256
    constitution: str
    last_mutation: str
    last_threat_family: str
    last_patch_id: str
    organ_count: u256
    organs: gl.storage.TreeMap[str, Address]
    allowances: gl.storage.TreeMap[Address, u256]

    def __init__(self):
        pass

    @gl.public.write
    def approve(self, spender: str, amount: int) -> None:
        raise gl.vm.UserError("FROZEN_BY_HELIX")

    @gl.public.write
    def withdraw(self, to: str, amount: int) -> None:
        raise gl.vm.UserError("FROZEN_BY_HELIX")

    @gl.public.write
    def apply_mutation(
        self,
        patch_id: str,
        threat_family: str,
        rationale: str,
        new_constitution: str,
        new_code: str,
        freeze: bool,
        new_max_approval: int,
        bump_version: bool,
    ) -> None:
        if gl.message.sender_address != self.governor:
            raise gl.vm.UserError("not governor")
        self.last_patch_id = patch_id
        self.last_threat_family = threat_family
        self.last_mutation = rationale
        if new_constitution:
            self.constitution = new_constitution
        if freeze:
            self.frozen = True
            self.max_approval = 0
        if bump_version:
            self.genome_version = self.genome_version + 1

    @gl.public.write
    def register_organ(self, organ: str) -> None:
        if gl.message.sender_address != self.governor:
            raise gl.vm.UserError("not governor")
        key = str(int(self.organ_count))
        self.organs[key] = Address(organ)
        self.organ_count = self.organ_count + 1

    @gl.public.write
    def upgrade(self, new_code: bytes) -> None:
        if gl.message.sender_address != self.governor:
            raise gl.vm.UserError("not governor")
        root = gl.storage.Root.get()
        code = root.code.get()
        code.truncate()
        code.extend(new_code)

    @gl.public.view
    def get_state(self) -> str:
        return (
            str(self.genome_version)
            + "||" + ("1" if self.frozen else "0")
            + "||" + str(self.max_approval)
            + "||" + self.constitution
            + "||" + self.last_patch_id
            + "||" + self.last_threat_family
            + "||" + self.last_mutation
            + "||" + str(self.organ_count)
        )

    @gl.public.view
    def last_mutation_rationale(self) -> str:
        return self.last_mutation

    @gl.public.view
    def genome_label(self) -> str:
        return "HELIX_SPLICED_V2"
