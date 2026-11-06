from t40_lib import *
import uuid
email='oi%s@totvs.com.br'%uuid.uuid4().hex[:8]
def mk(em):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':em}); pg=ctx.new_page(); errs=[]; reqs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('request',lambda r: reqs.append(r.post_data or '') if '/api/db' in r.url else None)
    pg.route('**/*',route); pg.goto('http://localhost:8790/'); pg.wait_for_timeout(3500); return ctx,pg,errs,reqs
imgreq=lambda reqs,op=None: [r for r in reqs if '/carteira/ocrimg' in r and (op is None or '"op":"%s"'%op in r.replace(' ',''))]
# 1) semear 2 registros com imagens (3 e 2 partes) e esperar gravar
ctx,pg,errs,reqs=mk(email)
pg.evaluate("""()=>{
 const rec=(id,n)=>({id,at:nowISO(),nome:id+'.png',mime:'image/png',tam:10,hash:'h'+id,estado:'lido',ocr:true,n,texto:'t',avisos:[]});
 S.ocr.unshift(rec('ocT1',3),rec('ocT2',2)); touchG('ocr','ocT1'); touchG('ocr','ocT2');
 [['ocT1',['AAAA','BBBB','CCCC']],['ocT2',['DDDD','EEEE']]].forEach(([id,L])=>L.forEach((b64,i)=>{const ch={id:id+'_'+i,ocrId:id,i,n:L.length,b64};S.ocrimg.push(ch);touchG('ocrimg',ch.id)}));}""")
pg.wait_for_function("GCOL.ocrimg.d.size===0 && GCOL.ocr.d.size===0 && !saving",timeout=30000); pg.wait_for_timeout(500); ctx.close()
# 2) reabrir: nada de ocrimg na abertura
ctx,pg,errs,reqs=mk(email)
ck('abertura não consulta a coleção ocrimg', len(imgreq(reqs))==0, imgreq(reqs)[:2])
ck('registros OCR carregados, imagens não', ev(pg,"S.ocr.length")==2 and ev(pg,"S.ocrimg.length")==0)
ck('sem imagem carregada, ocrimgOk=false', ev(pg,"ocrimgOk(S.ocr.find(o=>o.id==='ocT1'))") is False)
# 3) ver original: lê só as partes desse registro
pg.evaluate("ACT.ocVer({dataset:{id:'ocT1'}})"); pg.wait_for_function("ocrimgOk(S.ocr.find(o=>o.id==='ocT1'))",timeout=15000); pg.wait_for_timeout(300)
g=imgreq(reqs,'get'); ck('lê exatamente as 3 partes de ocT1 (por documento, sem listar tudo)', len(g)==3 and not imgreq(reqs,'list') and all('ocT1_' in r for r in g), g)
ck('imagem remontada na ordem', ev(pg,"ocImgB64('ocT1')")=='AAAABBBBCCCC')
ck('ocT2 continua sem ser lida', ev(pg,"S.ocrimg.filter(x=>x.ocrId==='ocT2').length")==0)
pg.evaluate("UI.view='importar';render()"); pg.wait_for_timeout(300)
ck('tela mostra a imagem original', 'base64,AAAABBBBCCCC' in ev(pg,"document.getElementById('app').innerHTML"))
n0=len(imgreq(reqs)); pg.evaluate("ocrimgEnsure(S.ocr.find(o=>o.id==='ocT1'))"); pg.wait_for_timeout(200)
ck('2ª chamada usa o que já está em memória (0 pedidos)', len(imgreq(reqs))==n0)
# 4) chamadas simultâneas compartilham a leitura
r=pg.evaluate("(()=>{const rec=S.ocr.find(o=>o.id==='ocT2');return Promise.all([ocrimgEnsure(rec),ocrimgEnsure(rec)]).then(v=>v)})()")
ck('duas chamadas simultâneas: ok e só 2 leituras', r==[True,True] and len([x for x in imgreq(reqs,'get') if 'ocT2_' in x])==2, r)
ck('sem erro de página', not errs, errs); ctx.close()
# 5) excluir registro cujas imagens NÃO foram carregadas: sem partes órfãs
ctx,pg,errs,reqs=mk(email)
pg.evaluate("ocrExcluir('ocT2')"); pg.wait_for_function("GCOL.ocrimg.x.size===0 && GCOL.ocr.x.size===0 && !saving",timeout=30000); pg.wait_for_timeout(500)
uid=pg.evaluate("ME.id"); snap=list(reqs)
lst=api(pg,{'op':'list','path':'data/users/%s/carteira/ocrimg'%uid,'limit':200})
ids=sorted(d['id'] for d in lst['docs'])
ck('excluir sem carregar: partes de ocT2 removidas, ocT1 intacto', ids==['ocT1_0','ocT1_1','ocT1_2'], ids)
ck('exclusão sem leitura de imagens', len(imgreq(snap,'get'))==0 and len(imgreq(snap,'list'))==0, [x[-50:] for x in imgreq(snap)])
ctx.close()
# 6) enviar ao OCR um registro não carregado: pedido leva a imagem completa
ctx,pg,errs,reqs=mk(email)
cap=pg.evaluate("""async()=>{let p=null;window.bkChamar=async(t,ped)=>{p=ped;return {via:'arquivo',motivo:''}};
  await ocrEnviar(S.ocr.find(o=>o.id==='ocT1')); return p&&p.arquivo&&p.arquivo.base64}""")
ck('pedido ao OCR contém a imagem inteira lida sob demanda', cap=='AAAABBBBCCCC', cap)
ctx.close()
# 7) falha de rede nas partes: mensagem clara, sem erro de página, depois recupera
ctx,pg,errs,reqs=mk(email)
st={'block':True}
def rt(r):
    if st['block'] and '/carteira/ocrimg' in (r.request.post_data or ''): r.abort()
    else: r.continue_()
pg.route('**/api/db',rt)
pg.evaluate("window.__apiTo={r:1500,w:1500}") 
res=pg.evaluate("ocrimgEnsure(S.ocr.find(o=>o.id==='ocT1')).then(()=>'ok',e=>'erro')")
ck('falha de rede: ensure rejeita e marca falha', res=='erro' and ev(pg,"OCI.falha.has('ocT1')"), res)
pg.evaluate("UI.view='importar';UI.oc.ver='ocT1';render()"); pg.wait_for_timeout(300)
ck('tela explica que não foi possível carregar', 'Não foi possível carregar a imagem original' in ev(pg,"document.getElementById('app').innerText"))
st['block']=False
res=pg.evaluate("ocrimgEnsure(S.ocr.find(o=>o.id==='ocT1'))")
ck('nova tentativa após a falha funciona', res is True and ev(pg,"ocImgB64('ocT1')")=='AAAABBBBCCCC', res)
ck('sem erro de página na falha', not errs, errs); ctx.close()
print('FAILS',F)
