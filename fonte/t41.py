from t40_lib import *
D='/home/claude/test/data/'
D_=D
D=D_
A,ea=open_h('dora@totvs.com.br')
txt=lambda: ev(A,"document.getElementById('app').innerText")
ck('sem chave: aviso aparece', 'Nenhuma chave de IA conectada' in txt(), txt()[:200])
ck('aviso diz que o restante funciona', 'funcionam normalmente' in txt())
ck('catálogo TOTVS carregado para usuário novo', ev(A,"S.solutions.filter(r=>!r._priv).length")>5)
ck('carteira zerada para usuário novo', ev(A,"clients().length")==0)
# usável sem IA: importar carteira
A.evaluate("UI.view='importar'; render()"); A.wait_for_timeout(300)
A.set_input_files('#f-cart',D+'carteira.xlsx'); A.wait_for_timeout(500); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(3500)
ck('importa a própria carteira sem chave', ev(A,"clients().length")>=3, ev(A,"clients().length"))
A.evaluate("UI.view='geral'; render()"); A.wait_for_timeout(300)
ck('aviso continua em outras telas', 'Nenhuma chave de IA conectada' in txt())
# botão leva às configurações de IA
A.click('[data-a=nav][data-v=ia]'); A.wait_for_timeout(400)
ck('botão leva a IA e provedores', 'Minhas chaves de IA' in txt())
# tentar usar IA sem chave: mensagem clara
ev(A,"window.__t=null; iaTestar('openai').then(()=>window.__t=document.getElementById('toast').innerText)"); A.wait_for_timeout(1500)
ck('IA sem chave: mensagem pede para cadastrar', 'Cadastre sua chave' in ev(A,"document.getElementById('toast').innerText") or 'Cadastre sua chave' in txt(), ev(A,"document.getElementById('toast').innerText"))
# salva chave do OpenAI: padrão continua Gemini
A.fill('#hk-openai','sk-teste-0000111122'); A.click('[data-a=hkSalvar][data-p=openai]'); A.wait_for_timeout(300)
t=txt(); ck('padrão sem chave: aviso específico', 'provedor padrão' in t.lower() and 'sem chave' in t.lower(), t[:250])
A.click('input[data-c=iaprov][value=openai]'); A.wait_for_timeout(300)
ck('com padrão que tem chave: aviso some', 'Nenhuma chave de IA conectada' not in txt() and 'está sem chave' not in txt())
A.click('[data-a=hkRemover][data-p=openai]'); A.wait_for_timeout(300)
ck('removendo a chave: aviso volta', 'Nenhuma chave de IA conectada' in txt())
ck('sem erros de página', not ea, str(ea[:2]))
p.stop(); print('FAILS',F)
