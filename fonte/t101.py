# Portfólio TOTVS: classificação por cliente, pontuação explicável, "Onde posso vender" e aba na ficha
from t40_lib import *
import json
P,e=open_h('exec_pt@totvs.com.br')
ev(P,"""(()=>{
 const mk=(k,name,seg,prods,extra={})=>{ S.clients[k]={key:k,name,cnpj:'',productsRaw:prods,seg:'',segment:seg,fichas:[],docs:[],mgmt:{},act:{},opps:[],src:{row:1},...extra}; runAnalysis(S.clients[k]); };
 S.clients={};
 mk('pa','Alfa Indústria','Manufatura','Protheus');
 mk('pb','Beta Serviços','Serviços','RM');
 mk('pc','Gama Sem Dados','','');
 S.solutions=S.solutions.filter(r=>!/^ZZ /.test(r.nome));
 S.solutions.push(
  newSol({id:'zz_prot',nome:'ZZ Módulo Fiscal Protheus',linha:'Protheus',status:'Validado',oficial:true,termos:['zz fiscal protheus'],segmentos:[S.clients.pa.segInfo?.id].filter(Boolean),funcionalidades:[{t:'apuração de tributos zzfunc'}]}),
  newSol({id:'zz_rm',nome:'ZZ Folha RM',linha:'RM',status:'Validado',oficial:true,termos:['zz folha rm']}),
  newSol({id:'zz_gen',nome:'ZZ Plataforma Genérica',linha:'',status:'NECESSITA VALIDAÇÃO',termos:['zz plataforma generica'],segmentos:[S.clients.pa.segInfo?.id].filter(Boolean)}),
  newSol({id:'zz_int',nome:'ZZ Conector',linha:'',status:'Em revisão',termos:['zz conector'],integracoes:[{sistema:'Protheus',estado:'confirmada',t:'integra',f:'TDN'}]}),
  newSol({id:'zz_neg',nome:'ZZ Sem Protheus',linha:'',status:'Validado',termos:['zz sem protheus'],integracoes:[{sistema:'Protheus',estado:'nao_integra',t:'não integra'}]}),
  newSol({id:'zz_none',nome:'ZZ Isolada',linha:'',status:'Validado',termos:['zz isolada'],segmentos:['seg_inexistente']}));
 return 0})()""")
