# t83 — rodada 26: expansão da Base de Soluções (35 novos registros: linhas TOTVS, marcas adquiridas, setoriais, IA, parceiros)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t83.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

tot = ev(A, "KB.solutions.length")
ck('base inicial (kb.js) >= 59 soluções (rodada 26: 24 originais + 35 novas; rodadas seguintes só crescem)', tot >= 59, tot)
seedn = ev(A, "(S.meta.seedIds||[]).length")
ck('todos os ids da base inicial foram semeados na conta', seedn == tot, seedn)

ids = ev(A, "S.solutions.map(s=>s.id)")
ck('nenhum id duplicado', len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1])

# productPatterns() constrói sem lançar exceção (regex válidos em todos os 'kw')
pp_err = ev(A, "(()=>{try{prodPatterns();return null}catch(e){return String(e)}})()")
ck('prodPatterns() constrói sem erro com os novos kw', pp_err is None, pp_err)

# fornecedores: os 4 parceiros externos têm fornecedor próprio; o resto cai no default TOTVS (exceto serviços)
forn = ev(A, "({vtex:S.solutions.find(s=>s.id=='vtex')?.fornecedor, docxpress:S.solutions.find(s=>s.id=='docxpress')?.fornecedor, weg:S.solutions.find(s=>s.id=='weg')?.fornecedor, dotz:S.solutions.find(s=>s.id=='dotz')?.fornecedor, lexos:S.solutions.find(s=>s.id=='lexos')?.fornecedor, rm_erp:S.solutions.find(s=>s.id=='rm_erp')?.fornecedor})")
print(forn)
ck('vtex tem fornecedor próprio (joint venture)', forn['vtex'] and 'VTEX' in forn['vtex'])
ck('docxpress tem fornecedor próprio (parceiro)', forn['docxpress'] and 'DOCXPRESS' in forn['docxpress'])
ck('weg tem fornecedor próprio (parceiro)', forn['weg'] and 'WEG' in forn['weg'])
ck('dotz tem fornecedor próprio (parceiro)', forn['dotz'] and 'Dotz' in forn['dotz'])
ck('lexos cai no default TOTVS (empresa do grupo, não parceiro externo)', forn['lexos'] == 'TOTVS', forn['lexos'])
ck('rm_erp (produto comum) cai no default TOTVS', forn['rm_erp'] == 'TOTVS', forn['rm_erp'])

# nenhum novo registro nasce "Validado" — status inicial é sempre Em revisão ou NECESSITA VALIDAÇÃO
novos = ['rm_erp','winthor_erp','winthor_wms','rm_labore','rm_smartview','rm_portal','datasul_suprimentos','totvs_performance','totvs_conector','totvs_ged','totvs_pix','totvs_rental','rdstation','linx','varejonline','systock','feedz','rubeus','rm_saude','datasul_gps','guia_saude','totvs_omni','totvs_educacional','gestao_estagio','totvs_juridico','totvs_hospitalidade','corten','lynn','intera','carol','vtex','docxpress','weg','dotz','lexos']
ck('35 ids novos presentes na base', len(novos) == 35 and all(i in ids for i in novos), [i for i in novos if i not in ids])
st = ev(A, "Object.fromEntries(%r.map(id=>[id, S.solutions.find(s=>s.id===id)?.status]))" % novos)
bad = {k: v for k, v in st.items() if v not in ('Em revisão', 'NECESSITA VALIDAÇÃO')}
ck('nenhum novo registro nasce "Validado" (exige validação humana)', not bad, bad)

# tipos herdados do TIPO_SEED aplicados corretamente (amostra)
tp = ev(A, "({rm_erp:S.solutions.find(s=>s.id=='rm_erp')?.tipo, corten:S.solutions.find(s=>s.id=='corten')?.tipo, totvs_performance:S.solutions.find(s=>s.id=='totvs_performance')?.tipo, vtex:S.solutions.find(s=>s.id=='vtex')?.tipo})")
ck('rm_erp tipo=produto', tp['rm_erp'] == 'produto', tp)
ck('corten tipo=plataforma', tp['corten'] == 'plataforma', tp)
ck('totvs_performance tipo=serviço', tp['totvs_performance'] == 'servico', tp)
ck('vtex (parceiro, sem override) tipo=complementar (default)', tp['vtex'] == 'complementar', tp)

# tela Base de Soluções renderiza as 59 sem travar / sem overflow visível
ev(A, "UI.view='solucoes';render();0"); A.wait_for_timeout(900)
badge = ev(A, "document.querySelector('[data-v=solucoes] .badge, .nav [data-v=solucoes] .badge')?.textContent || ''")
print('badge nav solucoes =', badge)
rows = ev(A, "document.querySelectorAll('[data-a=solAbrir], .sol-row, #app [data-sol-id]').length")
print('linhas/itens renderizados na tela de soluções =', rows)
ck('sem erros de página após navegar para Base de Soluções', not errs, errs)
print('FAILS', F)
p.stop()
