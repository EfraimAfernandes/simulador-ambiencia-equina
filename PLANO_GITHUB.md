# Plano de Publicação no GitHub

> Objetivo: disponibilizar o **Simulador de Ambiência Equina** como projeto aberto
> para que alunos do mundo inteiro possam testar a lógica de controle Arduino,
> verificar o funcionamento do firmware e simular cenários sem precisar de hardware.

---

## 1. Pré-requisitos

- [x] Comentários de autoria adicionados (app.ts, style.css, index.html, package.json, .ino)
- [x] `.gitignore` criado (node_modules, dist, build, release, .vscode, logs)
- [x] `README.md` criado (bilíngue PT/EN)
- [ ] Conta no [GitHub](https://github.com)
- [ ] Git instalado localmente (`git --version`)

> ⚠️ **Atenção:** os arquivos grandes (instaladores em `release/`, `bin/arduino-cli.exe`)
> **não** devem ir para o repositório (limite de 100 MB por arquivo). Eles já estão no
> `.gitignore` — publique-os como **GitHub Releases** (passo 7).

---

## 2. Inicializar o repositório local

Dentro da pasta `ProjetoAmbiencia/`:

```bash
git init
git add -A
git status        # confira se node_modules/ e release/ NÃO aparecem
```

Se algo grande aparecer, ajuste o `.gitignore` antes de commitar.

## 3. Primeiro commit

```bash
git commit -m "Simulador de Ambiência Equina — gêmeo digital termodinâmico e psicrométrico (UFR/ICAT)"
```

Dica: use uma mensagem descritiva e em português ou inglês, de forma consistente.

## 4. Criar o repositório no GitHub

1. Acesse github.com → **New repository**.
2. Nome sugerido: `simulador-ambiencia-equina` (ou `equine-ambience-simulator`).
3. Descrição: *"3D digital twin of an equine stable — thermodynamic & psychrometric simulation with Arduino (Web Serial) hardware-in-the-loop testing. UFR/ICAT."*
4. Deixe **público** (é o objetivo: alunos do mundo todo) e **não** marque a opção de criar README/.gitignore (já existem).
5. Copie a URL do repositório (HTTPS ou SSH).

## 5. Enviar (push)

```bash
git remote add origin https://github.com/SEU_USUARIO/simulador-ambiencia-equina.git
git branch -M main
git push -u origin main
```

> 🚨 Só execute `git push` quando você estiver pronto — ele publica o projeto publicamente.

## 6. (Recomendado) Publicar online de graça — GitHub Pages

Como o app é estático (Vite), dá para hospedar sem custo e sem instalar nada —
alunos acessam pelo link direto do navegador:

**Opção A — pela interface (mais simples):**
1. No repositório: **Settings → Pages**.
2. Em *Build and deployment → Source*, escolha **GitHub Actions**.
3. Crie `.github/workflows/deploy-pages.yml` (modelo abaixo) e faça push.

**Opção B — direto na sua máquina:**
```bash
npm run build                                    # gera dist/
npx gh-pages -d dist                             # publica na branch gh-pages
```
(requer `npm i -D gh-pages` e o comando `npx gh-pages` com permissão de push)

**Workflow GitHub Actions (modelo para o passo A):**

```yaml
# .github/workflows/deploy-pages.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

> Após o deploy, o simulador fica em `https://SEU_USUARIO.github.io/simulador-ambiencia-equina/`
> — acessível a qualquer aluno, no celular ou no computador.

## 7. Publicar os instaladores prontos (GitHub Releases)

Os instaladores Windows já gerados ficam em `ProjetoAmbiencia/release/`
(`Simulador de Ambiencia Equina Setup 1.0.0.exe` e `.msi`). Para disponibilizá-los:

1. GitHub → **Releases → Create a new release**.
2. Tag: `v1.0.0`.
3. Título: *"Simulador de Ambiência Equina 1.0.0"*.
4. Arraste os arquivos `.exe` e `.msi` como anexos (o GitHub aceita até 2 GB por release).

Assim, alunos podem baixar o app desktop sem precisar compilar nada.

## 8. Deixar o projeto atrativo (finalização)

- [ ] **Tópicos/tags** no repositório: `arduino`, `threejs`, `digital-twin`, `thermodynamics`, `vite`, `typescript`, `web-serial`, `equine-welfare`, `agricultural-engineering`, `education`.
- [ ] **Licença**: escolha uma (sugestões: MIT para código; CC BY 4.0 para documentação/imagens). Adicione o arquivo `LICENSE` — sem licença, legalmente ninguém pode reutilizar.
- [ ] **Badges** no README (build, versão, licença) — via shields.io.
- [ ] **Screenshot/GIF** da cena 3D no topo do README (vale mais que mil palavras).
- [ ] Atualizar o README com o **link do GitHub Pages** depois do deploy.
- [ ] Conferir que os créditos (UFR/ICAT, autores e orientador) aparecem no repositório e no README.

## 9. Checklist final antes do push

- [ ] `git status` limpo (sem `node_modules/`, `dist/`, `release/`, `bin/`)
- [ ] `npm run build` passando sem erros
- [ ] Simulador funcionando em `npm run dev` (cena 3D + painéis)
- [ ] Firmware `.ino` compilando no Arduino IDE
- [ ] README e créditos revisados
- [ ] Licença definida

---

## Riscos e cuidados

| Item | Cuidado |
|---|---|
| Arquivos grandes | Nunca dar `git add -A` se `release/` ou `bin/` não estiverem ignorados |
| Dados sensíveis | Conferir se não há senhas/tokens em `vite.config.ts`, scripts ou `.env` |
| Push acidental | O push é público e irreversível — revise o commit antes |
| Compartilhamento | Definir a licença para deixar claro como o projeto pode ser usado |
