# t98 — Carteira & MRR: importação da planilha Clientes_ESN (Empodera) no cadastro único,
# derivação (quadrantes, recência, produtos/etiquetas), qualidade, histórico, gestão da conta e telas
import sys, time, json; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
A, errs = open_h('qa.t98.%d@totvs.com.br' % time.time())
A.wait_for_timeout(500)

# ---------- utilidades ----------
for v, exp in [('1.234,56', 1234.56), ('R$ 2.000,00', 2000), (1500.456, 1500.46), ('', 0), ('-', 0), ('12.5', 12.5)]:
    r = ev(A, "empNum(%s)" % json.dumps(v)); ck('empNum(%r)' % (v,), abs(r - exp) < 0.001, r)
ck('empDate dd/mm/aaaa', ev(A, "empDate('05/03/2024')") == '2024-03-05')
ck('empDate serial Excel (45292 = 01/01/2024)', ev(A, "empDate(45292)") == '2024-01-01')
ck('empDate objeto Date à meia-noite local', ev(A, "empDate(new Date(2025, 6, 9))") == '2025-07-09')
ck('empDate vazio', ev(A, "empDate('')") is None)
pp = ev(A, "empParseProd('PROTHEUS, RH | Restrito, TECHFIN | CONSIGNADO, Retenção 2025, -')")
ck('empParseProd separa produtos', pp['produtos'] == ['PROTHEUS', 'RH', 'TECHFIN CONSIGNADO'], pp['produtos'])
ck('empParseProd separa etiquetas com severidade', [(t['k'], t['sev']) for t in pp['tags']] == [['restrito', 'crit'], ['retencao 2025', 'serious']] or [(t['k'], t['sev']) for t in pp['tags']] == [('restrito', 'crit'), ('retencao 2025', 'serious')], pp['tags'])

# ---------- cliente pré-existente no Analisador (mesmo código da planilha) ----------
ev(A, """(()=>{ const c = S.clients['c_T100'] = { key:'c_T100', code:'T100', name:'NOME DO ANALISADOR', cnpj:'', cnpjRaw:'', seg:'Indústria', city:'', size:'', mrr:777, productsRaw:'', churn:'', nps:'', notes:'nota antiga', uf:'', regime:'', release:'', fichas:[], docs:[], mgmt:{}, act:{} }; cadInit(c); runAnalysis(c); return 1; })()""")

IMP = """(async (rows, nome) => { await vend('xlsx'); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Relatório'], [], rows[0], ...rows.slice(1)]), 'Clientes');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }); await empArquivo(new File([buf], nome)); return UI.emp.pend ? UI.emp.pend.recs.length : -1; })(%s, %s)"""
H = ['Cód', 'NOME RAZÃO SOCIAL', 'NOME FANTASIA', 'CNPJ', 'SITUAÇÃO', 'SITUAÇÃO (PROTHEUS)', 'SEGMENTO', 'PRODUTO (ETIQUETA EMPODERA)', 'ESTADO', 'CIDADE', 'MRR CONTRATADO', 'MRR PAGANTE', 'MRR PAGANTE SOMA GRUPO EMP', 'ÚLTIMA VENDA PRODUTO', 'ÚLTIMA VENDA SERVIÇO', 'LINK EMPODERA']
R1 = [H,
  ['T100', 'ALFA SA', 'Alfa', '11222333000144', 'ATIVO', 'ATIVO', 'MANUFATURA', 'PROTHEUS, RH', 'PR', 'CURITIBA', 30000, 25000, 40000, '10/01/2023', '01/09/2025', 'https://empodera.example/alfa'],
  ['T200', 'BETA LTDA', 'Beta', '22333444000155', 'ATIVO', 'INATIVO', 'SERVICOS', 'PROTHEUS | Restrito', 'PR', 'PINHAIS', 50000, 50000, 50000, '01/08/2025', '', ''],
  ['T300', 'GAMA ME', '#N/A', '33444555000166', 'ATIVO', 'ATIVO', 'VAREJO', '-', 'PR', 'CURITIBA', 800, 800, 800, '15/02/2022', '', ''],
  ['T400', 'DELTA SA', 'Delta', '44555666000177', 'ATIVO', 'ATIVO', 'VAREJO', 'FLUIG', 'SC', 'JOINVILLE', '1.500,00', '1.500,00', 0, '20/09/2025', '', ''],
  ['T500', 'EPSILON', 'Epsilon', '55666777000188', 'INATIVO', 'INATIVO', 'LOGISTICA', '', 'PR', 'CURITIBA', 0, 0, 0, '', '', ''],
  ['T600', 'ZETA', 'Zeta', '66777888000199', 'ATIVO', 'ATIVO', 'LOGISTICA', 'RM', 'PR', 'CURITIBA', 0, 0, 0, '', '', '']]
