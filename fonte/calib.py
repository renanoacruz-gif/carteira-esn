# Calibração do motor de oportunidades (frente A): roda o motor REAL (analyzeClient + rxClass) sobre um conjunto-ouro e
# compara com o que o executivo afirma estar correto. Não escreve em S nem no banco; só lê o app em localhost.
# Uso: PYTHONPATH=<dir do t40_lib> python3 calib.py [gold.json] [--html saida.html] [--json saida.json]
# Requer servidor local em :8790 (ver LEIA-ME). Sem gold, usa calib_gold.sample.json (SINTÉTICO).
import sys, json, os, html as H
from t40_lib import *
MIN_N = 8  # abaixo disto não se calcula percentual (amostra pequena)
def args():
    a = sys.argv[1:]; g = None; ho = None; jo = None; i = 0
    while i < len(a):
        if a[i] == '--html': ho = a[i+1]; i += 2
        elif a[i] == '--json': jo = a[i+1]; i += 2
        else: g = a[i]; i += 1
    return g or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'calib_gold.sample.json'), ho, jo
JS = """cases=>cases.map(g=>{
 const c={key:'g_'+g.id,code:g.id,name:g.nome||g.id,cnpj:'',cnpjRaw:'',seg:g.segmento||'',city:'',size:g.porte||'',mrr:null,productsRaw:g.produtos||'',churn:g.churn||'',nps:g.nps==null?'':String(g.nps),notes:g.notas||'',uf:'',regime:'',release:'',fichas:[],docs:[],mgmt:{},act:{}};
 analyzeClient(c,S);
 return {id:g.id,opps:(c.opps||[]).map(o=>({r:o.ruleId,cl:rxClass(c,o).cl,score:o.score,conf:o.conf}))}})"""
def avalia(gold, got):
    por = {}; casos = []
    def R(r): return por.setdefault(r, {'regra': r, 'acerto': 0, 'classe_errada': 0, 'omissao': 0, 'ruido': 0, 'casos_ruido': [], 'casos_omissao': [], 'casos_classe': []})
    for g in gold['casos']:
        exp = {}; [exp.__setitem__(r, 'prioridade') for r in g['esperado'].get('prioridade', [])]; [exp.__setitem__(r, 'investigar') for r in g['esperado'].get('investigar', [])]
        em = {o['r']: o['cl'] for o in next(x for x in got if x['id'] == g['id'])['opps'] if o['cl'] in ('prioridade', 'investigar')}
        linha = {'id': g['id'], 'nome': g.get('nome', g['id']), 'esperado': exp, 'obtido': em, 'ok': exp == em}
        casos.append(linha)
        for r in set(exp) | set(em):
            x = R(r)
            if r in exp and r in em: (x.__setitem__('acerto', x['acerto'] + 1) if exp[r] == em[r] else (x.__setitem__('classe_errada', x['classe_errada'] + 1), x['casos_classe'].append(g['id'])))
            elif r in exp: x['omissao'] += 1; x['casos_omissao'].append(g['id'])
            else: x['ruido'] += 1; x['casos_ruido'].append(g['id'])
    for x in por.values():
        x['emitidas'] = x['acerto'] + x['classe_errada'] + x['ruido']; x['esperadas'] = x['acerto'] + x['classe_errada'] + x['omissao']
        x['precisao'] = round(x['acerto'] / x['emitidas'], 3) if x['emitidas'] >= MIN_N else None
        x['cobertura'] = round(x['acerto'] / x['esperadas'], 3) if x['esperadas'] >= MIN_N else None
    return {'rotulo': gold['meta']['rotulo'], 'n_casos': len(casos), 'casos_ok': sum(c['ok'] for c in casos), 'regras': sorted(por.values(), key=lambda x: x['regra']), 'casos': casos, 'min_n': MIN_N}
