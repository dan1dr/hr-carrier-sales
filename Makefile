.PHONY: dev seed test docker-up docker-down

dev:
	uvicorn api.main:app --reload --port 8000

seed:
	python -m api.seed

test:
	python -m pytest api/tests/ -v

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down
