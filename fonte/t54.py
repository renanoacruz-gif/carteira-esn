from t40_lib import *
import uuid
email='tk%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]')
K='c_T00001'
info=pg.evaluate("k=>{const c=S.clients[k];const o=c.opps.find(o=>o.sols&&o.sols.length);return o?{r:o.ruleId,s:o.sols[0].id,n:o.sols[0].nome}:null}",K)
print(info)
card=lambda: pg.evaluate("a=>{const c=S.clients[a.k];const o=c.opps.find(o=>o.ruleId===a.r);const d=document.createElement('div');d.innerHTML=oppCard(c,o);return d.innerText}",{'k':K,'r':info['r']})
ck('sem ticket: card mostra "Não estimado"', 'não estimado' in card().lower() and 'referência comercial' in card().lower())
ck('catálogo nasce sem tickets', ev(pg,"!S.meta.tickets||!Object.keys(S.meta.tickets).length"))
S=info['s']
def add(**d):
    base=dict(valor='1.250,00',moeda='BRL',natureza='Recorrente',origem='Proposta enviada ao cliente',data='2026-09-10',tipo='referencia',cli='',nota='')
    base.update(d); pg.evaluate("a=>tkAdd(a.s,a.d)",{'s':S,'d':base})
n=lambda: ev(pg,"tkOf('%s').length"%S)
add(valor='0'); ck('valor zero rejeitado', n()==0 and ev(pg,"UI.tkErr&&UI.tkErr.e.some(x=>/valor/i.test(x))"))
add(valor='abc'); ck('valor não numérico rejeitado', n()==0)
add(data='2026-02-31'); ck('data inexistente rejeitada', n()==0)
add(data='2099-01-01'); ck('data futura rejeitada', n()==0)
add(tipo='confirmado',origem='Referência interna do executivo'); ck('confirmado c/ origem interna rejeitado', n()==0)
add(moeda='XYZ'); ck('moeda inválida rejeitada', n()==0)
add(natureza='Qualquer'); ck('natureza inválida rejeitada', n()==0)
add(); ck('registro válido aceito', n()==1, ev(pg,"UI.tkErr"))
ck('valor "1.250,00" interpretado como 1250', ev(pg,"tkOf('%s')[0].valor"%S)==1250)
c=card(); ck('card mostra valor, natureza, tipo e origem', 'R$' in c and '1.250,00' in c and 'recorrente' in c.lower() and 'referência interna' in c.lower() and 'proposta enviada' in c.lower(), c[:80])
ck('card avisa que não é previsão/ROI', 'não é proposta, previsão de receita' in c.lower())
# outro cliente: ticket atrelado a K2 não vale para K
K2=pg.evaluate("k=>Object.keys(S.clients).find(x=>x!==k)",K)
add(valor='9999',tipo='confirmado',cli=K2,data='2026-10-01')
ck('ticket de outro cliente NUNCA aparece neste cliente', '9.999' not in card(), card()[:60])
ck('mas vale para o próprio cliente (confirmado > referência)', ev(pg,"tkPick('%s',S.clients['%s']).valor"%(S,K2))==9999)
add(valor='500',tipo='confirmado',origem='Tabela oficial TOTVS',data='2026-08-01')
ck('confirmado geral prevalece sobre referência interna', ev(pg,"tkPick('%s',S.clients['%s']).valor"%(S,K))==500)
# desatualizado
add(valor='10',data='2020-01-01',tipo='confirmado',origem='Tabela oficial TOTVS',cli=K)
ck('confirmado do próprio cliente prevalece e marca desatualizado', 'desatualizada' in card().lower())
# rank
ck('tkRank só soma BRL recorrente', ev(pg,"(()=>{const c=S.clients['%s'];const o=c.opps.find(o=>o.ruleId==='%s');return tkRank(c,o)})()"%(K,info['r']))>0)
ev(pg,"tkOf('%s').forEach(t=>{if(t.cli==='%s')t.natureza='Implantação'});0"%(S,K))
ck('natureza diferente de Recorrente não entra no rank', ev(pg,"(()=>{const c=S.clients['%s'];const o=c.opps.find(o=>o.ruleId==='%s');return tkRank(c,o)})()"%(K,info['r']))==0)
# privacidade: nunca no registro compartilhado da solução
ck('ticket não vai para o registro (compartilhado) da solução', 'valor' not in ev(pg,"JSON.stringify(S.solutions.find(s=>s.id==='%s'))"%S) and ev(pg,"!('tickets' in S.solutions.find(s=>s.id==='%s'))"%S))
# UI da solução
ev(pg,"UI.view='solucoes';UI.solSel='%s';render();0"%S); pg.wait_for_timeout(300)
t=ev(pg,"document.getElementById('app').innerText").lower()
ck('detalhe da solução mostra seção Ticket de referência', 'ticket de referência' in t and 'registrar referência' in t and 'preço confirmado' in t)
# remoção
tid=ev(pg,"tkOf('%s')[0].id"%S); pg.evaluate("a=>tkDel(a.s,a.t)",{'s':S,'t':tid}); ck('remoção funciona', ev(pg,"!tkOf('%s').some(t=>t.id==='%s')"%(S,tid)))
# persistência
pg.wait_for_timeout(3000); cnt=n(); pg.reload(); pg.wait_for_timeout(3500)
ck('tickets persistem após recarregar', n()==cnt and cnt>0, (cnt,n()))
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
