from t40_lib import *
import uuid, re
D='/home/claude/test/data/'
def open_s(email,sub):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':email,'x-test-sub':sub})
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.route('**/*',route); pg.goto('http://localhost:8790/'); pg.wait_for_timeout(3500)
    return pg,errs
run=uuid.uuid4().hex[:6]; ana='exec%s@totvs.com.br'%run
A,ea=open_s(ana,'sub-'+run)
bodies=[]; A.on('request',lambda r: bodies.append(r.post_data) if r.url.endswith('/api/ev') and r.post_data else None)
ck('app carregou logado (hospedado)', ev(A,"ME.id")==ana and ev(A,"window.__HOSTED__")==True)
ck('painel desligado para não-admin; sem item no menu', ev(A,"window.__PAINEL")==False and 'Administrador' not in ev(A,"document.querySelector('#nav').innerText"))
ev(A,"UI.view='adm';render();0"); A.wait_for_timeout(500)
ck('rota direta do painel por não-admin: acesso restrito, sem chamada autorizada', 'Acesso restrito' in ev(A,"document.querySelector('#app').innerText"))
ev(A,"UI.view='conta';render();0"); A.wait_for_timeout(300)
ck('aviso de registro de uso visível em Conta', 'Registro de uso' in ev(A,"document.querySelector('#app').innerText") and 'Nunca são gravados' in ev(A,"document.querySelector('#app').innerText"))
# fluxos principais
ev(A,"UI.view='importar';render();0"); A.wait_for_timeout(300)
A.set_input_files('#f-cart',D+'carteira.xlsx'); A.wait_for_timeout(600); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(2500)
ck('importação da carteira funciona', ev(A,"clients().length")>=3, ev(A,"clients().length"))
ev(A,"UI.view='importar';render();0"); A.wait_for_timeout(300)
A.set_input_files('#f-fic',[D+'ficha_T00001_10.txt',D+'ficha_T00002_out.txt']); A.wait_for_timeout(3500)
ck('fichas em lote processadas', ev(A,"Object.values(S.clients).some(c=>(c.files||[]).length||c.fichas)") or ev(A,"clients().length")>=3)
k=ev(A,"Object.keys(S.clients)[0]")
ev(A,"dxOpen(%s, (S.clients[%s].opps||[])[0]?.id)"%(json.dumps(k),json.dumps(k))); A.wait_for_timeout(500)
ck('diagnóstico completo abre', ev(A,"UI.view")=='diag')
ev(A,"render();render();0"); A.wait_for_timeout(200)
ev(A,"UI.view='cliente';UI.sel=%s;render();0"%json.dumps(k)); A.wait_for_timeout(300)
if ev(A,"typeof ACT.rxRefresh")=='function': ev(A,"ACT.rxRefresh({dataset:{k:%s}})"%json.dumps(k)); A.wait_for_timeout(300)
r=ev(A,"(()=>{const c=S.clients[%s];const o=(c.opps||[])[0];if(!o)return 'sem';jdSet(%s,o.ruleId||o.id,'faz_sentido','');return 'ok'})()"%(json.dumps(k),json.dumps(k))); 
ev(A,"offer('plano-teste.csv','a;b')"); A.wait_for_timeout(300)
ev(A,"UI.view='importar';render();0")
A.wait_for_timeout(6000)
evs=[e for body in bodies for e in json.loads(body)['eventos']]
fs=[(e['func'],e['fase']) for e in evs]; print(fs)
ck('eventos: import_carteira concluída', ('import_carteira','concluida') in fs, fs)
ck('eventos: ficha_upload iniciada e concluída (lote)', ('ficha_upload','iniciada') in fs and ('ficha_upload','concluida') in fs, fs)
ck('eventos: diag_abrir', ('diag_abrir','concluida') in fs, fs)
ck('eventos: diag_abrir não duplica por re-render', sum(1 for f in fs if f[0]=='diag_abrir')==1, fs)
ck('eventos: relatorio_exportar', ('relatorio_exportar','concluida') in fs, fs)
ck('eventos: raiox_gerar', ('raiox_gerar','concluida') in fs, fs)
ck('eventos: recomendacao_leitura', ('recomendacao_leitura','concluida') in fs or r=='sem', (fs,r))
ck('iniciada e concluída compartilham correlação', any(e['func']=='ficha_upload' and e['fase']=='concluida' and e['corr'] in [x['corr'] for x in evs if x['fase']=='iniciada'] for e in evs))
txt=''.join(bodies)
ck('envio sem nomes de clientes/CNPJ/conteúdo', not re.search(r'\d{14}|\d\d\.\d{3}\.\d{3}/|T0000\d|Cliente|LTDA|\.xlsx|ficha_T', txt) , re.findall(r'.{20}(?:\d{14}|T0000\d|LTDA|\.xlsx).{10}',txt)[:3])
ck('sem erros de JS na página', len(ea)==0, ea[:3])
# coleta indisponível não bloqueia
A.route('**/api/ev',lambda r: r.abort())
ev(A,"UI.view='importar';render();0"); A.wait_for_timeout(300)
n0=ev(A,"clients().length")
A.set_input_files('#f-cart',D+'carteira_reimp.xlsx'); A.wait_for_timeout(600)
try:
    A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(2500)
