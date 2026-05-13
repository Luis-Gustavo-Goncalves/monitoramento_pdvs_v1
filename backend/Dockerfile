# Backend - PDV Monitor
FROM python:3.11-slim

# Instala dependencias de sistema necessarias para paramiko e mysql.
RUN apt-get update && apt-get install -y \
    gcc \
    libssl-dev \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia e instala dependencias Python.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o codigo do backend, incluindo config.json e pdvs.json do contexto.
COPY . .

# Falha o build se os arquivos de configuracao nao vierem com conteudo.
RUN test -s pdvs.json && test -s config.json

EXPOSE 8000

CMD ["python", "main.py"]
