FROM mcr.microsoft.com/playwright/python:v1.51.0-jammy

ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 10000

CMD ["sh", "-c", "python3 -m gunicorn --bind 0.0.0.0:${PORT:-10000} --timeout 180 --workers 3 app:app"]