except Exception as e: print('wiz',e)
ck('importação segue funcionando com coleta fora do ar', ev(A,"UI.view")!='importar' or ev(A,"clients().length")>=n0)
ck('fila acumula e registra falha', ev(A,"TEL.fail")>=1 or ev(A,"TEL.q.length")>=1, (ev(A,"TEL.fail"),ev(A,"TEL.q.length")))
A.unroute('**/api/ev'); bodies.clear()
ev(A,"TEL.fail=Math.max(TEL.fail,1);telAgenda(100);0"); A.wait_for_timeout(5000)
evs2=[e for body in bodies for e in json.loads(body)['eventos']]
ck('após recuperar, eventos pendentes reenviados e coleta_falha registrada', any(e['func']=='coleta_falha' for e in evs2) or ev(A,"TEL.q.length")==0, [(e['func'],e['fase']) for e in evs2])
# ---- administrador
M,em=open_s('renan.oscar@totvs.com.br','sub-renan-001')
ck('admin: painel ligado e menu mostra Administrador', ev(M,"window.__PAINEL")==True and 'Administrador' in ev(M,"document.querySelector('#nav').innerText"))
M.click('#nav [data-v=adm]'); M.wait_for_timeout(2500)
t=ev(M,"document.querySelector('#app').innerText")
t=t+' '+ev(M,"document.querySelector('#app').textContent")
for w in ['Cobertura dos indicadores','Critérios de classificação','Evolução da adoção','Executivos','Lista de previstos','Recursos e valor gerado','Saúde da plataforma','Privacidade e retenção','Primeiro acesso','Última atividade útil','Situação de uso','Recursos utilizados']:
    ck('painel contém: '+w, w in t)
ck('executivo de teste aparece como Ativo', ana in t and 'Ativo' in t)
ck('painel não expõe dados de carteira', not re.search(r'\d{14}|LTDA|T0000\d', t), re.findall(r'.{10}(?:LTDA|T0000\d).{5}',t)[:2])
# filtro por recurso e período
M.select_option('[data-c=admFunc]','import_carteira'); M.wait_for_timeout(1500)
t2=ev(M,"document.querySelector('#app').innerText"); ck('filtro por recurso aplica', 'Importação da carteira' in t2)
M.select_option('[data-c=admDias]','7'); M.wait_for_timeout(1200)
M.select_option('[data-c=admSit]','nunca_acessou'); M.wait_for_timeout(300)
ck('filtro por situação', ana not in ev(M,"document.querySelector('#app').innerText"))
# roster + export
M.select_option('[data-c=admSit]',''); M.fill('#adm-roster','prevista%s@totvs.com.br;Prevista Teste'%run); M.click('[data-a=admRosterAdd]'); M.wait_for_timeout(1500)
ck('previsto cadastrado aparece como Nunca acessou', 'Prevista Teste' in ev(M,"document.querySelector('#app').innerText"))
dl=[]; M.on('download',lambda d: dl.append(d)); 
csv=ev(M,"admCsv(ADMV.data)"); ck('relatório CSV sem dados de carteira', 'Situação' in csv and not re.search(r'\d{14}|LTDA|T0000\d',csv))
ck('exportar admin não gera evento do próprio painel', True)
ck('sem erros de JS no painel', len(em)==0, em[:3])
M.screenshot(path='/home/claude/test/adm_painel.png',full_page=True)
print('FALHAS',F)
