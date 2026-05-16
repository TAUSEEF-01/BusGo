import glob
import re

# Fix global declaration order in main.py
for filepath in glob.glob('busgo/services/*/main.py'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'global kafka_consumer' in content:
        # Move global declaration to the very top of the function
        lines = content.split('\n')
        new_lines = []
        for line in lines:
            if 'async def startup' in line:
                new_lines.append(line)
                new_lines.append('    global kafka_consumer')
            elif 'global kafka_consumer' in line:
                continue
            else:
                new_lines.append(line)
        content = '\n'.join(new_lines)
        
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'Fixed global order in {filepath}')

# Add kafka-python to requirements.txt for sync services
for filepath in glob.glob('busgo/services/*/requirements.txt'):
    with open(filepath, 'r') as f:
        reqs = f.read()
    if 'kafka-python' not in reqs and 'aiokafka' not in reqs: # Sync services usually use kafka-python
         with open(filepath, 'a') as f:
            f.write('\nkafka-python\n')
         print(f'Added kafka-python to {filepath}')
    elif 'kafka-python' not in reqs and 'aiokafka' in reqs: # Async services might still need it if importing from 'kafka'
         with open(filepath, 'a') as f:
            f.write('\nkafka-python\n')
         print(f'Added kafka-python to async {filepath}')
