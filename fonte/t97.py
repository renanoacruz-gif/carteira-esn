# t97 — Meu Forecast: integração simplificada da Mesa Forecast no Analisador de Carteira
# (normalização de status, parsing de número/data, metas por nome com fallback, KPIs por
# período mensal/trimestral/anual com meta zerada/ausente, vínculo manual oportunidade-cliente,
# render da nova tela sem erros)
import sys, time, json; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t97.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

# ---------- normalização de status ----------
for s, exp in [('GANHA', 'GANHA'), ('Ganho', 'GANHA'), ('EM ABERTO', 'EM ABERTO'), ('Aberta', 'EM ABERTO'),
               ('Em Assinatura', 'EM ASSINATURA'), ('PERDIDA', 'PERDIDA'), ('Perdido', 'PERDIDA'), ('Cancelada', 'OUTRO')]:
    r = ev(A, "fcNormStatus(%r)" % s)
    ck('fcNormStatus(%r) == %r' % (s, exp), r == exp, r)

# ---------- parsing de número (decimal brasileiro) e data ----------
for v, exp in [('1.234,56', 1234.56), ('500', 500), ('', 0), ('R$ 2.000,00', 2000), (None, 0), ('abc', 0)]:
    r = ev(A, "fcPNum(%s)" % json.dumps(v))
    ck('fcPNum(%r) == %r' % (v, exp), abs(r - exp) < 0.001, r)

for v, ano, mes, exp in [('15/04/2026', 2026, '04', '2026-04-15'), ('2026-04-05', 2026, '04', '2026-04-05'), ('', 2026, '04', '2026-04-01'), ('texto', 2026, '09', '2026-09-01')]:
    r = ev(A, "fcPData(%r, %d, %r)" % (v, ano, mes))
    ck('fcPData(%r) == %r' % (v, exp), r == exp, r)

# ---------- fcHash: determinístico e sem colisão trivial ----------
h1 = ev(A, "fcHash('abc|def')"); h2 = ev(A, "fcHash('abc|def')"); h3 = ev(A, "fcHash('abc|ghi')")
ck('fcHash determinístico', h1 == h2, (h1, h2))
ck('fcHash distingue chaves diferentes', h1 != h3, (h1, h3))
ck('fcHash gera id válido para seletor CSS (sem ":")', ':' not in h1, h1)

# ---------- metas: casar pelo primeiro nome do usuário logado, com fallback para todas as linhas ----------
ev(A, "ME.nome='Renan Oscar Araujo'; S.meta.fcData={opps:[],metas:[{nome:'Renan Silva',tipo:'CDU',ano:120000,mes:Array(9).fill(10000),tri:[30000,30000,30000,30000]},{nome:'Bruno Souza',tipo:'CDU',ano:100000,mes:Array(9).fill(9000),tri:[27000,27000,27000,27000]}]}; 1")
rows = ev(A, "fcMetaRows().map(r=>r.nome)")
ck('fcMetaRows casa só a linha "Renan Silva" (primeiro nome do usuário)', rows == ['Renan Silva'], rows)

ev(A, "ME.nome='Zeca da Silva'; 1")
rows2 = ev(A, "fcMetaRows().map(r=>r.nome)")
ck('fcMetaRows sem correspondência: fallback para todas as linhas (igual ao original)', sorted(rows2) == ['Bruno Souza', 'Renan Silva'], rows2)

# ---------- período: meses incluídos por seleção ----------
ck('fcMesesSel mensal retorna só o mês selecionado', ev(A, "JSON.stringify(fcMesesSel('mensal','08'))") == '["08"]')
ck('fcMesesSel trimestral Q2 retorna abr/mai/jun', ev(A, "JSON.stringify(fcMesesSel('trimestral','Q2'))") == '["04","05","06"]')
ck('fcMesesSel anual retorna os 9 meses do ciclo', ev(A, "fcMesesSel('anual',null).length") == 9)

# ---------- fcMetaTotal: soma das linhas casadas, por período ----------
ev(A, "ME.nome='Renan Oscar'; S.meta.fcData={opps:[],metas:[{nome:'Renan X',tipo:'CDU',ano:120000,mes:[10000,10000,10000,10000,10000,10000,10000,10000,10000],tri:[0,30000,30000,30000]}]}; 1")
ck('fcMetaTotal mensal (ago=idx4) == 10000', ev(A, "fcMetaTotal('mensal','08')") == 10000)
ck('fcMetaTotal trimestral Q2 == 30000', ev(A, "fcMetaTotal('trimestral','Q2')") == 30000)
ck('fcMetaTotal anual == 120000', ev(A, "fcMetaTotal('anual',null)") == 120000)

