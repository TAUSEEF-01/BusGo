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
        
        # Check environment variables of operator-service container
        cmd = "sudo docker exec infrastructure-operator-service-1 env | grep -i DATABASE_URL"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print("Live operator-service DATABASE_URL:")
        print(stdout.read().decode())
        
        # Check routes inside live database
        print("Listing routes from live db container...")
        cmd_db = "sudo docker exec -i infrastructure-postgres-1 psql -U postgres -d postgres -c \"SELECT id, operator_id, origin_city, destination_city FROM routes;\""
        stdin, stdout, stderr = ssh.exec_command(cmd_db)
        print(stdout.read().decode())
        print("Errors if any:")
        print(stderr.read().decode())
        
    except Exception as e:
        print("Error:", e)
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
