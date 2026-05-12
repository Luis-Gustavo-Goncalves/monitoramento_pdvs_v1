# PDV Monitor 🖥️

Ferramenta de monitoramento de Pontos de Venda (PDVs) via SSH.  
Desenvolvida em Python + FastAPI no backend e React no frontend.
test de pr

---

## 📁 Estrutura do Projeto

```
pdv-monitor/
│
├── backend/
│   ├── main.py               ← Servidor FastAPI (rotas da API)
│   ├── pdvs.json             ← Lista de PDVs (adicione/remova aqui)
│   ├── requirements.txt      ← Dependências Python
│   │
│   ├── ssh/
│   │   └── ssh_client.py     ← Ping, SSH, identificar SO, inxi
│   │
│   └── utils/
│       └── monitor.py        ← Orquestra as 7 etapas em paralelo
│
└── frontend/
    └── src/
        └── App.jsx           ← Interface React (dashboard)
```

---

## ⚙️ As 7 Etapas de Monitoramento

Para cada PDV, o sistema executa:

| #   | Etapa                  | Descrição                                          |
| --- | ---------------------- | -------------------------------------------------- |
| 1   | **Ping**               | Verifica se o PDV está acessível na rede           |
| 2   | **Conexão SSH**        | Abre canal seguro com o PDV                        |
| 3   | **Identificar SO**     | Detecta Lubuntu, Linux Mint, Ubuntu etc.           |
| 4   | **Verificar inxi**     | Checa se inxi já está instalado (`which` + `dpkg`) |
| 5   | **Instalar inxi**      | Executa `sudo apt install inxi` se necessário      |
| 6   | **Coletar info**       | Executa `inxi -F` e captura a saída                |
| 7   | **Enviar ao frontend** | Dados disponibilizados via API REST                |

> Se o inxi **já estiver instalado** (etapa 4 = verdadeiro), a etapa 5 é pulada automaticamente.

---

## 🚀 Como Rodar

### Pré-requisitos

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend

# Instala as dependências
pip install -r requirements.txt

# Edite pdvs.json com os seus PDVs (host, usuário, senha)

# Inicia o servidor
python main.py
# → Rodando em http://localhost:8000
```

### Frontend

```bash
cd frontend

# Instala as dependências
npm install

# Inicia o servidor de desenvolvimento
npm run dev
# → Abre em http://localhost:5173
```

---

## 🔌 API — Rotas Disponíveis

| Método   | Rota              | Descrição                                     |
| -------- | ----------------- | --------------------------------------------- |
| `GET`    | `/pdvs`           | Lista todos os PDVs cadastrados               |
| `POST`   | `/pdvs`           | Adiciona um novo PDV                          |
| `DELETE` | `/pdvs/{id}`      | Remove um PDV                                 |
| `POST`   | `/monitorar`      | Inicia monitoramento de todos os PDVs         |
| `POST`   | `/monitorar/{id}` | Monitora um PDV específico                    |
| `GET`    | `/status`         | Retorna status atual (cache) de todos os PDVs |
| `GET`    | `/status/{id}`    | Retorna status de um PDV específico           |

---

## 📋 Formato do pdvs.json

```json
[
  {
    "id": "pdv-001",
    "nome": "Caixa 01 - Loja Centro",
    "host": "192.168.1.101",
    "usuario": "pdv",
    "senha": "senha123"
  }
]
```

Para **adicionar** um PDV: inclua um novo objeto no arquivo ou use a rota `POST /pdvs`.  
Para **remover** um PDV: delete o objeto ou use a rota `DELETE /pdvs/{id}`.

---

## 📈 Escalabilidade (500+ PDVs)

O monitoramento roda em **paralelo com ThreadPoolExecutor**.  
O padrão são 20 workers simultâneos — ajuste em `monitor.py`:

```python
# Para redes mais robustas, pode aumentar
monitorar_todos(max_workers=30)
```

Com 20 workers e ~15s por PDV, 500 PDVs levam em torno de **4-6 minutos** no total.

---

## 🖥️ Sistemas Operacionais Suportados nos PDVs

- ✅ Lubuntu
- ✅ Linux Mint
- ✅ Ubuntu
- ✅ Debian (e derivados com `apt`)
