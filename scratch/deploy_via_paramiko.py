import paramiko
import sys
import time

SERVER_IP = "135.171.216.245"
SERVER_USER = "azureuser"
PASSWORD = "bqaIJ#1xUU+2QdChsNrA1zN^"
LOCAL_SETUP_SCRIPT = r"E:\My_Github_Projects\Jaabo\setup_server.sh"
REMOTE_SETUP_SCRIPT = "/home/azureuser/setup_server.sh"

def main():
    print(f"Connecting to {SERVER_USER}@{SERVER_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname=SERVER_IP, username=SERVER_USER, password=PASSWORD, timeout=30)
        print("Connected successfully!")

        print(f"Uploading {LOCAL_SETUP_SCRIPT} to {REMOTE_SETUP_SCRIPT}...")
        sftp = ssh.open_sftp()
        sftp.put(LOCAL_SETUP_SCRIPT, REMOTE_SETUP_SCRIPT)
        sftp.close()
        print("Upload completed.")

        print("Executing setup_server.sh on remote server...")
        # Run command and read output stream in real-time
        cmd = f"chmod +x {REMOTE_SETUP_SCRIPT} && bash {REMOTE_SETUP_SCRIPT}"
        stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)

        # Read channels
        encoding = sys.stdout.encoding or 'utf-8'
        while not stdout.channel.exit_status_ready():
            if stdout.channel.recv_ready():
                data = stdout.channel.recv(1024).decode('utf-8', errors='replace')
                safe_data = data.encode(encoding, errors='replace').decode(encoding)
                sys.stdout.write(safe_data)
                sys.stdout.flush()
            time.sleep(0.1)

        # Clear any remaining output
        if stdout.channel.recv_ready():
            data = stdout.channel.recv(4096).decode('utf-8', errors='replace')
            safe_data = data.encode(encoding, errors='replace').decode(encoding)
            sys.stdout.write(safe_data)
            sys.stdout.flush()

        exit_code = stdout.channel.recv_exit_status()
        print(f"\nCommand completed with exit code: {exit_code}")
        
    except Exception as e:
        print(f"Error during deployment: {e}")
        sys.exit(1)
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
