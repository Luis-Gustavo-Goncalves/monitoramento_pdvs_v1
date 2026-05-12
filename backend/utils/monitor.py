"""
monitor.py - Orquestra o monitoramento de todos os PDVs
Rastreia a etapa exata onde cada falha ocorreu para exibição detalhada no frontend.
"""
import json
import os
import concurrent.futures
from datetime import datetime
from ssh.ssh_client import (
    parsear_hardware,
    fazer_ping,
    conectar_ssh,
    identificar_sistema_operacional,
    instalar_inxi,
    obter_info_sistema,
)

ARQUIVO_PDVS = os.path.join(os.path.dirname(__file__), "..", "pdvs.json")
cache_resultados: dict = {}


def carregar_pdvs() -> list:
    with open(ARQUIVO_PDVS, "r", encoding="utf-8") as f:
        return json.load(f)


def monitorar_pdv(pdv: dict) -> dict:
    resultado = {
        "id":                      pdv["id"],
        "nome":                    pdv["nome"],
        "host":                    pdv["host"],
        "origem":                  pdv.get("origem", "socin"),
        "status":                  "offline",
        "sistema_operacional":     None,
        "inxi_ja_estava_instalado": None,
        "inxi_instalado":          False,
        "info_sistema":            None,
        "cpu_modelo":              None,
        "memoria_total":           None,
        "memoria_usada":           None,
        "disco_total":             None,
        "disco_usado":             None,
        # ── campos de erro detalhado ──
        "erro":                    None,   # mensagem resumida
        "erro_etapa":              None,   # onde falhou: "ping"|"ssh"|"so"|"inxi"|"coleta"
        "erro_detalhe":            None,   # mensagem técnica completa
        # ─────────────────────────────
        "atualizado_em":           datetime.now().isoformat(),
    }

    pdv_label = f"[{pdv['id']}]"

    # Host vazio (SCH sem IP cadastrado)
    if not pdv.get("host"):
        resultado.update({
            "status":       "erro",
            "erro":         "IP não cadastrado",
            "erro_etapa":   "configuracao",
            "erro_detalhe": "Este terminal não possui endereço IP registrado no banco de dados. Execute a sincronização novamente ou edite o cadastro manualmente.",
        })
        print(f"{pdv_label} ✗ Sem IP cadastrado — pulando")
        return resultado

    print(f"{pdv_label} Verificando {pdv['host']}...")

    # ── ETAPA 1: Ping ──────────────────────────────────────────────────────────
    print(f"{pdv_label} Etapa 1/6 — Ping {pdv['host']}...")
    if not fazer_ping(pdv["host"]):
        resultado.update({
            "status":       "offline",
            "erro":         "Sem resposta ao ping",
            "erro_etapa":   "ping",
            "erro_detalhe": f"O host {pdv['host']} não respondeu ao ICMP ping (2 tentativas, timeout 2s). "
                            "Verifique: cabo de rede, energia, IP correto.",
        })
        print(f"{pdv_label} ✗ OFFLINE — sem resposta ao ping")
        return resultado

    resultado["status"] = "online"
    print(f"{pdv_label} ✓ Ping OK")

    # ── ETAPA 2: Conexão SSH ───────────────────────────────────────────────────
    print(f"{pdv_label} Etapa 2/6 — SSH {pdv['usuario']}@{pdv['host']}...")
    cliente = conectar_ssh(pdv["host"], pdv["usuario"], pdv["senha"])
    if not cliente:
        resultado.update({
            "status":       "erro_ssh",
            "erro":         "Falha na autenticação SSH",
            "erro_etapa":   "ssh",
            "erro_detalhe": f"Ping OK mas SSH falhou em {pdv['host']} com usuário '{pdv['usuario']}'. "
                            "Possíveis causas: senha incorreta, SSH desabilitado, porta 22 bloqueada, "
                            "ou serviço SSH não iniciado no terminal.",
        })
        print(f"{pdv_label} ✗ Falha SSH")
        return resultado

    print(f"{pdv_label} ✓ SSH conectado")

    try:
        # ── ETAPA 3: Identificar SO ────────────────────────────────────────────
        print(f"{pdv_label} Etapa 3/6 — Identificando SO...")
        try:
            resultado["sistema_operacional"] = identificar_sistema_operacional(cliente)
            print(f"{pdv_label} ✓ SO: {resultado['sistema_operacional']}")
        except Exception as e:
            resultado["sistema_operacional"] = "Desconhecido"
            resultado["erro_detalhe"] = f"SO não identificado: {e}"
            print(f"{pdv_label} ⚠ SO não identificado: {e}")

        # ── ETAPA 4+5: Verificar / instalar inxi ──────────────────────────────
        print(f"{pdv_label} Etapa 4/6 — Verificando/instalando inxi...")
        usar_coletor_nativo = False
        try:
            inxi_res = instalar_inxi(cliente, pdv["senha"])
            resultado["inxi_ja_estava_instalado"] = inxi_res["ja_instalado"]
            resultado["inxi_instalado"]           = inxi_res["instalado"]

            if inxi_res["ja_instalado"]:
                print(f"{pdv_label} ✓ inxi já instalado")
            elif inxi_res["instalado"]:
                print(f"{pdv_label} ✓ inxi instalado agora")
            else:
                # inxi não pôde ser instalado → aciona coletor nativo automaticamente
                usar_coletor_nativo = True
                print(f"{pdv_label} ⚠ inxi indisponível — usando coletor nativo")
        except Exception as e:
            usar_coletor_nativo = True
            print(f"{pdv_label} ⚠ Exceção ao instalar inxi ({e}) — usando coletor nativo")

        # ── ETAPA 6: Coletar hardware (inxi ou coletor nativo) ─────────────────
        print(f"{pdv_label} Etapa 5/6 — Coletando hardware {'[NATIVO]' if usar_coletor_nativo else '[inxi]'}...")
        try:
            if usar_coletor_nativo:
                # Coletor nativo: /proc, /sys, lscpu, df — sem inxi
                from ssh.ssh_client import coletar_hardware_nativo
                hw_nativo = coletar_hardware_nativo(cliente)
                resultado["info_sistema"] = hw_nativo.pop("info_sistema", None)
                resultado["inxi_instalado"] = False
                resultado.update({
                    "cpu_modelo":    hw_nativo["cpu_modelo"],
                    "memoria_total": hw_nativo["memoria_total"],
                    "memoria_usada": hw_nativo["memoria_usada"],
                    "disco_total":   hw_nativo["disco_total"],
                    "disco_usado":   hw_nativo["disco_usado"],
                })
            else:
                resultado["info_sistema"] = obter_info_sistema(cliente)
                hw = parsear_hardware(resultado["info_sistema"], cliente)
                resultado.update({
                    "cpu_modelo":    hw["cpu_modelo"],
                    "memoria_total": hw["memoria_total"],
                    "memoria_usada": hw["memoria_usada"],
                    "disco_total":   hw["disco_total"],
                    "disco_usado":   hw["disco_usado"],
                })
            print(f"{pdv_label} ✓ Hardware coletado")
        except Exception as e:
            resultado.update({
                "status":       "erro",
                "erro":         "Falha ao coletar hardware",
                "erro_etapa":   "coleta",
                "erro_detalhe": f"Erro ao coletar dados de hardware em {pdv['host']}: {e}",
            })
            print(f"{pdv_label} ✗ Erro na coleta de hardware: {e}")
            return resultado

        print(f"{pdv_label} ✓ Etapa 6/6 — Concluído")

    finally:
        cliente.close()

    return resultado


def monitorar_todos(max_workers: int = 20) -> list:
    global cache_resultados
    pdvs = carregar_pdvs()
    print(f"\n=== Iniciando monitoramento de {len(pdvs)} PDVs ===\n")

    resultados = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futuros = {executor.submit(monitorar_pdv, pdv): pdv for pdv in pdvs}
        for futuro in concurrent.futures.as_completed(futuros):
            try:
                res = futuro.result()
                resultados.append(res)
                cache_resultados[res["id"]] = res
            except Exception as e:
                pdv = futuros[futuro]
                erro = {
                    "id":           pdv["id"],
                    "nome":         pdv["nome"],
                    "host":         pdv["host"],
                    "origem":       pdv.get("origem", "socin"),
                    "status":       "erro",
                    "erro":         "Erro inesperado no monitoramento",
                    "erro_etapa":   "interno",
                    "erro_detalhe": str(e),
                    "atualizado_em": datetime.now().isoformat(),
                }
                resultados.append(erro)
                cache_resultados[pdv["id"]] = erro

    print(f"\n=== Monitoramento concluído: {len(resultados)} PDVs processados ===\n")
    return resultados


def obter_cache() -> list:
    return list(cache_resultados.values())
