FROM python:3.11-slim

WORKDIR /app

# LightGBM requires libgomp (OpenMP runtime)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libgomp1 && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY model_server.py .
COPY model_artifacts/ model_artifacts/

ENV PORT=8080
EXPOSE 8080

CMD uvicorn model_server:app --host 0.0.0.0 --port $PORT
