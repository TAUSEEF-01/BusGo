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
        
        # List files in infrastructure
        cmd = "ls -la ~/Jaabo/busgo/infrastructure"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print("Files in infrastructure folder on VM:")
        print(stdout.read().decode())
        
        # Cat .env if it exists
        cmd_env = "cat ~/Jaabo/busgo/infrastructure/.env 2>/dev/null || echo 'No .env in infrastructure'"
        stdin, stdout, stderr = ssh.exec_command(cmd_env)
        print(".env contents:")
        print(stdout.read().decode())

        # Check docker-compose env
        cmd_env2 = "cat ~/Jaabo/busgo/services/operator-service/.env 2>/dev/null || echo 'No .env in operator-service'"
        stdin, stdout, stderr = ssh.exec_command(cmd_env2)
        print("operator-service .env:")
        print(stdout.read().decode())
        
    except Exception as e:
        print("Error:", e)
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
