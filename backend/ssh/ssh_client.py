"""
ssh_client.py - Conexão SSH, ping e coleta de hardware dos PDVs.

Estratégia de coleta em cascata:
  1. inxi -F          → parser regex (resultado mais rico)
  2. Coletor nativo   → /proc, /sys, df, free, lscpu, dmidecode
                        produz os MESMOS campos que o inxi, sem depender dele
"""
import paramiko
import subprocess
import platform
import re


# ─── Ping ─────────────────────────────────────────────────────────────────────

def fazer_ping(host: str) -> bool:
    sistema = platform.system().lower()
    comando = (
        ["ping", "-n", "2", "-w", "1000", host]
        if sistema == "windows"
        else ["ping", "-c", "2", "-W", "2", host]
    )
    resultado = subprocess.run(comando, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return resultado.returncode == 0


# ─── SSH ──────────────────────────────────────────────────────────────────────

def conectar_ssh(host: str, usuario: str, senha: str, porta: int = 22):
    cliente = paramiko.SSHClient()
    cliente.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        cliente.connect(
            hostname=host, port=porta, username=usuario, password=senha,
            timeout=10, banner_timeout=10
        )
        return cliente
    except paramiko.AuthenticationException:
        print(f"[ERRO] Autenticação falhou em {host}")
    except paramiko.SSHException as e:
        print(f"[ERRO] SSH em {host}: {e}")
    except Exception as e:
        print(f"[ERRO] Conexão em {host}: {e}")
    return None


def executar_comando(cliente, comando: str, senha_sudo: str = None, timeout: int = 60) -> str:
    try:
        if senha_sudo and comando.strip().startswith("sudo"):
            cmd = f"echo '{senha_sudo}' | sudo -S {comando.replace('sudo ', '', 1)}"
            stdin, stdout, stderr = cliente.exec_command(cmd, timeout=timeout)
        else:
            stdin, stdout, stderr = cliente.exec_command(comando, timeout=timeout)

        stdout.channel.recv_exit_status()
        saida = stdout.read().decode("utf-8", errors="ignore").strip()
        erro  = stderr.read().decode("utf-8", errors="ignore").strip()

        if erro and not any(x in erro.lower() for x in ["password", "sudo", "dpkg"]):
            return f"ERRO: {erro}"
        return saida
    except Exception as e:
        return f"ERRO: {str(e)}"


# ─── Sistema operacional ───────────────────────────────────────────────────────

def identificar_sistema_operacional(cliente) -> str:
    """
    Detecta SO + versão completa via PRETTY_NAME do /etc/os-release.
    Fallback para Slackware via /etc/slackware-version.
    Exemplos: "Lubuntu 22.04.3 LTS", "Slackware 15.0", "Linux Mint 21.3"
    """
    saida = executar_comando(cliente, "cat /etc/os-release 2>/dev/null || echo ''")
    sl    = saida.lower()

    def _campo(nome):
        m = re.search(rf'^{nome}="?([^"\n]+)"?', saida, re.MULTILINE | re.IGNORECASE)
        return m.group(1).strip() if m else ""

    pretty = _campo("PRETTY_NAME")
    nome   = _campo("NAME")
    ver_id = _campo("VERSION_ID")
    versao = _campo("VERSION")
    nome_lower = (pretty or nome).lower()

    # Slackware — usa arquivo próprio
    if "slackware" in sl or "slackware" in nome_lower:
        sv = executar_comando(cliente, "cat /etc/slackware-version 2>/dev/null || echo ''")
        if sv and not sv.startswith("ERRO") and sv.strip():
            return sv.strip()
        ver = re.search(r"slackware[^\d]*(\d[\d.]*)", sl)
        return f"Slackware {ver.group(1)}" if ver else "Slackware"

    # Sem /etc/os-release — tenta slackware-version mesmo assim
    if not pretty and not nome:
        sv = executar_comando(cliente, "cat /etc/slackware-version 2>/dev/null || echo ''")
        if sv and not sv.startswith("ERRO") and sv.strip():
            return sv.strip()

    # PRETTY_NAME já vem formatado pela distro
    if pretty:
        return re.sub(r'\s*\([^)]*\)\s*$', '', pretty).strip() or pretty

    # Fallback manual
    if nome:
        if ver_id:
            return f"{nome} {ver_id}"
        if versao:
            ver_num = re.match(r'[\d.]+', versao)
            return f"{nome} {ver_num.group()}" if ver_num else f"{nome} {versao}"
        return nome

    # Último recurso
    saida2 = executar_comando(cliente, "lsb_release -d 2>/dev/null || echo ''")
    desc   = saida2.replace("Description:", "").strip()
    if desc and not desc.startswith("ERRO"):
        return re.sub(r'\s*\([^)]*\)\s*$', '', desc).strip() or desc

    return "Linux Desconhecido"


def _eh_slackware(cliente) -> bool:
    sv = executar_comando(cliente, "cat /etc/slackware-version 2>/dev/null || echo ''")
    if sv and not sv.startswith("ERRO") and sv.strip():
        return True
    osr = executar_comando(cliente, "cat /etc/os-release 2>/dev/null || echo ''")
    return "slackware" in osr.lower()


# ─── Instalação inxi ──────────────────────────────────────────────────────────

def verificar_inxi_instalado(cliente) -> bool:
    if "/inxi" in executar_comando(cliente, "which inxi 2>/dev/null"):
        return True
    dpkg = executar_comando(cliente, "dpkg -s inxi 2>/dev/null | grep Status")
    if "installed" in dpkg.lower():
        return True
    pkg = executar_comando(cliente, "ls /var/log/packages/inxi* 2>/dev/null")
    if pkg and not pkg.startswith("ERRO"):
        return True
    return False


def _instalar_inxi_slackware(cliente, senha: str) -> bool:
    print("  [Slackware] Instalando inxi...")

    if "/slackpkg" in executar_comando(cliente, "which slackpkg 2>/dev/null", timeout=10):
        print("  [Slackware] Tentando via slackpkg...")
        executar_comando(cliente, "echo 'y' | slackpkg -batch=on install inxi 2>/dev/null",
                         senha_sudo=senha, timeout=180)
        if verificar_inxi_instalado(cliente):
            print("  [Slackware] ✓ inxi instalado via slackpkg")
            return True

    print("  [Slackware] Tentando download direto do script inxi...")
    cmds = [
        "mkdir -p /usr/local/bin",
        (
            "wget -q -O /usr/local/bin/inxi "
            "https://raw.githubusercontent.com/smxi/inxi/master/inxi 2>/dev/null || "
            "curl -fsSL -o /usr/local/bin/inxi "
            "https://raw.githubusercontent.com/smxi/inxi/master/inxi 2>/dev/null"
        ),
        "chmod +x /usr/local/bin/inxi",
        "ln -sf /usr/local/bin/inxi /usr/bin/inxi 2>/dev/null || true",
    ]
    for cmd in cmds:
        executar_comando(cliente, cmd, senha_sudo=senha, timeout=90)

    if verificar_inxi_instalado(cliente):
        print("  [Slackware] ✓ inxi instalado via download direto")
        return True

    print("  [Slackware] ✗ Não foi possível instalar inxi — usará coletor nativo")
    return False


def instalar_inxi(cliente, senha: str) -> dict:
    if verificar_inxi_instalado(cliente):
        return {"ja_instalado": True, "instalado": True}

    if _eh_slackware(cliente):
        print("  inxi ausente — Slackware detectado, instalando...")
        instalado = _instalar_inxi_slackware(cliente, senha)
    else:
        print("  inxi ausente — instalando via apt...")
        executar_comando(
            cliente,
            "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y inxi",
            senha_sudo=senha, timeout=120
        )
        instalado = verificar_inxi_instalado(cliente)

    return {"ja_instalado": False, "instalado": instalado}


# ─── Coletor nativo (sem inxi) ────────────────────────────────────────────────

def coletar_hardware_nativo(cliente) -> dict:
    """
    Coleta CPU, RAM e disco usando apenas arquivos/comandos Unix universais.
    Funciona em qualquer Linux — Slackware antigo, Lubuntu, Ubuntu, Mint, Debian.
    Retorna os mesmos campos que parsear_hardware():
      cpu_modelo, memoria_total, memoria_usada, disco_total, disco_usado
    Também monta info_sistema (texto formatado) compatível com o frontend.
    """
    hw = {
        "cpu_modelo":    None,
        "memoria_total": None,
        "memoria_usada": None,
        "disco_total":   None,
        "disco_usado":   None,
        "info_sistema":  None,  # texto formatado para exibição no modal
    }

    linhas_info = []   # monta o bloco de texto exibido no modal de detalhes

    # ── CPU ───────────────────────────────────────────────────────────────────
    print("  [nativo] Coletando CPU...")

    # 1) lscpu (disponível na maioria dos Linux modernos e Slackware >= 13)
    lscpu = executar_comando(cliente, "lscpu 2>/dev/null || echo ''")
    cpu_modelo = None

    if lscpu and not lscpu.startswith("ERRO"):
        def _lscpu(campo):
            m = re.search(rf'^{campo}\s*:\s*(.+)', lscpu, re.MULTILINE | re.IGNORECASE)
            return m.group(1).strip() if m else None

        model_name = _lscpu("Model name")
        vendor     = _lscpu("Vendor ID")
        arch       = _lscpu("Architecture")
        cpus       = _lscpu(r"CPU\(s\)")
        mhz        = _lscpu("CPU MHz") or _lscpu("CPU max MHz")
        cache_l3   = _lscpu("L3 cache")
        cache_l2   = _lscpu("L2 cache")

        if model_name and len(model_name) > 4:
            cpu_modelo = model_name
            # Remove excesso de espaços que alguns kernels colocam
            cpu_modelo = re.sub(r'\s+', ' ', cpu_modelo).strip()

        # Monta bloco CPU para info_sistema
        linhas_info.append("CPU:")
        if cpu_modelo:  linhas_info.append(f"  Modelo:      {cpu_modelo}")
        if arch:        linhas_info.append(f"  Arquitetura: {arch}")
        if cpus:        linhas_info.append(f"  Núcleos:     {cpus}")
        if mhz:
            try:    linhas_info.append(f"  Frequência:  {float(mhz):.0f} MHz")
            except: linhas_info.append(f"  Frequência:  {mhz}")
        if cache_l3:    linhas_info.append(f"  Cache L3:    {cache_l3}")
        elif cache_l2:  linhas_info.append(f"  Cache L2:    {cache_l2}")

    # 2) Fallback: /proc/cpuinfo (universal — sempre presente)
    if not cpu_modelo:
        cpuinfo = executar_comando(cliente, "grep 'model name' /proc/cpuinfo | head -1")
        m = re.search(r'model name\s*:\s*(.+)', cpuinfo, re.IGNORECASE)
        if m:
            cpu_modelo = re.sub(r'\s+', ' ', m.group(1)).strip()

        # Se ainda sem modelo (alguns ARM/MIPS não têm 'model name')
        if not cpu_modelo:
            hw_raw = executar_comando(cliente, "grep -E 'Hardware|Processor|cpu model' /proc/cpuinfo | head -3")
            for line in hw_raw.splitlines():
                if ":" in line:
                    cpu_modelo = line.split(":", 1)[1].strip()
                    break

        if cpu_modelo and not linhas_info:
            # Não teve lscpu — monta bloco mínimo
            linhas_info.append("CPU:")
            linhas_info.append(f"  Modelo: {cpu_modelo}")
            ncores = executar_comando(cliente, "nproc 2>/dev/null || grep -c processor /proc/cpuinfo")
            if ncores and ncores.isdigit():
                linhas_info.append(f"  Núcleos: {ncores}")

    hw["cpu_modelo"] = cpu_modelo

    # ── Memória ───────────────────────────────────────────────────────────────
    print("  [nativo] Coletando RAM...")

    meminfo = executar_comando(cliente, "cat /proc/meminfo")
    if meminfo and not meminfo.startswith("ERRO"):
        def _mem_kb(campo):
            m = re.search(rf'^{campo}:\s*(\d+)\s*kB', meminfo, re.MULTILINE)
            return int(m.group(1)) if m else None

        total_kb  = _mem_kb("MemTotal")
        avail_kb  = _mem_kb("MemAvailable")
        free_kb   = _mem_kb("MemFree")
        buffers   = _mem_kb("Buffers") or 0
        cached    = _mem_kb("Cached") or 0
        sreclaimable = _mem_kb("SReclaimable") or 0

        if total_kb:
            def _fmt_mem(kb):
                mb = kb / 1024
                return f"{mb/1024:.2f} GB" if mb >= 1024 else f"{mb:.0f} MB"

            hw["memoria_total"] = _fmt_mem(total_kb)

            # MemAvailable é mais preciso (kernel >= 3.14); fallback para free+buffers+cache
            if avail_kb is not None:
                usada_kb = total_kb - avail_kb
            elif free_kb is not None:
                usada_kb = total_kb - free_kb - buffers - cached - sreclaimable
            else:
                usada_kb = None

            if usada_kb is not None and usada_kb >= 0:
                hw["memoria_usada"] = _fmt_mem(usada_kb)

            linhas_info.append("")
            linhas_info.append("Memória:")
            linhas_info.append(f"  Total:      {hw['memoria_total']}")
            if hw["memoria_usada"]:
                linhas_info.append(f"  Usada:      {hw['memoria_usada']}")
                pct = usada_kb / total_kb * 100 if total_kb else 0
                linhas_info.append(f"  Uso:        {pct:.1f}%")

    # ── Disco ─────────────────────────────────────────────────────────────────
    print("  [nativo] Coletando disco...")

    # df -h no / para tamanho e uso geral
    df_root = executar_comando(cliente, "df -h / 2>/dev/null | tail -1")
    if df_root and not df_root.startswith("ERRO"):
        p = df_root.split()
        if len(p) >= 5:
            hw["disco_total"] = p[1]
            hw["disco_usado"] = f"{p[2]} ({p[4]})"

    # Tenta também lsblk para mais detalhes dos discos físicos
    lsblk = executar_comando(
        cliente,
        "lsblk -d -o NAME,SIZE,MODEL,TYPE 2>/dev/null | grep -v loop | grep disk || "
        "lsblk -d -o NAME,SIZE,TYPE 2>/dev/null | grep disk"
    )

    # hdparm ou /sys/block para velocidade/tipo (opcional — não bloqueia se falhar)
    # Usa /sys/block para detectar SSD vs HDD
    discos_info = []
    if lsblk and not lsblk.startswith("ERRO"):
        for linha in lsblk.splitlines():
            partes = linha.split()
            if len(partes) >= 2:
                dev  = partes[0]
                size = partes[1]
                model = " ".join(partes[2:-1]) if len(partes) > 3 else ""
                # Detecta SSD via /sys/block/{dev}/queue/rotational (0=SSD, 1=HDD)
                rot = executar_comando(cliente, f"cat /sys/block/{dev}/queue/rotational 2>/dev/null || echo '1'")
                tipo = "SSD" if rot.strip() == "0" else "HDD"
                discos_info.append(f"{dev}: {size} {tipo}" + (f" ({model})" if model else ""))

    linhas_info.append("")
    linhas_info.append("Disco:")
    if hw["disco_total"]:
        linhas_info.append(f"  Total (/):  {hw['disco_total']}")
    if hw["disco_usado"]:
        linhas_info.append(f"  Usado (/):  {hw['disco_usado']}")
    for d in discos_info:
        linhas_info.append(f"  Dispositivo: {d}")

    # ── Informações extras para o bloco de texto do modal ─────────────────────
    print("  [nativo] Coletando info extra...")

    # Uptime
    uptime_raw = executar_comando(cliente, "uptime -p 2>/dev/null || uptime")
    if uptime_raw and not uptime_raw.startswith("ERRO"):
        linhas_info.append("")
        linhas_info.append(f"Uptime: {uptime_raw.strip()}")

    # Kernel
    kernel = executar_comando(cliente, "uname -r 2>/dev/null || echo ''")
    if kernel and not kernel.startswith("ERRO"):
        linhas_info.append(f"Kernel: {kernel.strip()}")

    # IP da interface principal
    ip_raw = executar_comando(
        cliente,
        "ip -4 addr show scope global 2>/dev/null | grep 'inet ' | head -1 | awk '{print $2}' || "
        "ifconfig 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}'"
    )
    if ip_raw and not ip_raw.startswith("ERRO") and ip_raw.strip():
        linhas_info.append(f"IP local: {ip_raw.strip()}")

    # ── Monta info_sistema (texto exibido no modal de detalhes) ───────────────
    hw["info_sistema"] = "\n".join(linhas_info)

    print(f"  [nativo] ✓ Coleta concluída — "
          f"CPU: {bool(hw['cpu_modelo'])} | "
          f"RAM: {bool(hw['memoria_total'])} | "
          f"Disco: {bool(hw['disco_total'])}")

    return hw


# ─── Coleta de informações via inxi ───────────────────────────────────────────

def obter_info_sistema(cliente) -> str:
    saida = executar_comando(cliente, "inxi -Fxz -c 0 -y 200 2>/dev/null", timeout=60)
    if not saida or saida.startswith("ERRO") or len(saida) < 50:
        saida = executar_comando(cliente, "inxi -F 2>/dev/null", timeout=60)
    return saida


def _limpar_ansi(texto: str) -> str:
    texto = re.sub(r'\x1b\[[0-9;]*[mGKHF]', '', texto)
    texto = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', texto)
    return texto


def parsear_hardware(info_sistema: str, cliente=None) -> dict:
    """
    Extrai CPU, RAM e disco da saída do inxi -F.
    Se info_sistema estiver vazio ou inválido E houver cliente SSH disponível,
    aciona automaticamente o coletor nativo como fallback.
    """
    hardware = {
        "cpu_modelo":    None,
        "memoria_total": None,
        "memoria_usada": None,
        "disco_total":   None,
        "disco_usado":   None,
    }

    # Sem saída do inxi → vai direto para o coletor nativo
    if not info_sistema or len(info_sistema.strip()) < 30:
        if cliente:
            print("  [parser] inxi sem saída — acionando coletor nativo")
            return coletar_hardware_nativo(cliente)
        return hardware

    linhas = [_limpar_ansi(l) for l in info_sistema.splitlines()]

    for linha in linhas:
        s  = linha.strip()
        sl = s.lower()

        # CPU
        if hardware["cpu_modelo"] is None and sl.startswith("cpu:"):
            m = re.search(r'model:\s*([^\n]+?)(?=\s+bits:|\s+type:|\s+arch:|\s+socket:|$)',
                          s, re.IGNORECASE)
            if m:
                hardware["cpu_modelo"] = m.group(1).strip()
            if not hardware["cpu_modelo"]:
                resto = re.sub(r'(?i)^\s*cpu:\s*', '', s)
                resto = re.sub(r'\s*\(.*?\)', '', resto)
                resto = re.sub(r'(?i)\s*cache:.*', '', resto)
                resto = re.sub(r'(?i)\s*clocked at.*', '', resto)
                resto = re.sub(r'(?i)^(info:|dual\s+core|quad\s+core|single\s+core|'
                               r'hexa\s+core|octa\s+core|topology:)\s*', '', resto).strip()
                if len(resto) > 4:
                    hardware["cpu_modelo"] = resto[:80]

        # RAM
        if sl.startswith("memory:") or ("ram:" in sl and "total:" in sl):
            mt = re.search(r'total:\s*([\d.,]+\s*[KMGT]i?B)', s, re.IGNORECASE)
            mu = re.search(r'used:\s*([\d.,]+\s*[KMGT]i?B)', s, re.IGNORECASE)
            if mt: hardware["memoria_total"] = mt.group(1).strip()
            if mu: hardware["memoria_usada"] = mu.group(1).strip()
            if not hardware["memoria_total"]:
                m2 = re.search(r'(\d[\d.,]+)\s*/\s*(\d[\d.,]+)\s*(M[Bi]?B?|G[Bi]?B?)',
                               s, re.IGNORECASE)
                if m2:
                    hardware["memoria_usada"] = f"{m2.group(1)} {m2.group(3)}"
                    hardware["memoria_total"] = f"{m2.group(2)} {m2.group(3)}"

        # Disco
        if "local storage:" in sl or (sl.startswith("drives:") and ("total:" in sl or "size:" in sl)):
            dt = re.search(r'total:\s*([\d.,]+\s*[KMGT]i?B)', s, re.IGNORECASE)
            du = re.search(r'used:\s*([\d.,]+\s*[KMGT]i?B)', s, re.IGNORECASE)
            if dt: hardware["disco_total"] = dt.group(1).strip()
            if du: hardware["disco_usado"] = du.group(1).strip()
            if not hardware["disco_total"]:
                m2 = re.search(r'size:\s*([\d.,]+\s*[KMGT]i?B)', s, re.IGNORECASE)
                if m2: hardware["disco_total"] = m2.group(1).strip()
                mp = re.search(r'([\d.,]+)%\s*used', s, re.IGNORECASE)
                if mp: hardware["disco_usado"] = f"{mp.group(1)}% usado"

    # Campos ainda vazios após parsear inxi → coletor nativo complementa
    campos_vazios = not hardware["cpu_modelo"] or not hardware["memoria_total"] or not hardware["disco_total"]
    if cliente and campos_vazios:
        print("  [parser] Campos incompletos no inxi — complementando com coletor nativo")
        nativo = coletar_hardware_nativo(cliente)
        for campo, valor in nativo.items():
            if campo in hardware and not hardware[campo] and valor:
                hardware[campo] = valor

    return hardware
