"""
main.py - Servidor FastAPI — PDV Monitor v3.0
Suporta SOCIN (PDVs) + Emporium (Self-Checkouts) + Dias sem venda
"""
import json
import os
import sys
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from utils.monitor import monitorar_todos, monitorar_pdv, obter_cache, carregar_pdvs, ARQUIVO_PDVS

app = FastAPI(title="PDV Monitor", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

monitoramento_em_andamento = False


# ─── Modelos ──────────────────────────────────────────────────────────────────

class NovoPDV(BaseModel):
    id: str
    nome: str
    host: str
    usuario: str
    senha: str

class EdicaoPDV(BaseModel):
    nome:    Optional[str] = None
    host:    Optional[str] = None
    usuario: Optional[str] = None
    senha:   Optional[str] = None

class CredenciaisSync(BaseModel):
    usuario_ssh: str
    senha_ssh:   str


# ─── Raiz ─────────────────────────────────────────────────────────────────────

@app.get("/")
def raiz():
    return {"mensagem": "PDV Monitor rodando!", "versao": "3.0.0"}


# ─── PDVs ─────────────────────────────────────────────────────────────────────

@app.get("/pdvs")
def listar_pdvs():
    pdvs = carregar_pdvs()
    return [{"id": p["id"], "nome": p["nome"], "host": p["host"], "usuario": p["usuario"]}
            for p in pdvs]

@app.post("/pdvs")
def adicionar_pdv(pdv: NovoPDV):
    pdvs = carregar_pdvs()
    if any(p["id"] == pdv.id for p in pdvs):
        raise HTTPException(400, f"PDV '{pdv.id}' já existe")
    pdvs.append(pdv.dict())
    _salvar_pdvs(pdvs)
    return {"mensagem": f"PDV '{pdv.nome}' adicionado"}

@app.put("/pdvs/{pdv_id}")
def editar_pdv(pdv_id: str, dados: EdicaoPDV):
    pdvs = carregar_pdvs()
    pdv  = next((p for p in pdvs if p["id"] == pdv_id), None)
    if not pdv:
        raise HTTPException(404, "PDV não encontrado")
    alteracoes = dados.dict(exclude_none=True)
    if not alteracoes:
        raise HTTPException(400, "Nenhum campo para atualizar")
    for campo, valor in alteracoes.items():
        pdv[campo] = valor
    _salvar_pdvs(pdvs)
    return {"mensagem": f"PDV '{pdv_id}' atualizado", "campos_alterados": list(alteracoes.keys())}

@app.delete("/pdvs/{pdv_id}")
def remover_pdv(pdv_id: str):
    pdvs  = carregar_pdvs()
    novos = [p for p in pdvs if p["id"] != pdv_id]
    if len(novos) == len(pdvs):
        raise HTTPException(404, "PDV não encontrado")
    _salvar_pdvs(novos)
    return {"mensagem": f"PDV '{pdv_id}' removido"}


# ─── Sincronização MySQL SOCIN ────────────────────────────────────────────────

@app.post("/sincronizar-mysql")
def sincronizar_mysql(credenciais: CredenciaisSync):
    """Sincroniza PDVs do banco SOCIN (situacao_pdv = 2)."""
    try:
        from utils.mysql_sync import sincronizar_pdvs
        resumo = sincronizar_pdvs(credenciais.usuario_ssh, credenciais.senha_ssh)
        return {"mensagem": "Sincronização SOCIN concluída", "resumo": resumo}
    except FileNotFoundError as e:
        raise HTTPException(500, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erro: {str(e)}")


# ─── Sincronização MySQL Emporium ─────────────────────────────────────────────

@app.post("/sincronizar-mysql-emporium")
def sincronizar_mysql_emporium(credenciais: CredenciaisSync):
    """Sincroniza self-checkouts do banco Emporium (tabela pos)."""
    try:
        from utils.mysql_sync import sincronizar_pdvs_emporium
        resumo = sincronizar_pdvs_emporium(credenciais.usuario_ssh, credenciais.senha_ssh)
        return {"mensagem": "Sincronização Emporium concluída", "resumo": resumo}
    except FileNotFoundError as e:
        raise HTTPException(500, str(e))
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erro: {str(e)}")


# ─── Verificação de configuração ──────────────────────────────────────────────

@app.get("/config-banco")
def verificar_config_banco():
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if not os.path.exists(config_path):
        return {"configurado": False}
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    banco    = config.get("banco", {})
    banco_emp = config.get("banco_emporium", {})
    ssh      = config.get("ssh", {})
    ssh_emp  = config.get("ssh_emporium", {})

    return {
        "configurado": True,
        "banco":    {"host": banco.get("host"), "porta": banco.get("porta", 3306),
                     "banco": banco.get("banco"), "usuario": banco.get("usuario")},
        "ssh":      {"usuario": ssh.get("usuario")},
        "banco_emporium": {
            "configurado": bool(banco_emp.get("host")),
            "host": banco_emp.get("host"), "porta": banco_emp.get("porta", 3306),
            "banco": banco_emp.get("banco"), "usuario": banco_emp.get("usuario"),
        },
        "ssh_emporium": {"usuario": ssh_emp.get("usuario")},
    }


# ─── Monitoramento ────────────────────────────────────────────────────────────

@app.post("/monitorar")
def iniciar_monitoramento(background_tasks: BackgroundTasks):
    global monitoramento_em_andamento
    if monitoramento_em_andamento:
        return {"mensagem": "Monitoramento já em andamento"}

    def executar():
        global monitoramento_em_andamento
        monitoramento_em_andamento = True
        try:
            monitorar_todos(max_workers=20)
        finally:
            monitoramento_em_andamento = False

    background_tasks.add_task(executar)
    return {"mensagem": "Monitoramento iniciado em background"}

@app.post("/monitorar/{pdv_id}")
def monitorar_um_pdv(pdv_id: str):
    pdvs = carregar_pdvs()
    pdv  = next((p for p in pdvs if p["id"] == pdv_id), None)
    if not pdv:
        raise HTTPException(404, "PDV não encontrado")
    return monitorar_pdv(pdv)

@app.get("/status")
def obter_status():
    resultados = obter_cache()
    total   = len(resultados)
    online  = sum(1 for r in resultados if r.get("status") == "online")
    offline = sum(1 for r in resultados if r.get("status") == "offline")
    erro    = total - online - offline

    # Subtotais por origem
    total_socin    = sum(1 for r in resultados if r.get("origem") == "socin"    or r.get("id","").startswith("pdv-"))
    total_emporium = sum(1 for r in resultados if r.get("origem") == "emporium" or r.get("id","").startswith("sch-"))

    return {
        "monitoramento_em_andamento": monitoramento_em_andamento,
        "resumo": {
            "total":          total,
            "online":         online,
            "offline":        offline,
            "erro":           erro,
            "total_socin":    total_socin,
            "total_emporium": total_emporium,
        },
        "pdvs": resultados,
    }

@app.get("/status/{pdv_id}")
def obter_status_pdv(pdv_id: str):
    cache = obter_cache()
    pdv   = next((r for r in cache if r["id"] == pdv_id), None)
    if not pdv:
        raise HTTPException(404, "PDV sem dados. Execute o monitoramento primeiro.")
    return pdv


# ─── Dias sem venda ────────────────────────────────────────────────────────────

@app.get("/dias-sem-venda")
def dias_sem_venda():
    """
    Retorna lista de PDVs SOCIN offline com última venda e dias sem registro.
    Consulta capa_cupom_venda para cada PDV offline do cache.
    """
    try:
        from utils.mysql_sync import buscar_dias_sem_venda
        cache   = obter_cache()
        offline = [r for r in cache if r.get("status") == "offline"]
        if not offline:
            return {"mensagem": "Nenhum PDV offline no momento", "dados": []}
        dados = buscar_dias_sem_venda(offline)
        return {"total_offline": len(offline), "total_socin": len(dados), "dados": dados}
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erro: {str(e)}")


@app.get("/dias-sem-venda-todos")
def dias_sem_venda_todos():
    """
    Retorna última venda de TODOS os PDVs registrados na capa_cupom_venda,
    independente de estarem online ou offline.
    Agrupa por numero_loja + numero_pdv e calcula dias sem registro.
    """
    try:
        from utils.mysql_sync import buscar_dias_sem_venda_todos
        dados = buscar_dias_sem_venda_todos()
        return {"total": len(dados), "dados": dados}
    except ConnectionError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erro: {str(e)}")


# ─── Helper ───────────────────────────────────────────────────────────────────

def _salvar_pdvs(pdvs: list):
    with open(ARQUIVO_PDVS, "w", encoding="utf-8") as f:
        json.dump(pdvs, f, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
