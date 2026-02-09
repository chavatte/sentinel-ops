
# SSH Keys Configuration / Configuração de Chaves SSH

---

### 🇬🇧 English

**⚠️ SECURITY WARNING:** Never commit your real private keys to this repository. This folder serves only as a mount point (Volume) for Docker.

**How to use:**

1. Place your private SSH keys in this folder (or map your local `~/.ssh` here via Docker Compose).
2. The key filename must match exactly the path defined in your `repos.yml`.

**Example:**
If `config/repos.yml` has `ssh_key: /ssh/id_rsa`, you must have a file named `id_rsa` inside this folder.

---

### 🇧🇷 Português

**⚠️ AVISO DE SEGURANÇA:** Nunca faça commit de suas chaves privadas reais neste repositório. Esta pasta serve apenas como ponto de montagem (Volume) para o Docker.

**Como usar:**

1. Coloque suas chaves SSH privadas nesta pasta.
2. O nome do arquivo da chave deve corresponder exatamente ao caminho definido no seu `repos.yml`.

**Exemplo:**
Se no `config/repos.yml` você tem `ssh_key: /ssh/id_rsa`, deve haver um arquivo chamado `id_rsa` nesta pasta.
