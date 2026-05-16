import glob

for filepath in glob.glob('busgo/services/*/database.py'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'connect_args={"ssl": "require"}' in content:
        content = content.replace('connect_args={"ssl": "require"}', 'connect_args={"ssl": "require", "prepared_statement_cache_size": 0}')
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'Updated {filepath}')