# ---------- fcOppsPeriodo + fcKPI: meta configurada, realizado < meta ----------
ev(A, """S.meta.fcData={opps:[
  {id:'o1',tab:'AGOSTO',mes:'08',cliente:'Cliente A',produto:'P1',status:'GANHA',cdu:1000,rec:2000,serv:0,total:3000,data:'2026-08-10',vendedor:''},
  {id:'o2',tab:'AGOSTO',mes:'08',cliente:'Cliente B',produto:'P2',status:'EM ABERTO',cdu:0,rec:0,serv:5000,total:5000,data:'2026-08-12',vendedor:''},
  {id:'o3',tab:'AGOSTO',mes:'08',cliente:'Cliente C',produto:'P3',status:'EM ASSINATURA',cdu:4000,rec:0,serv:0,total:4000,data:'2026-08-15',vendedor:''},
  {id:'o4',tab:'SETEMBRO',mes:'09',cliente:'Cliente D',produto:'P4',status:'GANHA',cdu:0,rec:0,serv:9999,total:9999,data:'2026-09-01',vendedor:''}
], metas:[{nome:'Renan Oscar',tipo:'CDU',ano:120000,mes:[0,0,0,0,10000,0,0,0,0],tri:[0,0,0,0]}]}; ME.nome='Renan Oscar'; 1""")
k = ev(A, "fcKPI('mensal','08')")
ck('KPI mensal ago: meta == 10000', k['meta'] == 10000, k['meta'])
ck('KPI mensal ago: realizado soma só GANHA do mês (3000, ignora set/aberto/assinatura)', k['realizado'] == 3000, k['realizado'])
ck('KPI mensal ago: atingimento == 30%', round(k['atingimento']) == 30, k['atingimento'])
ck('KPI mensal ago: falta == 7000', k['falta'] == 7000, k['falta'])
ck('KPI mensal ago: excedente == 0', k['excedente'] == 0, k['excedente'])
ck('KPI mensal ago: aberto 1 oportunidade, R$5000', k['aberto']['n'] == 1 and k['aberto']['v'] == 5000, k['aberto'])
ck('KPI mensal ago: assinatura 1 oportunidade, R$4000', k['assinatura']['n'] == 1 and k['assinatura']['v'] == 4000, k['assinatura'])
g = {x['t']: x['ganho'] for x in k['porTipo']}
ck('KPI mensal ago: ganho por tipo cdu=1000, rec=2000, serv=0 (só da ganha de agosto)', g == {'cdu': 1000, 'rec': 2000, 'serv': 0}, g)

# ---------- tipo de venda: meta x ganho filtrados por CDU / Recorrente / Serviços ----------
ck('fcNormRev normaliza os tipos', ev(A, "[fcNormRev('CDU'),fcNormRev('Recorrente'),fcNormRev('Serviços'),fcNormRev('rec'),fcNormRev('TOTAL')]") == ['cdu', 'rec', 'serv', 'rec', None])
ev(A, "S.meta.fcData.metas=[{nome:'Renan Oscar',tipo:'CDU',ano:0,mes:[0,0,0,0,4000,0,0,0,0],tri:[0,0,0,0]},{nome:'Renan Oscar',tipo:'Recorrente',ano:0,mes:[0,0,0,0,8000,0,0,0,0],tri:[0,0,0,0]},{nome:'Renan Oscar',tipo:'TOTAL',ano:0,mes:[0,0,0,0,99999,0,0,0,0],tri:[0,0,0,0]}]; 1")
kt = ev(A, "fcKPI('mensal','08','')")
ck('todos os tipos: meta soma CDU+Recorrente e ignora linha sem tipo válido (12000)', kt['meta'] == 12000, kt['meta'])
kc = ev(A, "fcKPI('mensal','08','cdu')")
ck('tipo CDU: meta 4000, realizado 1000 (só a parcela CDU da ganha), 25%', kc['meta'] == 4000 and kc['realizado'] == 1000 and round(kc['atingimento']) == 25, kc)
ck('tipo CDU: em assinatura conta só oportunidade com CDU (1, R$4000); em aberto 0', kc['assinatura'] == {'n': 1, 'v': 4000} and kc['aberto']['n'] == 0, (kc['assinatura'], kc['aberto']))
kr = ev(A, "fcKPI('mensal','08','rec')")
ck('tipo Recorrente: meta 8000, realizado 2000', kr['meta'] == 8000 and kr['realizado'] == 2000, kr)
ks = ev(A, "fcKPI('mensal','08','serv')")
ck('tipo Serviços sem meta: atingimento null, em aberto R$5000', ks['atingimento'] is None and ks['aberto']['v'] == 5000, ks)
pt = {x['t']: x for x in kt['porTipo']}
ck('porTipo traz meta x ganho dos 3 tipos', pt['cdu']['meta'] == 4000 and pt['cdu']['ganho'] == 1000 and pt['rec']['ganho'] == 2000 and pt['serv']['pct'] is None, kt['porTipo'])
ev(A, "S.meta.fcData.metas=[{nome:'Renan Oscar',tipo:'CDU',ano:120000,mes:[0,0,0,0,10000,0,0,0,0],tri:[0,0,0,0]}]; 1")

