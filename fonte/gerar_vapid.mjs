/* Gera o par de chaves VAPID do lembrete diário. Uso: node gerar_vapid.mjs
   Cadastre os dois valores como SEGREDOS no Cloudflare (Workers → carteira-esn → Settings → Variables and Secrets → Secret). Não grave no repositório. */
import { webcrypto as c } from 'node:crypto';
const k = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const j = await c.subtle.exportKey('jwk', k.privateKey), b = s => Buffer.from(s, 'base64url');
console.log('VAPID_PUBLIC=' + Buffer.concat([Buffer.from([4]), b(j.x), b(j.y)]).toString('base64url'));
console.log('VAPID_PRIVATE=' + j.d);
