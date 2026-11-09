# t74 — harness de calibração do motor (frente A): baseline travado do gold sintético + contas do avaliador
import sys, json, os, importlib.util
sys.path.insert(0, '/home/claude/test')
from t40_lib import *
spec = importlib.util.spec_from_file_location('calib', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'calib.py')); calib = importlib.util.module_from_spec(spec); spec.loader.exec_module(calib)
gp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'calib_gold.sample.json'); gold = json.load(open(gp))
pg, errs = open_h('qa.t74@totvs.com.br')
n0 = ev(pg, "S.clients.length")
got = ev(pg, "(" + calib.JS + ")(" + json.dumps(gold['casos']) + ")")
r = calib.avalia(gold, got)
ck('gold sintético rotulado como tal', 'SINTÉTICO' in gold['meta']['rotulo'])
ck('12 casos avaliados', r['n_casos'] == 12)
ck('baseline: 9/12 idênticos ao esperado', r['casos_ok'] == 9)
ck('baseline: divergentes = S02,S03,S05', sorted(c['id'] for c in r['casos'] if not c['ok']) == ['S02', 'S03', 'S05'])
byr = {x['regra']: x for x in r['regras']}
ck('retencao: 2 acertos, 0 ruído/omissão', byr['retencao']['acerto'] == 2 and byr['retencao']['ruido'] == 0 and byr['retencao']['omissao'] == 0)
ck('amostra pequena: sem percentual (n<8)', all(x['precisao'] is None and x['cobertura'] is None for x in r['regras']))
ck('motor não alterou S (clientes)', ev(pg, "S.clients.length") == n0)
ck('sem erros de página', not errs)
# avaliador: contas com n>=8
g2 = {'meta': {'rotulo': 'x'}, 'casos': [{'id': f'a{i}', 'esperado': {'prioridade': ['retencao'], 'investigar': []}} for i in range(10)]}
o2 = [{'id': f'a{i}', 'opps': ([{'r': 'retencao', 'cl': 'prioridade'}] if i < 8 else []) + ([{'r': 'reforma', 'cl': 'investigar'}] if i < 2 else [])} for i in range(10)]
r2 = calib.avalia(g2, o2); b2 = {x['regra']: x for x in r2['regras']}
ck('avaliador: retencao 8 acertos/2 omissões', b2['retencao']['acerto'] == 8 and b2['retencao']['omissao'] == 2)
ck('avaliador: cobertura 0.8 com n=10', b2['retencao']['cobertura'] == 0.8)
ck('avaliador: ruído reforma=2, precisão None (n<8)', b2['reforma']['ruido'] == 2 and b2['reforma']['precisao'] is None)
ck('avaliador: classe errada contada', calib.avalia({'meta': {'rotulo': 'x'}, 'casos': [{'id': 'z', 'esperado': {'prioridade': ['fluig'], 'investigar': []}}]}, [{'id': 'z', 'opps': [{'r': 'fluig', 'cl': 'investigar'}]}])['regras'][0]['classe_errada'] == 1)
h = calib.html_rel(r)
ck('html: rótulo + aviso + tabelas', 'SINTÉTICO' in h and 'Por regra' in h and 'Por caso' in h and 'n ≥ 8' in h)
ck('html: sem recurso externo', 'http://' not in h and 'https://' not in h and '<script' not in h)
print('FAILS', F)
p.stop()
