import os
import shutil
import time
import subprocess
import json
from config import DATA_DIR, SSH_DIR
import parsers


class RepoAuditor:
    def __init__(self, repo_config):
        self.id = repo_config["id"]
        self.name = repo_config["name"]
        self.url = repo_config["git"]
        self.ssh_key = repo_config.get("ssh_key")
        self.work_dir = os.path.join(DATA_DIR, "repos", self.id)
        self.manager = "unknown"

    def _prepare_ssh_key(self):
        if not self.ssh_key:
            return None
        original_path = (
            self.ssh_key
            if self.ssh_key.startswith("/")
            else os.path.join(SSH_DIR, self.ssh_key)
        )

        if not os.path.exists(original_path):
            print(f"DEBUG: Chave não encontrada em {original_path}")
            return None

        safe_key_path = os.path.join("/tmp", f"key_{self.id}")
        try:
            shutil.copyfile(original_path, safe_key_path)
            os.chmod(safe_key_path, 0o600)
            uid = os.getuid()
            os.chown(safe_key_path, uid, uid)
        except Exception as e:
            print(f"Erro preparando chave SSH para {self.name}: {e}")
            return None
        return safe_key_path

    def _get_ssh_command(self, key_path):
        cmd = "ssh -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o PubkeyAcceptedKeyTypes=+ssh-rsa"
        if key_path:
            cmd += f" -i {key_path}"
        return cmd

    def _exec(self, cmd_list, cwd, env):
        print(f"[{self.name}] Executando: {' '.join(cmd_list)}")
        p = subprocess.run(cmd_list, cwd=cwd, env=env, capture_output=True, text=True)
        if p.returncode != 0:
            err_msg = p.stderr.strip() or p.stdout.strip() or "Sem mensagem de erro"
            raise Exception(f"Comando falhou: {' '.join(cmd_list)} | Erro: {err_msg}")
        return p

    def run(self):
        result = {
            "id": self.id,
            "name": self.name,
            "ok": False,
            "manager": "unknown",
            "audit": {"high": 0, "critical": 0},
            "audit_items": [],
            "outdated": [],
            "error": None,
            "timestamp": int(time.time()),
        }
        safe_key = None
        try:
            subprocess.run(
                ["git", "config", "--global", "--add", "safe.directory", "*"],
                check=False,
            )
            safe_key = self._prepare_ssh_key()

            if os.path.exists(self.work_dir):
                shutil.rmtree(self.work_dir)
            os.makedirs(self.work_dir, exist_ok=True)

            env = os.environ.copy()
            env["GIT_SSH_COMMAND"] = self._get_ssh_command(safe_key)
            env["CI"] = "true" 
            env["YARN_ENABLE_TELEMETRY"] = "0"

            self._exec(["git", "init", "-q"], self.work_dir, env)
            self._exec(["git", "remote", "add", "origin", self.url], self.work_dir, env)
            self._exec(
                ["git", "config", "core.sparseCheckout", "true"], self.work_dir, env
            )

            git_info = os.path.join(self.work_dir, ".git/info")
            os.makedirs(git_info, exist_ok=True)
            
            with open(os.path.join(git_info, "sparse-checkout"), "w") as f:
                f.write("package.json\nyarn.lock\n.yarnrc.yml\n.yarn/releases/\n.yarn/plugins/\npackage-lock.json\npnpm-lock.yaml\n")

            self._exec(
                ["git", "fetch", "--depth=1", "origin", "HEAD"], self.work_dir, env
            )
            self._exec(["git", "checkout", "FETCH_HEAD"], self.work_dir, env)
            
            os.makedirs(os.path.join(self.work_dir, ".yarn", "releases"), exist_ok=True)
            os.makedirs(os.path.join(self.work_dir, ".yarn", "plugins"), exist_ok=True)

            if not os.path.exists(os.path.join(self.work_dir, "package.json")):
                raise FileNotFoundError("package.json não encontrado")

            yarn_lock_path = os.path.join(self.work_dir, "yarn.lock")
            if os.path.exists(yarn_lock_path):
                with open(yarn_lock_path, "r", encoding="utf-8") as f_lock:
                    header = f_lock.read(200)
                    if "__metadata" in header:
                        self.manager = "yarn_berry"
                    else:
                        self.manager = "yarn"
            elif os.path.exists(os.path.join(self.work_dir, "pnpm-lock.yaml")):
                self.manager = "pnpm"
            else:
                self.manager = "npm"
                
            result["manager"] = self.manager
            
            if self.manager == "yarn_berry":
                proc_ver = subprocess.run(
                    ["yarn", "--version"], 
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                yarn_version = proc_ver.stdout.strip()
                
                major_version = 4
                if yarn_version and "." in yarn_version:
                    try:
                        major_version = int(yarn_version.split(".")[0])
                    except:
                        pass
                
                print(f"[{self.name}] Detetado Yarn v{yarn_version}. Preparando ambiente...")

                plugin_url = f"https://go.mskelton.dev/yarn-outdated/v{major_version}"
                
                self._exec(
                    ["yarn", "plugin", "import", plugin_url],
                    self.work_dir, env
                )
                
                print(f"[{self.name}] Analisando pacotes desatualizados (Yarn Berry)...")
                proc_out = subprocess.run(
                    ["yarn", "outdated", "--json"],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                parsers.parse_yarn_berry_outdated(proc_out.stdout, result)

                print(f"[{self.name}] Auditando vulnerabilidades (Yarn Berry)...")
                proc_audit = subprocess.run(
                    ["yarn", "npm", "audit", "--all", "--recursive", "--json"],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                parsers.parse_yarn_berry_audit(proc_audit.stdout, result)

            elif self.manager == "yarn":
                print(f"[{self.name}] Analisando pacotes desatualizados (Yarn Clássico)...")
                proc_out = subprocess.run(
                    ["yarn", "outdated", "--json"],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                parsers.parse_yarn_outdated(proc_out.stdout, result)
                
                print(f"[{self.name}] Auditando vulnerabilidades (Yarn Clássico)...")
                proc_audit = subprocess.run(
                    ["yarn", "audit", "--json"],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                parsers.parse_yarn_audit(proc_audit.stdout, result)

            elif self.manager == "pnpm":
                self._exec(["corepack", "use", "pnpm@latest"], self.work_dir, env)
                
                print(f"[{self.name}] Analisando pacotes desatualizados (PNPM)...")
                proc_out = subprocess.run(
                    ["pnpm", "outdated", "--json"],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                parsers.parse_npm_outdated(proc_out.stdout, result)
                
                print(f"[{self.name}] Auditando vulnerabilidades (PNPM)...")
                proc_audit = subprocess.run(
                    ["pnpm", "audit", "--json"],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                parsers.parse_pnpm_audit(proc_audit.stdout, result)

            else:
                print(f"[{self.name}] Analisando pacotes desatualizados (NPM)...")
                proc_out = subprocess.run(
                    ["npm", "outdated", "--json"],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                parsers.parse_npm_outdated(proc_out.stdout, result)
                
                print(f"[{self.name}] Auditando vulnerabilidades (NPM)...")
                proc_audit = subprocess.run(
                    ["npm", "audit", "--json"],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                try:
                    parsers.parse_npm_audit_tree(
                        json.loads(proc_audit.stdout).get("vulnerabilities", {}), result
                    )
                except:
                    pass
                
            print(f"[{self.name}] Realizando varredura avançada com OSV-Scanner...")
            lockfile_map = {
                "yarn": "yarn.lock",
                "yarn_berry": "yarn.lock",
                "pnpm": "pnpm-lock.yaml",
                "npm": "package-lock.json"
            }
            
            target_lockfile = lockfile_map.get(self.manager)
            if target_lockfile and os.path.exists(os.path.join(self.work_dir, target_lockfile)):
                proc_osv = subprocess.run(
                    ["osv-scanner", "--format", "json", "--lockfile", target_lockfile],
                    cwd=self.work_dir, capture_output=True, text=True, env=env
                )
                
                if not proc_osv.stdout.strip() and proc_osv.stderr.strip():
                    print(f"[{self.name}] ⚠️ OSV-Scanner falhou: {proc_osv.stderr.strip()}")
                    
                parsers.parse_osv_audit(proc_osv.stdout, result)

            result["ok"] = (
                result["audit"]["high"] == 0 and result["audit"]["critical"] == 0
            )

        except Exception as e:
            result["error"] = str(e)
            print(f"Erro em {self.name}: {e}")

        if os.path.exists(self.work_dir):
            shutil.rmtree(self.work_dir)
        if safe_key and os.path.exists(safe_key):
            try:
                os.remove(safe_key)
            except:
                pass

        return result