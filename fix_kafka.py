import glob
import re

for filepath in glob.glob('busgo/services/*/main.py'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'KafkaConsumer()' in content and 'app = FastAPI' in content:
        # Move instantiation into startup
        consumer_match = re.search(r'(\w+)\s*=\s*(\w+KafkaConsumer)\(\)', content)
        if consumer_match:
            var_name = consumer_match.group(1)
            class_name = consumer_match.group(2)
            
            # 1. Replace global instantiation with None
            content = content.replace(f'{var_name} = {class_name}()', f'{var_name} = None')
            
            # 2. Add global and instantiation inside startup
            startup_pattern = r'(@app\.on_event\("startup"\)\s+async def startup.*?:)'
            if re.search(startup_pattern, content):
                content = re.sub(startup_pattern, r'\1\n    global ' + var_name + r'\n    ' + var_name + r' = ' + class_name + r'()', content)
            else:
                # Add startup if missing (unlikely but safe)
                content += f'\n\n@app.on_event("startup")\nasync def startup():\n    global {var_name}\n    {var_name} = {class_name}()\n'

        with open(filepath, 'w') as f:
            f.write(content)
        print(f'Fixed Kafka instantiation in {filepath}')