H.append('GRUPO EMPRESARIAL')
for r in R1[1:]: r.append({'T100': 'GRUPO ALFA', 'T300': 'Grupo Varejo', 'T400': 'GRUPO VAREJO'}.get(r[0], ''))
n = ev(A, IMP % (json.dumps(R1), json.dumps('Clientes_ESN_01_10_2025.xlsx')))
ck('planilha lida: 6 clientes (cabeçalho achado abaixo de linhas de título)', n == 6, n)
ck('data-base sugerida pelo nome do arquivo', ev(A, "UI.emp.pend.data") == '2025-10-01')
pl = ev(A, "(()=>{ const p = empPlano(UI.emp.pend.recs); return { novos: p.novos.length, primeira: p.primeira.length, mud: p.mud.length, aus: p.ausentes.length }; })()")
ck('prévia: 5 novos, 1 já cadastrado (casado pelo código), 0 ausentes', pl == {'novos': 5, 'primeira': 1, 'mud': 0, 'aus': 0}, pl)
ck('prévia não altera nada antes de aplicar', ev(A, "Object.keys(S.clients).length") == 1)
ev(A, "UI.view = 'mrr'; render(); 1"); ck('prévia aparece na tela', 'Aplicar importação' in ev(A, "document.getElementById('app').innerHTML"))
ev(A, "empAplicar('2025-10-01')")

ck('cadastro único: 6 clientes no Analisador', ev(A, "Object.keys(S.clients).length") == 6)
c1 = ev(A, "(()=>{ const c = S.clients['c_T100']; return { name: c.name, mrr: c.mrr, notes: c.notes, seg: c.seg, mrrP: c.emp.mrrP, mrrC: c.emp.mrrC, uvp: c.emp.uvp, uvs: c.emp.uvs, fant: c.emp.fantasia }; })()")
ck('cliente existente: cadastro do Analisador preservado', c1['name'] == 'NOME DO ANALISADOR' and c1['notes'] == 'nota antiga' and c1['seg'] == 'Indústria', c1)
ck('MRR oficial do cadastro passa a ser o MRR pagante do Empodera (era 777)', c1['mrr'] == 25000, c1['mrr'])
fz = ev(A, "(()=>{ const o = freezeClient(S.clients['c_T100']); return { mrrP: o.emp && o.emp.mrrP, uvp: o.emp && o.emp.uvp }; })()")
ck('persistência: bloco Empodera é gravado com o cliente', fz == {'mrrP': 25000, 'uvp': '2023-01-10'}, fz)
ck('cliente existente: bloco Empodera preenchido', c1['mrrP'] == 25000 and c1['mrrC'] == 30000 and c1['uvp'] == '2023-01-10' and c1['uvs'] == '2025-09-01' and c1['fant'] == 'Alfa', c1)
c4 = ev(A, "(()=>{ const c = Object.values(S.clients).find(c => c.code === 'T400'); return { name: c.name, cnpj: c.cnpj, seg: c.seg, uf: c.uf, mrr: c.mrr, mrrP: c.emp.mrrP, opps: Array.isArray(c.opps) }; })()")
ck('cliente novo criado com cadastro e análise', c4 == {'name': 'Delta', 'cnpj': '44555666000177', 'seg': 'VAREJO', 'uf': 'SC', 'mrr': 1500, 'mrrP': 1500, 'opps': True}, c4)
ck('#N/A no nome fantasia vira vazio (usa razão social)', ev(A, "empDerive().find(d => d.cod === 'T300').nome") == 'GAMA ME')

