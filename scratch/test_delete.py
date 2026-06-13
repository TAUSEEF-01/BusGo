import requests

def main():
    login_url = "https://busgo.farefin.com/api/auth/login"
    login_data = {
        "phone": "12345678",
        "password": "12345678",
        "expected_role": "OPERATOR"
    }
    
    r = requests.post(login_url, json=login_data)
    token = r.json()['data']['access_token']
        
    delete_url = "https://busgo.farefin.com/api/operators/routes/0ac7ce98-c4f0-4ba4-829f-27d25ba4531c"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("\nSending DELETE request for route with trips...")
    r = requests.delete(delete_url, headers=headers)
    print("DELETE status code:", r.status_code)
    try:
        print("DELETE response JSON:", r.json())
    except Exception:
        print("DELETE response text:", r.text)

if __name__ == '__main__':
    main()
