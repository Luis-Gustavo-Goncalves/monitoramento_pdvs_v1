# ── Backend — PDV Monitor ──────────────────────────────────────────────────────
FROM python:3.11-slim

# Instala dependências de sistema necessárias para paramiko e mysql
RUN apt-get update && apt-get install -y \
    gcc \
    libssl-dev \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia e instala dependências Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código do backend
COPY . .

# Garante que o pdvs.json existe (lista vazia se não existir)
RUN test -f pdvs.json || echo "[]" > pdvs.json

EXPOSE 8000

CMD ["python", "main.py"]
