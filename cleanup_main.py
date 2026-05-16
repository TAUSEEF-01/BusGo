import glob
import re

for filepath in glob.glob('busgo/services/*/main.py'):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Get consumer class name
    m = re.search(r'from .* import (\w+KafkaConsumer)', content)
    if not m:
        continue
    class_name = m.group(1)
    
    # Normalize global part
    content = re.sub(r'kafka_consumer\s*=\s*(None|\w+KafkaConsumer\(\))', 'kafka_consumer = None', content)
    
    # Normalize startup part
    # We want to find the startup function and ensure it has:
    # global kafka_consumer
    # kafka_consumer = Class()
    
    startup_pattern = r'(@app\.on_event\("startup"\)\s+async def startup\(\):)'
    if re.search(startup_pattern, content):
        # Remove existing kafka_consumer assignments and global declarations inside startup
        content = re.sub(r'(async def startup\(\):)(\s+global kafka_consumer)?(\s+kafka_consumer\s*=\s*.*?\n)', r'\1\n', content)
        # Re-insert cleanly
        content = re.sub(startup_pattern, r'\1\n    global kafka_consumer\n    kafka_consumer = ' + class_name + '()', content)

    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Cleaned up {filepath}')
