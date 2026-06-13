import os

def main():
    filepath = "busgo/infrastructure/docker-compose.yml"
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Simple replacements for ports and base URL
    replacements = {
        '      - "8086:5432"': '      - "${POSTGRES_PORT:-8086}:5432"',
        '      - "8087:6379"': '      - "${REDIS_PORT:-8087}:6379"',
        '      - "8088:9092"': '      - "${KAFKA_PORT:-8088}:9092"',
        '      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:8088': '      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:${KAFKA_PORT:-8088}',
        '      - "8085:8000"\n      - "8089:8001"': '      - "${KONG_PORT:-8085}:8000"\n      - "${KONG_ADMIN_PORT:-8089}:8001"',
        '      - "8101:8000"': '      - "${AUTH_SERVICE_PORT:-8101}:8000"',
        '      - "8102:8000"': '      - "${SEARCH_SERVICE_PORT:-8102}:8000"',
        '      - "8103:8000"': '      - "${INVENTORY_SERVICE_PORT:-8103}:8000"',
        '      - "8104:8000"': '      - "${BOOKING_SERVICE_PORT:-8104}:8000"',
        '      - "8105:8000"': '      - "${PAYMENT_SERVICE_PORT:-8105}:8000"',
        '      - "8106:8000"': '      - "${TICKET_SERVICE_PORT:-8106}:8000"',
        '      - "8107:8000"': '      - "${NOTIFICATION_SERVICE_PORT:-8107}:8000"',
        '      - "8108:8000"': '      - "${CANCELLATION_SERVICE_PORT:-8108}:8000"',
        '      - "8109:8000"': '      - "${OPERATOR_SERVICE_PORT:-8109}:8000"',
        '      - "8110:8000"': '      - "${DEALS_SERVICE_PORT:-8110}:8000"',
        '      - "8111:8000"': '      - "${ADMIN_SERVICE_PORT:-8111}:8000"',
        '      - "8112:8000"': '      - "${AUDIT_SERVICE_PORT:-8112}:8000"',
        '        VITE_API_BASE_URL: https://busgo.farefin.com': '        VITE_API_BASE_URL: ${VITE_API_BASE_URL:-https://busgo.farefin.com}',
        '      - "8083:80"': '      - "${FRONTEND_PORT:-8083}:80"',
        '    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0': '    image: elasticsearch:8.11.0',
    }

    for target, replacement in replacements.items():
        if target in content:
            content = content.replace(target, replacement)
            print(f"Replaced port/config: {target} -> {replacement}")
        else:
            # Also support standard unix newlines if there is any mismatch
            target_lf = target.replace('\r\n', '\n')
            replacement_lf = replacement.replace('\r\n', '\n')
            if target_lf in content:
                content = content.replace(target_lf, replacement_lf)
                print(f"Replaced port/config (LF): {target_lf} -> {replacement_lf}")
            else:
                print(f"Warning: target config not found: {repr(target)}")

    # 2. Uniquely inject database URL overrides per service
    services_db = {
        "auth-service": ("DATABASE_URL_AUTH", "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "async"),
        "search-service": ("DATABASE_URL_SEARCH", "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "async"),
        "inventory-service": ("DATABASE_URL_INVENTORY", "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "async"),
        "booking-service": ("DATABASE_URL_BOOKING", "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "async"),
        "payment-service": ("DATABASE_URL_PAYMENT", "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "async"),
        "ticket-service": ("DATABASE_URL_TICKET", "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "async"),
        "notification-service": ("DATABASE_URL_NOTIFICATION", "postgresql://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "sync"),
        "cancellation-service": ("DATABASE_URL_CANCELLATION", "postgresql://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "sync"),
        "operator-service": ("DATABASE_URL_OPERATOR", "postgresql+asyncpg://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "async"),
        "deals-service": ("DATABASE_URL_DEALS", "postgresql://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "sync"),
        "admin-service": ("DATABASE_URL_ADMIN", "postgresql://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "sync"),
        "audit-service": ("DATABASE_URL_AUDIT", "postgresql://postgres.wtldkwqnfynxfqyqvehy:BusGoLet%27sGo@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres", "sync"),
    }

    for service, (env_var, default_url, db_type) in services_db.items():
        # Find the service block start
        service_idx = content.find(f"  {service}:")
        if service_idx == -1:
            print(f"Warning: could not find service {service}")
            continue

        # Find the next environment block under this service
        env_idx = content.find("environment:", service_idx)
        if env_idx == -1:
            print(f"Warning: could not find environment for {service}")
            continue

        # Find the anchor under this environment
        anchor = "supabase-async-db" if db_type == "async" else "supabase-sync-db"
        anchor_str = f"<<: *{anchor}"
        anchor_idx = content.find(anchor_str, env_idx)
        if anchor_idx == -1 or anchor_idx - env_idx > 100:
            print(f"Warning: anchor not found near environment for {service}")
            continue

        # Replace only the anchor occurrence under this specific service
        target = anchor_str
        replacement = f"{anchor_str}\n      DATABASE_URL: ${{{env_var}:-{default_url}}}"
        
        left = content[:anchor_idx]
        right = content[anchor_idx:]
        right = right.replace(target, replacement, 1)
        content = left + right
        print(f"Added database override for {service}: {env_var}")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print("docker-compose.yml fully updated.")

if __name__ == '__main__':
    main()
