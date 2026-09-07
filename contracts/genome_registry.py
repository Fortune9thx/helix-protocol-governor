# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer.types import *


class GenomeRegistry(gl.contract.Contract):
    owner: Address
    patch_title: gl.storage.TreeMap[str, str]
    patch_code: gl.storage.TreeMap[str, str]
    patch_constitution: gl.storage.TreeMap[str, str]

    def __init__(self):
        self.owner = gl.message.sender_address

    def _only_owner(self) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("not owner")

    @gl.public.write
    def register_patch(self, patch_id: str, title: str, constitution: str, code: str) -> None:
        self._only_owner()
        self.patch_title[patch_id] = title
        self.patch_constitution[patch_id] = constitution
        self.patch_code[patch_id] = code

    @gl.public.view
    def get_patch(self, patch_id: str) -> str:
        title = self.patch_title.get(patch_id, "")
        constitution = self.patch_constitution.get(patch_id, "")
        has_code = "1" if self.patch_code.get(patch_id, "") else "0"
        return title + "||" + constitution + "||" + has_code

    @gl.public.view
    def get_patch_code(self, patch_id: str) -> str:
        return self.patch_code.get(patch_id, "")

    @gl.public.view
    def get_constitution(self, patch_id: str) -> str:
        return self.patch_constitution.get(patch_id, "")
