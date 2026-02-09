const btn = document.getElementById("btn");
const meta = document.getElementById("meta");
const grid = document.getElementById("grid");

let isScanning = false;
let pollTimer = null;

function getBumpClass(bump) {
  if (bump === "major") return "bad";
  if (bump === "minor") return "warn";
  return "muted";
}
function bumpLabel(b) {
  return b === "major" ? "MAJOR" : b === "minor" ? "MINOR" : "PATCH";
}

function sevClass(sev) {
  if (sev === "critical") return "bad";
  if (sev === "high") return "bad";
  if (sev === "moderate") return "warn";
  return "muted";
}
function sevLabel(sev) {
  return (sev || "unknown").toUpperCase();
}

function fmtTime(ts) {
  if (!ts) return "UNKNOWN";
  try {
    return new Date(ts * 1000).toLocaleString("pt-BR");
  } catch {
    return "UNKNOWN";
  }
}

async function apiGetStatus() {
  const r = await fetch("/api/status?ts=" + Date.now());
  if (!r.ok) throw new Error("API /api/status HTTP " + r.status);
  return await r.json();
}

async function apiRun() {
  const r = await fetch("/api/run", { method: "POST" });
  if (!r.ok) throw new Error("API /api/run HTTP " + r.status);
  return await r.json();
}

function setScanningState(scanning) {
  isScanning = scanning;
  if (scanning) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-cog fa-spin"></i> AUDITANDO...';
    meta.innerHTML =
      '<span class="running-text">:: SYSTEM SCANNING IN PROGRESS ::</span>';
    grid.innerHTML = `
            <div class="scanning-overlay" style="grid-column: 1 / -1;">
                <i class="fas fa-radiation fa-spin"></i>
                <h2 style="color: #fff; margin-top:10px;">PROTOCOLOS DE AUDITORIA ATIVOS</h2>
                <p>O Sentinel Ops está analisando vulnerabilidades e dependências nos repositórios.</p>
                <div style="margin-top: 15px; color: var(--dim)">
                    Isso pode levar alguns minutos. Não feche a página.
                </div>
            </div>
        `;
    startPolling();
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> EXEC_CHECK';
    stopPolling();
  }
}

