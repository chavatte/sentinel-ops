# Repository Configuration / Configuração dos Repositórios

---

### 🇬🇧 English

This directory stores the `repos.yml` file, where you define which projects Sentinel Ops should audit.

**Format Examples:**

1. **Private Repo (Requires SSH):**
   ```yaml
   - id: my-private-project
     name: "Backend API"
     git: git@github.com:user/project.git
     ssh_key: /ssh/id_rsa
   ```


2. **Public Repo (HTTPS):**
   **YAML**

   ```
   - id: react-public
     name: "React Source"
     git: [https://github.com/facebook/react.git](https://github.com/facebook/react.git)
     # ssh_key: (leave empty or remove line)
   ```

---

### 🇧🇷 Português

Este diretório armazena o arquivo `repos.yml`, onde você define quais projetos o Sentinel Ops deve auditar.

**Exemplos de Formato:**

1. **Repositório Privado (Requer SSH):**
   **YAML**

   ```
   - id: meu-projeto-privado
     name: "Backend API"
     git: git@github.com:usuario/projeto.git
     ssh_key: /ssh/id_rsa
   ```
2. **Repositório Público (HTTPS):**
   **YAML**

   ```
   - id: react-publico
     name: "React Source"
     git: [https://github.com/facebook/react.git](https://github.com/facebook/react.git)
     # ssh_key: (deixe vazio ou remova a linha)
   ```
