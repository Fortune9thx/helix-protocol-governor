# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class Watchdog(gl.Contract):
    host: Address
    family: str
    born_from: Address

    def __init__(self, host: str, family: str):
        self.host = Address(host)
        self.family = family
        self.born_from = gl.message.sender_address

    @gl.public.view
    def identity(self) -> str:
        return self.family + "||" + self.host.as_hex + "||" + self.born_from.as_hex
