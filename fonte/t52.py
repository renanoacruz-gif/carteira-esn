from t40_lib import *
import uuid
email='cp%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]'); pg.wait_for_timeout(1500)
SETUP="""(cfg)=>{
 const base=(window.__base ||= clone(S.clients['c_T00001'])); S.clients={};
 const mk=(key,o)=>{const c=clone(base); c.key=key; c.name=o.name; c.code=key; c.cnpj=''; c.seg='Indústria metalmecânica'; c.notes=''; c.docs=[]; c.opps=[]; c.productsRaw=''; c.size='';
   c.cad={}; if(o.func) c.cad.func={v:o.func,fonte:{tipo:'manual'},st:'confirmado'};
   c.cnpjCad=o.cnae?{cnaePrincipal:{codigo:o.cnae},porte:'DEMAIS'}:null;
   c.fichas=(o.items?[{id:'f_'+key,file:'ficha_'+key+'.xlsx',comp:'2026-10',state:'vinculado',items:o.items.map((d,j)=>({desc:d,vals:[1000],vi:0,comp:'2026-10',kind:classifyItem(d),loc:'linha '+(j+2)}))}]:[]);
   if(o.seg) c.seg=o.seg; S.clients[key]=c; return c;};
 cfg.forEach(o=>mk(o.key,o)); reanalyzeAll(true); return Object.keys(S.clients).length}"""
FL='Assinatura Fluig Plataforma'; PR='Licença Protheus Financeiro'
def peers(n_with_fluig=3,n_without=1,n_nofich=2):
    L=[{'key':'T','name':'ALVO','cnae':'2512800','func':150,'items':[PR]}]
    for i in range(n_with_fluig): L.append({'key':'pf%d'%i,'name':'Par F%d'%i,'cnae':'2512800','func':120+i,'items':[PR,FL]})
    for i in range(n_without): L.append({'key':'pn%d'%i,'name':'Par N%d'%i,'cnae':'2512800','func':130,'items':[PR]})
    for i in range(n_nofich): L.append({'key':'ps%d'%i,'name':'Par S%d'%i,'cnae':'2512800','func':140})
    return L
def run(L):
    pg.evaluate(SETUP,L)
    return pg.evaluate("""()=>{const c=S.clients['T']; return {opps:c.opps.filter(o=>/^cmp_/.test(o.ruleId)).map(o=>({id:o.ruleId,modo:o.modo,tab:o.cmpTab,orig:o.origemTipo,cl:rxClass(c,o).cl,json:JSON.stringify(o)})), lac:ctxLacunas(c).map(x=>x.falta)}}""")
r=run(peers())
o=r['opps']
ck('gera 1 indicação de comparação', len(o)==1, [x['id'] for x in o])
t=o[0]['tab'] if o else {}
ck('contagens: 6 comparáveis, 4 com ficha, 3 identificados, 1 sem identificação, 2 desconhecidos', (t.get('n'),t.get('nFicha'),t.get('nDoc'),t.get('nAus'),t.get('nDesc'))==(6,4,3,1,2), t)
ck('amostra pequena sinalizada (baixa representatividade)', t.get('baixa') is True)
ck('cobertura documental = 4/6 (67%)', t.get('cob')==67, t.get('cob'))
ck('modo investigar + origem Comparação de portfólio + classe investigar', o and o[0]['modo']=='investigacao' and o[0]['orig']==['Comparação de portfólio'] and o[0]['cl']=='investigar', o and (o[0]['modo'],o[0]['orig'],o[0]['cl']))
ck('grupo cita segmento, CNAE e porte', 'CNAE divisão 25' in t.get('grupo','') and 'porte' in t.get('grupo',''), t.get('grupo'))
ck('sem ficha ≠ "não possui" (desconhecidos não entram em ausência)', t.get('nAus')==1 and 'situação desconhecida' in t.get('just',''))
ck('não expõe identidades de pares', not any(('Par F' in x['json'] or 'Par N' in x['json'] or 'Par S' in x['json']) for x in o))
ck('não apresentado como benchmark de mercado', 'não o mercado' in t.get('just',''))
# amostra insuficiente
r=run(peers(3,0,0)); ck('3 pares com ficha, todos têm → gera', len(r['opps'])==1, r['opps'] and r['opps'][0]['tab'])
r=run(peers(2,0,3)); ck('apenas 2 pares com ficha → NÃO gera', not r['opps'], [x['tab'] for x in r['opps']])
r=run(peers(1,3,0)); ck('1 de 4 (25%) abaixo do mínimo → NÃO gera', not r['opps'])
# alvo sem ficha
L=peers(); L[0]['items']=None
r=run(L); ck('alvo sem ficha: nada gerado e pendência pede ficha', not r['opps'] and any('Ficha de faturamento deste cliente' in x for x in r['lac']), r['lac'])
# alvo sem CNAE/porte
L=peers(); L[0].pop('cnae'); L[0].pop('func')
r=run(L); ck('alvo sem CNAE/porte: não compara por segmento amplo + pendência', not r['opps'] and any('CNAE' in x for x in r['lac']), (r['opps'],r['lac']))
# pares com CNAE de outra divisão
L=peers()
for x in L[1:]: x['cnae']='4711300'
r=run(L); ck('CNAE de outra divisão: não comparável', not r['opps'])
# pares de outro segmento
L=peers()
for x in L[1:]: x['seg']='Varejo supermercados'
r=run(L); ck('outro segmento: não comparável', not r['opps'])
# alvo já tem Fluig
L=peers(); L[0]['items']=[PR,FL]; r=run(L); ck('alvo já tem a solução identificada: sem indicação', not r['opps'])
# porte diferente
L=peers()
for x in L[1:]: x['func']=900
r=run(L); ck('porte conhecido e diferente: não comparável', not r['opps'])
# decisão descartada preservada
r=run(peers()); pg.evaluate("()=>{const c=S.clients['T']; const o=c.opps.find(o=>/^cmp_/.test(o.ruleId)); decSet('T',o.ruleId,{valid:'descartada',nota:'teste'}); }")
ev(pg,"reanalyzeAll(true);0"); cl=pg.evaluate("()=>{const c=S.clients['T']; const o=c.opps.find(o=>/^cmp_/.test(o.ruleId)); return rxClass(c,o).cl}")
ck('indicação descartada permanece descartada após reanálise', cl=='nao', cl)
h=pg.evaluate("()=>{const c=S.clients['T']; const o=c.opps.find(o=>/^cmp_/.test(o.ruleId)); return oppCard(c,o)}")
ck('cartão mostra a tabela exigida', all(x in h for x in ['Comparação de portfólio','Grupo comparado','Contratação identificada em','Cobertura documental','Justificativa','O que validar']), h[:100])
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
