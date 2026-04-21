FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Run DB migrations first, then start the trading worker
CMD ["sh", "-c", "python -m app.db.bootstrap && python worker_main.py"]
