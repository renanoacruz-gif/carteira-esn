from t40_lib import *
import uuid
email='rd%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0"); pg.wait_for_timeout(4500)  # deixa o gatilho de abertura (4s) passar antes do teste
def page(items,extra=''):
    return "<html><body><nav><a href='/x'>Menu</a></nav><main><h2>Produtos</h2>"+''.join("<a href='/p/%d'>%s</a>"%(i,t) for i,t in enumerate(items))+extra+"</main><footer><a>Contato</a></footer></body></html>"
SUF=uuid.uuid4().hex[:5]
TETA='Zorblax Nimbus '+SUF
base=['Gestão de Obras','Gestão de Frotas Plus','TOTVS Alfa Compras','Módulo Beta Fiscal','Sistema Gama RH','Portal Delta','Plataforma Épsilon','Zeta Analytics']
R=lambda js,a=None: pg.evaluate(js,a)
ck('radar nasce sem fontes', R("!S.meta.radar||!S.meta.radar.fontes.length"))
# validações
R("rdAdd({nome:'',url:'http://x.com',fin:'zzz'})"); ck('fonte inválida rejeitada (nome, http, finalidade)', R("S.meta.radar==null||S.meta.radar.fontes.length")==0 and R("UI.rdErr.length")>=3)
R("rdAdd({nome:'Externo',url:'https://exemplo.com/p',fin:'catalogo'})"); ck('domínio fora de totvs.com(.br) rejeitado', R("rdState().fontes.length")==0)
R("rdAdd({nome:'Catálogo',url:'https://www.totvs.com/produtos/',fin:'catalogo'})"); R("rdAdd({nome:'Dup',url:'https://www.totvs.com/produtos',fin:'catalogo'})")
ck('fonte válida entra; URL duplicada rejeitada', R("rdState().fontes.length")==1)
R("rdAdd({nome:'TDN Release',url:'https://tdn.totvs.com/display/rel',fin:'documentacao'})")
F1,F2=R("rdState().fontes.map(f=>f.id)")
ap=lambda f,h: pg.evaluate("a=>{const o=rdAplicar(rdFonte(a.f),a.h);return {res:o.res,erro:o.erro,add:o.add,rem:o.rem,novos:o.novos,dup:o.dup,n:o.n}}",{'f':f,'h':h})
q=lambda: R("rdState().fila.filter(x=>x.status==='pendente').map(x=>({t:x.tipo,ti:x.titulo,fin:x.fin}))")
# 1ª leitura = baseline
o=ap(F1,page(base)); ck('1ª leitura registra linha de base sem gerar fila', o['res']=='baseline' and o['n']>=8 and q()==[], o)
ck('itens genéricos (Menu/Contato) e nav/footer não entram', R("rdFonte('%s').base.n"%F1)==len(base)+1, R("rdFonte('%s').base.n"%F1))  # +1 = título h2 'Produtos'
# sem mudança
o=ap(F1,page(base)); ck('releitura idêntica = sem mudança', o['res']=='sem_mudanca' and q()==[])
# novo item
o=ap(F1,page(base+[TETA])); ck('item novo na lista → 1 indício na fila (não vira produto)', o['res']=='mudou' and o['novos']==1 and q()==[{'t':'novo_item','ti':TETA,'fin':'catalogo'}], q())
ck('nenhuma solução criada automaticamente', R("n=>!S.solutions.some(s=>s.nome===n)",TETA))
# repetição não duplica fila
ap(F1,page(base)); o=ap(F1,page(base+[TETA])); ck('mesmo item reaparecendo não duplica a fila', len(q())==1, q())
# item que já existe na Base
nome=R("S.solutions.find(s=>!s.arquivado&&s.nome.length>8).nome"); o=ap(F1,page(base+[TETA,nome])); ck('item igual a solução existente da Base é tratado como duplicado', o['dup']>=1 and not any(x['ti']==nome for x in q()), (o,nome))
# queda abrupta
o=ap(F1,page(base[:2]+[])); ck('queda abrupta não é aplicada (evita falsa remoção)', o.get('erro') is not None and 'Queda abrupta' in o['erro'], o)
ck('base preservada após queda abrupta', R("rdFonte('%s').base.n"%F1)>=9)
# página vazia
o=ap(F1,'<html><body><p>Faça login</p></body></html>'); ck('página vazia/login não é aplicada', o.get('erro') and 'insuficiente' in o['erro'].lower(), o)
# documentação ≠ lançamento
doc=lambda ls: "<main><h1>Release 12.1.2410</h1>"+''.join("<p>%s</p>"%l for l in ls)+"</main>"
dl=['Correção da rotina MATA103 para notas de entrada','Ajuste na geração do SPED Fiscal bloco K','Nova versão do Smart View disponível','Melhoria de desempenho no Browse','Tratamento de erro no REST','Atualização do dicionário','Campo adicional na SA1','Novo parâmetro MV_XYZ']
ap(F2,doc(dl)); ck('documentação: baseline sem fila', R("rdState().fila.filter(x=>x.fonteId==='%s').length"%F2)==0)
o=ap(F2,doc(dl+['Lançamento do produto TOTVS Novo Mega Módulo','Correção na rotina MATA110'])); 
fq=R("rdState().fila.filter(x=>x.fonteId==='%s')"%F2)
ck('documentação alterada → UM item “documentação atualizada”, nunca novo produto', len(fq)==1 and fq[0]['tipo']=='doc' and 'não é lançamento' in fq[0]['titulo'].lower() and not any(x['tipo']=='novo_item' for x in fq), fq)
ck('item registra fonte, data e conteúdo alterado', fq[0]['url'] and fq[0]['em'] and len(fq[0]['trecho'])==2 and fq[0]['add']==2, fq[0])
# estrutura mudou
big=base+['Item %d novo'%i for i in range(50)]
ap(F1,page(base)); o=ap(F1,page(big)); fe=[x for x in R("rdState().fila") if x['tipo']=='estrutura']; ck('mudança massiva → 1 item “estrutura” em vez de dezenas de indícios', len(fe)==1, [x['tipo'] for x in R("rdState().fila")])
R("rdFonte('%s').base=null;0"%F1); ap(F1,page(base)); ap(F1,page(base+[TETA]))
# fila: descartar exige motivo; rascunho por clique
print(R('rdState().fila.map(x=>[x.tipo,x.titulo,x.status])'))
idn=R("rdState().fila.find(x=>x.tipo==='novo_item'&&x.status==='pendente').id")
R("a=>rdFila(a,'descartada','')",idn); ck('descartar sem motivo é recusado', R("rdState().fila.find(x=>x.id==='%s').status"%idn)=='pendente')
nS=R("S.solutions.length"); R("a=>rdFila(a,'rascunho','')",idn)
r=R("(()=>{const q=rdState().fila.find(x=>x.id==='%s');const s=S.solutions.find(x=>x.id===q.solId);return {st:q.status,s:s&&{n:s.nome,status:s.status,ori:s.origem,f:s.fontes[0].u,of:s.oficial,priv:s._priv}}})()"%idn)
ck('rascunho criado só por clique: NECESSITA VALIDAÇÃO, não oficial, com fonte', r['st']=='rascunho' and r['s']['status']=='NECESSITA VALIDAÇÃO' and r['s']['of']==False and r['s']['priv']==True and r['s']['f'].startswith('https://www.totvs.com') and R("S.solutions.length")==nS+1, r)
# reaparece depois de revisado? não volta
ap(F1,page(base)); ap(F1,page(base+[TETA])); ck('item já revisado não volta para a fila', not any(x['ti']==TETA for x in q()), q())
# rascunho duplicado da Base é recusado
R("rdEnfileirar(rdFonte('%s'),{key:'it|x|y',tipo:'novo_item',titulo:'%s',trecho:[],add:1,rem:0})"%(F1,nome)); id2=R("rdState().fila.find(x=>x.key==='it|x|y').id"); n2=R("S.solutions.length"); R("a=>rdFila(a,'rascunho','')",id2)
ck('rascunho com nome já existente na Base é recusado', R("S.solutions.length")==n2 and R("rdState().fila.find(x=>x.id==='%s').status"%id2)=='pendente')
# verificação via backend (mock)
R("window.__calls=[];window.__real=bkChamar;window.__HOSTED__=true;bkChamar=async(t,req)=>{window.__calls.push(req);return {via:'direto',resp:{ok:true,resultados:[{ok:true,paginas:[{u:req.urls[0],html:window.__html}]}]}}};0")
pg.evaluate("h=>window.__html=h",page(base+['Outro Novo Produto Iota '+SUF])); out=R("rdVerificar('%s',true)"%F1)
ck('rdVerificar usa /api/importar sem páginas vinculadas nem anexos', R("__calls.length")==1 and R("__calls[0].tipo")=='importar_link' and R("__calls[0].opcoes.paginasVinculadas")==0 and R("__calls[0].opcoes.anexos")==0)
ck('verificação detecta novidade pelo backend', any(x['ti']=='Outro Novo Produto Iota '+SUF for x in q()), q())
# erro do backend
R("bkChamar=async()=>({via:'direto',resp:{ok:false,resultados:[{ok:false,erro:{codigo:'http',mensagem:'HTTP 403'}}]}});0"); R("rdVerificar('%s',true)"%F1)
ck('erro do backend registrado na fonte sem alterar base', R("rdFonte('%s').erro.msg"%F1)=='HTTP 403')
# agendamento semanal
R("window.__HOSTED__=true;window.__calls=[];bkChamar=async(t,req)=>{window.__calls.push(req.urls[0]);return {via:'direto',resp:{ok:true,resultados:[{ok:true,paginas:[{u:req.urls[0],html:window.__html}]}]}}};rdState().fontes.forEach(f=>{f.hist.forEach(h=>h.em=new Date().toISOString())});0")
R("radarAuto()"); ck('semanal: fontes verificadas há <7 dias não são consultadas', R("__calls.length")==0, R("__calls"))
R("rdState().fontes.forEach(f=>{f.hist[0].em='2020-01-01T00:00:00.000Z'});0"); 
pg.evaluate("async()=>{await radarAuto()}")
ck('semanal: fontes devidas (>7 dias) são consultadas', R("__calls.length")==2, R("__calls"))
R("rdState().auto=false;rdState().fontes.forEach(f=>{f.hist[0].em='2020-01-01T00:00:00.000Z'});__calls.length=0;0"); pg.evaluate("async()=>{await radarAuto()}")
ck('semanal desligado não consulta', R("__calls.length")==0)
# UI
R("UI.view='solucoes';UI.rdOpen=true;render();0"); pg.wait_for_timeout(300)
t=R("document.getElementById('app').innerText").lower()
ck('UI: painel do radar com avisos e fila', 'radar de portfólio oficial' in t and 'mudança de página não é lançamento' in t and 'não uma lista comercial completa' in t and 'fila de revisão' in t and 'sem execução em segundo plano'.replace('sem execução','não há execução') in t)
# persistência
pg.wait_for_timeout(3500); nf=R("rdState().fontes.length"); nq=R("rdState().fila.length"); pg.reload(); pg.wait_for_timeout(3500)
ck('fontes, base e fila persistem após recarregar', R("S.meta.radar.fontes.length")==nf and R("S.meta.radar.fila.length")==nq and R("!!S.meta.radar.fontes[0].base"))
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
