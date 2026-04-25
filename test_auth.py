import sys, os
sys.path.append(os.path.abspath('busgo/services/auth-service'))
sys.path.append(os.path.abspath('busgo'))

from services.auth_service.models.user import User if "services.auth_service" in sys.modules else None

# Wait, let me just try testing it by making a request to the auth service.
