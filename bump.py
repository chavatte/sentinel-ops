import sys
import re
import os
import subprocess

FILES = [
    "README.md",
    "README.pt-br.md",
    "src/static/index.html"
]

def get_current_version():
    try:
        with open("src/static/index.html", "r", encoding="utf-8") as f:
            content = f.read()
            match = re.search(r"\[VERSION (\d+\.\d+\.\d+)\]", content)
            if match:
                return match.group(1)
    except FileNotFoundError:
        pass
    print("Erro: Não foi possível encontrar a versão atual no index.html")
    sys.exit(1)

def bump_version(current, bump_type):
    major, minor, patch = map(int, current.split("."))
    
    if bump_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif bump_type == "minor":
        minor += 1
        patch = 0
    elif bump_type == "patch":
        patch += 1
        
    return f"{major}.{minor}.{patch}"

def update_files(old_version, new_version):
    for filepath in FILES:
        if not os.path.exists(filepath):
            print(f"Aviso: Arquivo {filepath} não encontrado. Ignorando.")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        content = content.replace(f"[VERSION {old_version}]", f"[VERSION {new_version}]")
        content = content.replace(f"version-{old_version}-00ff41", f"version-{new_version}-00ff41")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
        print(f"✅ Arquivo atualizado: {filepath}")

def run_command(command):
    print(f"\n⚙️  Executando: {command}")
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    
    for line in process.stdout:
        print(line, end="")
        
    process.wait()
    if process.returncode != 0:
        print(f"\n❌ Erro ao executar o comando (Código {process.returncode})")
        sys.exit(1)
    print("✅ Comando concluído com sucesso!\n")

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ["major", "minor", "patch"]:
        print("Uso correto: python bump.py [major|minor|patch]")
        sys.exit(1)

    bump_type = sys.argv[1]
    current_version = get_current_version()
    new_version = bump_version(current_version, bump_type)
    
    print(f"🚀 Atualizando versão: {current_version} -> {new_version}")
    update_files(current_version, new_version)
    print(f"🎉 Textos da versão {new_version} aplicados com sucesso!\n")
    print("-" * 50)
    resposta_build = input("🐳 Deseja fazer o BUILD da nova imagem Docker agora? (S/n): ").strip().lower()
    
    if resposta_build in ['', 's', 'sim', 'y', 'yes']:
        build_cmd = f"docker build -t chavatte/sentinel-ops:latest -t chavatte/sentinel-ops:{new_version} ."
        run_command(build_cmd)
        
        print("-" * 50)
        resposta_push = input("☁️  Deseja fazer o PUSH para o Docker Hub agora? (S/n): ").strip().lower()
        if resposta_push in ['', 's', 'sim', 'y', 'yes']:
            run_command("docker push chavatte/sentinel-ops:latest")
            run_command(f"docker push chavatte/sentinel-ops:{new_version}")
            print(f"🏆 Lançamento da versão {new_version} finalizado 100%!")
        else:
            print("Push cancelado. Você pode enviar a imagem manualmente depois.")
    else:
        print("Build cancelado. Os textos foram atualizados, mas a imagem do Docker não foi regerada.")