function render(data) {
  if (data.running && !isScanning) {
    setScanningState(true);
    return;
  }
  if (!data.running && isScanning) {
    setScanningState(false);
  }
  if (isScanning) return;

  const dt = fmtTime(data.generated_at);
  meta.innerHTML = `<i class="far fa-clock"></i> LAST SCAN: ${dt}`;
  grid.innerHTML = "";

  if (!data.results || data.results.length === 0) {
    const note = data.note ? ` (${data.note})` : "";
    grid.innerHTML = `<div class="text-muted" style="text-align:center; grid-column:1/-1;">Nenhum repositório configurado no sistema${note}.</div>`;
    return;
  }

  data.results.sort((a, b) => {
    const aBad = !a.ok || (a.audit && a.audit.high + a.audit.critical > 0);
    const bBad = !b.ok || (b.audit && b.audit.high + b.audit.critical > 0);
    return bBad - aBad;
  });

  for (const repo of data.results) {
    const audit = repo.audit || { high: 0, critical: 0 };
    const auditCount = (audit.high || 0) + (audit.critical || 0);

    const hasOut = (repo.outdated || []).length > 0;
    const auditItems = Array.isArray(repo.audit_items) ? repo.audit_items : [];

    let statusHtml = "";
    let borderStyle = "";

    if (repo.error) {
      statusHtml = `<span class="pill warn"><i class="fas fa-exclamation-triangle"></i> ERROR</span>`;
      borderStyle = "border-left: 3px solid var(--warning);";
    } else if (auditCount > 0) {
      statusHtml = `<span class="pill bad"><i class="fas fa-biohazard"></i> ${audit.high}H / ${audit.critical}C</span>`;
      borderStyle = "border-left: 3px solid var(--danger);";
    } else if (hasOut) {
      statusHtml = `<span class="pill warn"><i class="fas fa-arrow-up"></i> UPDATE</span>`;
      borderStyle = "border-left: 3px solid var(--warning);";
    } else {
      statusHtml = `<span class="pill ok"><i class="fas fa-shield-alt"></i> SECURE</span>`;
      borderStyle = "border-left: 3px solid var(--accent);";
    }

    const outHtml = hasOut
      ? repo.outdated
        .map((p) => {
          const bumpClass = getBumpClass(p.bump);
          return `
            <div class="pkg">
              <div style="overflow:hidden; text-overflow:ellipsis;"><code style="color:var(--text-main)">${p.name}</code></div>
              <div style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                <span class="text-${bumpClass}" style="opacity:0.8">${p.latest}</span>
                <span class="pill ${bumpClass}" style="font-size:0.6rem">${bumpLabel(p.bump)}</span>
              </div>
            </div>`;
        })
        .join("")
      : !repo.error
        ? `<div style="text-align:center; padding:15px; color:var(--accent); opacity:0.3; letter-spacing:1px;">
           <i class="fas fa-check-circle" style="font-size:1.5em; margin-bottom:5px"></i><br>
           SYSTEM UP-TO-DATE
         </div>`
        : "";

    let vulnsHtml = "";
    if (auditItems.length > 0) {
      const bySevOrder = {
        critical: 0,
        high: 1,
        moderate: 2,
        low: 3,
        unknown: 4,
      };
      auditItems.sort(
        (a, b) => (bySevOrder[a.severity] ?? 9) - (bySevOrder[b.severity] ?? 9),
      );

      vulnsHtml = `
        <details>
          <summary>
            <span class="text-bad"><i class="fas fa-bug"></i> THREATS DETECTED (${auditItems.length})</span>
          </summary>
          <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px">
            ${auditItems
          .map((v) => {
            const sev = (v.severity || "unknown").toLowerCase();
            const klass = sevClass(sev);
            const id = v.id ? `<code>${v.id}</code>` : ``;

            return `
                <div class="vuln">
                  <div class="vuln-title">
                    <div>
                      <span class="pill ${klass}">${sevLabel(sev)}</span>
                      <strong style="margin-left:5px; color:#fff">${v.module}</strong>
                    </div>
                    <div class="vuln-meta"><span>${id}</span></div>
                  </div>
                  <div style="font-size:0.85rem; opacity:0.8; margin-bottom:5px;">
                    ${v.title || "Vulnerabilidade Detectada"}
                  </div>
                  ${v.recommendation
                ? `<div style="font-size:0.8rem; color:var(--accent);">
                    <i class="fas fa-wrench"></i> ${v.recommendation}
                  </div>`
                : ""
              }
                </div>`;
          })
          .join("")}
          </div>
        </details>
      `;
    }

    const card = document.createElement("div");
    card.className = "card";
    card.style = borderStyle;

    const managerIcon =
      repo.manager === "yarn"
        ? "fa-yarn"
        : repo.manager === "npm"
          ? "fa-npm"
          : "fa-code";
    const displayManager =
      repo.manager !== "unknown"
        ? `<i class="fab ${managerIcon}" style="font-size:0.8em; opacity:0.5; margin-left:5px"></i>`
        : "";

    card.innerHTML = `
      <div class="card-header">
        <div class="repo-name">
            <i class="fab fa-git-alt"></i> ${repo.name}
            ${displayManager}
        </div>
        <div>${statusHtml}</div>
      </div>
      
      ${repo.error
        ? `<div style="color:var(--danger); padding:10px; border:1px solid var(--danger); background:rgba(255,0,0,0.1); font-size:0.8rem;">
        <strong><i class="fas fa-times"></i> FALHA NA AUDITORIA:</strong><br>${repo.error}
      </div>`
        : ""
      }

      <div class="pkg-list">${outHtml}</div>
      ${vulnsHtml}
    `;

    grid.appendChild(card);
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    try {
      await loadStatus();
    } catch { }
  }, 2500);
}

async function loadStatus() {
  try {
    const data = await apiGetStatus();
    render(data);
    return data;
  } catch (e) {
    if (!isScanning) {
      meta.innerHTML = '<span class="text-bad">:: CONNECTION LOST ::</span>';
    }
  }
}

async function triggerScan() {
  try {
    setScanningState(true);
    await apiRun();
  } catch (e) {
    alert("Erro ao iniciar: " + e.message);
    setScanningState(false);
  }
}

btn.addEventListener("click", triggerScan);
loadStatus();
