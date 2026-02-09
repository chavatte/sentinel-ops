FROM python:3.11-alpine

RUN apk add --no-cache git openssh npm && \
    npm install -g pnpm yarn

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /data /ssh /config

COPY src /app/src

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

CMD ["python3", "/app/src/main.py"]
