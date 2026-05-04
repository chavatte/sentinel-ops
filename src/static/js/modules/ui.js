import { utils } from "./utils.js";

let chartInstances = {};

export const ui = {
  setScanningState: (isScanning, elements) => {
    const { btn, meta, grid } = elements;
    if (isScanning) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-cog fa-spin"></i> AUDITANDO...';
      meta.innerHTML =
        '<span class="running-text">:: SYSTEM SCANNING IN PROGRESS ::</span>';
      grid.innerHTML = `
        <div class="scanning-overlay" style="grid-column: 1 / -1;">
            <i class="fas fa-radiation fa-spin"></i>
            <h2 style="color: #fff; margin-top:10px;">PROTOCOLOS DE AUDITORIA ATIVOS</h2>
            <p>O Sentinel Ops está analisando vulnerabilidades e dependências nos repositórios.</p>
            <div style="margin-top: 15px; color: var(--dim)">Isso pode levar alguns minutos. Não feche a página.</div>
        </div>`;
    } else {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sync-alt"></i> EXEC_CHECK';
    }
  },

  renderMetrics: (metricsData, elements) => {
    elements.metricsBar.style.display = "flex";
    document.getElementById("m-mttr").innerText =
      metricsData.mttr_days.toFixed(1);
    document.getElementById("m-pend").innerText = metricsData.pending_count;
    document.getElementById("m-fix").innerText = metricsData.fixed_count;
  },

  renderRepoList: (repos, listElement) => {
    listElement.innerHTML =
      repos
        .map(
          (repo) => `
      <div class="repo-item ${repo.is_enabled ? "active" : ""}">
        <div>
          <strong style="color: #fff;">${repo.name}</strong> <span style="opacity: 0.5; font-size: 0.8rem;">[${repo.id}]</span><br>
          <code style="font-size: 0.75rem; color: var(--accent);">${repo.git_url}</code>
        </div>
        <div style="display: flex; gap: 10px;">
          <button data-action="toggle" data-id="${repo.id}" style="padding: 5px 10px; font-size: 0.8rem;">
             <i class="fas ${repo.is_enabled ? "fa-pause" : "fa-play"}"></i>
          </button>
          <button data-action="delete" data-id="${repo.id}" style="padding: 5px 10px; font-size: 0.8rem; border-color: var(--danger); color: var(--danger);">
             <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `,
        )
        .join("") ||
      '<div class="text-muted" style="text-align:center;">Nenhum repositório cadastrado.</div>';
  },

  renderGrid: (data, elements) => {
    const { grid, meta } = elements;
    meta.innerHTML = `<i class="far fa-clock"></i> LAST SCAN: ${utils.fmtTime(data.generated_at)}`;
    grid.innerHTML = "";

    if (!data.results || data.results.length === 0) {
      grid.innerHTML = `<div class="text-muted" style="text-align:center; grid-column:1/-1;">Nenhum repositório auditado no sistema.</div>`;
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

    data.results.forEach((repo) => {
      const audit = repo.audit || { high: 0, critical: 0 };
      const critHighCount = audit.high + audit.critical;
      const hasOut = (repo.outdated || []).length > 0;
      const auditItems = Array.isArray(repo.audit_items)
        ? repo.audit_items
        : [];
      const totalVulns = auditItems.length;

      let badges = [];
      let borderStyle = "border-left: 3px solid var(--accent);";

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
          if (
            !borderStyle.includes("danger") &&
            !borderStyle.includes("#ff8c00")
          ) {
            borderStyle = "border-left: 3px solid var(--warning);";
          }
        }
      }

      const outHtml = hasOut
        ? repo.outdated
            .map((p) => {
              const bClass = utils.getBumpClass(p.bump);
              return `
          <div class="pkg-grid-item">
            <div class="pkg-name-wrapper"><code>${p.name}</code></div>
            <div class="pkg-current">${p.current || "---"}</div>
            <div class="pkg-latest text-${bClass}">
              <i class="fas fa-arrow-right pkg-arrow"></i> ${p.latest || "---"}
            </div>
            <div class="pkg-bump"><span class="pill ${bClass}">${utils.bumpLabel(p.bump)}</span></div>
          </div>`;
            })
            .join("")
        : !repo.error && totalVulns === 0
          ? `<div class="empty-state"><i class="fas fa-check-circle"></i><br>SYSTEM UP-TO-DATE</div>`
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
          (a, b) =>
            (bySevOrder[a.severity] ?? 9) - (bySevOrder[b.severity] ?? 9),
        );

        vulnsHtml = `
            <div class="threats-container">
              ${auditItems
                .map((v) => {
                  const sev = (v.severity || "unknown").toLowerCase();
                  const klass = utils.sevClass(sev);
                  let sourceBadges = (
                    Array.isArray(v.source) ? v.source : [v.source || "unknown"]
                  )
                    .map((s) => {
                      if (s.toLowerCase() === "osv")
                        return `<span class="pill pill-osv"><i class="fas fa-dna"></i> OSV</span>`;
                      if (
                        s.toLowerCase() === "audit" ||
                        s.toLowerCase() === "native"
                      )
                        return `<span class="pill pill-native"><i class="fas fa-cog"></i> NATIVO</span>`;
                      return "";
                    })
                    .join("");

                  let intelUrl = v.id
                    ? v.id.startsWith("GHSA")
                      ? `https://github.com/advisories/${v.id}`
                      : v.id.startsWith("CVE")
                        ? `https://nvd.nist.gov/vuln/detail/${v.id}`
                        : `https://osv.dev/vulnerability/${v.id}`
                    : "";
                  const intelBtn = intelUrl
                    ? `<div class="btn-intel-wrapper"><a href="${intelUrl}" target="_blank" style="text-decoration:none;"><span class="pill btn-intel"><i class="fas fa-crosshairs"></i> INTEL</span></a></div>`
                    : "";

                  return `
                  <div class="vuln">
                    <div class="vuln-title">
                      <div><span class="pill ${klass}">${utils.sevLabel(sev)}</span><strong style="margin-left:5px; color:#fff">${v.module}</strong></div>
                    </div>
                    ${sourceBadges ? `<div style="margin-bottom: 8px;">${sourceBadges}</div>` : ""}
                    <div class="vuln-detail-desc"><div class="vuln-detail-id">${v.id ? `<code>${v.id}</code>` : ""}</div>${v.title || "Vulnerabilidade Detectada"}</div>
                    ${v.recommendation ? `<div class="vuln-recommendation"><i class="fas fa-wrench"></i> ${v.recommendation}</div>` : ""}
                    ${intelBtn}
                  </div>`;
                })
                .join("")}
            </div>`;
      }

      const card = document.createElement("div");
      card.className = "card";
      card.style = borderStyle;

      const mIcon = repo.manager.includes("yarn")
        ? "fa-yarn"
        : repo.manager === "npm"
          ? "fa-npm"
          : "fa-code";
      const vBadge =
        repo.manager === "yarn_berry"
          ? `<span class="repo-manager-badge">v4+</span>`
          : "";

      const encodedVulnsHtml = encodeURIComponent(vulnsHtml);
      const encodedOutHtml = encodeURIComponent(outHtml);

      const showDetailsBtn =
        hasOut || totalVulns > 0
          ? `
          <button class="btn-outline btn-details" data-repo="${encodeURIComponent(repo.name)}" data-vulns="${encodedVulnsHtml}" data-pkgs="${encodedOutHtml}" data-vuln-count="${totalVulns}">
              <span><i class="fas fa-search-plus" style="margin-right: 8px;"></i> VER DETALHES</span>
              <i class="fas fa-chevron-right" style="opacity: 0.5;"></i>
          </button>
      `
          : `<div class="empty-state"><i class="fas fa-check-circle"></i><br>SYSTEM UP-TO-DATE</div>`;

      card.innerHTML = `
        <div class="card-header card-header-compact">
          <div class="repo-name">
            <i class="fas fa-layer-group" style="opacity: 0.5;"></i> ${repo.name}
            ${repo.manager !== "unknown" ? `<span class="repo-manager-badge"><i class="fab ${mIcon}"></i>${vBadge}</span>` : ""}
          </div>
          <div class="repo-badges-container">${badges.join("")}</div>
        </div>
        ${repo.error ? `<div class="sys-error-msg"><strong><i class="fas fa-times"></i> FALHA NA AUDITORIA:</strong><br>${repo.error}</div>` : ""}
        ${showDetailsBtn}
      `;
      grid.appendChild(card);
    });

    const detailButtons = document.querySelectorAll(".btn-details");
    detailButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const currentBtn = e.currentTarget;
        ui.openDetailsPanel(
          decodeURIComponent(currentBtn.dataset.repo),
          decodeURIComponent(currentBtn.dataset.pkgs),
          decodeURIComponent(currentBtn.dataset.vulns),
          parseInt(currentBtn.dataset.vulnCount),
        );
      });
    });
  },

  openDetailsPanel: (repoName, pkgsHtml, vulnsHtml, vulnCount) => {
    let modal = document.getElementById("secops-details-modal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "secops-details-modal";
      modal.className = "modal-overlay";
      document.body.appendChild(modal);
    }

    const hasVulns = vulnCount > 0;
    const threatsTitle = hasVulns
      ? `<h3 class="details-section-title title-danger"><i class="fas fa-bug text-bad"></i> THREATS DETECTED (${vulnCount})</h3>`
      : "";
    const techDebtTitle = pkgsHtml
      ? `<h3 class="details-section-title title-warning"><i class="fas fa-arrow-up text-warn"></i> TECHNICAL DEBT (UPDATES)</h3>`
      : "";

    modal.innerHTML = `
        <div class="modal-content card modal-details-content">
          <div class="modal-header modal-header-bordered">
            <h2 class="modal-title">
              <i class="fas fa-crosshairs"></i> ${repoName} 
              <span class="modal-subtitle">// SECOPS AUDIT REPORT</span>
            </h2>
            <button id="btn-close-details" class="btn-close"><i class="fas fa-times"></i></button>
          </div>
          
          <div class="modal-body modal-body-scroll">
            ${techDebtTitle}
            ${pkgsHtml ? `<div class="pkg-list" style="margin-bottom: 20px;">${pkgsHtml}</div>` : ""}
            ${threatsTitle}
            ${hasVulns ? vulnsHtml : ""}
          </div>
        </div>
      `;

    modal.style.display = "flex";

    document
      .getElementById("btn-close-details")
      .addEventListener("click", () => {
        modal.style.display = "none";
      });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  },

  renderAnalytics: (metrics) => {
    const colorCrit = "#ff3333";
    const colorHigh = "#ff8c00";
    const colorMod = "#f1c40f";
    const colorLow = "#1e90ff";
    const colorBase = "#050709";

    const sevData = metrics.severity_distribution;
    const sevOptions = {
      series: [
        sevData.critical || 0,
        sevData.high || 0,
        sevData.moderate || 0,
        sevData.low || 0,
      ],
      labels: ["CRITICAL", "HIGH", "MODERATE", "LOW"],
      chart: {
        type: "donut",
        background: "transparent",
        height: 280,
        foreColor: "#e0e0e0",
      },
      colors: [colorCrit, colorHigh, colorMod, colorLow],
      stroke: { show: true, colors: [colorBase], width: 2 },
      dataLabels: { enabled: false },
      theme: { mode: "dark" },
      plotOptions: { pie: { donut: { size: "70%" } } },
      legend: { position: "bottom" },
    };

    if (chartInstances.sev) chartInstances.sev.destroy();
    chartInstances.sev = new ApexCharts(
      document.querySelector("#chart-severity"),
      sevOptions,
    );
    chartInstances.sev.render();

    const tdData = metrics.tech_debt;
    const tdOptions = {
      series: [
        {
          name: "Pacotes Desatualizados",
          data: [tdData.major || 0, tdData.minor || 0, tdData.patch || 0],
        },
      ],
      xaxis: {
        categories: ["MAJOR (Quebra)", "MINOR (Feature)", "PATCH (Fix)"],
        axisBorder: { show: false },
      },
      chart: {
        type: "bar",
        background: "transparent",
        height: 280,
        toolbar: { show: false },
        foreColor: "#e0e0e0",
      },
      colors: [colorCrit, colorMod, "#555555"],
      plotOptions: {
        bar: { distributed: true, borderRadius: 3, columnWidth: "50%" },
      },
      dataLabels: {
        enabled: true,
        style: { fontSize: "14px", colors: ["#fff"] },
      },
      legend: { show: false },
      theme: { mode: "dark" },
      grid: { borderColor: "rgba(255,255,255,0.05)", strokeDashArray: 4 },
    };

    if (chartInstances.td) chartInstances.td.destroy();
    chartInstances.td = new ApexCharts(
      document.querySelector("#chart-techdebt"),
      tdOptions,
    );
    chartInstances.td.render();

    const offenders = metrics.top_offenders || [];
    const offNames = offenders.map((o) => o.name);
    const offCounts = offenders.map((o) => o.count);

    const offOptions = {
      series: [{ name: "Ameaças Ativas", data: offCounts }],
      xaxis: { categories: offNames, axisBorder: { show: false } },
      chart: {
        type: "bar",
        background: "transparent",
        height: 280,
        toolbar: { show: false },
        foreColor: "#e0e0e0",
      },
      colors: ["#8a2be2"],
      plotOptions: {
        bar: { horizontal: true, borderRadius: 3, barHeight: "40%" },
      },
      dataLabels: {
        enabled: true,
        textAnchor: "start",
        style: { colors: ["#fff"] },
        offsetX: 10,
      },
      theme: { mode: "dark" },
      grid: { borderColor: "rgba(255,255,255,0.05)", strokeDashArray: 4 },
    };

    if (chartInstances.off) chartInstances.off.destroy();
    chartInstances.off = new ApexCharts(
      document.querySelector("#chart-offenders"),
      offOptions,
    );
    chartInstances.off.render();
  },
};
