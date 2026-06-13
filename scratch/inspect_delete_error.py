import asyncio
from sqlalchemy import create_engine, text
import sys
sys.path.append('busgo')
from shared.database_config import get_database_url

def main():
    url = get_database_url(async_driver=False)
    engine = create_engine(url, connect_args={'sslmode': 'require'})
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            print("Attempting to delete route 0ac7ce98-c4f0-4ba4-829f-27d25ba4531c...")
            conn.execute(text("DELETE FROM routes WHERE id='0ac7ce98-c4f0-4ba4-829f-27d25ba4531c'"))
            print("Delete execution succeeded! Committing...")
            trans.commit()
            print("Transaction committed successfully!")
        except Exception as e:
            print("Delete failed!")
            print("Error:", e)
            trans.rollback()
            print("Transaction rolled back.")

if __name__ == '__main__':
    main()
