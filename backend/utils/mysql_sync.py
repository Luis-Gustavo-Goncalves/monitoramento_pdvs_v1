"""
mysql_sync.py - Conecta aos bancos MySQL SOCIN e Emporium e sincroniza pdvs.json
"""
import json
import os
import re
import mysql.connector
from mysql.connector import Error

ARQUIVO_PDVS   = os.path.join(os.path.dirname(__file__), "..", "pdvs.json")
ARQUIVO_CONFIG = os.path.join(os.path.dirname(__file__), "..", "config.json")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def carregar_config() -> dict:
    if not os.path.exists(ARQUIVO_CONFIG):
        raise FileNotFoundError("config.json não encontrado.")
    with open(ARQUIVO_CONFIG, "r", encoding="utf-8") as f:
        return json.load(f)


def _conectar(db_cfg: dict):
    try:
        cx = mysql.connector.connect(
            host=db_cfg.get("host"),
            port=db_cfg.get("porta", 3306),
            database=db_cfg.get("banco"),
            user=db_cfg.get("usuario"),
            password=db_cfg.get("senha"),
            connection_timeout=10,
        )
        if cx.is_connected():
            print(f"[MySQL] Conectado: {db_cfg.get('banco')}@{db_cfg.get('host')}")
            return cx
    except Error as e:
        raise ConnectionError(f"Falha ao conectar em {db_cfg.get('host')}: {e}")


