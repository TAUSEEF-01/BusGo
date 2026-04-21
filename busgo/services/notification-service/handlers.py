import os
from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))

# Mock Email Directory
EMAIL_MOCK_DIR = "/tmp/emails"
if not os.path.exists(EMAIL_MOCK_DIR):
    os.makedirs(EMAIL_MOCK_DIR, exist_ok=True)

def send_email(to_email: str, subject: str, template_name: str, **context):
    try:
        template = env.get_template(f"{template_name}.html")
        html_content = template.render(**context)
        
        # Mock sending by saving to file
        file_path = os.path.join(EMAIL_MOCK_DIR, f"{to_email}_{template_name}.html")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        
        print(f"[EMAIL MOCK] Sent '{subject}' to {to_email} (Saved to {file_path})")
        return {"status": "SENT"}
    except Exception as e:
        print(f"[EMAIL ERR] {e}")
        return {"status": "FAILED", "error": str(e)}

def send_sms(phone: str, message: str):
    # Mock SMS sending (e.g., BSMS API in prod)
    print(f"[SMS MOCK] Sending to {phone}: {message}")
    return {"status": "SENT"}

def send_push(fcm_token: str, title: str, body: str):
    # Mock Push sending (e.g., Firebase Admin SDK)
    if not fcm_token:
        return {"status": "FAILED", "error": "No FCM token"}
    print(f"[PUSH MOCK] Sending to {fcm_token} -> {title}: {body}")
    return {"status": "SENT"}

def send_whatsapp(phone: str, message: str):
    # Mock WhatsApp sending
    print(f"[WHATSAPP MOCK] Sending to {phone}: {message}")
    return {"status": "SENT"}
