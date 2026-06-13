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
        
        # Search for unique strings in compiled javascript
        cmd_grep = "sudo docker exec infrastructure-frontend-1 grep -o 'trips' /usr/share/nginx/html/assets/index-C64Ys7Xw.js | wc -l"
        stdin, stdout, stderr = ssh.exec_command(cmd_grep)
        print("Number of occurrences of 'trips' in js asset:")
        print(stdout.read().decode().strip())

        cmd_grep2 = "sudo docker exec infrastructure-frontend-1 grep -o 'boarding' /usr/share/nginx/html/assets/index-C64Ys7Xw.js | wc -l"
        stdin, stdout, stderr = ssh.exec_command(cmd_grep2)
        print("Number of occurrences of 'boarding' in js asset:")
        print(stdout.read().decode().strip())

        # Let's search for "trips.filter" or specific code from our ManageTrips.tsx change
        # e.g., the CSS class `text-blue-700` or `bg-blue-50` near trips count badge
        cmd_grep3 = "sudo docker exec infrastructure-frontend-1 grep -o 'bg-blue-50 text-blue-700' /usr/share/nginx/html/assets/index-C64Ys7Xw.js || echo 'Not found'"
        stdin, stdout, stderr = ssh.exec_command(cmd_grep3)
        print("Search for bg-blue-50 text-blue-700 class in js asset:")
        print(stdout.read().decode().strip())

        cmd_grep4 = "sudo docker exec infrastructure-frontend-1 grep -o 'Are you sure you want to remove this route' /usr/share/nginx/html/assets/index-C64Ys7Xw.js || echo 'Not found'"
        stdin, stdout, stderr = ssh.exec_command(cmd_grep4)
        print("Search for route remove confirmation string in js asset:")
        print(stdout.read().decode().strip())

    except Exception as e:
        print("Error:", e)
    finally:
        ssh.close()

if __name__ == '__main__':
    main()
