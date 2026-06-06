import paramiko
import os
import sys

def deploy():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    hostname = "135.171.216.245"
    username = "azureuser"
    password = "bqaIJ#1xUU+2QdChsNrA1zN^"
    local_script_path = "setup_server.sh"
    remote_script_path = "/home/azureuser/setup_server.sh"

    print("Connecting to Azure VM via SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password, timeout=20)
        print("SSH Connection successful!")

        # SFTP Upload setup_server.sh
        print(f"Uploading local '{local_script_path}' to remote '{remote_script_path}'...")
        sftp = ssh.open_sftp()
        sftp.put(local_script_path, remote_script_path)
        sftp.close()
        print("Upload completed successfully!")

        # Execute remote commands
        print("Executing deployment script on VM...")
        cmd = "chmod +x ~/setup_server.sh && bash ~/setup_server.sh"
        stdin, stdout, stderr = ssh.exec_command(cmd)

        # Print output in real-time
        while True:
            line = stdout.readline()
            if not line:
                break
            print(line, end="")

        # Check for errors
        err = stderr.read().decode()
        if err:
            print("\nErrors/Stderr:")
            print(err)

        print("\nDeployment execution completed.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    deploy()
