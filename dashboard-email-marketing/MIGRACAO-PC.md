# Continuidade do dashboard LATAM em outro PC

Este repositório contém o código-fonte do dashboard. A versão publicada na
Cloudflare não substitui este repositório. Os dados de campanhas e as peças
salvas estão no projeto Supabase; não são copiados junto com o código.

## Antes de desligar o PC antigo

1. Preserve o commit atual e os arquivos `dashboard-codigo.zip` e
   `dashboard-historico.bundle` do pacote de migração em armazenamento externo
   seguro. Verifique os hashes SHA-256 depois da cópia.
2. Preserve separadamente as planilhas originais. A pasta `Bases` deste
   workspace contém janeiro a junho de 2026. Localize também as planilhas
   originais usadas nas cargas de julho em diante; elas não estão nessa pasta.
3. Confirme que possui acesso às contas Cloudflare, Supabase e ao destino Git
   definitivo. Não inclua tokens, senhas ou arquivos `.env` no repositório.
4. Não apague este PC até validar o projeto e os arquivos no novo computador.

## No novo PC

1. Instale Node.js 22.13 ou superior e Git.
2. Clone o repositório definitivo, ou extraia `dashboard-codigo.zip` e
   restaure o histórico a partir de `dashboard-historico.bundle` se necessário.
3. Na raiz do projeto, execute `npm ci` e `npm run build`.
4. Configure autenticação na Cloudflare em sua própria conta, sem copiar tokens
   em texto aberto. O Worker de produção é `dashboard-latam`; os segredos de
   execução já estão cadastrados nele. Confirme os nomes/ambiente antes de
   qualquer publicação.
5. Confirme a conexão de leitura com o mesmo projeto Supabase e compare os
   indicadores exibidos no dashboard antes de realizar uma nova carga.

## Estado conhecido ao preparar esta migração

- `npm run build` passa.
- `npm test` falha em dois testes antigos de renderização: um tenta carregar
  `cloudflare:` diretamente no Node.js e outro espera a estrutura do antigo
  starter. Isso não foi alterado como parte da migração.
- O remoto Git configurado nesta máquina era `git.chatgpt-team.site` e não
  respondeu durante a preparação. Um commit local ou um pacote de backup não
  significa que o código já esteja salvo fora deste PC.
- Nenhuma alteração no banco Supabase nem no Worker de produção faz parte
  desta migração.
