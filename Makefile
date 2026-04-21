.PHONY: up down logs migrate seed test

up:
	cd busgo/infrastructure && docker-compose up -d

down:
	cd busgo/infrastructure && docker-compose down

logs:
	cd busgo/infrastructure && docker-compose logs -f

migrate:
	@echo "Running migrations across services..."
	for d in busgo/services/* ; do \
		if [ -f "$$d/alembic.ini" ]; then \
			echo "Migrating $$d"; \
			cd $$d && alembic upgrade head && cd ../../../; \
		fi \
	done

seed:
	@echo "Seeding the database..."
	python busgo/infrastructure/seed.py

test:
	@echo "Running tests..."
	for d in busgo/services/* ; do \
		if [ -f "$$d/pytest.ini" ] || [ -f "$$d/tests" ]; then \
			echo "Testing $$d"; \
			cd $$d && pytest && cd ../../../; \
		fi \
	done
