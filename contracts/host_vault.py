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

    def __init__(self, constitution: str):
        self.owner = gl.message.sender_address
        self.governor = gl.message.sender_address
        self.frozen = False
        self.genome_version = 1
        self.max_approval = 10**30
        self.constitution = constitution
        self.last_mutation = "genesis"
        self.last_threat_family = ""
        self.last_patch_id = "NONE"
        self.organ_count = 0
        root = gl.storage.Root.get()
        root.upgraders.get().append(gl.message.sender_address)

    def _only_governor(self) -> None:
        if gl.message.sender_address != self.governor:
            raise gl.vm.UserError("not governor")

    def _not_frozen(self) -> None:
        if self.frozen:
            raise gl.vm.UserError("FROZEN_BY_HELIX")

    @gl.public.write
    def set_governor(self, governor: str) -> None:
        if gl.message.sender_address != self.owner and gl.message.sender_address != self.governor:
            raise gl.vm.UserError("not authorized")
        self.governor = Address(governor)
        root = gl.storage.Root.get()
        root.upgraders.get().append(Address(governor))

    @gl.public.write.payable
    def deposit(self) -> None:
        return

    @gl.public.write
    def approve(self, spender: str, amount: int) -> None:
        self._not_frozen()
        if amount > self.max_approval:
            raise gl.vm.UserError("above max_approval")
        self.allowances[Address(spender)] = amount

    @gl.public.write
    def withdraw(self, to: str, amount: int) -> None:
        self._not_frozen()
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("not owner")
        gl.contract.get_at(Address(to)).emit_transfer(value=amount)

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
        self._only_governor()
        self.last_patch_id = patch_id
        self.last_threat_family = threat_family
        self.last_mutation = rationale
        if new_constitution:
            self.constitution = new_constitution
        if freeze:
            self.frozen = True
            self.max_approval = 0
        if new_max_approval >= 0:
            self.max_approval = new_max_approval
        if bump_version:
            self.genome_version = self.genome_version + 1
        if new_code:
            root = gl.storage.Root.get()
            code = root.code.get()
            code.truncate()
            code.extend(new_code.encode("utf-8"))

    @gl.public.write
    def register_organ(self, organ: str) -> None:
        self._only_governor()
        key = str(int(self.organ_count))
        self.organs[key] = Address(organ)
        self.organ_count = self.organ_count + 1

    @gl.public.write
    def upgrade(self, new_code: bytes) -> None:
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
    def get_allowance(self, spender: str) -> u256:
        return self.allowances.get(Address(spender), 0)

    @gl.public.view
    def get_organ(self, index: str) -> Address:
        return self.organs.get(index, Address("0x" + "00" * 20))

    @gl.public.view
    def last_mutation_rationale(self) -> str:
        return self.last_mutation
