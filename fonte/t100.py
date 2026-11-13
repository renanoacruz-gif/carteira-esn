# Atualizar ferramenta: versão publicada, aviso de nova versão e recarga sem reinstalar o atalho
from t40_lib import *
import json
P,e=open_h('exec_atu@totvs.com.br')
b0=ev(P,"BUILD")
ck('página carrega com a versão do pacote', isinstance(b0,str) and len(b0)==12 and b0!='__BUILD__', b0)
r=ev(P,"fetch('/api/versao',{cache:'no-store'}).then(r=>r.json()).then(j=>JSON.stringify(j))"); rj=json.loads(r)
ck('servidor informa a mesma versão', rj['ok'] and rj['v']==b0, r)
ck('mesma versão: sem aviso', ev(P,"atuCheck().then(v=>v)")==False and ev(P,"document.getElementById('atu-bar')")==None)
ck('botão "Atualizar ferramenta" no menu lateral', ev(P,"!!document.querySelector('#sbfoot [data-a=atuGo]')") and 'Atualizar ferramenta' in ev(P,"document.querySelector('#sbfoot').innerText"))
ev(P,"UI.view='conta';render();0"); P.wait_for_timeout(300)
ck('botão e explicação em Minha conta', ev(P,"!!document.querySelector('#app [data-a=atuGo]')") and 'Não precisa reinstalar o atalho' in ev(P,"document.querySelector('#app').innerText"))
# servidor com versão diferente → aviso
P.route('**/api/versao',lambda rt: rt.fulfill(status=200,content_type='application/json',body='{"ok":true,"v":"ffffffffffff"}'))
ck('versão diferente no servidor: aviso aparece uma única vez', ev(P,"atuCheck().then(()=>atuCheck())")==True and ev(P,"document.querySelectorAll('#atu-bar').length")==1 and 'Nova versão' in ev(P,"document.getElementById('atu-bar').innerText"))
ev(P,"render();0"); P.wait_for_timeout(200)
ck('aviso sobrevive à troca de tela; Conta indica nova versão', ev(P,"!!document.getElementById('atu-bar')") and 'há uma nova versão disponível' in ev(P,"document.querySelector('#app').innerText"))
P.route('**/api/versao',lambda rt: rt.fulfill(status=500,body='x'))
ck('falha na consulta não derruba nem apaga o aviso', ev(P,"atuCheck().then(v=>v)")==False and ev(P,"!!document.getElementById('atu-bar')"))
# atualizar: grava pendências, recarrega e limpa o endereço
ev(P,"window.__antes=1;S.meta.atuTeste='gravado';touchMeta();0")
P.click('#atu-bar [data-a=atuGo]'); P.wait_for_function("window.__antes===undefined && document.body.innerText.includes('Ferramenta atualizada')",timeout=20000); tok=True; P.wait_for_timeout(3000)
ck('recarregou a página (estado em memória zerado)', ev(P,"window.__antes")==None and ev(P,"typeof BUILD")=='string')
ck('endereço limpo após a recarga', ev(P,"location.pathname+location.search")=='/')
ck('dado pendente foi gravado antes de recarregar', ev(P,"S.meta.atuTeste")=='gravado', ev(P,"S.meta.atuTeste"))
ck('confirmação exibida após a recarga', tok)
ev(P,"delete S.meta.atuTeste;touchMeta();0"); P.wait_for_timeout(800)
ck('sem erro de script', not e, e[:2])
print('FALHAS:',len(F)); [print(' -',x) for x in F]; p.stop()