# ---------- derivação ----------
D = {d['cod']: d for d in ev(A, "empDerive().map(d => ({ cod: d.cod, quad: d.quad, ativo: d.ativo, dp: d.dp, gap: d.gap, bucket: d.bucket.k, tags: d.tags.map(t => t.k), produtos: d.produtos }))")}
ck('quadrantes: Proteger / Expandir / Reativar / Nutrir / Inativo / Sem data', [D[k]['quad'] for k in ['T100', 'T200', 'T300', 'T400', 'T500', 'T600']] == ['Proteger', 'Expandir', 'Reativar', 'Nutrir', 'Inativo', 'Sem data'], {k: v['quad'] for k, v in D.items()})
ck('dias desde a última venda de produto pela data-base', D['T200']['dp'] == 61, D['T200']['dp'])
ck('gap contratado − pagante', D['T100']['gap'] == 5000 and D['T200']['gap'] == 0, (D['T100']['gap'], D['T200']['gap']))
ck('etiqueta Restrito separada do produto', D['T200']['tags'] == ['restrito'] and D['T200']['produtos'] == ['PROTHEUS'], D['T200'])
T = ev(A, "(()=>{ const t = empTotais(empDerive()); return { n: t.n, ativos: t.ativos, mrrP: t.mrrP, ticket: t.ticket, pag: t.pagantes }; })()")
ck('totais: 6 clientes, 5 ativos, MRR 77.300, 4 pagantes', T['n'] == 6 and T['ativos'] == 5 and T['mrrP'] == 77300 and T['pag'] == 4 and abs(T['ticket'] - 15460) < 0.01, T)
ev(A, "empSetCfg('baseRecencia', 'recente')")
ck('base "mais recente": T100 deixa de ser Proteger (serviço em 09/2025)', ev(A, "empDerive().find(d => d.cod === 'T100').quad") == 'Expandir')
ev(A, "empSetCfg('baseRecencia', 'produto'); empSetCfg('limiarMrr', '60.000')")
ck('limiar de MRR 60 mil: T200 vira Nutrir e T100 Reativar', ev(A, "empDerive().filter(d => ['T100','T200'].includes(d.cod)).map(d => d.quad).sort()") == ['Nutrir', 'Reativar'])
ev(A, "empSetCfg('limiarMrr', '20000'); empSetCfg('limiarDias', '10')"); ck('limiar de dias inválido (<30) é ignorado', ev(A, "S.meta.emp.cfg.limiarDias") == 365)

# ---------- grupos, plano da semana e movimento (antes da 2ª importação) ----------
G = ev(A, "empGrupos().map(g => [g.nome.toUpperCase(), g.n, g.mrr, g.grupo, g.fora])")
ck('grupos: MRR do grupo fora da carteira e contas do mesmo grupo', G == [['GRUPO ALFA', 1, 25000, 40000, 15000], ['GRUPO VAREJO', 2, 2300, 800, 0]], G)
ck('movimento do MRR só existe a partir da 2ª importação', ev(A, "empMov()") is None)
ps = ev(A, "empPlanoSemana().map(x => [x.tipo, x.nome])")
ck('plano da semana: conta em Proteger sem próxima ação', ps == [['Proteger sem ação', 'Alfa']], ps)

# ---------- qualidade ----------
Q = {r['id']: r['cods'] for r in ev(A, "empRegras().map(r => ({ id: r.id, cods: r.itens.map(d => d.cod).sort() }))")}
ck('qualidade: situação divergente', Q['sitdiv'] == ['T200'], Q['sitdiv'])
ck('qualidade: ativo sem MRR', Q['semmrr'] == ['T600'], Q['semmrr'])
ck('qualidade: nome fantasia ausente', Q['nome'] == ['T300'], Q['nome'])
ck('qualidade: contratado > pagante', Q['gap'] == ['T100'], Q['gap'])
ck('qualidade: grupo com MRR fora', Q['grupo'] == ['T100'], Q['grupo'])
ck('qualidade: sem etiqueta de produto (ativos)', Q['semprod'] == ['T300'], Q['semprod'])
ck('contador de qualidade ignora regras informativas', ev(A, "empQualN()") == 3, ev(A, "empQualN()"))

# ---------- filtros e telas ----------
ev(A, "UI.view = 'mrr'; 1")
for tab, txt in [('painel', 'Top 5 clientes'), ('semana', 'Plano da semana'), ('grupos', 'Grupos empresariais'), ('visao', 'Leituras da carteira'), ('recencia', 'Matriz MRR'), ('produtos', 'Matriz cliente × produto'), ('qualidade', 'Situação Empodera × Protheus'), ('dados', 'Parâmetros da análise')]:
    ev(A, "UI.emp.tab = %r; render(); 1" % tab); A.wait_for_timeout(60)
    ck('aba %s renderiza' % tab, txt in ev(A, "document.getElementById('app').innerHTML"))
