import paramiko

def main():
    hostname = "135.171.216.245"
    username = "azureuser"
    password = "bqaIJ#1xUU+2QdChsNrA1zN^"
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password, timeout=20)
        print("Connected to VM.")
        
        # Git status
        cmd_status = "cd ~/Jaabo && git status"
        stdin, stdout, stderr = ssh.exec_command(cmd_status)
        print("--- Git Status on VM ---")
        print(stdout.read().decode())
        
        # Git log last 3 commits
        cmd_log = "cd ~/Jaabo && git log -n 3 --oneline"
        stdin, stdout, stderr = ssh.exec_command(cmd_log)
        print("--- Git Log on VM ---")
        print(stdout.read().decode())
        
        # Check if trips count code exists in the server's ManageTrips.tsx
        cmd_grep = "grep -n 'trips.filter' ~/Jaabo/busgo/frontend/src/pages/ManageTrips.tsx || echo 'Not found'"
        stdin, stdout, stderr = ssh.exec_command(cmd_grep)
        print("--- Grep trips.filter in ManageTrips.tsx on VM ---")
        print(stdout.read().decode())

    except Exception as e:
        print("Error:", e)
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