def _extrair_ip(valor: str):
    m = re.search(r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b", valor or "")
    return m.group(1) if m else None


def _carregar_json_atual() -> dict:
    if not os.path.exists(ARQUIVO_PDVS):
        return {}
    try:
        with open(ARQUIVO_PDVS, "r", encoding="utf-8") as f:
            conteudo = f.read().strip()
            if conteudo:
                return {p["id"]: p for p in json.loads(conteudo)}
    except (json.JSONDecodeError, KeyError):
        pass
    return {}


def _salvar_json(pdvs_atuais: dict, novos_da_origem: dict, prefixo: str, origem: str) -> dict:
    ids_atuais_desta_origem = {k for k in pdvs_atuais if k.startswith(prefixo)}
    ids_novos               = set(novos_da_origem.keys())

    adicionados = ids_novos - ids_atuais_desta_origem
    removidos   = ids_atuais_desta_origem - ids_novos
    existentes  = ids_novos & ids_atuais_desta_origem

    atualizados = []
    for pid in existentes:
        p_atual = pdvs_atuais[pid]
        p_novo  = novos_da_origem[pid]
        if p_atual.get("host") != p_novo["host"]:
            p_atual["host"] = p_novo["host"]
            atualizados.append(pid)
        p_atual["usuario"] = p_novo["usuario"]
        p_atual["senha"]   = p_novo["senha"]

    resultado = {}
    for pid, pdv in pdvs_atuais.items():
        if not pid.startswith(prefixo):
            resultado[pid] = pdv
    for pid in existentes:
        resultado[pid] = pdvs_atuais[pid]
    for pid in adicionados:
        resultado[pid] = novos_da_origem[pid]

    def sort_key(p):
        pid = p["id"]
        if pid.startswith("pdv-"):
            parts = pid.split("-")
            return (0, int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0,
                    int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0)
        elif pid.startswith("sch-"):
            parts = pid.split("-")
            return (1, int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0,
                    int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0)
        return (2, 0, 0)

    lista_final = sorted(resultado.values(), key=sort_key)
    for p in lista_final:
        p.pop("_sort_loja", None)
        p.pop("_sort_num", None)

    with open(ARQUIVO_PDVS, "w", encoding="utf-8") as f:
        json.dump(lista_final, f, indent=2, ensure_ascii=False)

    return {
        "total":       len([p for p in lista_final if p["id"].startswith(prefixo)]),
        "adicionados": len(adicionados),
        "removidos":   len(removidos),
        "atualizados": len(atualizados),
        "detalhes": {
            "adicionados": sorted(adicionados),
            "removidos":   sorted(removidos),
            "atualizados": sorted(atualizados),
        },
    }


# ─── SOCIN ────────────────────────────────────────────────────────────────────

def sincronizar_pdvs(usuario_ssh: str, senha_ssh: str) -> dict:
    config = carregar_config()
    cx     = _conectar(config.get("banco", {}))

    nomes_lojas = {}
    cur = cx.cursor(dictionary=True)
    try:
        cur.execute("SELECT codigo_loja, nome_loja FROM loja ORDER BY codigo_loja")
        for row in cur.fetchall():
            nomes_lojas[str(row["codigo_loja"])] = row["nome_loja"]
    except Error:
        pass
    finally:
        cur.close()

    cur = cx.cursor(dictionary=True)
    cur.execute("""
        SELECT codigo_loja, codigo_pdv, numero_pdv, ip_pdv
        FROM pdv
        WHERE situacao_pdv = 2
        ORDER BY codigo_loja ASC, numero_pdv ASC
    """)
    rows = cur.fetchall()
    cur.close()
    cx.close()
    print(f"[SOCIN] {len(rows)} PDVs encontrados")

    novos = {}
    for row in rows:
        cl  = str(row["codigo_loja"])
        num = str(row["numero_pdv"]).zfill(3)
        pid = f"pdv-{cl}-{num}"
        nl  = nomes_lojas.get(cl, f"Loja {cl}")
        novos[pid] = {
            "id":      pid,
            "nome":    f"{cl} - {nl} - pdv - {row['numero_pdv']}",
            "host":    str(row["ip_pdv"]).strip(),
            "usuario": usuario_ssh,
            "senha":   senha_ssh,
            "origem":  "socin",
        }

    return _salvar_json(_carregar_json_atual(), novos, "pdv-", "socin")


# ─── EMPORIUM ─────────────────────────────────────────────────────────────────

def sincronizar_pdvs_emporium(usuario_ssh: str, senha_ssh: str) -> dict:
    """
    Sincroniza self-checkouts do banco Emporium.
    SELECT pos_number, pos_name, pos_version, store_key, pos_ip FROM pos
    O campo pos_ip é usado diretamente como host SSH.
    """
    config = carregar_config()
    db_cfg = config.get("banco_emporium", {})

    if not db_cfg or not db_cfg.get("host"):
        raise FileNotFoundError(
            "Bloco 'banco_emporium' não encontrado no config.json."
        )

    cx  = _conectar(db_cfg)
    cur = cx.cursor(dictionary=True)

    # Verifica se a coluna pos_ip existe na tabela pos
    try:
        cur.execute("""
            SELECT pos_number, pos_name, pos_version, store_key, pos_ip
            FROM pos
            ORDER BY store_key ASC, pos_number ASC
        """)
    except Error:
        # Fallback: sem pos_ip (coluna pode não existir em versões antigas)
        cur.execute("""
            SELECT pos_number, pos_name, pos_version, store_key
            FROM pos
            ORDER BY store_key ASC, pos_number ASC
        """)

    rows = cur.fetchall()
    cur.close()
    cx.close()
    print(f"[Emporium] {len(rows)} self-checkouts encontrados")

    sem_ip = []
    novos  = {}
    for row in rows:
        store    = str(row.get("store_key") or "0")
        num      = str(row.get("pos_number") or "0").zfill(3)
        pid      = f"sch-{store}-{num}"
        pos_name = str(row.get("pos_name") or "")
        pos_ver  = str(row.get("pos_version") or "")

        # Prioridade do IP: 1) pos_ip   2) IP extraído do pos_name   3) None (sem IP)
        pos_ip_raw = str(row.get("pos_ip") or "").strip()
        host = (
            _extrair_ip(pos_ip_raw)          # campo pos_ip direto
            or _extrair_ip(pos_name)          # IP embutido no nome
            or None                           # sem IP disponível
        )

        if not host:
            sem_ip.append(pid)
            print(f"  [Emporium] ⚠ {pid} ({pos_name}) sem IP — será cadastrado sem host")
            host = ""   # cadastra com host vazio; monitoramento tratará como offline

        novos[pid] = {
            "id":          pid,
            "nome":        f"Emporium - SCH {store} - {pos_name or num}",
            "host":        host,
            "usuario":     usuario_ssh,
            "senha":       senha_ssh,
            "origem":      "emporium",
            "pos_version": pos_ver,
        }

    resumo = _salvar_json(_carregar_json_atual(), novos, "sch-", "emporium")
    resumo["sem_ip"] = sem_ip
    return resumo


# ─── Dias sem venda (SOCIN) ───────────────────────────────────────────────────

def buscar_dias_sem_venda_todos() -> list:
    """
    Busca última venda de TODOS os PDVs da tabela capa_cupom_venda,
    independente de status online/offline.
    SELECT numero_loja, data_venda, numero_pdv FROM capa_cupom_venda
    Agrupa por loja+pdv e retorna última data de venda e dias sem registro.
    """
    config = carregar_config()
    cx = None
    try:
        cx = _conectar(config.get("banco", {}))
    except ConnectionError as e:
        print(f"[dias_sem_venda_todos] Não conectou: {e}")
        return []

    try:
        cur = cx.cursor(dictionary=True)
        cur.execute("""
            SELECT
                numero_loja,
                numero_pdv,
                MAX(data_venda)                          AS ultima_venda,
                DATEDIFF(NOW(), MAX(data_venda))         AS dias_sem_registro,
                COUNT(*)                                 AS total_vendas
            FROM capa_cupom_venda
            GROUP BY numero_loja, numero_pdv
            ORDER BY dias_sem_registro DESC, numero_loja ASC, numero_pdv ASC
        """)
        rows = cur.fetchall()
        cur.close()
    except Error as e:
        if cx:
            cx.close()
        print(f"[dias_sem_venda_todos] Erro na query: {e}")
        return []

    # Carrega mapa de nomes de loja
    nomes_lojas = {}
    try:
        cur2 = cx.cursor(dictionary=True)
        cur2.execute("SELECT codigo_loja, nome_loja FROM loja ORDER BY codigo_loja")
        for row in cur2.fetchall():
            nomes_lojas[str(row["codigo_loja"])] = row["nome_loja"]
        cur2.close()
    except Error:
        pass

    cx.close()

    resultados = []
    for row in rows:
        numero_loja = str(row["numero_loja"])
        numero_pdv  = str(row["numero_pdv"])
        pdv_id      = f"pdv-{numero_loja}-{numero_pdv.zfill(3)}"
        nome_loja   = nomes_lojas.get(numero_loja, f"Loja {numero_loja}")
        ultima_venda = row["ultima_venda"]
        dias         = row["dias_sem_registro"]

        resultados.append({
            "id":                pdv_id,
            "nome":              f"{numero_loja} - {nome_loja} - pdv - {numero_pdv}",
            "numero_loja":       numero_loja,
            "numero_pdv":        numero_pdv,
            "ultima_venda":      ultima_venda.isoformat() if ultima_venda else None,
            "dias_sem_registro": int(dias) if dias is not None else None,
            "total_vendas":      int(row["total_vendas"]) if row["total_vendas"] else 0,
        })

    return resultados


def buscar_dias_sem_venda(pdvs_offline: list) -> list:
    config = carregar_config()
    resultados = []
    cx = None
    try:
        cx = _conectar(config.get("banco", {}))
    except ConnectionError as e:
        print(f"[dias_sem_venda] Não conectou: {e}")
        return []

    for pdv in pdvs_offline:
        pid = pdv.get("id", "")
        if not pid.startswith("pdv-"):
            continue
        partes = pid.split("-")
        if len(partes) < 3:
            continue
        numero_loja = partes[1]
        numero_pdv  = str(int(partes[2]))
        try:
            cur = cx.cursor(dictionary=True)
            cur.execute("""
                SELECT
                    MAX(hora_venda) AS ultima_venda,
                    DATEDIFF(NOW(), MAX(hora_venda)) AS dias_sem_registro
                FROM capa_cupom_venda
                WHERE numero_loja = %s AND numero_pdv = %s
            """, (numero_loja, numero_pdv))
            row = cur.fetchone()
            cur.close()
            resultados.append({
                "id":                pdv.get("id"),
                "nome":              pdv.get("nome"),
                "host":              pdv.get("host"),
                "ultima_venda":      row["ultima_venda"].isoformat() if row and row["ultima_venda"] else None,
                "dias_sem_registro": int(row["dias_sem_registro"]) if row and row["dias_sem_registro"] is not None else None,
            })
        except Error as e:
            resultados.append({
                "id": pdv.get("id"), "nome": pdv.get("nome"), "host": pdv.get("host"),
                "ultima_venda": None, "dias_sem_registro": None, "erro": str(e),
            })

    if cx:
        cx.close()

    resultados.sort(key=lambda x: (x.get("dias_sem_registro") or -1), reverse=True)
    return resultados
