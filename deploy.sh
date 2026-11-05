#!/usr/bin/env bash
# Uso: depois de preencher database_id e ADMIN_EMAILS no wrangler.toml:  bash deploy.sh
set -e
cd "$(dirname "$0")"
grep -q 'COLE_O_ID_AQUI' wrangler.toml && { echo 'Preencha database_id no wrangler.toml (saída de: npx wrangler d1 create carteira-esn).'; exit 1; }
grep -q 'seu.nome@totvs.com.br' wrangler.toml && { echo 'Troque ADMIN_EMAILS no wrangler.toml pelo seu e-mail @totvs.com.br.'; exit 1; }
grep -qE '^[[:space:]]*ALLOW_TEST_USER' wrangler.toml && { echo 'ALLOW_TEST_USER não pode existir no wrangler.toml de produção.'; exit 1; }
npx wrangler d1 execute carteira-esn --remote --file=schema.sql
npx wrangler deploy
echo
echo 'Publicado. Agora proteja com Cloudflare Access (README, passo 6) ANTES de divulgar o link.'
