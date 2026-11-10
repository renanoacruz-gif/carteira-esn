# t89 — rodada 35: segmento inferido automaticamente pelo CNAE (cadastro público do CNPJ já consultado)
import sys, time; sys.path.insert(0, '/home/claude/test')
from t40_lib import *
em = 'qa.t89.%d@totvs.com.br' % time.time()
A, errs = open_h(em)
A.wait_for_timeout(500)

# --- mapa CNAE -> segmento (unidade) ---
casos = [
    ('0151201', 'agro'),           # pecuária
    ('1091101', 'manufatura'),     # fabricação de produtos de panificação
    ('4120400', 'construcao'),     # construção de edifícios
    ('7112000', 'construcao'),     # serviços de engenharia
    ('4651601', 'distribuicao'),   # comércio atacadista de equip. de informática
    ('4713100', 'varejo'),         # comércio varejista em geral
    ('4520001', 'varejo'),         # manutenção/comércio de veículos
    ('5111100', 'servicos'),       # transporte aéreo (precedente Helisul)
    ('4921301', 'logistica_seg'),  # transporte rodoviário de passageiros
    ('5211701', 'logistica_seg'),  # armazenamento
    ('6920601', 'servicos'),       # contabilidade/consultoria/auditoria
    ('6201501', 'servicos'),       # desenvolvimento de software
    ('6911701', None),             # atividades jurídicas — fora de propósito
    ('8610101', None),             # saúde — fora de propósito
    ('8511200', None),             # educação — fora de propósito
    ('5611201', None),             # restaurante (hospitalidade) — fora de propósito
]
for cod, esperado in casos:
    r = ev(A, "KB.cnaeSeg(%r)" % cod)
    ck('CNAE %s -> %s' % (cod, esperado), r == esperado, r)

# --- integração com classifySeg ---
ev(A, """(()=>{
  window.__mk = (over) => Object.assign({ key:'c_t89', id:'c_t89', name:'Empresa Sem Pista Nenhuma LTDA', seg:'', fichas:[], docs:[] }, over);
  0
})()""")

# 1) sem planilha, sem nome reconhecível, com CNAE de distribuição -> inferido por CNAE
c1 = ev(A, """(()=>{
  const c = window.__mk({ cnpjCad:{ cnaePrincipal:{ codigo:'4651601', formatado:'46.51-6/01', descricao:'Comércio atacadista de equipamentos de informática' } } });
  return classifySeg(c, {});
})()""")
ck('sem planilha/nome, com CNAE de atacado -> segInfo.id=distribuicao, mode=inferido', c1['id'] == 'distribuicao' and c1['mode'] == 'inferido', c1)
ck('ev da inferência por CNAE cita o código e a descrição', 'CNAE' in c1['ev'] and '46.51-6/01' in c1['ev'] and 'INFERÊNCIA' in c1['ev'], c1['ev'])

# 2) planilha com segmento explícito prevalece sobre o CNAE (mesmo cliente, CNAE diferente do texto da planilha)
c2 = ev(A, """(()=>{
  const c = window.__mk({ seg:'Manufatura', cnpjCad:{ cnaePrincipal:{ codigo:'4651601', formatado:'46.51-6/01', descricao:'Comércio atacadista' } } });
  return classifySeg(c, {});
})()""")
ck('planilha explícita prevalece sobre CNAE', c2['id'] == 'manufatura' and c2['mode'] == 'planilha', c2)

# 3) override manual prevalece sobre o CNAE
c3 = ev(A, """(()=>{
  const c = window.__mk({ cnpjCad:{ cnaePrincipal:{ codigo:'4651601', formatado:'46.51-6/01', descricao:'Comércio atacadista' } } });
  return classifySeg(c, { c_t89:'servicos' });
})()""")
ck('override manual prevalece sobre CNAE', c3['id'] == 'servicos' and c3['mode'] == 'manual', c3)

# 4) CNAE fora de propósito (jurídico) + nome sem pista -> cai em 'ausente', não inventa segmento
c4 = ev(A, """(()=>{
  const c = window.__mk({ cnpjCad:{ cnaePrincipal:{ codigo:'6911701', formatado:'69.11-7/01', descricao:'Atividades jurídicas' } } });
  return classifySeg(c, {});
})()""")
ck('CNAE sem mapeamento (jurídico) não força segmento', c4['id'] == None and c4['mode'] == 'ausente', c4)

# 5) regressão: inferência pelo nome continua funcionando quando não há CNAE
c5 = ev(A, """(()=>{
  const c = window.__mk({ name:'Distribuidora Atacado Bebidas Sul LTDA', cnpjCad:null });
  return classifySeg(c, {});
})()""")
ck('sem CNAE, inferência pelo nome continua funcionando', c5['id'] == 'distribuicao' and c5['mode'] == 'inferido' and 'razão social' in c5['ev'], c5)

# 6) CNAE também funciona quando o nome bateria num segmento diferente — CNAE tem prioridade sobre o nome
c6 = ev(A, """(()=>{
  const c = window.__mk({ name:'Transportadora Logística Veloz LTDA', cnpjCad:{ cnaePrincipal:{ codigo:'6920601', formatado:'69.20-6/01', descricao:'Atividades de contabilidade' } } });
  return classifySeg(c, {});
})()""")
ck('CNAE tem prioridade sobre a inferência por nome', c6['id'] == 'servicos' and 'CNAE' in c6['ev'], c6)

# regressão: nenhum segmento/regra foi criado ou removido nesta rodada
nseg = ev(A, "KB.segments.length"); nrul = ev(A, "RULES.length"); nsol = ev(A, "KB.solutions.length")
ck('12 segmentos (nenhum criado/removido)', nseg == 12, nseg)
ck('RULES inalteradas (>= 14, rodadas anteriores)', nrul >= 14, nrul)
ck('catálogo de soluções inalterado nesta rodada (>= 61)', nsol >= 61, nsol)

ck('sem erros de página', not errs, errs)
print('FAILS', F)
p.stop()