seg=ev(P,"S.clients.pa.segInfo?.id||''"); lin=ev(P,"JSON.stringify([baseLines(S.clients.pa),baseLines(S.clients.pb),baseLines(S.clients.pc)])")
ck('cenário: Alfa (Protheus, com segmento), Beta (RM), Gama (sem dados)', lin=='[["Protheus"],["RM"],[]]' and seg, (lin,seg))
g=lambda k,sid: json.loads(ev(P,"JSON.stringify(ptClass(ptCtx(S.clients.%s),S.solutions.find(r=>r.id==='%s')))"%(k,sid)))
x=g('pa','protheus'); ck('contratada: produto identificado na planilha; sem pontuação', x['cls']=='contratada' and x['score'] is None and 'Planilha' in x['porque'], x)
x=g('pa','zz_rm'); ck('incompatível: solução da linha RM em cliente Protheus', x['cls']=='incompativel' and 'linha RM' in x['porque'] and [f for f in x['fatores'] if f['k']=='compat'][0]['pts']==0, x['porque'])
x=g('pb','zz_prot'); ck('incompatível no sentido inverso', x['cls']=='incompativel')
x=g('pa','zz_neg'); ck('incompatível: Base registra que não integra com a linha do cliente', x['cls']=='incompativel' and 'não integra com Protheus' in x['porque'])
x=g('pa','zz_prot'); f={i['k']:i for i in x['fatores']}
ck('potencial: mesma linha + segmento, registro validado', x['cls']=='potencial' and f['segmento']['pts']==20 and f['compat']['pts']==20 and f['compl']['pts']==8 and f['mat']['pts']==10 and f['dor']['pts']==0, x)
ck('pontuação = soma dos fatores, entre 0 e 100', x['score']==sum(i['pts'] for i in x['fatores']) and 0<=x['score']<=100 and sum(i['peso'] for i in x['fatores'])==100)
ck('pesos conforme especificação (20/25/20/15/10/10)', [i['peso'] for i in x['fatores']]==[20,25,20,15,10,10])
x=g('pa','zz_gen'); ck('necessita validação: aderente ao segmento, registro não validado', x['cls']=='validar' and 'não foi validado' in x['porque'] and [i for i in x['fatores'] if i['k']=='compat'][0]['pts']==10 and 'validar antes de afirmar' in [i for i in x['fatores'] if i['k']=='compat'][0]['motivo'], x['porque'])
x=g('pa','zz_int'); f={i['k']:i for i in x['fatores']}
ck('integração registrada pontua compatibilidade e complementaridade, mas sem indício não vira potencial', f['compat']['pts']==20 and 'Integração com Protheus registrada' in f['compat']['motivo'] and f['compl']['pts']==15 and x['cls']=='nao_ident', x)
x=g('pa','zz_none'); ck('não identificada: sem indício', x['cls']=='nao_ident' and [i for i in x['fatores'] if i['k']=='segmento'][0]['pts']==0)
x=g('pc','zz_prot'); f={i['k']:i for i in x['fatores']}
ck('cliente sem dados: nada é afirmado (segmento 0, compatibilidade "validar")', x['cls']=='nao_ident' and f['segmento']['pts']==0 and f['compat']['pts']==8 and 'validar' in f['compat']['motivo'], x)
# hipótese de dor e texto
ev(P,"S.clients.pa.dorHip=[{id:'dh_t',solId:'zz_int',frase:'conciliação manual demorada',trecho:'conciliação automática',tipo:'funcionalidades',fonte:null,termos:[],em:'2026-11-01T12:00:00Z'}];runAnalysis(S.clients.pa);0")
x=g('pa','zz_int'); ck('hipótese de dor do executivo → potencial com 25 pontos de dor', x['cls']=='potencial' and [i for i in x['fatores'] if i['k']=='dor'][0]['pts']==25 and 'conciliação manual' in [i for i in x['fatores'] if i['k']=='dor'][0]['motivo'], x['cls'])
ev(P,"S.clients.pb.docs=[{name:'ata.txt',text:'cliente comentou sobre zz conector na reunião'}];runAnalysis(S.clients.pb);0")
x=g('pb','zz_int'); ck('citada só em texto → possivelmente utilizada (não contratada)', x['cls']=='possivel' and 'apenas em texto' in x['porque'], x)
ev(P,"S.clients.pb.prodDec={zz_int:{st:'confirmado'}};runAnalysis(S.clients.pb);0")
ck('confirmação do executivo → contratada', g('pb','zz_int')['cls']=='contratada')
ev(P,"S.clients.pa.emp={cod:'T1',mrrP:5000,ausente:false};S.clients.pc.emp={cod:'T3',mrrP:0,ausente:true};0")
ck('viabilidade usa a carteira (ativo com receita 10; ausente 0)', [i for i in g('pa','zz_prot')['fatores'] if i['k']=='viab'][0]['pts']==10 and [i for i in g('pc','zz_prot')['fatores'] if i['k']=='viab'][0]['pts']==0)
# página Portfólio
ck('menu: Portfólio TOTVS dentro de Base de Soluções', ev(P,"NAV.find(x=>x[0]==='solucoes')[3].some(s=>s[0]==='portfolio')"))
ev(P,"UI.view='portfolio';UI.pt=null;render();0"); P.wait_for_timeout(400)
tx=lambda: ev(P,"document.querySelector('#app').innerText")
n=ev(P,"activeSols().length")
ck('lista paginada (50 por página) com total da Base', ('%d solução(ões) na Base'%n) in tx() and ev(P,"document.querySelectorAll('#app [data-a=ptSel]').length")==min(50,n) and ('Página 1 de %d'%((n+49)//50)) in tx(), n)
P.fill('[data-i=ptq]','zzfunc tributos'); P.wait_for_timeout(700)
ck('busca por funcionalidade (todas as palavras)', ev(P,"document.querySelectorAll('#app [data-a=ptSel]').length")==1 and 'ZZ Módulo Fiscal Protheus' in tx())
ck('foco preservado na busca', ev(P,"document.activeElement?.dataset?.i")=='ptq')
P.fill('[data-i=ptq]','zz'); P.wait_for_timeout(700); P.select_option('[data-c=ptlinha]','RM'); P.wait_for_timeout(300)
ck('filtro por linha', ev(P,"document.querySelectorAll('#app [data-a=ptSel]').length")==1 and 'ZZ Folha RM' in tx())
P.select_option('[data-c=ptlinha]',''); P.wait_for_timeout(300)
P.click('[data-a=ptSel][data-id=zz_prot]'); P.wait_for_timeout(400)
ck('"Onde posso vender": título e clientes ordenados (potencial primeiro, incompatível por último)', 'Onde posso vender: ZZ Módulo Fiscal Protheus' in tx() and ev(P,"[...document.querySelectorAll('#app tbody tr td:first-child b')].map(b=>b.innerText).join('|')")=='Alfa Indústria|Gama Sem Dados|Beta Serviços', ev(P,"[...document.querySelectorAll('#app tbody tr td:first-child b')].map(b=>b.innerText).join('|')"))
ck('explicação por fator disponível e pesos na legenda', ev(P,"document.querySelectorAll('#app details.pt-ex').length")==3 and 'segmento 20 · dor ou oportunidade 25' in tx() and 'não uma garantia' in tx())
P.click('[data-a=ptCls][data-k=incompativel]'); P.wait_for_timeout(300)
ck('filtro por classificação', ev(P,"document.querySelectorAll('#app tbody tr').length")==1 and 'Beta Serviços' in tx())
P.click('[data-a=ptVoltar]'); P.wait_for_timeout(300); P.click('[data-a=ptSel][data-id=zz_gen]'); P.wait_for_timeout(300)
ck('registro não validado: alerta antes de levar ao cliente', 'Registro ainda não validado' in tx())
P.click('#app a[data-a=open]'); P.wait_for_timeout(600)
ck('clique no cliente abre a ficha', ev(P,"UI.view")=='cliente')
# aba na ficha
ev(P,"UI.sel='pa';UI.view='cliente';UI.ctab='portfolio';UI.pt=null;render();0"); P.wait_for_timeout(500)
ck('aba "Portfólio TOTVS" na ficha com contagem por classe', 'Portfólio TOTVS neste cliente' in tx() and 'Contratada (' in tx() and 'Incompatível (' in tx() and 'Potencial (' in tx(), tx()[:300])
P.click('[data-a=ptCCls][data-k=contratada]'); P.wait_for_timeout(300)
ck('filtro por classe na ficha', 'Linha Protheus' in tx() and 'ZZ Folha RM' not in tx())
ev(P,"ptUI().ccls='';render();0"); P.fill('[data-i=ptcq]','zz folha'); P.wait_for_timeout(700)
ck('busca de solução na ficha', 'ZZ Folha RM' in tx() and 'ZZ Conector' not in tx())
# rodada 4: campos novos, complementares, descontinuada, diagnóstico e briefing
ev(P,"UI.view='solucoes';UI.solSel=null;UI.solEdit={d:solDraft(S.solutions.find(r=>r.id==='zz_int')),errs:[],dups:null};render();0"); P.wait_for_timeout(400)
ck('formulário da solução tem os campos novos', all(ev(P,"!!document.querySelector('[data-c=sf][data-f=%s]')"%k) for k in ['ciclo','entrega','comercial','dependencias','complementares']))
r=ev(P,"""(()=>{const r=S.solutions.find(x=>x.id==='zz_int'),d=solDraft(r);d.ciclo='Ativa';d.entrega='SaaS';d.comercial='assinatura';d.dependencias='Protheus 12.1.2310\\nPorta REST';d.complementares='TOTVS Backoffice – Linha Protheus (ERP); inexistente';const ch=applyDraft(r,d);const d2=solDraft(r);return JSON.stringify([ch,r.ciclo,r.entrega,r.comercial,r.dependencias,r.complementares,applyDraft(r,d2),d2.dependencias])})()"""); rj=json.loads(r)
ck('campos novos gravam, contam como alteração e voltam iguais ao rascunho', rj[0]==True and rj[1:4]==['Ativa','SaaS','assinatura'] and rj[4]==['Protheus 12.1.2310','Porta REST'] and len(rj[5])==2 and rj[6]==False, r)
ev(P,"UI.solEdit=null;UI.solSel='zz_int';render();0"); P.wait_for_timeout(300)
ck('detalhe da solução mostra ciclo, entrega, comercialização, dependências e complementares', all(k in tx() for k in ['Ciclo de vida: Ativa','Entrega: SaaS','Comercialização: assinatura','Dependências: Protheus 12.1.2310','Complementares:']))
ev(P,"S.clients.pa.dorHip=[];runAnalysis(S.clients.pa);0")
x=g('pa','zz_int'); f={i['k']:i for i in x['fatores']}
ck('complementar registrada de algo que o cliente tem → 15 pontos com o motivo', f['compl']['pts']==15 and 'complementar de TOTVS Backoffice' in f['compl']['motivo'], f['compl'])
ev(P,"S.solutions.find(r=>r.id==='zz_prot').ciclo='Descontinuada';0")
x=g('pa','zz_prot'); ck('solução descontinuada não é recomendada', x['cls']=='nao_ident' and 'descontinuada' in x['porque'])
ev(P,"S.solutions.find(r=>r.id==='zz_prot').ciclo='';Object.assign(S.solutions.find(r=>r.id==='zz_prot'),{dores:[{t:'apuração fiscal manual e sujeita a erro'}],prerequisitos:[{t:'Release 12.1.2310 ou superior'}],limites:'Não cobre ISS municipal',fontes:[{t:'TDN Fiscal',u:'https://tdn.totvs.com/x/abc'}]});0")
cs=json.loads(ev(P,"JSON.stringify(ptCandidatas(S.clients.pa,5).map(x=>[x.r.id,x.cls,x.score]))"))
ck('candidatas: só potencial/validar, ordenadas, no máximo 5', 0<len(cs)<=5 and all(c[1] in('potencial','validar') for c in cs) and not any(c[0] in('zz_rm','zz_neg','protheus') for c in cs) and [c for c in cs if c[1]=='potencial']==sorted([c for c in cs if c[1]=='potencial'],key=lambda c:-c[2]), cs)
ev(P,"UI.sel='pa';UI.view='cliente';UI.ctab='diagnostico';render();0"); P.wait_for_timeout(600)
dg=ev(P,"document.querySelector('#pt-diag')?.innerText||''")
ck('Diagnóstico executivo ganha o bloco de soluções candidatas (uso interno)', 'Soluções candidatas do Portfólio TOTVS' in dg and 'uso interno' in dg and 'Diagnóstico executivo' in tx())
ck('ficha da candidata: dor, evidência, pré-requisito, restrição, fonte oficial e próxima ação — tudo do registro', all(k in dg for k in ['apuração fiscal manual e sujeita a erro','Mesma linha do cliente (Protheus)','Release 12.1.2310 ou superior','Não cobre ISS municipal','TDN Fiscal','PRÓXIMA AÇÃO']), dg[:600])
ck('pergunta de descoberta derivada da dor registrada', 'Como vocês tratam hoje: “apuração fiscal manual e sujeita a erro”?' in dg)
ck('pendências explícitas para o que não está registrado', 'Registro da solução ainda não validado na Base.' in dg and 'Pré-requisitos técnicos não registrados.' in dg and 'Não registrada na Base.' in dg)
fj=json.loads(ev(P,"(()=>{const r=S.solutions.find(x=>x.id==='zz_gen');r.finalidade='Orquestrar processos entre áreas';const x=ptCliente(S.clients.pa).find(y=>y.id==='zz_gen');const f=ptFicha(S.clients.pa,x);return JSON.stringify([f.fin,f.pend,f.acao])})()"))
ck('sem dores registradas: usa a finalidade registrada e aponta a lacuna; registro não validado pede validação', fj[0]=='Orquestrar processos entre áreas' and any('Dores específicas não registradas' in x for x in fj[1]) and any('Sem fonte oficial' in x for x in fj[1]) and 'Validar conteúdo' in fj[2], fj)
ck('link de fonte só para domínio oficial e com noopener', ev(P,"[...document.querySelectorAll('#pt-diag a[target=_blank]')].every(a=>a.rel.includes('noopener')&&/totvs\\.com/.test(a.hostname))") and ev(P,"document.querySelectorAll('#pt-diag a[target=_blank]').length")>=1)
ck('nada de preço, ROI ou benefício inventado no bloco', not any(k in dg for k in ['R$','ROI','economia de','retorno de']))
br=json.loads(ev(P,"JSON.stringify(ptBriefRows(S.clients.pa))"))
ck('briefing: até 3 candidatas com classificação, aderência e próxima ação', 0<len(br)<=3 and all('aderência' in r[1] and 'Próxima ação:' in r[1] for r in br), br[:1])
ck('briefing: sem candidatas → bloco omitido', ev(P,"ptBriefRows(S.clients.pc)")==None or isinstance(ev(P,"JSON.stringify(ptBriefRows(S.clients.pc))"),str))
ev(P,"UI.sel='pc';UI.ctab='diagnostico';S.solutions.forEach(r=>{});render();0"); P.wait_for_timeout(400)
ck('diagnóstico de cliente sem dados não quebra', 'Soluções candidatas do Portfólio TOTVS' in ev(P,"document.querySelector('#pt-diag')?.innerText||''"))
# escala
t=ev(P,"""(()=>{ const b=S.solutions.length; for(let i=0;i<600;i++) S.solutions.push(newSol({id:'zzb'+i,nome:'ZZ Bulk '+i,linha:i%2?'Protheus':'',termos:['zzbulk'+i]})); const t0=performance.now(); const n=ptCliente(S.clients.pa).length; const t1=performance.now(); UI.view='portfolio'; UI.pt=null; render(); const t2=performance.now(); S.solutions.length=b; return JSON.stringify([n,Math.round(t1-t0),Math.round(t2-t1)]) })()"""); tj=json.loads(t)
ck('600+ soluções: classificação de um cliente e lista em tempo aceitável', tj[0]>=600 and tj[1]<1500 and tj[2]<1500, t)
ev(P,"S.solutions=S.solutions.filter(r=>!/^ZZ /.test(r.nome));S.clients={};UI.view='geral';render();0")
ck('sem erro de script', not e, e[:2])
print('FALHAS:',len(F)); [print(' -',x) for x in F]; p.stop()