cods = "filtered().map(c => c.code).sort()"
ev(A, "empIr({ quad: 'Proteger' })"); ck('clique no quadrante abre Clientes filtrado', ev(A, "UI.view") == 'clientes' and ev(A, cods) == ['T100'], ev(A, cods))
hc = ev(A, "document.getElementById('app').innerHTML"); ck('lista Clientes mostra Quadrante e última venda, com o filtro ativo em chip', '<th>Quadrante</th>' in hc and 'Quadrante: Proteger' in hc)
ev(A, "empIr({ seg: 'VAREJO', sit: 'todos' })"); ck('filtro por segmento do Empodera', ev(A, cods) == ['T300', 'T400'], ev(A, cods))
ev(A, "empIr({ prod: 'restrito' })"); ck('filtro por etiqueta', ev(A, cods) == ['T200'], ev(A, cods))
ev(A, "empIr({ sit: 'inativos' })"); ck('filtro por situação no Empodera', ev(A, cods) == ['T500'], ev(A, cods))
ev(A, "UI.f = { ...UI.f, ...EMP_FCLR }; 1"); ck('sem filtros do Empodera a lista mostra todos', ev(A, "filtered().length") == 6)
ev(A, "UI.view = 'mrr'; 1")

# ---------- gestão da conta na ficha existente ----------
ev(A, "empGstSet('c_T100', 'prioridade', 'Alta'); empGstSet('c_T100', 'proximaAcao', ' Visitar o diretor '); empGstSet('c_T100', 'dataAcao', '2020-01-01'); empGstSet('c_T100', 'potencial', '12.000,00'); empGstSet('c_T100', 'campoInvalido', 'x'); 1")
g = ev(A, "S.clients['c_T100'].gst")
ck('persistência: gestão da conta é gravada com o cliente', ev(A, "freezeClient(S.clients['c_T100']).gst.prioridade") == 'Alta')
ev(A, "UI.f.gp = 'Alta'; 1"); ck('filtro por prioridade da conta em Clientes', ev(A, "filtered().map(c => c.code)") == ['T100']); ev(A, "UI.f.gp = ''; 1")
ck('gestão gravada no cliente (campo desconhecido ignorado)', g['prioridade'] == 'Alta' and g['proximaAcao'] == 'Visitar o diretor' and g['potencial'] == 12000 and 'campoInvalido' not in g, g)
ev(A, "UI.sel = 'c_T100'; UI.view = 'cliente'; UI.ctab = 'gestao'; render(); 1"); A.wait_for_timeout(100)
hf = ev(A, "document.getElementById('app').innerHTML")
ck('ficha existente tem a aba Gestão da conta com a posição do Empodera', 'Gestão da conta' in hf and 'Posição no Empodera' in hf and 'Abrir no Empodera' in hf)
ck('interações saem da aba Gestão (um só lugar para registrar contato)', 'gi_txt' not in hf and 'Reunião e retornos' in hf)
ev(A, "UI.ctab = 'reuniao'; render(); 1"); A.wait_for_timeout(100)
ck('aba Reunião e retornos traz o registro de interações', ev(A, "!!document.getElementById('gi_txt') && document.getElementById('app').innerHTML.includes('Retornos')"))
ev(A, "document.getElementById('gi_txt').value = 'Reunião de alinhamento'; empGstAddI('c_T100'); 1")
ck('interação registrada', ev(A, "S.clients['c_T100'].gst.interacoes.map(i => i.texto)") == ['Reunião de alinhamento'])
ev(A, "empGstDelI('c_T100', S.clients['c_T100'].gst.interacoes[0].id); 1"); ck('interação excluída', ev(A, "S.clients['c_T100'].gst.interacoes.length") == 0)
ev(A, "UI.view = 'mrr'; UI.emp.tab = 'visao'; render(); 1"); hv = ev(A, "document.getElementById('app').innerHTML")
ck('agenda mostra a próxima ação vencida', 'Visitar o diretor' in hv and 'Vencida' in hv)

