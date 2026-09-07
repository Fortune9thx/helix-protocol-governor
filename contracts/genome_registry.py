# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class GenomeRegistry(gl.Contract):
    owner: Address
    patch_title: TreeMap[str, str]
    patch_code: TreeMap[str, str]
    patch_constitution: TreeMap[str, str]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.patch_title = TreeMap()
        self.patch_code = TreeMap()
        self.patch_constitution = TreeMap()

    def _only_owner(self) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("not owner")

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
