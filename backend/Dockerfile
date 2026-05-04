FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    curl wget ca-certificates \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

RUN playwright install chromium --with-deps

COPY . .

EXPOSE 8080

CMD ["python3", "-m", "gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "120", "--workers", "1", "--threads", "4", "app:app"]
