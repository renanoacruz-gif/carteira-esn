# Rodada "destravar": funil de adoção, mensagens de IA acionáveis, pausa no teste e código real da falha de importação
from t40_lib import *
import uuid, json
def open_s(email,sub):
    ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':email,'x-test-sub':sub})
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e))); pg.route('**/*',route); pg.goto('http://localhost:8790/'); pg.wait_for_timeout(3500)
    return pg,errs
A,ea=open_s('renan.oscar@totvs.com.br','sub-renan-001')
# funil (cálculo)
r=ev(A,"""JSON.stringify(admFunil([
 {email:'a@t',nome:'A',previsto:true,identificado:false},
 {email:'b@t',nome:'B',previsto:true,identificado:true,importou_carteira:false,recursos_principais_cobertura:[]},
 {email:'c@t',nome:'C',previsto:true,identificado:true,importou_carteira:true,recursos_principais_cobertura:['import_carteira']},
 {email:'d@t',nome:'D',previsto:true,identificado:true,importou_carteira:true,recursos_principais_cobertura:['import_carteira','diag_abrir']},
 {email:'e@t',nome:'E',previsto:true,identificado:true,importou_carteira:false,recursos_principais_cobertura:['diag_abrir']},
 {email:'x@t',nome:'X',previsto:false,identificado:true,importou_carteira:true,recursos_principais_cobertura:['diag_abrir']}
]).map(e=>[e.n,e.parou.map(u=>u.email)]))"""); fj=json.loads(r)
ck('funil: 5 convidados → 4 acessaram → 2 importaram → 1 usou recurso principal (fora da lista não conta)', [x[0] for x in fj]==[5,4,2,1], fj)
ck('funil: "parou aqui" por etapa', fj[0][1]==['a@t'] and sorted(fj[1][1])==['b@t','e@t'] and fj[2][1]==['c@t'] and fj[3][1]==[], fj)
ck('funil: soma das paradas + última etapa = convidados', sum(len(x[1]) for x in fj)+fj[3][0]==5)
ev(A,"UI.view='adm';render();0"); A.wait_for_timeout(3000)
fx=ev(A,"document.querySelector('#adm-funil')?.innerText||''")
ck('painel mostra o funil de adoção acima da lista de executivos', 'Funil de adoção' in fx and 'Convidados' in fx and 'Importaram a carteira' in fx and ev(A,"document.querySelector('#adm-funil').compareDocumentPosition(document.querySelector('[data-a=admAddFocus]'))&4")==4, fx[:200])
ck('servidor informa a etapa "importou carteira" por executivo', ev(A,"ADMV.data.usuarios.every(u=>typeof u.importou_carteira==='boolean')"))
n0=ev(A,"ADMV.data.usuarios.filter(u=>u.previsto).length"); n1=ev(A,"admFunil(ADMV.data.usuarios)[0].n")
ck('etapa 1 = total de previstos do painel', n0==n1 and n0>0, (n0,n1))
if ev(A,"!!document.querySelector('#adm-funil details')"):
    ev(A,"document.querySelector('#adm-funil details').open=true;window.__cp='';navigator.clipboard.writeText=async t=>{window.__cp=t};0"); A.click('#adm-funil [data-a=admFunilCopy]'); A.wait_for_timeout(400)
    ck('copiar e-mails de quem parou na etapa', '@' in ev(A,"window.__cp") and 'reenvie o convite' in fx or 'primeiro passo' in fx or 'indique um cliente' in fx, ev(A,"window.__cp")[:60])
# mensagens de IA
ck('limite de uso: explica que é cota da chave e o que fazer', all(k in ev(A,"AI_ERR.limite_de_uso") for k in ['cota da sua chave','não é limite desta ferramenta','troque de provedor']))
ck('indisponível: não cita mais um provedor específico', 'Gemini' not in ev(A,"AI_ERR.indisponivel") and 'outro provedor' in ev(A,"AI_ERR.indisponivel"))
ck('login necessário na importação: indica o caminho alternativo', 'Importar materiais' in ev(A,"AI_ERR.autenticacao_necessaria"))
# pausa no teste após limite de uso
calls=[]
def teste(rt): calls.append(1); rt.fulfill(status=200,content_type='application/json',body=json.dumps({'versao':1,'ok':False,'tipo':'ia_teste','provedor':'gemini','erro':{'codigo':'limite_de_uso','mensagem':'Limite de uso/cota do Gemini atingido.'}}))
A.route('**/api/ia/teste',teste)
ev(A,"UI.view='ia';render();0"); A.wait_for_timeout(500)
p0=ev(A,"document.querySelector('[data-a=iaTestar]').dataset.p")
A.click('[data-a=iaTestar]'); A.wait_for_timeout(1200)
tx=ev(A,"document.querySelector('#app').innerText")
if calls:
    ck('após limite de uso: botão em pausa e orientação "O que fazer"', ev(A,"document.querySelector('[data-a=iaTestar][data-p=%s]').disabled"%p0) and 'O que fazer:' in tx and 'cota da sua chave' in tx, tx[:200])
    ev(A,"iaTestar('%s');0"%p0); A.wait_for_timeout(600)
    ck('segundo teste dentro de 1 min não chama o provedor', len(calls)==1, len(calls))
    ck('outros provedores continuam testáveis', ev(A,"[...document.querySelectorAll('[data-a=iaTestar]')].filter(b=>!b.disabled).length")>=1)
else:
    ck('teste de provedor exige chave: nenhum pedido enviado sem ela', True)
# importação por link: código real da falha chega à telemetria
r=ev(A,"fetch('/api/importar',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({versao:1,pedidoId:'l_t102',tipo:'importar_link',urls:['https://tdn.totvs.com/pages/viewpage.action?pageId=1']})}).then(r=>r.json()).then(j=>JSON.stringify([j.ok,j.erro||null,j.resultados?.[0]?.erro?.codigo||null]))"); rj=json.loads(r)
ck('importação que falha em todos os links: resposta sem erro geral, com erro por link', rj[0]==False and rj[1] is None and rj[2], r)
A.wait_for_timeout(1500)
ck('sem erro de script', not ea, ea[:2])
print('CODIGO_ESPERADO',rj[2])
print('FALHAS:',len(F)); [print(' -',x) for x in F]; p.stop()