# ---------- ligações com o restante do app ----------
pi = ev(A, "pendItems().filter(x => x.titulo === 'Próxima ação da conta vencida').map(x => [x.tipo, x.key, x.prazo])")
ck('próxima ação vencida entra na central de pendências (e no número do lembrete)', pi == [['acao', 'c_T100', '2020-01-01']], pi)
ck('lembrete diário conta a ação vencida', ev(A, "lemRetornos()") >= 1)
ev(A, "UI.view = 'geral'; render(); 1"); A.wait_for_timeout(150)
ck('Visão da Carteira mostra "Ações de conta para hoje"', ev(A, "(document.getElementById('emphoje') || {}).innerText || ''").find('Visitar o diretor') >= 0)
sig = ev(A, "({ a: empSinais(S.clients['c_T100']).map(x => x.text), b: empSinais(Object.values(S.clients).find(c => c.code === 'T200')).map(x => x.text), n: empSinais(Object.values(S.clients).find(c => c.code === 'T400')).length })")
ck('motor: quadrante Proteger vira sinal de retenção', len(sig['a']) == 1 and 'Proteger' in sig['a'][0], sig['a'])
ck('motor: etiqueta Restrito vira sinal de retenção', len(sig['b']) == 1 and 'Restrito' in sig['b'][0], sig['b'])
ck('motor: cliente sem risco não gera sinal', sig['n'] == 0)
ck('motor: oportunidade de retenção aparece para a conta em Proteger', ev(A, "S.clients['c_T100'].opps.some(o => o.ruleId === 'retencao')"))
ck('motor: base instalada do Empodera preenche produtos quando o cadastro não informa', ev(A, "Object.values(S.clients).find(c => c.code === 'T400').productsRaw") == 'FLUIG' and ev(A, "Object.values(S.clients).find(c => c.code === 'T200').productsRaw") == 'PROTHEUS')
br = dict(ev(A, "empBriefRows(S.clients['c_T100'])"))
ck('briefing: posição do Empodera com quadrante e próxima ação', br.get('Quadrante de atenção') == 'Proteger' and 'Visitar o diretor' in br.get('Próxima ação', '') and br.get('MRR pagante', '').find('contratado') > 0, br)
ck('briefing: cliente sem Empodera não ganha o bloco', ev(A, "empBriefRows({ key: 'x' })") is None)
ev(A, "S.meta.fcData = { opps: [{ id: 'oz', tab: 'ABRIL', mes: '04', cliente: 'Cliente Forecast', produto: 'ERP', status: 'EM ASSINATURA', cdu: 9000, rec: 0, serv: 0, total: 9000, data: '2020-04-10', vendedor: '' }, { id: 'ow', tab: 'ABRIL', mes: '04', cliente: 'Outro', produto: 'RH', status: 'GANHA', cdu: 1, rec: 0, serv: 0, total: 1, data: '2020-04-10', vendedor: '' }], metas: [] }; 1")
ps2 = ev(A, "empPlanoSemana().map(x => [x.tipo, x.nome, x.v])")
ck('plano da semana: ação vencida primeiro, depois assinatura parada do forecast (ganha não entra)', ps2 == [['Ação vencida', 'NOME DO ANALISADOR', 25000], ['Assinatura parada', 'Cliente Forecast', 9000]], ps2)
ev(A, "delete S.meta.fcData; 1")
ck('menu: Carteira & MRR e Meu Forecast agrupados em Visão da Carteira', ev(A, "NAV.find(x => x[0] === 'geral')[3].map(s => s[0])") == ['geral', 'mrr', 'forecast'] and ev(A, "NAV.filter(x => ['mrr', 'forecast'].includes(x[0])).length") == 0)
fs = ev(A, "(()=>{ const I = fcNomeIdx(); return [fcSug({ cliente: 'beta' }, I)?.code || null, fcSug({ cliente: 'BETA LTDA' }, I)?.code || null, fcSug({ cliente: 'Bet' }, I), fcSug({ cliente: 'Nome do Analisador' }, I)?.code || null]; })()")
ck('forecast: sugere vínculo só com nome idêntico (fantasia, razão ou cadastro)', fs == ['T200', 'T200', None, 'T100'], fs)
ev(A, "S.clients['x_dup'] = { ...S.clients['c_T100'], key: 'x_dup', code: 'X1', emp: null, gst: null, name: 'Beta' }; 1")
ck('forecast: nome que casa com dois clientes não é sugerido', ev(A, "fcSug({ cliente: 'Beta' }, fcNomeIdx())") is None)
ev(A, "delete S.clients['x_dup']; UI.view = 'mrr'; 1")