# ---------- meta zerada/ausente: não gera percentual enganoso ----------
k0 = ev(A, "fcKPI('mensal','04')")  # abril: sem meta configurada (0) e sem oportunidades
ck('meta zerada/ausente: atingimento é null (não divide por zero)', k0['atingimento'] is None, k0['atingimento'])
ck('meta zerada/ausente: falta == 0 (max(0-0,0))', k0['falta'] == 0, k0['falta'])

# ---------- excedente: realizado > meta ----------
ev(A, "S.meta.fcData.metas=[{nome:'Renan Oscar',tipo:'CDU',ano:120000,mes:[0,0,0,0,1000,0,0,0,0],tri:[0,0,0,0]}]; 1")
ke = ev(A, "fcKPI('mensal','08')")
ck('realizado > meta: falta == 0', ke['falta'] == 0, ke['falta'])
ck('realizado > meta: excedente == realizado - meta (2000)', ke['excedente'] == 2000, ke['excedente'])

# ---------- vínculo manual oportunidade-cliente: nunca por nome semelhante ----------
ev(A, "S.clients['c_t97']={key:'c_t97',name:'Cliente Alfa Participações S/A',code:'C-9001',cnpj:'12345678000190',opps:[],cadConf:[],conflicts:[]}; 1")
ck('fcFindCliente por código exato', ev(A, "fcFindCliente('C-9001')?.key") == 'c_t97')
ck('fcFindCliente por CNPJ (com máscara)', ev(A, "fcFindCliente('12.345.678/0001-90')?.key") == 'c_t97')
ck('fcFindCliente por razão social exata', ev(A, "fcFindCliente('Cliente Alfa Participações S/A')?.key") == 'c_t97')
ck('fcFindCliente NÃO casa por nome parecido (exige exato)', ev(A, "fcFindCliente('Cliente Alfa')") is None)
ck('fcFindCliente sem resultado para texto aleatório', ev(A, "fcFindCliente('xyz-inexistente')") is None)

ev(A, "delete S.meta.fcLink; 1")
ev(A, "fcLinkConfirm('o1','C-9001')")
link = ev(A, "S.meta.fcLink['o1']")
ck('fcLinkConfirm com match exato grava o vínculo manual', link == 'c_t97', link)
ev(A, "fcLinkConfirm('o2','nao existe')")
link2 = ev(A, "S.meta.fcLink['o2']")
ck('fcLinkConfirm sem match não grava vínculo (sem vínculo automático por aproximação)', link2 is None, link2)
ev(A, "fcLink('o1', '')")
ck('fcLink remove o vínculo quando chave vazia', ev(A, "S.meta.fcLink['o1']") is None)
ev(A, "delete S.clients['c_t97']; 1")

# ---------- render: tela "Meu Forecast" existe na navegação e renderiza sem erro, com e sem dados ----------
ck('NAV inclui o destino "forecast"', ev(A, "NAV.some(x=>x[0]==='forecast'||x[3].some(s=>s[0]==='forecast'))"))
ck('V dispatch (ui.js) liga forecast -> vForecast', ev(A, "typeof vForecast") == 'function')

ev(A, "delete S.meta.fcData; delete S.meta.fcSheet; UI.view='forecast'; render(); 1")
A.wait_for_timeout(150)
html0 = ev(A, "document.getElementById('app').innerHTML")
ck('sem dados sincronizados: tela mostra orientação para vincular a planilha', 'Mesa Forecast' in html0, len(html0))

ev(A, """S.meta.fcSheet={url:'https://docs.google.com/spreadsheets/d/0123456789abcdefghij',minutes:30,auto:true,lastOk:new Date().toISOString()};
S.meta.fcData={opps:[{id:'ox1',tab:'AGOSTO',mes:'08',cliente:'Cliente Z',produto:'ERP',status:'GANHA',cdu:1000,rec:0,serv:0,total:1000,data:'2026-08-05',vendedor:''}],metas:[{nome:'Renan Oscar',tipo:'CDU',ano:12000,mes:[0,0,0,0,1000,0,0,0,0],tri:[0,0,0,0]}]};
UI.fc={per:'mensal',sel:'08'}; render(); 1""")
A.wait_for_timeout(150)
html1 = ev(A, "document.getElementById('app').innerHTML")
ck('com dados: mostra os KPIs de meta/realizado', 'Meta comercial' in html1 and 'Realizado' in html1, len(html1))
ck('com dados: seletor de tipo de venda e bloco Meta × Ganho por tipo', 'fcftipo' in html1 and 'Meta × Ganho por tipo de venda' in html1, len(html1))
ev(A, "UI.fc.tipo='rec'; render(); 1")
ck('filtro Recorrente: oportunidade só-CDU some da tabela', 'Cliente Z' not in ev(A, "document.getElementById('app').innerHTML"))
ev(A, "UI.fc.tipo=''; render(); 1"); html1 = ev(A, "document.getElementById('app').innerHTML")
ck('com dados: mostra a tabela de oportunidades com a linha sincronizada', 'Cliente Z' in html1, len(html1))

ev(A, "UI.view='geral'; render(); 1")  # sai da tela antes de terminar (não deixa UI.view preso em forecast p/ outros testes)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
