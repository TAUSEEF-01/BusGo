import urllib.request
import json
import sys

def make_request(url, method="GET", headers=None, data=None):
    if headers is None:
        headers = {}
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode('utf-8')
        headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(url, data=req_data, method=method)
    for key, val in headers.items():
        req.add_header(key, val)
        
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = response.read().decode('utf-8')
            return response.status, json.loads(res_data)
    except urllib.error.HTTPError as e:
        try:
            err_data = e.read().decode('utf-8')
            return e.code, json.loads(err_data)
        except Exception:
            return e.code, {"detail": str(e)}
    except Exception as e:
        return 0, {"detail": str(e)}

def test_login_and_fetch():
    print("Testing login and data fetch as admin...")
    print("=" * 60)
    
    # Let's try log in via Kong Gateway first
    login_url_kong = "http://localhost:8085/api/auth/login"
    # Let's try log in via direct Auth service if Kong is not accessible
    login_url_direct = "http://localhost:8101/login"
    
    credentials_email = {
        "phone": "admin@busgo.com",
        "password": "admin123"
    }
    credentials_phone = {
        "phone": "+1234567890",
        "password": "admin123"
    }
    
    token = None
    user_info = None
    
    # Try different URL and credential combinations
    for url, desc in [(login_url_kong, "Kong Gateway"), (login_url_direct, "Direct Auth service")]:
        for creds, cred_desc in [(credentials_email, "Email"), (credentials_phone, "Phone")]:
            print(f"Attempting login via {desc} using {cred_desc}...")
            status, response = make_request(url, method="POST", data=creds)
            print(f"Status Code: {status}")
            
            if status == 200 and response.get("success"):
                data = response.get("data", {})
                token = data.get("access_token")
                user_info = data.get("user")
                print(f"SUCCESSFUL LOGIN!")
                print(f"User: {user_info.get('full_name')} ({user_info.get('email')}), Role: {user_info.get('role')}")
                print(f"Token (first 20 chars): {token[:20]}...")
                break
            else:
                print(f"FAILED: {response}")
        if token:
            break
            
    if not token:
        print("\n[ERROR] Unable to log in with any combination. Make sure the backend services are running.")
        sys.exit(1)
        
    print("\n" + "=" * 60)
    print("Fetching protected user profile (/api/auth/me)...")
    me_url = "http://localhost:8085/api/auth/me"
    status, response = make_request(me_url, headers={"Authorization": f"Bearer {token}"})
    print(f"Status Code: {status}")
    print(f"Response: {response}")
    
    print("\n" + "=" * 60)
    print("Fetching dashboard stats from admin-service (/api/admin/dashboard-stats)...")
    stats_url_kong = "http://localhost:8085/api/admin/dashboard-stats"
    stats_url_direct = "http://localhost:8111/dashboard-stats"
    
    # Try fetching via Kong first
    print("Attempting stats fetch via Kong Gateway...")
    status, response = make_request(stats_url_kong, headers={"Authorization": f"Bearer {token}"})
    print(f"Status Code: {status}")
    print(f"Response: {response}")
    
    # Try fetching via Direct port if Kong fails or returns error
    if status != 200:
        print("\nAttempting stats fetch directly from admin-service port (8111)...")
        status, response = make_request(stats_url_direct, headers={"Authorization": f"Bearer {token}"})
        print(f"Status Code: {status}")
        print(f"Response: {response}")

if __name__ == "__main__":
    test_login_and_fetch()
