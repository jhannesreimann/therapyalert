FROM mcr.microsoft.com/playwright/python:v1.51.0-jammy

ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["python3", "-m", "gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "120", "--workers", "1", "--threads", "4", "app:app"]
