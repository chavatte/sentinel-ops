import { api } from "./modules/api.js";
import { utils } from "./modules/utils.js";
import { ui } from "./modules/ui.js";

const DOM = {
  btn: document.getElementById("btn"),
  meta: document.getElementById("meta"),
  grid: document.getElementById("grid"),
  btnReport: document.getElementById("btn-report"),
  metricsBar: document.getElementById("metrics-bar"),
  btnConfig: document.getElementById("btn-config"),
  modal: document.getElementById("config-modal"),
  btnCloseModal: document.getElementById("btn-close-modal"),
  repoForm: document.getElementById("repo-form"),
  repoList: document.getElementById("repo-list"),
  btnAnalytics: document.getElementById("btn-analytics"),
  modalAnalytics: document.getElementById("analytics-modal"),
  btnCloseAnalytics: document.getElementById("btn-close-analytics"),
};

let state = {
  isScanning: false,
  pollTimer: null,
  lastData: null,
  lastMetrics: null,
};

async function fetchFullStatus() {
  try {
    const data = await api.getStatus();
    state.lastData = data;

    if (data.running && !state.isScanning) {
      state.isScanning = true;
      ui.setScanningState(true, DOM);
      startPolling();
      return;
    } else if (!data.running && state.isScanning) {
      state.isScanning = false;
      ui.setScanningState(false, DOM);
      stopPolling();
    }

    if (!state.isScanning) {
      ui.renderGrid(data, DOM);
      if (data.results && data.results.length > 0)
        DOM.btnReport.style.display = "flex";

      try {
        const metrics = await api.getMetrics();
        state.lastMetrics = metrics;
        ui.renderMetrics(metrics, DOM);
      } catch (e) {
        console.error(e);
      }
    }
  } catch (e) {
    if (!state.isScanning)
      DOM.meta.innerHTML =
        '<span class="text-bad">:: CONNECTION LOST ::</span>';
  }
}

function startPolling() {
  if (state.pollTimer) return;
  state.pollTimer = setInterval(fetchFullStatus, 2500);
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

DOM.btn.addEventListener("click", async () => {
  try {
    state.isScanning = true;
    ui.setScanningState(true, DOM);
    await api.run();
    startPolling();
  } catch (e) {
    alert("Erro ao iniciar: " + e.message);
    state.isScanning = false;
    ui.setScanningState(false, DOM);
  }
});

DOM.btnReport.addEventListener("click", () => {
  if (!state.lastData) {
    alert("Nenhum dado disponível. Aguarde o scan.");
    return;
  }
  utils.generateMarkdownReport(state.lastData, state.lastMetrics);
});

async function refreshRepoList() {
  DOM.repoList.innerHTML =
    '<div style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Lendo banco...</div>';
  try {
    const repos = await api.getRepos();
    ui.renderRepoList(repos, DOM.repoList);
  } catch (e) {
    DOM.repoList.innerHTML =
      '<div class="text-bad">Erro ao conectar com o cofre.</div>';
  }
}

DOM.btnConfig.addEventListener("click", () => {
  DOM.modal.style.display = "flex";
  refreshRepoList();
});

DOM.btnCloseModal.addEventListener(
  "click",
  () => (DOM.modal.style.display = "none"),
);

DOM.repoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    id: document.getElementById("repo-id").value,
    name: document.getElementById("repo-name").value,
    git: document.getElementById("repo-git").value,
    ssh_key: document.getElementById("repo-ssh").value,
  };
  await api.addRepo(payload);
  DOM.repoForm.reset();
  refreshRepoList();
});

DOM.repoList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === "delete" && confirm(`Desativar defesa no setor ${id}?`)) {
    await api.deleteRepo(id);
    refreshRepoList();
  } else if (action === "toggle") {
    await api.toggleRepo(id);
    refreshRepoList();
  }
});

DOM.btnAnalytics.addEventListener("click", () => {
  if (state.lastMetrics) {
    DOM.modalAnalytics.style.display = "flex";
    ui.renderAnalytics(state.lastMetrics);
  } else {
    alert("Aguarde o primeiro scan para gerar as métricas.");
  }
});

DOM.btnCloseAnalytics.addEventListener("click", () => {
  DOM.modalAnalytics.style.display = "none";
});

DOM.modalAnalytics.addEventListener("click", (e) => {
  if (e.target === DOM.modalAnalytics) {
    DOM.modalAnalytics.style.display = "none";
  }
});

async function checkForSystemUpdates() {
  const updateInfo = await api.checkUpdate();
  if (updateInfo && updateInfo.update_available) {
    const banner = document.getElementById("update-banner");
    document.getElementById("update-version").innerText =
      `v${updateInfo.latest_version}`;
    banner.style.display = "flex";
  }
}

fetchFullStatus();
checkForSystemUpdates();
