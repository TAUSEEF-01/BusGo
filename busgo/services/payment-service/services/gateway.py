import asyncio
import uuid
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from shared.enums import PaymentMethod

class MockGateway:
    _simulate_failure = False

    @classmethod
    def set_simulate_failure(cls, fail: bool):
        cls._simulate_failure = fail

    @classmethod
    def get_redirect_url(cls, payment_id: str, method: PaymentMethod) -> str:
        if method == PaymentMethod.BKASH:
            return f"https://mock-bkash.com/checkout/{payment_id}"
        elif method == PaymentMethod.NAGAD:
            return f"https://mock-nagad.com/pay/{payment_id}"
        else:
            return f"https://mock-sslcommerz.com/gw/{payment_id}"

    @classmethod
    async def process_refund(cls, amount: float, method: PaymentMethod) -> dict:
        await asyncio.sleep(2) # Mock 2 second delay
        
        if cls._simulate_failure:
            return {"success": False, "refund_id": None}
            
        return {
            "success": True,
            "refund_id": f"ref_{uuid.uuid4().hex[:10]}"
        }
