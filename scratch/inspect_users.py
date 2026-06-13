from sqlalchemy import create_engine, text
import sys
sys.path.append('busgo')
from shared.database_config import get_database_url

def main():
    url = get_database_url(async_driver=False)
    engine = create_engine(url, connect_args={'sslmode': 'require'})
    with engine.connect() as conn:
        print("--- Users ---")
        users = conn.execute(text("SELECT id, email, role, phone FROM users")).fetchall()
        for u in users:
            print(f"User: ID={u[0]}, Email={u[1]}, Role={u[2]}, Phone={u[3]}")
            
        print("\n--- Operators ---")
        operators = conn.execute(text("SELECT id, name, contact_email, contact_phone FROM operators")).fetchall()
        for o in operators:
            print(f"Operator: ID={o[0]}, Name={o[1]}, Email={o[2]}, Phone={o[3]}")

if __name__ == '__main__':
    main()
