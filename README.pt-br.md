<pre style="font-size: 0.6rem;">

                              \\\\\\
                           \\\\\\\\\\\\
                          \\\\\\\\\\\\\\\
-------------,-|           |C>   // )\\\\|    .o88b. db   db  .d8b.  db    db  .d8b.  d888888b d888888b d88888b
           ,','|          /    || ,'/////|   d8P  Y8 88   88 d8' '8b 88    88 d8' '8b '~~88~~' '~~88~~' 88'  
---------,','  |         (,    ||   /////    8P      88ooo88 88ooo88 Y8    8P 88ooo88    88       88    88ooooo 
         ||    |          \\  ||||//''''|    8b      88~~~88 88~~~88 '8b  d8' 88~~~88    88       88    88~~~~~ 
         ||    |           |||||||     _|    Y8b  d8 88   88 88   88  '8bd8'  88   88    88       88    88.   
         ||    |______      ''''\____/ \      'Y88P' YP   YP YP   YP    YP    YP   YP    YP       YP    Y88888P
         ||    |     ,|         _/_____/ \
         ||  ,'    ,' |        /          |                 ___________________________________________
         ||,'    ,'   |       |         \  |              / \                                           \ 
_________|/    ,'     |      /           | |             |  |  A P I                                     | 
_____________,'      ,',_____|      |    | |              \ |      Portfolio Chavatte                    | 
             |     ,','      |      |    | |                |                        chavatte.42web.io   | 
             |   ,','    ____|_____/    /  |                |    ________________________________________|___
             | ,','  __/ |             /   |                |  /                                            /
_____________|','   ///_/-------------/   |                 \_/____________________________________________/ 
              |===========,'                              
			  

</pre>

<div align="center">

<img src="./assets/logo.png" alt="Sentinel Ops" style="margin: 10px;">

# 🛡️ Sentinel Ops

> **Chavatte Security Operations Center**
> Monitor de Ameaças e Vulnerabilidades Avançado para Ecossistemas Node.js

![Version](https://img.shields.io/badge/version-2.0.0-00ff41?style=for-the-badge&logo=security)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker)
![License](https://img.shields.io/badge/License-MIT-orange?style=for-the-badge)

O **Sentinel Ops** é uma ferramenta de Inteligência de Ameaças (Threat Intelligence) e auditoria de segurança contínua projetada para Home Labs, servidores CasaOS e equipes de DevSecOps. Ele monitora repositórios Git, verifica árvores de dependências, rastreia débitos técnicos e alerta sobre vulnerabilidades (CVEs/GHSAs) através de um HUD Cyberpunk interativo.

</div>

---

## ✨ Principais Funcionalidades

* **🗄️ Configuração Dinâmica (UI & SQLite):** Diga adeus aos arquivos YAML. Gerencie repositórios, ative/desative scans e mantenha o histórico de ameaças diretamente pela Interface Web (`SYS_CONFIG`).
* **📊 Threat Analytics:** Visualização de dados interativa (via ApexCharts) monitorando MTTR (Mean Time To Resolve), Distribuição de Severidade e Projetos de Alto Risco.
* **🕵️‍♂️ Compatibilidade Universal:** Detecta e audita de forma transparente ambientes **NPM**, **Yarn (Clássico e Berry v4+)** e **PNPM**.
* **🌐 Integração OSV-Scanner:** Realiza varreduras profundas usando o banco de dados `OSV.dev` do Google, capturando ameaças ignoradas pelas auditorias nativas.
* **🎯 Threat Intel Dinâmico:** Links gerados automaticamente para relatórios oficiais de mitigação (NIST NVD, GitHub Advisories, OSV).
* **📄 Exportação de Relatório:** Geração instantânea de relatórios táticos em formato Markdown (`.md`) para facilitar o trabalho das equipes de Red/Blue Team.
* **⚡ Ultra Rápido (Sparse Checkout):** Não clona o repositório inteiro. Baixa apenas os manifestos (`package.json`, `lockfiles`) isolados na memória.
* **🔑 Suporte Híbrido:** Funciona nativamente com repositórios privados (via SSH) e públicos (via HTTPS).

---

## 🚀 Instalação Rápida (Docker Compose)

### 1. Estrutura de Pastas

Crie uma pasta para o projeto e dentro dela a seguinte estrutura:

```text
/sentinel-ops
├── docker-compose.yml
└── ssh/                # (Opcional) Suas chaves SSH privadas
```

### 2. Configuração (`docker-compose.yml`)

**YAML**

```
version: "3.8"
services:
  sentinel-ops:
    image: chavatte/sentinel-ops:latest
    container_name: sentinel-ops
    restart: unless-stopped
    ports:
      - "9393:8080"
    dns:
      - 8.8.8.8
      - 1.1.1.1
    environment:
      - SCAN_INTERVAL=21600 # Tempo em segundos (6 horas)
      - TZ=America/Sao_Paulo
    volumes:
      - ./ssh:/ssh:ro
      - sentinel_data:/data # O banco SQLite fica salvo aqui

volumes:
  sentinel_data:
```

### 3. Executando e Configurando

**Bash**

```
docker-compose up -d
```

1. Acesse o seu Dashboard SecOps em: `http://localhost:9393`
2. Clique no botão **`SYS_CONFIG`** no painel superior.
3. Cadastre os repositórios diretamente pela interface (Não é mais necessário editar arquivos YAML).

---

## 🛡️ Transparência SecOps & Segurança da Imagem Docker

Como uma ferramenta focada em segurança cibernética, o Sentinel Ops mantém rigorosa transparência sobre a sua própria cadeia de suprimentos ( *Supply Chain* ) de containers. Se você auditar nossa imagem Docker usando ferramentas como Docker Scout ou Trivy, poderá notar algumas CVEs sinalizadas. Estas vulnerabilidades estão mapeadas e são classificadas estritamente como  **Riscos Aceitos de Terceiros (Accepted Third-Party Risks)** :

* **Google OSV-Scanner (vulnerabilidades `golang`):** Nós buscamos o binário oficial mais recente do `osv-scanner` diretamente das *releases* do Google. Quaisquer CVEs relacionadas ao Golang sinalizadas neste binário são dependências upstream gerenciadas internamente pelo Google.
* **Alpine & NPM (`tar`, `minimatch`, etc.):** Nossa base utiliza a imagem fortificada `python:3.14-alpine` e força atualizações globais do NPM para minimizar a superfície de ataque. No entanto, dependências do gerenciador do SO podem disparar alertas de nível moderado.

*Fique tranquilo: O Sentinel Ops é executado em subprocessos isolados. Esses falsos-positivos não oferecem qualquer vetor de ataque aos seus repositórios ou servidor.*

---

## 🔑 Configuração de SSH (Para Repos Privados)

Se você precisa auditar repositórios privados (GitHub, GitLab, Bitbucket):

1. Copie sua chave privada (ex: `id_rsa`) para a pasta `./ssh`.
2. No painel  **`SYS_CONFIG`** , preencha o campo `Chave SSH` com o caminho `/ssh/nome-do-arquivo` (ex: `/ssh/id_rsa`).
3. **Segurança:** O Sentinel Ops copia sua chave para uma área temporária segura e aplica permissões restritas (`chmod 600`) automaticamente.
4. *Não é necessário configurar arquivos `known_hosts` manualmente.*

---

## 🛠️ Desenvolvimento (Manual)

Se quiser rodar fora do Docker ou contribuir com o código:

**Pré-requisitos:** Python 3.11+, Git, Node.js, Corepack (Yarn/PNPM) e OSV-Scanner instalados.

**Bash**

**Bash**

```
# 1. Clone este repositório
git clone https://github.com/chavatte/sentinel-ops.git
# 2. Instale as dependências Python
pip install -r requirements.txt

# 3. Inicie o servidor
python3 src/main.py
```

---

## 📝 Licença

Este projeto é distribuído sob a licença  **MIT** . Consulte o arquivo `LICENSE` para mais detalhes.

---

CHAVATTE SECURITY

Desenvolvido por @DevChavatte
