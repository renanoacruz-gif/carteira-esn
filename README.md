# Gestão de Carteira TOTVS ESN — versão hospedada (uso interno)

Um endereço único: app + API + banco. Login pelo Cloudflare Access, só e-mail `@totvs.com.br`.
Cada executivo tem carteira privada e chave de IA própria; o catálogo de soluções é compartilhado.

## Implantação (≈15 min, plano gratuito)

Requisitos: conta Cloudflare (gratuita), Node 18+.

1. `cd hosted` · `npx wrangler login`
2. `npx wrangler d1 create carteira-esn` → copie o `database_id` para `wrangler.toml`.
3. Em `wrangler.toml`, troque `ADMIN_EMAILS` pelo seu e-mail TOTVS (admin pode excluir registros do catálogo criados por outros).
4. `bash deploy.sh` (cria a tabela e publica). A saída mostra a URL `https://carteira-esn.<sua-conta>.workers.dev`.
5. **Não divulgue a URL ainda.** Sem Access a API recusa tudo (401), mas a página do app fica pública: faça o passo 6 em seguida.
6. Proteger com Access: Cloudflare → *Workers & Pages* → `carteira-esn` → *Access* → *Protect this Worker*.
   Política **Allow** → *Include* → **Emails ending in** `@totvs.com.br`. (Se pedir, crie a organização Zero Trust: plano Free, até 50 usuários.)
   Método de login: *One-time PIN* (código enviado ao e-mail) funciona sem configurar nada.
7. Verificar (abra em janela anônima):
   - com e-mail TOTVS → abre o app; `…/api/me` devolve `"hospedado":true` e seu e-mail;
   - com e-mail de outro domínio → bloqueado pelo Access (e, se passasse, a API devolve `dominio_nao_permitido`).
8. Compartilhe a URL com os executivos. Cada um: *Integrações → Minhas chaves de IA* → cola a sua chave (Gemini, OpenAI ou Anthropic) → *Testar*.

A primeira pessoa que abrir o app carrega o catálogo base (marcado "base inicial"). Depois, qualquer solução adicionada por link/manual aparece para todos como **"adicionado por X • não validado"** até alguém marcar *Validado*.

## Como funciona (segurança)

| Item | Regra |
|---|---|
| Entrada | Access (borda Cloudflare) + o Worker confere e-mail e domínio (`ALLOWED_DOMAIN`) a cada chamada |
| Carteira | `data/users/<e-mail>/…` só acessível pelo próprio e-mail (regra no servidor, não no app) |
| Catálogo | todos leem e gravam; autoria (`criadoPor`/`alteradoPor`) definida pelo servidor; versão `cv` impede sobrescrita silenciosa (409 → o app relê e mescla); exclusão só do criador ou admin |
| Chave de IA | fica no `localStorage` do navegador do executivo; vai em cabeçalho a cada pedido; o servidor não grava nem registra; não entra em backup |
| Dados de cliente | nunca vão ao catálogo (barreira existente no app); vão ao provedor de IA só quando o executivo autoriza o envio |
| `ALLOW_TEST_USER` | existe só para teste local. **Nunca defina em produção.** |

**Atenção — responsabilidade:** quem administra a conta Cloudflare (banco D1) tem acesso técnico a todas as carteiras. Os dados ficam fora da infraestrutura da TOTVS; mantenha a aprovação formal da TOTVS e, quando houver banco corporativo, migre (o formato é JSON por documento).

## Operação

- Backup: `npx wrangler d1 export carteira-esn --remote --output=backup.sql` (semanal). O app também exporta backup JSON por executivo.
- Atualizar o app: gerar novo pacote → `bash deploy.sh` (o banco não é tocado).
- Limites gratuitos: Workers 100 mil requisições/dia; D1 com limites diários de leitura/gravação (veja *D1 → Metrics*); Access até 50 usuários. O app consulta o catálogo a cada 45 s só com a aba visível.
- Remover um executivo: tire o e-mail da política do Access (os dados dele ficam no banco até você apagá-los: `DELETE FROM docs WHERE owner='x@totvs.com.br'`).

## Problemas comuns

- `nao_autorizado` em `/api/me`: o Access não está ligado ao Worker (passo 6).
- `sem_banco`: `database_id` errado ou tabela não criada (passo 4).
- "Sessão do Cloudflare Access expirada": recarregue a página.
- Salvar com erro `conflito` repetido: duas pessoas editando o mesmo registro; recarregue.
- Página manual do backend (APP_TOKEN opcional): `…/backend`.
