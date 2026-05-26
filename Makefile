install:
	pip install -r requirements.txt

backend:
	uvicorn backend.app.main:app --reload

dashboard:
	streamlit run frontend/dashboard.py

test:
	pytest -q
