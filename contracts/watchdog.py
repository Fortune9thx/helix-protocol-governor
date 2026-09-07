# v0.3.0
# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer.types import *


class Watchdog(gl.contract.Contract):
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
