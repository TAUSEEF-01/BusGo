import paramiko
import sys

SERVER_IP = "135.171.216.245"
SERVER_USER = "azureuser"
PASSWORD = "bqaIJ#1xUU+2QdChsNrA1zN^"

def main():
    print(f"Connecting to {SERVER_USER}@{SERVER_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname=SERVER_IP, username=SERVER_USER, password=PASSWORD, timeout=30)
        print("Connected successfully!")

        print("Running: sudo docker ps")
        stdin, stdout, stderr = ssh.exec_command("sudo docker ps")
        
        # We need to provide sudo password if prompted, but azureuser has passwordless sudo for docker?
        # Let's read the output.
        output = stdout.read().decode('utf-8')
        err_output = stderr.read().decode('utf-8')
        
        print("\n--- stdout ---")
        print(output)
        print("--- stderr ---")
        print(err_output)
        
    except Exception as e:
        print(f"Error checking docker status: {e}")
        sys.exit(1)
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