# ---------- segunda importação: MRR alterado, ausente marcado (não apagado), histórico ----------
R2 = [H] + [r[:] for r in R1[1:] if r[0] != 'T400']
R2[1][11] = 28000
ev(A, "UI.view = 'importar'; 1")
n2 = ev(A, IMP.replace('empArquivo', 'loadPortfolio') % (json.dumps(R2), json.dumps('Clientes_ESN_01_11_2025.xlsx')))
ck('ponto único: "Importar e fichas" reconhece a Clientes_ESN e encaminha para Carteira & MRR', ev(A, "UI.view") == 'mrr' and ev(A, "!UI.wiz && UI.emp.tab") == 'dados', ev(A, "UI.view"))
pl2 = ev(A, "(()=>{ const p = empPlano(UI.emp.pend.recs); return { novos: p.novos.length, mud: p.mud.length, aus: p.ausentes.map(c => c.code), antes: p.mrrAntes, novo: p.mrrNovo }; })()")
ck('2ª importação: 0 novos, 1 MRR alterado, T400 ausente', n2 == 5 and pl2['novos'] == 0 and pl2['mud'] == 1 and pl2['aus'] == ['T400'], pl2)
ck('2ª importação: variação de MRR na prévia', pl2['antes'] == 77300 and pl2['novo'] == 78800, pl2)
ev(A, "empAplicar('2025-11-01')")
ck('ausente continua no cadastro, só marcado', ev(A, "Object.keys(S.clients).length") == 6 and ev(A, "Object.values(S.clients).find(c => c.code === 'T400').emp.ausente") is True)
ev(A, "UI.f.es = 'ausentes'; 1"); ck('filtro "fora da última importação" em Clientes', ev(A, "filtered().map(c => c.code)") == ['T400']); ev(A, "UI.f.es = ''; 1")
ck('MRR oficial acompanha a reimportação', ev(A, "S.clients['c_T100'].mrr") == 28000)
ck('ausente sai dos indicadores', ev(A, "empDerive().length") == 5 and ev(A, "empTotais(empDerive()).mrrP") == 78800)
ck('gestão da conta preservada na reimportação', ev(A, "S.clients['c_T100'].gst.prioridade") == 'Alta')
ck('histórico de MRR por cliente', ev(A, "S.clients['c_T100'].emp.hist") == [['2025-10-01', 25000], ['2025-11-01', 28000]], ev(A, "S.clients['c_T100'].emp.hist"))
sn = ev(A, "S.meta.emp.snaps.map(s => [s.data, s.total, s.mrrP])")
ck('snapshots por data-base', sn == [['2025-10-01', 6, 77300], ['2025-11-01', 5, 78800]], sn)
mv = ev(A, "(()=>{ const m = empMov(); return { it: m.it.map(x => [x.nome, x.tipo, x.dv]), subiu: m.subiu, saiu: m.saiu, liq: m.liq, n: m.n }; })()")
ck('movimento do MRR: expansão, saída e líquido', mv['it'] == [['Alfa', 'subiu', 3000], ['Delta', 'saiu', -1500]] and mv['subiu'] == 3000 and mv['saiu'] == -1500 and mv['liq'] == 1500, mv)
ev(A, "UI.view = 'mrr'; UI.emp.tab = 'visao'; render(); 1"); ck('card Movimento do MRR na Visão geral', 'Líquido: +R$' in ev(A, "document.getElementById('app').innerHTML"))
pdf = ev(A, "empPdf()")
ck('resumo executivo em PDF é gerado', isinstance(pdf, int) and pdf > 3000, pdf)
ck('qualidade lista o ausente', ev(A, "empRegras().find(r => r.id === 'aus').itens.map(d => d.cod)") == ['T400'])
ev(A, "UI.emp.tab = 'dados'; render(); 1"); ck('evolução do MRR desenhada com 2 importações', 'em-line' in ev(A, "document.getElementById('app').innerHTML"))

# ---------- planilha inválida não altera nada ----------
bad = ev(A, IMP % (json.dumps([['Nome', 'Valor'], ['x', 1]]), json.dumps('outra.xlsx')))
ck('planilha sem "Cód"/"MRR PAGANTE" é recusada', bad == -1 and ev(A, "Object.keys(S.clients).length") == 6, bad)

ck('planilha comum continua indo para o assistente de colunas', ev(A, "empPreparar('x.xlsx', [{ name: 'A', rows: [['Código', 'Cliente', 'MRR'], ['1', 'X', 10]] }], true)") is False)
ev(A, "UI.view = 'geral'; render(); 1")
ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
