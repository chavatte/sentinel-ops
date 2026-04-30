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
    const getScore = (r) => {
      if (!r.ok || r.error) return 4;
      if ((r.audit?.high || 0) + (r.audit?.critical || 0) > 0) return 3;
      if (Array.isArray(r.audit_items) && r.audit_items.length > 0) return 2;
      if ((r.outdated || []).length > 0) return 1;
      return 0;
    };
    return getScore(b) - getScore(a);
  });

  for (const repo of data.results) {
    const audit = repo.audit || { high: 0, critical: 0 };
    const critHighCount = (audit.high || 0) + (audit.critical || 0);

    const hasOut = (repo.outdated || []).length > 0;
    const auditItems = Array.isArray(repo.audit_items) ? repo.audit_items : [];
    const totalVulns = auditItems.length;

    let badges = [];
    let borderStyle = "";
    if (repo.error) {
      badges.push(
        `<span class="pill warn"><i class="fas fa-exclamation-triangle"></i> ERROR</span>`,
      );
      borderStyle = "border-left: 3px solid var(--warning);";
    } else {
      if (critHighCount > 0) {
        badges.push(
          `<span class="pill bad"><i class="fas fa-biohazard"></i> ${audit.high}H / ${audit.critical}C</span>`,
        );
        borderStyle = "border-left: 3px solid var(--danger);";
      } else if (totalVulns > 0) {
        badges.push(
          `<span class="pill warn" style="color: #ff8c00; border-color: #ff8c00;"><i class="fas fa-shield-virus"></i> ${totalVulns} VULN</span>`,
        );
        borderStyle = "border-left: 3px solid #ff8c00;";
      }

      if (hasOut) {
        badges.push(
          `<span class="pill warn"><i class="fas fa-arrow-up"></i> UPDATE</span>`,
        );
        if (borderStyle === "") {
          borderStyle = "border-left: 3px solid var(--warning);";
        }
      }

      if (badges.length === 0) {
        badges.push(
          `<span class="pill ok"><i class="fas fa-shield-alt"></i> SECURE</span>`,
        );
        borderStyle = "border-left: 3px solid var(--accent);";
      }
    }

    let statusHtml = `<div style="display: flex; gap: 8px; flex-wrap: wrap;">${badges.join("")}</div>`;

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
      : !repo.error && totalVulns === 0
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
                let sourceBadges = "";
                const sources = Array.isArray(v.source)
                  ? v.source
                  : [v.source || "unknown"];
                sources.forEach((sourceRaw) => {
                  const s = sourceRaw.toLowerCase();
                  if (s === "osv") {
                    sourceBadges += `<span class="pill" style="border-color:#8a2be2; color:#8a2be2; font-size:0.6rem; margin-right:4px;"><i class="fas fa-dna"></i> OSV</span>`;
                  } else if (s === "audit" || s === "native") {
                    sourceBadges += `<span class="pill" style="border-color:#1e90ff; color:#1e90ff; font-size:0.6rem; margin-right:4px;"><i class="fas fa-cog"></i> NATIVO</span>`;
                  }
                });

                let intelUrl = "";
                if (v.id) {
                  if (v.id.startsWith("GHSA")) {
                    intelUrl = `https://github.com/advisories/${v.id}`;
                  } else if (v.id.startsWith("CVE")) {
                    intelUrl = `https://nvd.nist.gov/vuln/detail/${v.id}`;
                  } else {
                    intelUrl = `https://osv.dev/vulnerability/${v.id}`;
                  }
                }

                const intelBtn = intelUrl
                  ? `<div style="margin-top: 10px;">
                       <a href="${intelUrl}" target="_blank" style="text-decoration:none;">
                         <span class="pill" style="border: 1px dashed var(--accent); color: var(--accent); cursor: pointer;">
                           <i class="fas fa-crosshairs"></i> INTEL
                         </span>
                       </a>
                     </div>`
                  : "";

                return `
                <div class="vuln">
                  <div class="vuln-title" style="margin-bottom: 8px;">
                    <div>
                      <span class="pill ${klass}">${sevLabel(sev)}</span>
                      <strong style="margin-left:5px; color:#fff">${v.module}</strong>
                    </div>
                  </div>
                  
                  ${sourceBadges ? `<div style="margin-bottom: 8px;">${sourceBadges}</div>` : ""}
                  
                  <div style="font-size:0.85rem; opacity:0.8; margin-bottom:8px;">
                    <div style="margin-bottom: 4px;">${id}</div>
                    ${v.title || "Vulnerabilidade Detectada"}
                  </div>
                  
                  ${
                    v.recommendation
                      ? `<div style="font-size:0.8rem; color:var(--accent);">
                    <i class="fas fa-wrench"></i> ${v.recommendation}
                  </div>`
                      : ""
                  }
                  
                  ${intelBtn}
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
      repo.manager === "yarn" || repo.manager === "yarn_berry"
        ? "fa-yarn"
        : repo.manager === "npm"
          ? "fa-npm"
          : "fa-code";

    const versionBadge =
      repo.manager === "yarn_berry"
        ? `<span style="font-size:0.6em; opacity:0.6; margin-left:2px">v4+</span>`
        : "";

    const displayManager =
      repo.manager !== "unknown"
        ? `<i class="fab ${managerIcon}" style="font-size:0.8em; opacity:0.5; margin-left:5px"></i>${versionBadge}`
        : "";

    card.innerHTML = `
      <div class="card-header">
        <div class="repo-name">
            <i class="fab fa-git-alt"></i> ${repo.name}
            ${displayManager}
        </div>
        <div>${statusHtml}</div>
      </div>
      
      ${
        repo.error
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
    } catch {}
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

const btnReport = document.getElementById("btn-report");
let lastData = null;

async function loadStatus() {
  try {
    const data = await apiGetStatus();
    lastData = data;
    render(data);

    if (data && data.results && data.results.length > 0) {
      btnReport.style.display = "flex";
    }

    return data;
  } catch (e) {
    if (!isScanning) {
      meta.innerHTML = '<span class="text-bad">:: CONNECTION LOST ::</span>';
    }
  }
}

function generateMarkdownReport() {
  if (!lastData || !lastData.results) return;

  const date = new Date(lastData.generated_at * 1000).toLocaleString("pt-BR");

  let md = `# 🛡️ Sentinel Ops - Threat Intelligence Report\n`;
  md += `> **Generated at:** ${date} | **System:** Chavatte Security Operations Center\n\n`;
  md += `--- \n\n`;
  md += `## 📊 Executive Summary (Blue Team & DevSecOps)\n`;

  const totalRepos = lastData.results.length;
  const vulnerableRepos = lastData.results.filter(
    (r) => r.audit_items && r.audit_items.length > 0,
  ).length;
  const outdatedRepos = lastData.results.filter(
    (r) => r.outdated && r.outdated.length > 0,
  ).length;

  md += `- **Total Repositories Scanned:** ${totalRepos}\n`;
  md += `- **Repositories with Threats:** ${vulnerableRepos}\n`;
  md += `- **Repositories with Technical Debt (Updates):** ${outdatedRepos}\n\n`;

  md += `--- \n\n`;
  md += `## 🎯 Threat Matrix (Red Team Exploitation Map)\n\n`;

  lastData.results.forEach((repo) => {
    const vulns = repo.audit_items || [];
    const outds = repo.outdated || [];

    if (vulns.length === 0 && outds.length === 0) return;

    md += `### 📁 [${repo.name}]\n`;

    if (vulns.length > 0) {
      md += `#### 🚨 Active Vulnerabilities (${vulns.length})\n`;
      vulns.forEach((v) => {
        const sev = (v.severity || "unknown").toUpperCase();
        const id = v.id || "Unknown ID";
        let intelUrl = "";
        if (id.startsWith("GHSA"))
          intelUrl = `https://github.com/advisories/${id}`;
        else if (id.startsWith("CVE"))
          intelUrl = `https://nvd.nist.gov/vuln/detail/${id}`;
        else intelUrl = `https://osv.dev/vulnerability/${id}`;

        md += `- **[${sev}]** \`${v.module}\` - ${v.title}\n`;
        md += `  - **ID:** ${id}\n`;
        if (v.source) md += `  - **Source:** ${v.source.join(", ")}\n`;
        md += `  - **Intel:** [Read Mitigation Report](${intelUrl})\n`;
      });
      md += `\n`;
    }

    if (outds.length > 0) {
      md += `#### ⚠️ Outdated Packages (${outds.length})\n`;
      md += `| Package | Current | Latest | Bump |\n`;
      md += `|---|---|---|---|\n`;
      outds.forEach((p) => {
        const bumpEmote =
          p.bump === "major" ? "🔴" : p.bump === "minor" ? "🟠" : "🟡";
        md += `| \`${p.name}\` | ${p.current} | ${p.latest} | ${bumpEmote} ${p.bump.toUpperCase()} |\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Sentinel_Threat_Intel_${new Date().toISOString().split("T")[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

if (btnReport) btnReport.addEventListener("click", generateMarkdownReport);

loadStatus();
