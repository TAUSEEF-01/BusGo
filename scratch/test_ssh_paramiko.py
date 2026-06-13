import paramiko
import logging
import sys

def main():
    logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)
    
    hostname = "135.171.216.245"
    username = "azureuser"
    password = "bqaIJ#1xUU+2QdChsNrA1zN^"
    
    print("Initializing SSH client...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print("Connecting...")
        ssh.connect(hostname, username=username, password=password, timeout=15, banner_timeout=15)
        print("Connection successful!")
    except Exception as e:
        print(f"Connection failed: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
