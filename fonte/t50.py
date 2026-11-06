from t40_lib import *
import uuid, csv, io
URL='https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit?gid=0#gid=0'
H=['Cód. Cliente','Razão Social','CNPJ','Segmento','Cidade','Porte','MRR','Produtos','NPS','Observações']
R={'T00001':['T00001','Metalúrgica Alfa Ltda','11.222.333/0001-81','Metalmecânica','Curitiba','Média','15000','Protheus Backoffice; SCC','4','x'],
 'T00002':['T00002','Distribuidora Beta S/A','44.555.666/0001-81','Distribuição','Maringá','Grande','22000,50','Protheus','5','y'],
 'T00003':['T00003','Clínica Gama Ltda','77.888.999/0001-81','Saúde','Londrina','Pequena','3000','RM','3','z'],
 'T00004':['T00004','Construtora Delta Engenharia','12.345.678/0001-95','Construção','Curitiba','Média','9000','Protheus','4','w']}
def mk(rows,hdr=H):
    o=io.StringIO(); w=csv.writer(o); w.writerow(['Carteira ESN - exportação']); w.writerow([]); w.writerow(hdr)
    for r in rows: w.writerow(r)
    return o.getvalue()
ST={'csv':mk(R.values()),'err':None,'n':0}
email='sh%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
ev(pg,"window.confirm=()=>true;0")
def rt(r):
    ST['n']+=1
    if ST['err']: r.fulfill(status=403,content_type='application/json',body=json.dumps({'ok':False,'erro':{'codigo':'planilha_privada','mensagem':ST['err']}}))
    else: r.fulfill(status=200,content_type='application/json',body=json.dumps({'ok':True,'csv':ST['csv'],'gid':'0','bytes':len(ST['csv']),'em':'2026-11-06T10:00:00Z'}))
pg.route('**/api/planilha',rt)
T=lambda: ev(pg,"document.getElementById('app').innerText")
ev(pg,"UI.view='clientes';render();0"); pg.wait_for_timeout(400)
ck('Clientes (vazio): cartão da planilha aparece', 'Planilha do Google (carteira)' in T())
ev(pg,"UI.view='importar';render();0"); pg.wait_for_timeout(400)
ck('Importar e fichas: cartão da planilha aparece', 'Planilha do Google (carteira)' in T() and pg.locator('#sh_url').count()==1)
# link inválido
for bad in ['http://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789','https://evil.example.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789','https://docs.google.com/spreadsheets/d/curto']:
    pg.fill('#sh_url',bad); pg.click('[data-a=shGo]'); pg.wait_for_timeout(300)
