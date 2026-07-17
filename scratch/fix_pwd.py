import os

def replace_in_file(filepath, old_text, new_text):
    with open(filepath, 'r') as f:
        content = f.read()
    content = content.replace(old_text, new_text)
    with open(filepath, 'w') as f:
        f.write(content)

replace_in_file('e:/My_Github_Projects/Jaabo/busgo/infrastructure/docker-compose.yml', "BusGoLet'sGo", "BusGoLet%27sGo")
replace_in_file('e:/My_Github_Projects/Jaabo/setup_server.sh', "BusGoLet'sGo", "BusGoLet%27sGo")
