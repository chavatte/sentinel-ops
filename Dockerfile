FROM python:3.12-alpine

RUN apk upgrade --no-cache && \
    apk add --no-cache git openssh npm nodejs curl && \
    npm install -g corepack && \
    corepack enable && \
    curl -L https://github.com/google/osv-scanner/releases/latest/download/osv-scanner_linux_amd64 -o /usr/local/bin/osv-scanner && \
    chmod +x /usr/local/bin/osv-scanner

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --root-user-action=ignore --no-cache-dir -r requirements.txt

RUN mkdir -p /data /ssh /config

COPY src /app/src

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

CMD ["python3", "/app/src/main.py"]
