export const utils = {
  getBumpClass: (bump) =>
    bump === "major" ? "bad" : bump === "minor" ? "warn" : "muted",
  bumpLabel: (b) =>
    b === "major" ? "MAJOR" : b === "minor" ? "MINOR" : "PATCH",
  sevClass: (sev) =>
    sev === "critical" || sev === "high"
      ? "bad"
      : sev === "moderate"
        ? "warn"
        : "muted",
  sevLabel: (sev) => (sev || "unknown").toUpperCase(),
  fmtTime: (ts) => {
    if (!ts) return "UNKNOWN";
    try {
      return new Date(ts * 1000).toLocaleString("pt-BR");
    } catch {
      return "UNKNOWN";
    }
  },

  generateMarkdownReport: (lastData, metrics) => {
    if (!lastData || !lastData.results) return;
    const date = new Date(lastData.generated_at * 1000).toLocaleString("pt-BR");

    let md = `# 🛡️ Sentinel Ops - Threat Intelligence Report\n`;
    md += `> **Generated at:** ${date} | **System:** Chavatte Security Operations Center\n\n---\n\n`;

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

    if (metrics) {
      md += `### 📈 Global Metrics & Analytics\n`;
      md += `- **Mean Time To Resolve (MTTR):** ${metrics.mttr_days} dias\n`;
      md += `- **Threats Mitigated (Resolved):** ${metrics.fixed_count}\n`;
      md += `- **Threats Active (Pending):** ${metrics.pending_count}\n\n`;

      md += `#### 🔥 Severity Distribution (Active Threats)\n`;
      md += `- **CRITICAL:** ${metrics.severity_distribution.critical || 0}\n`;
      md += `- **HIGH:** ${metrics.severity_distribution.high || 0}\n`;
      md += `- **MODERATE:** ${metrics.severity_distribution.moderate || 0}\n`;
      md += `- **LOW:** ${metrics.severity_distribution.low || 0}\n\n`;

      md += `#### ⚠️ Technical Debt Risk (Pending Updates)\n`;
      md += `- **MAJOR (Quebra de Compatibilidade):** ${metrics.tech_debt.major || 0}\n`;
      md += `- **MINOR (Novas Features):** ${metrics.tech_debt.minor || 0}\n`;
      md += `- **PATCH (Correção de Bugs):** ${metrics.tech_debt.patch || 0}\n\n`;

      if (metrics.top_offenders && metrics.top_offenders.length > 0) {
        md += `#### 🎯 Top Offenders (Risk Concentration)\n`;
        metrics.top_offenders.forEach((off, index) => {
          md += `${index + 1}. **${off.name}** (${off.count} active threats)\n`;
        });
        md += `\n`;
      }
      md += `---\n\n`;
    }

    md += `## 🎯 Threat Matrix (Red Team Exploitation Map)\n\n`;

    lastData.results.forEach((repo) => {
      const vulns = repo.audit_items || [];
      const outds = repo.outdated || [];
      if (vulns.length === 0 && outds.length === 0) return;

      md += `### 📦 [${repo.name}]\n`;

      if (vulns.length > 0) {
        md += `#### 🚨 Active Vulnerabilities (${vulns.length})\n`;
        vulns.forEach((v) => {
          const sev = (v.severity || "unknown").toUpperCase();
          const id = v.id || "Unknown ID";
          let intelUrl = id.startsWith("GHSA")
            ? `https://github.com/advisories/${id}`
            : id.startsWith("CVE")
              ? `https://nvd.nist.gov/vuln/detail/${id}`
              : `https://osv.dev/vulnerability/${id}`;

          md += `- **[${sev}]** \`${v.module}\` - ${v.title}\n`;
          md += `  - **ID:** ${id}\n`;
          if (v.source) md += `  - **Source:** ${v.source.join(", ")}\n`;
          md += `  - **Intel:** [Read Mitigation Report](${intelUrl})\n`;
        });
        md += `\n`;
      }

      if (outds.length > 0) {
        md += `#### ⬆️ Outdated Packages (${outds.length})\n`;
        md += `| Package | Current | Latest | Bump |\n|---|---|---|---|\n`;
        outds.forEach((p) => {
          const bumpEmote =
            p.bump === "major" ? "🔴" : p.bump === "minor" ? "🟡" : "⚪";
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
  },
};
