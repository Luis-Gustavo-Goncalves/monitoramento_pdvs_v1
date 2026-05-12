import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* ─── CSS global ────────────────────────────────────────────────────────── */
const CSS_GLOBAL = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }

  @keyframes fadeIn    { from { opacity:0; transform:translateY(8px)  } to { opacity:1; transform:translateY(0)   } }
  @keyframes slideDown { from { opacity:0; max-height:0 }               to { opacity:1; max-height:5000px         } }
  @keyframes modalIn   { from { opacity:0; transform:scale(.95) translateY(14px) } to { opacity:1; transform:scale(1) translateY(0) } }
  @keyframes spin      { to   { transform:rotate(360deg) } }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes erroBlink { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0)} }

  .grupo-content { animation: slideDown .3s ease; overflow:hidden; }
  .fade-row      { animation: fadeIn   .22s ease both; }
  .modal-box     { animation: modalIn  .24s cubic-bezier(.16,1,.3,1) both; }
  .spin          { animation: spin 1s linear infinite; display:inline-block; }
  .pulse-dot     { animation: pulse 2s ease-in-out infinite; }
  .erro-card     { animation: erroBlink 2.5s ease infinite; }

  tr.pdv-row { transition: background .15s ease; }
  tr.pdv-row:hover { background:#161b27 !important; }

  button { transition: opacity .15s, transform .1s, background .2s, border-color .2s; }
  button:hover:not(:disabled) { opacity:.87; }
  button:active:not(:disabled) { transform:scale(.97); }

  input,select { transition: border-color .15s, box-shadow .15s; }
  input:focus,select:focus { border-color:#3b82f6!important; box-shadow:0 0 0 3px rgba(59,130,246,.18); outline:none; }

  .tab-btn { transition: color .18s, border-color .18s, background .18s; }
  .badge   { transition: background .2s, color .2s; }
  .etapa-pill { transition: background .2s, border-color .2s; }

  ::-webkit-scrollbar       { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:#080b12; }
  ::-webkit-scrollbar-thumb { background:#1e2535; border-radius:3px; }
`;

function GlobalStyles() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS_GLOBAL;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}

/* ─── Helpers de UI ─────────────────────────────────────────────────────── */

function Spinner({ size = 14 }) {
  return (
    <span
      className="spin"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: "2px solid #1e2535",
        borderTopColor: "#3b82f6",
        borderRadius: "50%",
      }}
    />
  );
}

function StatusBadge({ status }) {
  const map = {
    online: {
      bg: "#052e16",
      color: "#22c55e",
      border: "#166534",
      label: "ONLINE",
    },
    offline: {
      bg: "#2d0a0a",
      color: "#ef4444",
      border: "#7f1d1d",
      label: "OFFLINE",
    },
    erro_ssh: {
      bg: "#2d1700",
      color: "#f97316",
      border: "#7c2d12",
      label: "ERRO SSH",
    },
    erro: { bg: "#2d1700", color: "#f97316", border: "#7c2d12", label: "ERRO" },
    configuracao: {
      bg: "#1e1040",
      color: "#a78bfa",
      border: "#4c1d95",
      label: "SEM CONFIG",
    },
  };
  const s = map[status] || {
    bg: "#1e2535",
    color: "#64748b",
    border: "#334155",
    label: status,
  };
  return (
    <span
      className="badge"
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        borderRadius: 6,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.8,
      }}
    >
      {s.label}
    </span>
  );
}

function HwCell({ principal, secundario, icon }) {
  if (!principal)
    return <span style={{ color: "#334155", fontSize: 12 }}>—</span>;
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: "#e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
        <span>{principal}</span>
      </div>
      {secundario && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
          {secundario}
        </div>
      )}
    </div>
  );
}

/* ─── Etiqueta de etapa de erro ─────────────────────────────────────────── */
const ETAPA_MAP = {
  configuracao: { label: "Sem IP", color: "#a78bfa", bg: "#1e1040" },
  ping: { label: "Ping falhou", color: "#ef4444", bg: "#2d0a0a" },
  ssh: { label: "SSH falhou", color: "#f97316", bg: "#2d1700" },
  so: { label: "SO indetect.", color: "#facc15", bg: "#1c1500" },
  inxi: { label: "inxi falhou", color: "#fb923c", bg: "#2d1400" },
  coleta: { label: "Coleta falhou", color: "#f97316", bg: "#2d1700" },
  interno: { label: "Erro interno", color: "#94a3b8", bg: "#1e2535" },
};

function EtapaPill({ etapa }) {
  const e = ETAPA_MAP[etapa] || {
    label: etapa || "Erro",
    color: "#94a3b8",
    bg: "#1e2535",
  };
  return (
    <span
      className="etapa-pill"
      style={{
        background: e.bg,
        color: e.color,
        border: `1px solid ${e.color}44`,
        borderRadius: 5,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {e.label}
    </span>
  );
}

/* ─── Agrupamento ────────────────────────────────────────────────────────── */
function agruparPorLoja(pdvs) {
  const grupos = {};
  pdvs.forEach((p) => {
    const partes = p.nome ? p.nome.split(" - ") : [];
    const chave =
      partes.length >= 2 ? `${partes[0]} - ${partes[1]}` : "Sem Loja";
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(p);
  });
  return Object.entries(grupos)
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([loja, lista]) => ({
      loja,
      pdvs: lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      isEmporium: lista.some(
        (p) => p.id?.startsWith("sch-") || p.origem === "emporium",
      ),
    }));
}

/* ─── Exportação PDF ────────────────────────────────────────────────────── */
function exportarPDF(pdvs) {
  const agora = new Date().toLocaleString("pt-BR");
  const grupos = agruparPorLoja(pdvs);
  const online = pdvs.filter((p) => p.status === "online").length;
  const offline = pdvs.filter((p) => p.status === "offline").length;
  const erro = pdvs.length - online - offline;

  const linhas = grupos
    .map(
      ({ loja, pdvs: lista }) => `
    <tr><td colspan="8" style="background:#1e293b;color:#fff;font-weight:700;padding:8px 10px;font-size:11px">🏪 ${loja}</td></tr>
    ${lista
      .map(
        (p, i) => `
      <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#fff"}">
        <td style="padding-left:20px">${p.nome || "—"}</td>
        <td style="font-family:monospace">${p.host || "—"}</td>
        <td>${p.sistema_operacional || "—"}</td>
        <td style="color:${p.status === "online" ? "#16a34a" : "#dc2626"};font-weight:700">${(p.status || "").toUpperCase()}</td>
        <td style="font-size:10px">${p.cpu_modelo || "—"}</td>
        <td>${p.memoria_total || "—"}${p.memoria_usada ? `<br><small>Usada: ${p.memoria_usada}</small>` : ""}</td>
        <td>${p.disco_total || "—"}${p.disco_usado ? `<br><small>Usado: ${p.disco_usado}</small>` : ""}</td>
        <td>${p.atualizado_em ? new Date(p.atualizado_em).toLocaleString("pt-BR") : "—"}</td>
      </tr>`,
      )
      .join("")}`,
    )
    .join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório PDV</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;padding:24px;color:#1e293b}
  h1{font-size:17px;margin-bottom:2px}.sub{color:#64748b;font-size:10px;margin-bottom:18px}
  .r{display:flex;gap:16px;margin-bottom:18px}.c{background:#f1f5f9;border-radius:6px;padding:8px 16px}
  .c .v{font-size:20px;font-weight:700}.c .l{font-size:9px;color:#64748b;text-transform:uppercase}
  table{width:100%;border-collapse:collapse}
  th{background:#1e293b;color:#fff;padding:7px 10px;text-align:left;font-size:9px;letter-spacing:.5px;text-transform:uppercase}
  td{padding:6px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  @media print{body{padding:12px}}</style></head><body>
  <h1>📡 PDV Monitor — Relatório</h1><p class="sub">Gerado em: ${agora}</p>
  <div class="r">
    <div class="c"><div class="v">${pdvs.length}</div><div class="l">Total</div></div>
    <div class="c"><div class="v" style="color:#16a34a">${online}</div><div class="l">Online</div></div>
    <div class="c"><div class="v" style="color:#dc2626">${offline}</div><div class="l">Offline</div></div>
    <div class="c"><div class="v" style="color:#ea580c">${erro}</div><div class="l">Erro</div></div>
  </div>
  <table><thead><tr>
    <th>Nome/PDV</th><th>Host</th><th>Sistema</th><th>Status</th>
    <th>CPU</th><th>RAM</th><th>Disco</th><th>Atualização</th>
  </tr></thead><tbody>${linhas}</tbody></table></body></html>`;

  const w = window.open("", "_blank", "width=1100,height=750");
  w.document.write(html);
  w.document.close();
  w.onload = () => w.print();
}

/* ─── Modal base ─────────────────────────────────────────────────────────── */
function Modal({ onClose, width = "min(500px,95vw)", children }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0f1117",
          border: "1px solid #1e2535",
          borderRadius: 16,
          width,
          padding: 32,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const inputSt = {
  background: "#161b27",
  border: "1px solid #1e2535",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#e2e8f0",
  fontSize: 14,
  fontFamily: "monospace",
  width: "100%",
};

/* ─── Modal Painel de Erros ─────────────────────────────────────────────── */
function ModalPainelErros({ pdvsComErro, onClose, onMonitorarUm }) {
  const [detalhe, setDetalhe] = useState(null);
  const [monitorando, setMon] = useState({});

  async function reMonitorar(pdv) {
    setMon((prev) => ({ ...prev, [pdv.id]: true }));
    try {
      const res = await fetch(`${API}/monitorar/${pdv.id}`, { method: "POST" });
      await res.json();
      onMonitorarUm();
    } catch {
    } finally {
      setMon((prev) => ({ ...prev, [pdv.id]: false }));
    }
  }

  // Agrupa por tipo de erro
  const porEtapa = {};
  pdvsComErro.forEach((p) => {
    const e = p.erro_etapa || "desconhecido";
    if (!porEtapa[e]) porEtapa[e] = [];
    porEtapa[e].push(p);
  });

  const ordemEtapas = [
    "configuracao",
    "ping",
    "ssh",
    "inxi",
    "coleta",
    "interno",
    "desconhecido",
  ];
  const etapasPresentes = ordemEtapas.filter((e) => porEtapa[e]);

  return (
    <Modal onClose={onClose} width="min(900px,96vw)">
      {/* Cabeçalho */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 22,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#e2e8f0" }}>
            ⚠️ Painel de Erros
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
            {pdvsComErro.length} terminal{pdvsComErro.length !== 1 ? "is" : ""}{" "}
            com problema • clique em um para ver o detalhe
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid #1e2535",
            color: "#64748b",
            cursor: "pointer",
            borderRadius: 8,
            padding: "6px 12px",
          }}
        >
          ✕
        </button>
      </div>

      {/* Resumo por categoria */}
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}
      >
        {etapasPresentes.map((etapa) => {
          const e = ETAPA_MAP[etapa] || {
            label: etapa,
            color: "#94a3b8",
            bg: "#1e2535",
          };
          return (
            <div
              key={etapa}
              style={{
                background: e.bg,
                border: `1px solid ${e.color}55`,
                borderRadius: 8,
                padding: "8px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: e.color }}>
                {porEtapa[etapa].length}
              </span>
              <span style={{ fontSize: 12, color: e.color }}>{e.label}</span>
            </div>
          );
        })}
      </div>

      {/* Layout: lista à esquerda | detalhe à direita */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Lista de terminais com erro */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          {etapasPresentes.map((etapa) => (
            <div key={etapa}>
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 10,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {ETAPA_MAP[etapa]?.label || etapa} ({porEtapa[etapa].length})
              </p>
              {porEtapa[etapa].map((pdv, i) => {
                const selecionado = detalhe?.id === pdv.id;
                const etapaInfo = ETAPA_MAP[pdv.erro_etapa] || {
                  color: "#f97316",
                  bg: "#2d1700",
                };
                return (
                  <div
                    key={pdv.id}
                    className="fade-row"
                    onClick={() => setDetalhe(pdv)}
                    style={{
                      background: selecionado ? "#161b27" : "#0d1220",
                      border: `1px solid ${selecionado ? etapaInfo.color + "88" : "#1e2535"}`,
                      borderRadius: 10,
                      padding: "11px 14px",
                      cursor: "pointer",
                      marginBottom: 6,
                      animationDelay: `${i * 20}ms`,
                      transition: "border-color .15s, background .15s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: 600,
                            fontSize: 13,
                            color: "#e2e8f0",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {pdv.nome}
                        </p>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "#475569",
                            fontFamily: "monospace",
                          }}
                        >
                          {pdv.host || "sem IP"}
                        </p>
                      </div>
                      <EtapaPill etapa={pdv.erro_etapa} />
                    </div>
                    {pdv.erro && (
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: 11,
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {pdv.erro}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Painel de detalhe */}
        <div
          style={{
            background: "#0a0d14",
            border: "1px solid #1e2535",
            borderRadius: 12,
            padding: 20,
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          {!detalhe ? (
            <div
              style={{ textAlign: "center", paddingTop: 80, color: "#334155" }}
            >
              <p style={{ fontSize: 32 }}>👈</p>
              <p style={{ fontSize: 13 }}>
                Selecione um terminal
                <br />
                para ver o diagnóstico completo
              </p>
            </div>
          ) : (
            <div className="fade-row">
              {/* Nome e status */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 6,
                  }}
                >
                  <StatusBadge status={detalhe.status} />
                  <EtapaPill etapa={detalhe.erro_etapa} />
                  {(detalhe.id?.startsWith("sch-") ||
                    detalhe.origem === "emporium") && (
                    <span
                      style={{
                        fontSize: 10,
                        background: "#2e1065",
                        color: "#a78bfa",
                        border: "1px solid #4c1d95",
                        borderRadius: 4,
                        padding: "2px 7px",
                        fontWeight: 700,
                      }}
                    >
                      SCH
                    </span>
                  )}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#e2e8f0",
                  }}
                >
                  {detalhe.nome}
                </p>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: 12,
                    color: "#475569",
                    fontFamily: "monospace",
                  }}
                >
                  {detalhe.id} · {detalhe.host || "sem IP"}
                </p>
              </div>

              {/* Linha do tempo de etapas */}
              <div style={{ marginBottom: 16 }}>
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 10,
                    color: "#475569",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Diagnóstico por etapa
                </p>
                {[
                  {
                    etapa: "configuracao",
                    label: "Configuração IP",
                    ok: !!detalhe.host,
                  },
                  {
                    etapa: "ping",
                    label: "Ping (ICMP)",
                    ok:
                      detalhe.status !== "offline" &&
                      detalhe.status !== "erro" &&
                      detalhe.erro_etapa !== "ping",
                  },
                  {
                    etapa: "ssh",
                    label: "Conexão SSH",
                    ok:
                      !["ssh", "erro_ssh"].includes(detalhe.erro_etapa) &&
                      detalhe.status !== "erro_ssh" &&
                      detalhe.erro_etapa !== "ping" &&
                      !!detalhe.host,
                  },
                  {
                    etapa: "inxi",
                    label: "Instalação inxi",
                    ok: detalhe.inxi_instalado,
                  },
                  {
                    etapa: "coleta",
                    label: "Coleta de hardware",
                    ok: !!(detalhe.cpu_modelo || detalhe.memoria_total),
                  },
                ].map(({ etapa, label, ok }) => {
                  const falhouAqui = detalhe.erro_etapa === etapa;
                  const cor = falhouAqui
                    ? "#ef4444"
                    : ok
                      ? "#22c55e"
                      : "#334155";
                  return (
                    <div
                      key={etapa}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 14, color: cor }}>
                        {falhouAqui ? "✗" : ok ? "✓" : "○"}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: falhouAqui
                            ? "#ef4444"
                            : ok
                              ? "#94a3b8"
                              : "#475569",
                          fontWeight: falhouAqui ? 700 : 400,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mensagem de erro */}
              {detalhe.erro && (
                <div
                  style={{
                    background: "#2d0a0a",
                    border: "1px solid #7f1d1d44",
                    borderRadius: 8,
                    padding: "12px 14px",
                    marginBottom: 14,
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 4px",
                      fontSize: 10,
                      color: "#7f1d1d",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Erro
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#fca5a5",
                      fontWeight: 600,
                    }}
                  >
                    {detalhe.erro}
                  </p>
                </div>
              )}

              {/* Detalhe técnico */}
              {detalhe.erro_detalhe && (
                <div
                  style={{
                    background: "#0d1220",
                    border: "1px solid #1e2535",
                    borderRadius: 8,
                    padding: "12px 14px",
                    marginBottom: 14,
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 10,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Diagnóstico técnico
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      color: "#94a3b8",
                      lineHeight: 1.6,
                    }}
                  >
                    {detalhe.erro_detalhe}
                  </p>
                </div>
              )}

              {/* Última atualização */}
              {detalhe.atualizado_em && (
                <p
                  style={{ margin: "0 0 14px", fontSize: 11, color: "#334155" }}
                >
                  Verificado em:{" "}
                  {new Date(detalhe.atualizado_em).toLocaleString("pt-BR")}
                </p>
              )}

              {/* Botão re-monitorar */}
              <button
                onClick={() => reMonitorar(detalhe)}
                disabled={monitorando[detalhe.id]}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "none",
                  borderRadius: 8,
                  background: monitorando[detalhe.id]
                    ? "#1e2535"
                    : "linear-gradient(135deg,#3b82f6,#6366f1)",
                  color: monitorando[detalhe.id] ? "#475569" : "#fff",
                  cursor: monitorando[detalhe.id] ? "wait" : "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {monitorando[detalhe.id] ? (
                  <>
                    <Spinner />
                    Verificando...
                  </>
                ) : (
                  "🔄 Re-verificar este terminal"
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─── Modal Sincronizar MySQL ─────────────────────────────────────────────── */
function ModalSyncMySQL({ onClose, onSync }) {
  const [aba, setAba] = useState("socin");
  const [form, setForm] = useState({ usuario_ssh: "root", senha_ssh: "" });
  const [sincronizando, setSinc] = useState(false);
  const [resultado, setRes] = useState(null);
  const [erro, setErro] = useState("");

  async function handleSync() {
    if (!form.usuario_ssh || !form.senha_ssh) {
      setErro("Preencha usuário e senha SSH");
      return;
    }
    setSinc(true);
    setErro("");
    setRes(null);
    try {
      const ep =
        aba === "emporium"
          ? "/sincronizar-mysql-emporium"
          : "/sincronizar-mysql";
      const res = await fetch(`${API}${ep}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro na sincronização");
      setRes(data.resumo);
      onSync();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSinc(false);
    }
  }

  const tabSt = (active) => ({
    flex: 1,
    padding: "9px 0",
    background: active ? "#161b27" : "none",
    border: "1px solid " + (active ? "#3b82f6" : "#1e2535"),
    borderRadius: 8,
    color: active ? "#e2e8f0" : "#64748b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 700 : 400,
  });

  return (
    <Modal onClose={onClose}>
      <h2 style={{ margin: "0 0 6px", fontSize: 20, color: "#e2e8f0" }}>
        🗄 Sincronizar MySQL
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#475569" }}>
        Importa terminais do banco de dados para o monitoramento.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          className="tab-btn"
          style={tabSt(aba === "socin")}
          onClick={() => {
            setAba("socin");
            setRes(null);
            setErro("");
          }}
        >
          🖥 SOCIN — PDVs
        </button>
        <button
          className="tab-btn"
          style={tabSt(aba === "emporium")}
          onClick={() => {
            setAba("emporium");
            setRes(null);
            setErro("");
          }}
        >
          🛒 Emporium — SCH
        </button>
      </div>

      <p
        style={{
          margin: "0 0 18px",
          fontSize: 12,
          color: "#334155",
          background: "#0d1220",
          padding: "8px 12px",
          borderRadius: 8,
        }}
      >
        {aba === "socin" ? (
          <>
            Busca PDVs com{" "}
            <code style={{ color: "#38bdf8" }}>situacao_pdv = 2</code> no banco
            SOCIN. IP extraído de{" "}
            <code style={{ color: "#38bdf8" }}>ip_pdv</code>.
          </>
        ) : (
          <>
            Busca SCH pela query{" "}
            <code style={{ color: "#a78bfa" }}>SELECT … pos_ip FROM pos</code>.
            O campo <code style={{ color: "#a78bfa" }}>pos_ip</code> é usado
            como host SSH. SO:{" "}
            <strong style={{ color: "#fbbf24" }}>Slackware</strong>.
          </>
        )}
      </p>

      {!resultado ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label
              style={{
                fontSize: 12,
                color: "#64748b",
                display: "block",
                marginBottom: 6,
              }}
            >
              Usuário SSH {aba === "emporium" ? "(self-checkouts)" : "(PDVs)"}
            </label>
            <input
              value={form.usuario_ssh}
              onChange={(e) =>
                setForm({ ...form, usuario_ssh: e.target.value })
              }
              style={inputSt}
              placeholder="root"
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                color: "#64748b",
                display: "block",
                marginBottom: 6,
              }}
            >
              Senha SSH
            </label>
            <input
              type="password"
              value={form.senha_ssh}
              onChange={(e) => setForm({ ...form, senha_ssh: e.target.value })}
              style={inputSt}
              placeholder={
                aba === "emporium" ? "senha dos SCH" : "senha dos PDVs"
              }
            />
          </div>
          {erro && (
            <p
              style={{
                color: "#ef4444",
                fontSize: 13,
                margin: 0,
                background: "#2d0a0a",
                padding: "10px 14px",
                borderRadius: 8,
              }}
            >
              {erro}
            </p>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px",
                background: "none",
                border: "1px solid #1e2535",
                borderRadius: 8,
                color: "#64748b",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSync}
              disabled={sincronizando}
              style={{
                flex: 1,
                padding: "10px",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: sincronizando ? "wait" : "pointer",
                fontWeight: 700,
                background:
                  aba === "emporium"
                    ? "linear-gradient(135deg,#7c3aed,#a78bfa)"
                    : "linear-gradient(135deg,#0ea5e9,#6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {sincronizando ? (
                <>
                  <Spinner />
                  Sincronizando...
                </>
              ) : (
                `🗄 Sincronizar ${aba === "emporium" ? "Emporium" : "SOCIN"}`
              )}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {[
              ["Total", resultado.total, "#3b82f6"],
              ["Adicionados", resultado.adicionados, "#22c55e"],
              ["Removidos", resultado.removidos, "#ef4444"],
              ["Atualizados", resultado.atualizados, "#f97316"],
            ].map(([l, v, c]) => (
              <div
                key={l}
                style={{
                  background: "#161b27",
                  borderRadius: 10,
                  padding: "14px 16px",
                }}
              >
                <p
                  style={{ margin: 0, fontSize: 24, fontWeight: 700, color: c }}
                >
                  {v}
                </p>
                <p
                  style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}
                >
                  {l}
                </p>
              </div>
            ))}
          </div>
          {resultado.sem_ip?.length > 0 && (
            <div
              style={{
                background: "#1c1500",
                border: "1px solid #71390055",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 14,
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 11,
                  color: "#fbbf24",
                  fontWeight: 700,
                }}
              >
                ⚠ {resultado.sem_ip.length} SCH(s) sem IP cadastrado
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                {resultado.sem_ip.join(", ")} — configure o campo{" "}
                <code>pos_ip</code> no banco Emporium.
              </p>
            </div>
          )}
          <p
            style={{
              color: "#22c55e",
              fontSize: 13,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            ✓ Sincronização concluída com sucesso!
          </p>
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "10px",
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Fechar
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ─── Modal Dias sem venda ─────────────────────────────────────────────── */
function ModalDiasSemVenda({ onClose }) {
  const [dados, setDados] = useState(null);
  const [carr, setCarr] = useState(true);
  const [erro, setErro] = useState("");
  const [modoTodos, setModoTodos] = useState(false);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    setCarr(true);
    setErro("");
    setDados(null);
    setFiltro("");
    const endpoint = modoTodos
      ? `${API}/dias-sem-venda-todos`
      : `${API}/dias-sem-venda`;
    fetch(endpoint)
      .then((r) => r.json())
      .then(setDados)
      .catch((e) => setErro(e.message))
      .finally(() => setCarr(false));
  }, [modoTodos]);

  const corDias = (d) =>
    d === null || d === undefined
      ? "#64748b"
      : d >= 7
        ? "#ef4444"
        : d >= 3
          ? "#f97316"
          : "#facc15";

  const dadosFiltrados =
    dados?.dados?.filter((d) => {
      if (!filtro) return true;
      const f = filtro.toLowerCase();
      return (
        (d.nome || "").toLowerCase().includes(f) ||
        (d.id || "").toLowerCase().includes(f) ||
        (d.numero_loja || "").toString().includes(f) ||
        (d.numero_pdv || "").toString().includes(f)
      );
    }) || [];

  return (
    <Modal onClose={onClose} width="min(920px,95vw)">
      {/* Cabeçalho */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: "#e2e8f0" }}>
            📉 Dias sem Venda
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
            Consulta <code>capa_cupom_venda</code> —{" "}
            {modoTodos ? "todos os PDVs cadastrados" : "apenas PDVs offline"}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid #1e2535",
            color: "#64748b",
            cursor: "pointer",
            borderRadius: 8,
            padding: "6px 12px",
          }}
        >
          ✕
        </button>
      </div>

      {/* Toggle de modo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          background: "#0d1220",
          border: "1px solid #1e2535",
          borderRadius: 10,
          padding: "12px 16px",
        }}
      >
        <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>
          Modo de busca:
        </span>
        <div
          style={{
            display: "flex",
            borderRadius: 8,
            overflow: "hidden",
            border: "1px solid #1e2535",
          }}
        >
          <button
            onClick={() => setModoTodos(false)}
            style={{
              padding: "7px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: !modoTodos ? "#3b82f6" : "#0d1220",
              color: !modoTodos ? "#fff" : "#64748b",
              border: "none",
              transition: "all .2s",
            }}
          >
            🔴 Apenas Offline
          </button>
          <button
            onClick={() => setModoTodos(true)}
            style={{
              padding: "7px 16px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: modoTodos ? "#8b5cf6" : "#0d1220",
              color: modoTodos ? "#fff" : "#64748b",
              border: "none",
              transition: "all .2s",
            }}
          >
            🌐 Todos os PDVs
          </button>
        </div>
        {modoTodos && (
          <span
            style={{
              fontSize: 11,
              color: "#8b5cf6",
              background: "#1a0d33",
              border: "1px solid #8b5cf633",
              borderRadius: 6,
              padding: "3px 10px",
            }}
          >
            Busca direta na tabela — independe do status de monitoramento
          </span>
        )}
      </div>

      {carr && (
        <div
          style={{
            textAlign: "center",
            padding: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            color: "#475569",
          }}
        >
          <Spinner size={18} />
          Consultando banco...
        </div>
      )}
      {erro && (
        <p
          style={{
            color: "#ef4444",
            background: "#2d0a0a",
            padding: "12px 16px",
            borderRadius: 8,
          }}
        >
          Erro: {erro}
        </p>
      )}
      {dados && !carr && (
        <>
          {/* Cards de resumo */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {modoTodos ? (
              <>
                {[
                  ["Total no banco", dados.total, "#8b5cf6"],
                  [
                    "Sem venda há 7+ dias",
                    dadosFiltrados.filter((d) => d.dias_sem_registro >= 7)
                      .length,
                    "#ef4444",
                  ],
                  [
                    "Sem venda há 3-6 dias",
                    dadosFiltrados.filter(
                      (d) =>
                        d.dias_sem_registro >= 3 && d.dias_sem_registro < 7,
                    ).length,
                    "#f97316",
                  ],
                  [
                    "Vendas recentes",
                    dadosFiltrados.filter(
                      (d) =>
                        d.dias_sem_registro !== null && d.dias_sem_registro < 3,
                    ).length,
                    "#22c55e",
                  ],
                ].map(([l, v, c]) => (
                  <div
                    key={l}
                    style={{
                      background: "#0d1220",
                      border: "1px solid #1e2535",
                      borderRadius: 10,
                      padding: "10px 14px",
                      flex: 1,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 20,
                        fontWeight: 700,
                        color: c,
                      }}
                    >
                      {v}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        color: "#475569",
                      }}
                    >
                      {l}
                    </p>
                  </div>
                ))}
              </>
            ) : (
              <>
                {[
                  ["PDVs Offline", dados.total_offline, "#ef4444"],
                  ["Com histórico", dados.total_socin, "#3b82f6"],
                ].map(([l, v, c]) => (
                  <div
                    key={l}
                    style={{
                      background: "#0d1220",
                      border: "1px solid #1e2535",
                      borderRadius: 10,
                      padding: "12px 18px",
                      flex: 1,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 22,
                        fontWeight: 700,
                        color: c,
                      }}
                    >
                      {v}
                    </p>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 12,
                        color: "#475569",
                      }}
                    >
                      {l}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Campo de filtro (só no modo todos) */}
          {modoTodos && dados.dados.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <input
                type="text"
                placeholder="🔍 Filtrar por loja, PDV ou nome..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#0d1220",
                  border: "1px solid #1e2535",
                  borderRadius: 8,
                  padding: "9px 14px",
                  color: "#e2e8f0",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          )}

          {dados.dados.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>
              {modoTodos
                ? "✅ Nenhum registro encontrado na tabela."
                : "✅ Nenhum PDV offline com histórico no momento."}
            </div>
          ) : dadosFiltrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30, color: "#475569" }}>
              Nenhum resultado para "
              <strong style={{ color: "#94a3b8" }}>{filtro}</strong>"
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                maxHeight: "420px",
                overflowY: "auto",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#0a0f1a",
                    zIndex: 1,
                  }}
                >
                  <tr style={{ borderBottom: "1px solid #1e2535" }}>
                    {(modoTodos
                      ? [
                          "PDV / ID",
                          "Loja",
                          "Nº PDV",
                          "Última Venda",
                          "Dias sem Registro",
                          "Total Vendas",
                        ]
                      : [
                          "PDV / ID",
                          "Host",
                          "Última Venda",
                          "Dias sem Registro",
                        ]
                    ).map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "9px 14px",
                          textAlign: "left",
                          fontSize: 10,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dadosFiltrados.map((d, i) => (
                    <tr
                      key={d.id}
                      className="fade-row pdv-row"
                      style={{
                        borderBottom:
                          i < dadosFiltrados.length - 1
                            ? "1px solid #0d1220"
                            : "none",
                        animationDelay: `${i * 20}ms`,
                      }}
                    >
                      <td style={{ padding: "11px 14px" }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
                          {d.nome}
                        </p>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: 11,
                            color: "#475569",
                            fontFamily: "monospace",
                          }}
                        >
                          {d.id}
                        </p>
                      </td>
                      {modoTodos ? (
                        <>
                          <td
                            style={{
                              padding: "11px 14px",
                              fontSize: 12,
                              color: "#94a3b8",
                            }}
                          >
                            {d.numero_loja}
                          </td>
                          <td
                            style={{
                              padding: "11px 14px",
                              fontFamily: "monospace",
                              fontSize: 12,
                              color: "#94a3b8",
                            }}
                          >
                            {d.numero_pdv}
                          </td>
                        </>
                      ) : (
                        <td
                          style={{
                            padding: "11px 14px",
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "#94a3b8",
                          }}
                        >
                          {d.host}
                        </td>
                      )}
                      <td
                        style={{
                          padding: "11px 14px",
                          fontSize: 12,
                          color: "#94a3b8",
                        }}
                      >
                        {d.ultima_venda ? (
                          new Date(d.ultima_venda).toLocaleString("pt-BR")
                        ) : (
                          <span style={{ color: "#334155" }}>Sem registro</span>
                        )}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        {d.dias_sem_registro !== null &&
                        d.dias_sem_registro !== undefined ? (
                          <span
                            style={{
                              background: "#0d1220",
                              border: `1px solid ${corDias(d.dias_sem_registro)}44`,
                              color: corDias(d.dias_sem_registro),
                              borderRadius: 6,
                              padding: "3px 10px",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {d.dias_sem_registro === 0
                              ? "Hoje"
                              : `${d.dias_sem_registro} dia${d.dias_sem_registro !== 1 ? "s" : ""}`}
                          </span>
                        ) : (
                          <span style={{ color: "#334155", fontSize: 12 }}>
                            —
                          </span>
                        )}
                      </td>
                      {modoTodos && (
                        <td
                          style={{
                            padding: "11px 14px",
                            fontSize: 12,
                            color: "#64748b",
                          }}
                        >
                          {d.total_vendas?.toLocaleString("pt-BR")}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

/* ─── Modal Adicionar / Editar ────────────────────────────────────────────── */
function ModalFormPDV({ pdv, onClose, onSave }) {
  const editando = !!pdv;
  const [form, setForm] = useState({
    id: pdv?.id || "",
    nome: pdv?.nome || "",
    host: pdv?.host || "",
    usuario: pdv?.usuario || "root",
    senha: "",
  });
  const [salv, setSalv] = useState(false);
  const [erro, setErro] = useState("");

  async function handleSalvar() {
    if (
      !editando &&
      (!form.id || !form.nome || !form.host || !form.usuario || !form.senha)
    ) {
      setErro("Preencha todos os campos");
      return;
    }
    setSalv(true);
    setErro("");
    try {
      let res;
      if (editando) {
        const p = {};
        if (form.nome) p.nome = form.nome;
        if (form.host) p.host = form.host;
        if (form.usuario) p.usuario = form.usuario;
        if (form.senha) p.senha = form.senha;
        res = await fetch(`${API}/pdvs/${pdv.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      } else {
        res = await fetch(`${API}/pdvs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro");
      onSave();
      onClose();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalv(false);
    }
  }

  const campos = [
    ["ID", "id", "pdv-001", false, editando],
    ["Nome", "nome", "1 - Loja - pdv - 101", false, false],
    ["Host / IP", "host", "192.168.1.101", false, false],
    ["Usuário SSH", "usuario", "root", false, false],
    [
      "Senha SSH",
      "senha",
      editando ? "Nova senha (vazio=manter)" : "senha",
      true,
      false,
    ],
  ];

  return (
    <Modal onClose={onClose} width="min(480px,95vw)">
      <h2 style={{ margin: "0 0 24px", fontSize: 20, color: "#e2e8f0" }}>
        {editando ? `✏️ Editar — ${pdv.id}` : "➕ Adicionar PDV"}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {campos.map(([label, key, ph, isPass, disabled]) => (
          <div key={key}>
            <label
              style={{
                fontSize: 12,
                color: "#64748b",
                display: "block",
                marginBottom: 6,
              }}
            >
              {label}
            </label>
            <input
              type={isPass ? "password" : "text"}
              placeholder={ph}
              value={form[key]}
              disabled={disabled}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              style={{
                ...inputSt,
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? "not-allowed" : "text",
              }}
            />
          </div>
        ))}
        {erro && (
          <p
            style={{
              color: "#ef4444",
              fontSize: 13,
              margin: 0,
              background: "#2d0a0a",
              padding: "10px 14px",
              borderRadius: 8,
            }}
          >
            {erro}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px",
              background: "none",
              border: "1px solid #1e2535",
              borderRadius: 8,
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salv}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: salv ? "wait" : "pointer",
              fontWeight: 700,
              background: editando
                ? "linear-gradient(135deg,#f59e0b,#f97316)"
                : "linear-gradient(135deg,#3b82f6,#6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {salv ? (
              <>
                <Spinner />
                Salvando...
              </>
            ) : editando ? (
              "Salvar"
            ) : (
              "Adicionar"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Modal Detalhes PDV ──────────────────────────────────────────────────── */
function ModalDetalhes({ pdv, onClose }) {
  if (!pdv) return null;
  const isEmporium = pdv.id?.startsWith("sch-") || pdv.origem === "emporium";
  return (
    <Modal onClose={onClose} width="min(740px,95vw)">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: "#e2e8f0" }}>
              {pdv.nome}
            </h2>
            {isEmporium && (
              <span
                style={{
                  fontSize: 10,
                  background: "#2e1065",
                  color: "#a78bfa",
                  border: "1px solid #6d28d9",
                  borderRadius: 4,
                  padding: "2px 7px",
                  fontWeight: 700,
                }}
              >
                SCH EMPORIUM
              </span>
            )}
          </div>
          <p
            style={{
              margin: 0,
              color: "#64748b",
              fontSize: 13,
              fontFamily: "monospace",
            }}
          >
            {pdv.host} · {pdv.id}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <StatusBadge status={pdv.status} />
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid #1e2535",
              color: "#64748b",
              cursor: "pointer",
              borderRadius: 8,
              padding: "6px 12px",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          ["🖥 Sistema", pdv.sistema_operacional],
          ["⚡ CPU", pdv.cpu_modelo],
          [
            "🗃 inxi",
            pdv.inxi_instalado
              ? pdv.inxi_ja_estava_instalado
                ? "Já instalado"
                : "Instalado agora"
              : "Indisponível",
          ],
          ["💾 RAM Total", pdv.memoria_total],
          ["💾 RAM Usada", pdv.memoria_usada],
          ["🗄 Disco Total", pdv.disco_total],
          ["🗄 Disco Usado", pdv.disco_usado],
          [
            "🕐 Atualização",
            pdv.atualizado_em
              ? new Date(pdv.atualizado_em).toLocaleString("pt-BR")
              : "—",
          ],
          ...(pdv.pos_version ? [["📦 Versão POS", pdv.pos_version]] : []),
        ].map(([k, v]) => (
          <div
            key={k}
            style={{
              background: "#161b27",
              borderRadius: 10,
              padding: "12px 16px",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: "#475569",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {k}
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "#cbd5e1",
                fontFamily: "monospace",
                wordBreak: "break-word",
              }}
            >
              {v || "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Bloco de erro detalhado no modal de detalhes */}
      {pdv.erro && (
        <div
          style={{
            background: "#2d0a0a",
            border: "1px solid #7f1d1d44",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <EtapaPill etapa={pdv.erro_etapa} />
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "#fca5a5",
                fontWeight: 700,
              }}
            >
              {pdv.erro}
            </p>
          </div>
          {pdv.erro_detalhe && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#94a3b8",
                lineHeight: 1.6,
              }}
            >
              {pdv.erro_detalhe}
            </p>
          )}
        </div>
      )}

      {pdv.info_sistema ? (
        <div>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 10,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Saída completa · inxi -F
          </p>
          <pre
            style={{
              background: "#0a0d14",
              border: "1px solid #1e2535",
              borderRadius: 10,
              padding: 16,
              fontSize: 12,
              color: "#a3e635",
              overflowX: "auto",
              lineHeight: 1.7,
              fontFamily: "monospace",
              margin: 0,
            }}
          >
            {pdv.info_sistema}
          </pre>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 32, color: "#475569" }}>
          {pdv.status === "offline"
            ? "PDV offline — sem dados disponíveis"
            : "Execute o monitoramento para coletar informações"}
        </div>
      )}
    </Modal>
  );
}

/* ─── Linha da tabela ────────────────────────────────────────────────────── */
function PdvRow({ pdv, idx, onSelect, onEdit, onRemove }) {
  const isEmporium = pdv.id?.startsWith("sch-") || pdv.origem === "emporium";
  const temErro = ["erro", "erro_ssh"].includes(pdv.status);
  return (
    <tr
      className="pdv-row fade-row"
      onClick={() => onSelect(pdv)}
      style={{
        borderBottom: "1px solid #0d1220",
        cursor: "pointer",
        animationDelay: `${idx * 18}ms`,
        background: temErro ? "rgba(239,68,68,.03)" : "transparent",
      }}
    >
      <td style={{ padding: "11px 14px" }}>
        <StatusBadge status={pdv.status} />
      </td>
      <td style={{ padding: "11px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
              {pdv.nome}
            </p>
            <p
              style={{
                margin: "2px 0 0",
                fontSize: 11,
                color: "#475569",
                fontFamily: "monospace",
              }}
            >
              {pdv.id}
            </p>
          </div>
          {isEmporium && (
            <span
              style={{
                fontSize: 9,
                background: "#2e1065",
                color: "#a78bfa",
                border: "1px solid #4c1d95",
                borderRadius: 4,
                padding: "1px 5px",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              SCH
            </span>
          )}
        </div>
      </td>
      <td
        style={{
          padding: "11px 14px",
          fontFamily: "monospace",
          fontSize: 12,
          color: "#94a3b8",
        }}
      >
        {pdv.host || <span style={{ color: "#334155" }}>—</span>}
      </td>
      <td style={{ padding: "11px 14px", fontSize: 12, color: "#94a3b8" }}>
        {pdv.sistema_operacional || "—"}
      </td>
      <td style={{ padding: "11px 14px" }}>
        <HwCell principal={pdv.cpu_modelo} icon="⚡" />
      </td>
      <td style={{ padding: "11px 14px" }}>
        <HwCell
          principal={pdv.memoria_total || null}
          secundario={pdv.memoria_usada ? `Usada: ${pdv.memoria_usada}` : null}
          icon="💾"
        />
      </td>
      <td style={{ padding: "11px 14px" }}>
        <HwCell
          principal={pdv.disco_total || null}
          secundario={pdv.disco_usado ? `Usado: ${pdv.disco_usado}` : null}
          icon="🗄"
        />
      </td>
      <td style={{ padding: "11px 14px" }}>
        {/* Etiqueta de etapa de erro inline */}
        {temErro && pdv.erro_etapa ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <EtapaPill etapa={pdv.erro_etapa} />
            {pdv.erro && (
              <span
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 120,
                }}
              >
                {pdv.erro}
              </span>
            )}
          </div>
        ) : (
          <span
            style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}
          >
            {pdv.atualizado_em
              ? new Date(pdv.atualizado_em).toLocaleString("pt-BR")
              : "Nunca"}
          </span>
        )}
      </td>
      <td style={{ padding: "11px 14px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(pdv);
            }}
            style={{
              background: "none",
              border: "1px solid #1e3a5f",
              color: "#60a5fa",
              borderRadius: 6,
              padding: "4px 9px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            ✏️
          </button>
          <button
            onClick={(e) => onRemove(pdv.id, e)}
            style={{
              background: "none",
              border: "1px solid #2a1515",
              color: "#ef4444",
              borderRadius: 6,
              padding: "4px 9px",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Grupo de loja ───────────────────────────────────────────────────────── */
function GrupoLoja({
  loja,
  pdvs: lp,
  isEmporium,
  aberto,
  onToggle,
  onSelect,
  onEdit,
  onRemove,
}) {
  const onlineG = lp.filter((p) => p.status === "online").length;
  const offlineG = lp.filter((p) => p.status === "offline").length;
  const erroG = lp.filter((p) =>
    ["erro", "erro_ssh"].includes(p.status),
  ).length;
  return (
    <div
      style={{
        background: "#0f1117",
        border: "1px solid #1e2535",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#111827")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#0d1220")}
        style={{
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          background: "#0d1220",
          borderBottom: aberto ? "1px solid #1e2535" : "none",
          transition: "background .15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 14,
              transition: "transform .2s",
              display: "inline-block",
              transform: aberto ? "rotate(0)" : "rotate(-90deg)",
            }}
          >
            ▾
          </span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>
            {isEmporium ? "🛒" : "🏪"} {loja}
          </span>
          {isEmporium && (
            <span
              style={{
                fontSize: 10,
                background: "#2e1065",
                color: "#a78bfa",
                border: "1px solid #4c1d95",
                borderRadius: 4,
                padding: "2px 7px",
                fontWeight: 700,
              }}
            >
              EMPORIUM
            </span>
          )}
          <span style={{ fontSize: 12, color: "#475569" }}>
            {lp.length} {isEmporium ? "SCH" : "PDV"}
            {lp.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              color: "#22c55e",
              background: "#052e16",
              border: "1px solid #166534",
              borderRadius: 6,
              padding: "2px 10px",
            }}
          >
            ✓ {onlineG} online
          </span>
          {offlineG > 0 && (
            <span
              style={{
                fontSize: 12,
                color: "#ef4444",
                background: "#2d0a0a",
                border: "1px solid #7f1d1d",
                borderRadius: 6,
                padding: "2px 10px",
              }}
            >
              ✗ {offlineG} offline
            </span>
          )}
          {erroG > 0 && (
            <span
              style={{
                fontSize: 12,
                color: "#f97316",
                background: "#2d1700",
                border: "1px solid #7c2d12",
                borderRadius: 6,
                padding: "2px 10px",
              }}
            >
              ⚠ {erroG} erro
            </span>
          )}
        </div>
      </div>
      {aberto && (
        <div className="grupo-content" style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 1100,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #1e2535" }}>
                {[
                  "Status",
                  "Nome / ID",
                  "Host",
                  "Sistema",
                  "Processador",
                  "RAM",
                  "Disco",
                  "Erro / Atualização",
                  "Ações",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: 10,
                      color: "#475569",
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lp.map((pdv, i) => (
                <PdvRow
                  key={pdv.id}
                  pdv={pdv}
                  idx={i}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onRemove={onRemove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── App Principal ───────────────────────────────────────────────────────── */
export default function App() {
  const [dados, setDados] = useState(null);
  const [carr, setCarr] = useState(true);
  const [mon, setMon] = useState(false);
  const [pdvSel, setPdvSel] = useState(null);
  const [pdvEdit, setPdvEdit] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [showDias, setShowDias] = useState(false);
  const [showErros, setShowErros] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [grupoAb, setGrupoAb] = useState({});

  const buscarStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/status`);
      const data = await res.json();
      setDados(data);
      setMon(data.monitoramento_em_andamento);
    } catch {
    } finally {
      setCarr(false);
    }
  }, []);

  useEffect(() => {
    buscarStatus();
    const iv = setInterval(buscarStatus, mon ? 3000 : 15000);
    return () => clearInterval(iv);
  }, [buscarStatus, mon]);

  async function iniciarMon() {
    setMon(true);
    await fetch(`${API}/monitorar`, { method: "POST" });
    buscarStatus();
  }

  async function removerPDV(id, e) {
    e.stopPropagation();
    if (!confirm(`Remover ${id}?`)) return;
    await fetch(`${API}/pdvs/${id}`, { method: "DELETE" });
    buscarStatus();
  }

  const pdvsFilt = (dados?.pdvs || []).filter((p) => {
    const mb =
      !busca ||
      p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      p.host?.includes(busca) ||
      p.id?.toLowerCase().includes(busca.toLowerCase()) ||
      p.erro?.toLowerCase().includes(busca.toLowerCase());
    const ms =
      filtro === "todos" ||
      p.status === filtro ||
      (filtro === "erro" && ["erro", "erro_ssh"].includes(p.status));
    return mb && ms;
  });

  const grupos = agruparPorLoja(pdvsFilt);
  useEffect(() => {
    if (grupos.length > 0) {
      setGrupoAb((prev) => {
        const n = { ...prev };
        grupos.forEach(({ loja }) => {
          if (!(loja in n)) n[loja] = true;
        });
        return n;
      });
    }
  }, [pdvsFilt.length]);

  const resumo = dados?.resumo || {
    total: 0,
    online: 0,
    offline: 0,
    erro: 0,
    total_socin: 0,
    total_emporium: 0,
  };
  const pdvsComErro = (dados?.pdvs || []).filter((p) =>
    ["erro", "erro_ssh"].includes(p.status),
  );
  const offlineCount = resumo.offline || 0;

  const btnBase = {
    border: "1px solid #1e2535",
    borderRadius: 8,
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: 13,
    background: "none",
  };

  return (
    <>
      <GlobalStyles />
      <div
        style={{
          minHeight: "100vh",
          background: "#080b12",
          color: "#e2e8f0",
          fontFamily: "'Segoe UI',system-ui,sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            borderBottom: "1px solid #0d1220",
            padding: "18px 28px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#0a0d16",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              🖥
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
                PDV Monitor
              </h1>
              <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>
                Monitoramento de pontos de venda
              </p>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={() => exportarPDF(pdvsFilt)}
              disabled={pdvsFilt.length === 0}
              style={{
                ...btnBase,
                color: pdvsFilt.length === 0 ? "#334155" : "#4ade80",
                borderColor: pdvsFilt.length === 0 ? "#1e2535" : "#1e3a2f",
              }}
            >
              📄 Exportar PDF
            </button>

            {/* Botão Erros — destaque vermelho quando há erros */}
            <button
              onClick={() => setShowErros(true)}
              style={{
                ...btnBase,
                color: pdvsComErro.length > 0 ? "#f97316" : "#64748b",
                borderColor: pdvsComErro.length > 0 ? "#7c2d12" : "#1e2535",
                position: "relative",
              }}
            >
              ⚠️ Erros
              {pdvsComErro.length > 0 && (
                <span
                  className="pulse-dot"
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 17,
                    height: 17,
                    background: "#ef4444",
                    borderRadius: "50%",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  {pdvsComErro.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowDias(true)}
              style={{
                ...btnBase,
                color: offlineCount > 0 ? "#fbbf24" : "#94a3b8",
                borderColor: offlineCount > 0 ? "#713f12" : "#1e2535",
                position: "relative",
              }}
            >
              📉 Dias sem Venda
              {offlineCount > 0 && (
                <span
                  className="pulse-dot"
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 17,
                    height: 17,
                    background: "#f59e0b",
                    borderRadius: "50%",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#000",
                  }}
                >
                  {offlineCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowSync(true)}
              style={{ ...btnBase, color: "#38bdf8", borderColor: "#0c2a3a" }}
            >
              🗄 Sincronizar MySQL
            </button>
            <button
              onClick={() => setShowAdd(true)}
              style={{ ...btnBase, color: "#94a3b8" }}
            >
              ➕ Adicionar PDV
            </button>
            <button
              onClick={iniciarMon}
              disabled={mon}
              style={{
                background: mon
                  ? "#1e2535"
                  : "linear-gradient(135deg,#3b82f6,#6366f1)",
                border: "none",
                color: mon ? "#475569" : "#fff",
                borderRadius: 8,
                padding: "8px 20px",
                cursor: mon ? "not-allowed" : "pointer",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {mon ? (
                <>
                  <Spinner />
                  Monitorando...
                </>
              ) : (
                "▶ Monitorar Todos"
              )}
            </button>
          </div>
        </div>

        <div style={{ padding: "24px 28px" }}>
          {/* Cards resumo */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 14,
              marginBottom: 24,
            }}
          >
            {/* Card Total — expandido com subtotais SOCIN / Emporium */}
            <div
              className="fade-row"
              style={{
                background: "#0f1117",
                border: "1px solid #1e2535",
                borderRadius: 12,
                padding: "18px 22px",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>📡</div>
              <p
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 700,
                  color: "#3b82f6",
                }}
              >
                {resumo.total}
              </p>
              <p
                style={{ margin: "4px 0 8px", fontSize: 12, color: "#475569" }}
              >
                Total
              </p>
              {/* Subtotais */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  borderTop: "1px solid #1e2535",
                  paddingTop: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 10 }}>🖥</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      SOCIN
                    </span>
                  </div>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8" }}
                  >
                    {resumo.total_socin || 0}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 10 }}>🛒</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Emporium
                    </span>
                  </div>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}
                  >
                    {resumo.total_emporium || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Cards Online / Offline / Erro */}
            {[
              {
                label: "Online",
                valor: resumo.online,
                cor: "#22c55e",
                icon: "✅",
              },
              {
                label: "Offline",
                valor: resumo.offline,
                cor: "#ef4444",
                icon: "❌",
              },
              {
                label: "Erro",
                valor: resumo.erro,
                cor: "#f97316",
                icon: "⚠️",
                onClick:
                  pdvsComErro.length > 0 ? () => setShowErros(true) : null,
              },
            ].map(({ label, valor, cor, icon, onClick }) => (
              <div
                key={label}
                className="fade-row"
                onClick={onClick || undefined}
                style={{
                  background: "#0f1117",
                  border: `1px solid ${onClick && valor > 0 ? "#7c2d1280" : "#1e2535"}`,
                  borderRadius: 12,
                  padding: "18px 22px",
                  cursor: onClick && valor > 0 ? "pointer" : "default",
                  transition: "border-color .2s, transform .15s",
                }}
                onMouseEnter={(e) => {
                  if (onClick && valor > 0)
                    e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 30,
                    fontWeight: 700,
                    color: cor,
                  }}
                >
                  {valor}
                </p>
                <p
                  style={{ margin: "4px 0 0", fontSize: 12, color: "#475569" }}
                >
                  {label}
                  {onClick && valor > 0 ? " — clique para detalhes" : ""}
                </p>
              </div>
            ))}
          </div>

          {/* Filtros */}
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <input
              placeholder="Buscar por nome, IP, ID ou mensagem de erro..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                flex: 1,
                background: "#0f1117",
                border: "1px solid #1e2535",
                borderRadius: 8,
                padding: "9px 14px",
                color: "#e2e8f0",
                fontSize: 14,
              }}
            />
            {["todos", "online", "offline", "erro"].map((f) => (
              <button
                key={f}
                className="tab-btn"
                onClick={() => setFiltro(f)}
                style={{
                  background: filtro === f ? "#1e293b" : "none",
                  border: "1px solid " + (filtro === f ? "#3b82f6" : "#1e2535"),
                  color: filtro === f ? "#3b82f6" : "#64748b",
                  borderRadius: 8,
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: 13,
                  textTransform: "capitalize",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Lista */}
          {carr ? (
            <div
              style={{
                textAlign: "center",
                padding: 60,
                color: "#475569",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
              }}
            >
              <Spinner size={20} />
              Carregando...
            </div>
          ) : grupos.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#475569" }}>
              {dados?.pdvs?.length === 0
                ? "Nenhum PDV cadastrado. Use 'Sincronizar MySQL' ou 'Adicionar PDV'."
                : "Nenhum PDV encontrado para este filtro."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {grupos.map(({ loja, pdvs: lp, isEmporium }) => (
                <GrupoLoja
                  key={loja}
                  loja={loja}
                  pdvs={lp}
                  isEmporium={isEmporium}
                  aberto={grupoAb[loja] !== false}
                  onToggle={() =>
                    setGrupoAb((prev) => ({ ...prev, [loja]: !prev[loja] }))
                  }
                  onSelect={setPdvSel}
                  onEdit={setPdvEdit}
                  onRemove={removerPDV}
                />
              ))}
            </div>
          )}

          <p
            style={{
              textAlign: "center",
              marginTop: 18,
              fontSize: 11,
              color: "#1e2535",
            }}
          >
            {mon
              ? "⟳ Monitorando... atualizando a cada 3s"
              : "Atualiza automaticamente a cada 15s"}
          </p>
        </div>

        {/* Modais */}
        {pdvSel && (
          <ModalDetalhes pdv={pdvSel} onClose={() => setPdvSel(null)} />
        )}
        {pdvEdit && (
          <ModalFormPDV
            pdv={pdvEdit}
            onClose={() => setPdvEdit(null)}
            onSave={buscarStatus}
          />
        )}
        {showAdd && (
          <ModalFormPDV
            onClose={() => setShowAdd(false)}
            onSave={buscarStatus}
          />
        )}
        {showSync && (
          <ModalSyncMySQL
            onClose={() => setShowSync(false)}
            onSync={buscarStatus}
          />
        )}
        {showDias && <ModalDiasSemVenda onClose={() => setShowDias(false)} />}
        {showErros && (
          <ModalPainelErros
            pdvsComErro={pdvsComErro}
            onClose={() => setShowErros(false)}
            onMonitorarUm={buscarStatus}
          />
        )}
      </div>
    </>
  );
}