ck('link inválido não salva nem chama o servidor', ev(pg,"!S.meta.sheet")  and ST['n']==0)
# primeira vinculação: abre o assistente
pg.fill('#sh_url',URL); pg.click('[data-a=shGo]'); pg.wait_for_timeout(2500)
ck('primeira vez: abre mapeamento para conferência', 'Mapeamento de colunas' in T() and ev(pg,"!!UI.wiz&&UI.wiz.fromSheet"), T()[:200])
pg.click('[data-a=impPrev]'); pg.wait_for_timeout(500); pg.click('[data-a=impGo]'); pg.wait_for_timeout(2500)
ck('4 clientes importados', ev(pg,"clients().length")==4)
ck('mapeamento por nome de coluna salvo', ev(pg,"!!S.meta.sheet.mapH && !!S.meta.sheet.hash && S.meta.sheet.url.includes('docs.google.com')"))
ck('sem marcação de fora da planilha', ev(pg,"clients().filter(c=>c.foraPlanilha).length")==0)
ck('MRR com vírgula lido (22000,50)', abs(ev(pg,"S.clients['c_T00002'].mrr")-22000.5)<0.01, ev(pg,"S.clients['c_T00002'].mrr"))
# marca dado trabalhado no cliente T00002 (histórico)
ev(pg,"S.clients['c_T00002'].notes='nota do executivo';touchC('c_T00002');0")
# 2: sem alterações
n0=ST['n']; ev(pg,"UI.view='clientes';render();0"); pg.wait_for_timeout(300); pg.click('[data-a=shNow]'); pg.wait_for_timeout(1200)
ck('sem alterações: não reimporta', ST['n']==n0+1 and 'Sem alterações' in ev(pg,"document.querySelector('.toast, #toast')?.innerText||''") or ev(pg,"S.meta.sheet.lastErr")==None)
# 3: edição na planilha: MRR muda, T00002 sai, T00099 entra
R2=dict(R); R2['T00001']=list(R['T00001']); R2['T00001'][6]='18000'; del R2['T00002']; R2['T00099']=['T00099','Nova Ltda','11.444.777/0001-61','Serviços','SP','Média','5000','Protheus','4','n']
ST['csv']=mk(R2.values()); pg.click('[data-a=shNow]'); pg.wait_for_timeout(2500)
ck('auto-aplicação sem abrir assistente', not ev(pg,"!!UI.wiz"))
ck('MRR atualizado', ev(pg,"S.clients['c_T00001'].mrr")==18000, ev(pg,"S.clients['c_T00001'].mrr"))
ck('novo cliente criado', ev(pg,"!!S.clients['c_T00099']"))
ck('cliente removido da planilha é MANTIDO', ev(pg,"!!S.clients['c_T00002']") and ev(pg,"S.clients['c_T00002'].notes")=='nota do executivo')
ck('cliente removido marcado fora da planilha', ev(pg,"!!S.clients['c_T00002'].foraPlanilha"))
ck('pill visível na lista de clientes', 'fora da planilha desde' in T())
ev(pg,"UI.sel='c_T00002';UI.view='cliente';UI.ctab='raiox';render();0"); pg.wait_for_timeout(300)
ck('pill visível no cabeçalho do cliente', 'fora da planilha desde' in T())
# 4: volta
ST['csv']=mk(R.values()); ev(pg,"UI.view='clientes';render();0"); pg.wait_for_timeout(300); pg.click('[data-a=shNow]'); pg.wait_for_timeout(2500)
ck('cliente que volta perde a marcação', ev(pg,"!S.clients['c_T00002'].foraPlanilha"))
ck('T00099 (saiu agora) marcado', ev(pg,"!!S.clients['c_T00099'].foraPlanilha"))
# 5: proteção >50%
ST['csv']=mk([R['T00001']]); pg.click('[data-a=shNow]'); pg.wait_for_timeout(2500)
ck('planilha com poucos clientes: não marca em massa', ev(pg,"clients().filter(c=>c.foraPlanilha).length")<=1 and 'NÃO aplicada' in ev(pg,"S.meta.sheet.aviso"), ev(pg,"[clients().filter(c=>c.foraPlanilha).length,S.meta.sheet.aviso]"))
# 6: erro do Google
ST['err']='Planilha inacessível: compartilhe como "Qualquer pessoa com o link → Leitor".'; pg.click('[data-a=shNow]'); pg.wait_for_timeout(1200)
ck('erro mostrado e dados intactos', 'Planilha inacessível' in T() and ev(pg,"clients().length")==5)
ST['err']=None
# 7: coluna mapeada renomeada → assistente
H2=list(H); H2[1]='Cliente (nome)'; ST['csv']=mk(R.values(),H2); pg.click('[data-a=shNow]'); pg.wait_for_timeout(1500)
ck('coluna renomeada: pede conferência do mapeamento', 'Mapeamento de colunas' in T())
pg.click('[data-a=cancelWiz]'); pg.wait_for_timeout(300)
# 8: persistência
ST['csv']=mk(R.values()); pg.click('[data-a=shNow]'); pg.wait_for_timeout(2000)
ev(pg,"flush()") if ev(pg,"typeof flush")=='function' else None
pg.wait_for_timeout(2500); pg.reload(); pg.wait_for_timeout(4000)
ck('vínculo persiste após recarregar', ev(pg,"!!S.meta.sheet && S.meta.sheet.url.includes('docs.google.com')"))
ck('marcação persiste', ev(pg,"clients().filter(c=>c.foraPlanilha).length")>=1)
pg.unroute('**/api/planilha')
# 9: rota do servidor — validações (sem chamar o Google)
def srv(u): return ev(pg,"async u=>{const r=await fetch('/api/planilha',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:u})});return [r.status,(await r.json()).erro?.codigo]}"%() if False else "async u=>{const r=await fetch('/api/planilha',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:u})});return [r.status,(await r.json()).erro?.codigo]}")
res={}
for u in ['http://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789','https://docs.google.com.evil.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789','https://evil.com/?https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789','file:///etc/passwd','https://169.254.169.254/latest/meta-data','https://docs.google.com/spreadsheets/d/x/export','']:
    res[u]=pg.evaluate("async u=>{const r=await fetch('/api/planilha',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:u})});const j=await r.json();return [r.status,j.erro&&j.erro.codigo]}",u)
ck('servidor rejeita destinos fora do Google (SSRF)', all(v[0]==400 and v[1]=='link_invalido' for v in res.values()), res)
ck('servidor rejeita GET', pg.evaluate("async()=>{const r=await fetch('/api/planilha');return r.status}")>=400)
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
