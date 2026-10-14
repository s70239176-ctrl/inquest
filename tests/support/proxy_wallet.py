# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ProxyWallet: a minimal smart-contract wallet used ONLY to prove recipient-balance delivery on Studionet.

Studionet does not credit externally-owned accounts from contract-emitted transfers (measured), but it does deliver to
a contract that can receive. This wallet can act as the project and as the researcher of an Inquest contract: it
forwards payable calls (create_bounty, submit_claim) and plain calls (cancel, withdraw, resolve_claim) to Inquest, and
accepts plain value transfers through __receive__, so Inquest's finalized payments land in a balance we can read.

It is test support, not part of the product, and has no authority over anything but its own balance.
"""

from genlayer import *
import json


class ProxyWallet(gl.Contract):
    owner: Address
    received: u256
    receipts: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.received = u256(0)
        self.receipts = u256(0)

    @gl.public.write.payable  # genvm-lint rejects this combination (E013 vs E019); the SDK documents it
    def __receive__(self):
        self.received = u256(int(self.received) + int(gl.message.value))
        self.receipts = u256(int(self.receipts) + 1)

    @gl.public.write.payable
    def forward(self, target: str, method: str, args_json: str, value: u256):
        """Owner only. Calls `method` on `target` with `value` taken from this wallet's balance."""
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("not owner")
        args = json.loads(args_json)
        proxy = gl.get_contract_at(Address(target)).emit(value=u256(int(value)))
        getattr(proxy, method)(*args)

    @gl.public.view
    def get_received(self) -> dict:
        return {"received": int(self.received), "receipts": int(self.receipts), "owner": self.owner.as_hex}
