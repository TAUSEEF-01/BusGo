import paramiko
import os
import sys

def main():
    hostname = "135.171.216.245"
    username = "azureuser"
    password = "bqaIJ#1xUU+2QdChsNrA1zN^"

    print("Connecting to VM...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(hostname, username=username, password=password, timeout=20)
        print("Connected!")

        print("\n=== Docker Compose PS ===")
        stdin, stdout, stderr = ssh.exec_command("cd ~/Jaabo/busgo/infrastructure && sudo docker compose ps")
        print(stdout.read().decode())
        err = stderr.read().decode()
        if err:
            print("Errors:")
            print(err)

        print("\n=== Booking Service Logs ===")
        stdin, stdout, stderr = ssh.exec_command("cd ~/Jaabo/busgo/infrastructure && sudo docker compose logs --tail=50 booking-service")
        print(stdout.read().decode())
        err = stderr.read().decode()
        if err:
            print("Errors:")
            print(err)
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    main()
