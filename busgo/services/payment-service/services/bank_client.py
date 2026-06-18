import httpx
from core.config import settings
from typing import Optional, Dict, Any


class BankClient:
    @staticmethod
    async def verify_debit(
        user_id: str,
        amount: float,
        method: str,
        reference: Optional[str],
        mobile_number: Optional[str] = None,
        pin: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Ask the bank-service to verify balance and debit the funding account.
        Returns the VerifyDebitResponse dict, or a failure dict if unreachable."""
        payload = {
            "user_id": user_id,
            "amount": amount,
            "method": method,
            "reference": reference,
            "mobile_number": mobile_number,
            "pin": pin,
        }
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(
                    f"{settings.BANK_SERVICE_URL}/verify-debit",
                    json=payload,
                    timeout=8.0,
                )
                if res.status_code == 200:
                    body = res.json()
                    return body.get("data", {"success": False, "message": "Malformed bank response"})
                return {"success": False, "message": f"Bank service error ({res.status_code})"}
            except Exception as e:
                return {"success": False, "message": f"Bank service unreachable: {e}"}

    @staticmethod
    async def rollback_debit(user_id: str, amount: float, method: str, reference: Optional[str]) -> bool:
        """Credit back a previously debited amount. Called when payment creation fails after a debit."""
        payload = {
            "user_id": user_id,
            "amount": amount,
            "method": method,
            "reference": reference,
            "description": "Payment rollback — transaction failed after debit",
        }
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(
                    f"{settings.BANK_SERVICE_URL}/credit",
                    json=payload,
                    timeout=8.0,
                )
                return res.status_code == 200 and res.json().get("success", False)
            except Exception:
                return False
