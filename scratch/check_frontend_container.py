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
        
        # Check files inside frontend container
        cmd = "sudo docker exec infrastructure-frontend-1 ls -la /usr/share/nginx/html"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print("--- Files in Nginx HTML directory inside container ---")
        print(stdout.read().decode())
        
        # Check if the JS files contain the new code text
        cmd_grep = "sudo docker exec infrastructure-frontend-1 grep -rn 'trips' /usr/share/nginx/html/assets/ || echo 'Not found'"
        stdin, stdout, stderr = ssh.exec_command(cmd_grep)
        print("--- Grep 'trips' in container assets ---")
        # Just print first 500 chars to avoid flooding
        out = stdout.read().decode()
        print(out[:500] + ("..." if len(out) > 500 else ""))

        # Check if we can find 'boarding' or 'trips' in index.html or assets
        cmd_grep2 = "sudo docker exec infrastructure-frontend-1 grep -rn 'boarding' /usr/share/nginx/html/assets/ || echo 'Not found'"
        stdin, stdout, stderr = ssh.exec_command(cmd_grep2)
        print("--- Grep 'boarding' in container assets ---")
        out2 = stdout.read().decode()
        print(out2[:500] + ("..." if len(out2) > 500 else ""))

    except Exception as e:
        print("Error:", e)
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