def pct(v, n): return f'{round(v*100)}%' if v is not None else f'— (n={n} &lt; {MIN_N})'
def html_rel(r):
    rows = ''.join(f"<tr><td>{H.escape(x['regra'])}</td><td>{x['acerto']}</td><td>{x['classe_errada']}</td><td>{x['ruido']}</td><td>{x['omissao']}</td><td>{x['emitidas']}</td><td>{x['esperadas']}</td><td>{pct(x['precisao'], x['emitidas'])}</td><td>{pct(x['cobertura'], x['esperadas'])}</td><td>{H.escape(', '.join(x['casos_ruido'] + x['casos_omissao'] + x['casos_classe']) or '—')}</td></tr>" for x in r['regras'])
    cs = ''.join(f"<tr class=\"{'ok' if c['ok'] else 'no'}\"><td>{H.escape(c['id'])}</td><td>{H.escape(c['nome'])}</td><td>{H.escape(json.dumps(c['esperado'], ensure_ascii=False))}</td><td>{H.escape(json.dumps(c['obtido'], ensure_ascii=False))}</td><td>{'ok' if c['ok'] else 'divergente'}</td></tr>" for c in r['casos'])
    return f"""<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><title>Calibração do motor</title><style>
:root{{--pet:#002233;--ciano:#00C9EB;--bd:#DCE3E8;--txt2:#4B5E6A;--ok:#0E8F6B;--bad:#C2185B}}body{{font:14px/1.55 Verdana,sans-serif;margin:0;background:#F2F5F8;color:var(--pet)}}header{{background:var(--pet);color:#fff;padding:28px 32px}}h1{{margin:0;font-size:26px}}.sub{{color:#C8D8E2;max-width:80ch;margin-top:8px}}main{{max-width:1180px;margin:0 auto;padding:24px 32px}}h2{{margin:28px 0 10px}}table{{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--bd);border-radius:10px;overflow:hidden;font-size:13px}}th,td{{padding:9px 12px;border-bottom:1px solid #EAF0F3;text-align:left;vertical-align:top}}th{{background:#FAFCFD;color:var(--txt2)}}tr.no td{{background:#FEEEF5}}.aviso{{background:#FFF6E8;border:1px solid #F5D9AE;border-radius:10px;padding:12px 16px;margin:16px 0}}</style>
<header><h1>Calibração do motor de oportunidades</h1><div class="sub">{H.escape(r['rotulo'])}<br>{r['n_casos']} casos · {r['casos_ok']} idênticos ao esperado.</div></header><main>
<div class="aviso"><b>Como ler:</b> acerto = regra emitida na classe esperada; classe errada = emitida, mas Prioridade×Investigar divergem; ruído = emitida sem estar no esperado; omissão = esperada e não emitida. Percentuais só aparecem com n ≥ {r['min_n']} — abaixo disso a amostra não sustenta número. Nada aqui altera regras: ajustes são decisão humana.</div>
<h2>Por regra</h2><table><thead><tr><th>Regra</th><th>Acerto</th><th>Classe errada</th><th>Ruído</th><th>Omissão</th><th>Emitidas</th><th>Esperadas</th><th>Precisão</th><th>Cobertura</th><th>Casos a revisar</th></tr></thead><tbody>{rows}</tbody></table>
<h2>Por caso</h2><table><thead><tr><th>Caso</th><th>Cliente</th><th>Esperado</th><th>Obtido</th><th>Situação</th></tr></thead><tbody>{cs}</tbody></table></main></html>"""
if __name__ == '__main__':
    gp, ho, jo = args(); gold = json.load(open(gp))
    pg, errs = open_h('qa.calib@totvs.com.br')
    got = ev(pg, "(" + JS + ")(" + json.dumps(gold['casos']) + ")")
    r = avalia(gold, got); r['erros_pagina'] = errs
    print(f"Calibração: {r['casos_ok']}/{r['n_casos']} casos idênticos ao esperado · {gold['meta']['rotulo']}")
    for x in r['regras']: print(f"  {x['regra']:12s} acerto={x['acerto']} classe_errada={x['classe_errada']} ruido={x['ruido']} omissao={x['omissao']}")
    if jo: json.dump(r, open(jo, 'w'), ensure_ascii=False, indent=1)
    if ho: open(ho, 'w').write(html_rel(r))
    p.stop()
