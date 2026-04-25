import sys
import os

sys.path.append(os.path.abspath('busgo/services/auth-service'))
sys.path.append(os.path.abspath('busgo'))

from schemas.auth import RegisterRequest

req = RegisterRequest.model_validate({
    "phone": "123",
    "full_name": "Test",
    "password": "pass",
    "role": "OPERATOR"
})
print("Parsed req.role:", req.role)
print("Type of req.role:", type(req.role))
