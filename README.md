# JazzSide — Report Mensal e Dashboard LATAM

O dashboard publicado na Cloudflare tem seu código em `dashboard-email-marketing/`.
Os scripts Python e as validações na raiz são materiais históricos do processamento mensal.

## Dashboard atual

- Produção: https://dashboard-latam.jazzside.workers.dev
- Worker: `dashboard-latam`
- Supabase: projeto `fidfdgnnoqamhftczcer`.
- Stack: React, TypeScript, vinext/Vite e Cloudflare Workers.
- Dados atuais verificados em 06/10/2026: janeiro a setembro de 2026.

Para trabalhar em outro PC, clone este repositório e execute dentro da pasta do dashboard:

```powershell
cd dashboard-email-marketing
npm ci
npm run build
```

Use Node.js 22.13 ou superior. O build do código de referência passou no PC de migração.
O histórico Git do dashboard foi preservado junto ao histórico existente deste repositório.

A prévia local autenticada precisa de credenciais de desenvolvimento próprias. Os segredos
de produção continuam na Cloudflare e os dados continuam no Supabase. Arquivos `.env*`
e `.dev.vars*` com credenciais devem permanecer fora do Git.

Antes de publicar, confira a conta Cloudflare e o destino `dashboard-latam`.
O build atual gera o nome `latam-email-marketing-dashboard`; para usar o Worker existente,
é necessário fornecer explicitamente `--name dashboard-latam` ao comando de publicação.
A migração do código para este repositório não publica o Worker nem carrega dados no banco.

Consulte também `dashboard-email-marketing/MIGRACAO-PC.md` para o estado do backup e dos testes antigos.

## Scripts históricos

As instruções abaixo documentam o projeto Python original; seus caminhos do PC antigo
devem ser adaptados antes de executar qualquer script de processamento ou carga.

Projeto local para processar e enviar dados de marketing para o Supabase.

## Conteúdo

- `Base_Ouro_M1_a_M6.xlsx`: dados consolidados de Jan-Jun 2026
- `upload_supabase.py`: script de upload para Supabase usando cliente Python
- `upload_supabase_rest.py`: script de upload usando REST direto
- `supabase_inspect.py`: inspeciona a tabela Supabase
- `supabase_dashboard.py`: gera dashboard HTML local a partir da tabela
- `load_env.py`: carrega `.env`
- `.env`: credenciais e configurações locais (não deve ser versionada)
- `requirements.txt`: dependências Python
- `.gitignore`: ignorar arquivos sensíveis e outputs

## Como usar

1. Instale dependências Python:
   ```powershell
   python -m pip install -r requirements.txt
   ```

2. Garanta que `.env` contenha as credenciais corretas:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `SUPABASE_TABLE`

3. Inspecionar a tabela Supabase:
   ```powershell
   python supabase_inspect.py
   ```

4. Gerar dashboard local:
   ```powershell
   python supabase_dashboard.py --output supabase_dashboard.html
   ```

5. Fazer upload dos dados (quando o key de escrita estiver válido):
   ```powershell
   python upload_supabase.py --input-file Base_Ouro_M1_a_M6.xlsx
   ```

## Git e GitHub

No terminal atual, o comando `git` não está disponível. Para publicar este projeto no GitHub, instale o Git e, preferencialmente, o GitHub CLI.

### Instalar Git no Windows

- Baixe em: https://git-scm.com/download/win
- Após a instalação, abra um novo terminal e execute:
  ```powershell
  git --version
  ```

### Publicar no GitHub

Depois de instalar o Git:

```powershell
cd "C:\Users\adm\Documents\JazzSide\Report Mensal Local"
git init
git add .
git commit -m "Initial commit"
```

Se você tiver o GitHub CLI (`gh`), pode criar e conectar ao repositório:

```powershell
gh repo create jazzside-report-mensal --public --source . --remote origin
git push -u origin main
```

Se não tiver o GitHub CLI, crie o repo no GitHub pelo navegador e então:

```powershell
git remote add origin https://github.com/<seu-usuario>/jazzside-report-mensal.git
git push -u origin main
```

## Observação

A chave real de `service_role` deve ser usada apenas localmente e não deve ser comprometida em repositórios públicos.
