from t40_lib import *
import uuid, re, json
D='/home/claude/test/data/'
email='sec%s@totvs.com.br'%uuid.uuid4().hex[:6]
ctx=b.new_context(viewport={'width':1400,'height':900},extra_http_headers={'x-test-user':email,'x-test-sub':'s-'+email})
A=ctx.new_page(); errs=[]; dialogs=[]; csp=[]
A.on('pageerror',lambda e: errs.append(str(e)))
A.on('console',lambda m: csp.append(m.text) if 'Content Security Policy' in m.text or 'Content-Security-Policy' in m.text else None)
A.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()))
A.route('**/*',route); A.goto('http://localhost:8790/'); A.wait_for_timeout(3500)
ev(A,"window.__x=0;window.__trace=%s;0"%('true' if __import__('os').environ.get('TRACE') else 'false'))
ev(A,"UI.view='importar';render();0"); A.wait_for_timeout(300)
A.set_input_files('#f-cart',D+'carteira.xlsx'); A.wait_for_timeout(600); A.click('[data-a=impPrev]'); A.wait_for_timeout(300); A.click('[data-a=impGo]'); A.wait_for_timeout(2500)
ev(A,"UI.view='importar';render();0"); A.wait_for_timeout(300)
A.set_input_files('#f-fic',[D+'ficha_T00001_10.txt',D+'ficha_T00002_out.txt']); A.wait_for_timeout(3500)
ck('base importada (clientes>0)',ev(A,"clients().length")>0)
# --- mutação: payloads em todas as strings de S
ev(A,"""(()=>{
const PAYS=['<img src=x onerror="window.__x=1">','"><svg onload="window.__x=1">','</script><script>window.__x=1</script>','\\'><iframe srcdoc="<script>parent.__x=1</script>">','<a href="javascript:window.__x=1">x</a>','&lt;img src=x onerror=window.__x=1&gt;<img src=x onerror=window.__x=1>','<details open ontoggle="window.__x=1">','<math><mtext><table><mglyph><style><img src=x onerror=window.__x=1>'];
const SKIP=/^(id|key|k|i|ref|hash|epoch|at|cv|tipo|estado|state|status|st|cl|view|cnpj|doc|f|u|url|href|d|data|ts|mime|sha|provedor|modelo|origem|fonte_id|ver|versao|cls|classe|nivel|k2|parent|sel|refId|sigla|prod|rel)$/i;
const URLK=/^(u|url|href)$/i; let n=0;
const seen=new Set();
const walk=(o,dep,path)=>{ path=path||'S'; if(!o||typeof o!=='object'||seen.has(o)||dep>7) return; seen.add(o);
  for(const k of Object.keys(o)){ const v=o[k];
    if(typeof v==='string'){ if(URLK.test(k)&&/^https?:/.test(v)){ o[k]='javascript:window.__x=1'; n++; } else if(!SKIP.test(k)&&v.length>1&&!/^\\d{4}-\\d{2}-\\d{2}/.test(v)&&!/^https?:/.test(v)){ o[k]=v+(window.__trace?'<img src=x onerror="window.__x=1" data-p="'+path+'.'+k+'">':PAYS[n%PAYS.length]); n++; } }
    else if(v&&typeof v==='object') walk(v,dep+1,path+'.'+k);
  } };
walk(S.clients,0); walk(S.solutions,0); walk(S.pesq,0); walk(S.marcos,0); walk(S.regs,0); walk(S.insights,0); walk(S.inbox,0); walk(S.intlog,0); walk(S.ocr,0); walk(S.kbExtra,0);
window.__muts=n; return n; })()""")
print('mutações:',ev(A,"window.__muts"))
views=['geral','clientes','segmentos','consol','oport','plano','mercado','solucoes','refs','importar','pend','cnpj','integra','conta','ia','dados','criterios','base']
bad=[]
def chk(tag):
    x=ev(A,"window.__x"); jh=ev(A,"document.querySelectorAll('a[href^=\"javascript:\" i],a[href^=\" javascript:\" i],iframe[src^=\"javascript:\" i]').length")
    inl=ev(A,"[...document.querySelectorAll('*')].filter(e=>[...e.attributes].some(a=>/^on/i.test(a.name))).length")
    sc=ev(A,"[...document.querySelectorAll('#app script, body > script:not(:first-of-type)')].filter(s=>/__x/.test(s.textContent)).length")
    if x or jh or inl or sc:
        det=ev(A,"[...document.querySelectorAll('[data-p]')].map(e=>e.dataset.p).filter((v,i,a)=>a.indexOf(v)===i).slice(0,12)")
        bad.append((tag,x,jh,inl,sc,det))
    ev(A,"window.__x=0;0")
for v in views:
    try: ev(A,"UI.view=%s;render();0"%json.dumps(v)); A.wait_for_timeout(250)
    except Exception as e: errs.append('view %s: %s'%(v,str(e)[:100]))
    chk('view:'+v)
keys=ev(A,"Object.keys(S.clients)")
tabs=ev(A,"CTABS.map(t=>t[0])")
for k in keys[:3]:
    for t in tabs:
        try: ev(A,"UI.sel=%s;UI.view='cliente';UI.ctab=%s;render();0"%(json.dumps(k),json.dumps(t))); A.wait_for_timeout(150)
        except Exception as e: errs.append('cli %s/%s: %s'%(k,t,str(e)[:100]))
        chk('cli:%s'%t)
    try: ev(A,"UI.sel=%s;UI.view='diag';render();0"%json.dumps(k)); chk('diag')
    except Exception as e: pass
ck('XSS por mutação: nenhuma execução / href javascript: / handler inline em %d telas'%(len(views)+3*len(tabs)),not bad,bad[:5])
ck('nenhum alert/dialog disparado',not dialogs,dialogs)
real=[e for e in errs if 'view ' not in e and 'cli ' not in e]
print('erros de página (informativo):',len(errs),errs[:4])
# --- exportações com payload
ev(A,"window.__caps=[];globalThis.offer=async function(n,d){window.__caps.push({n,d:typeof d==='string'?d:null,isBlob:d instanceof Blob});};0")
ev(A,"exportCSV()"); A.wait_for_timeout(300)
csv=ev(A,"(__caps.find(c=>/\\.csv$/.test(c.n))||{}).d")
ck('CSV exportado',bool(csv),csv and csv[:80])
cells=[c for ln in (csv or '').split('\r\n') for c in ln.split(';')]
ck('CSV: nenhuma célula inicia com = + - @ (fora números)',not [c for c in cells if re.match(r'^"?[=+\-@]',c) and not re.match(r'^"?[+-]?\d+([.,]\d+)*"?$',c) and c.strip('"')!='-'],[c for c in cells if re.match(r'^"?[=+\-@]',c)][:5])
r=ev(A,"[toCSV(['a','b','c','d','e','f','g'],[['=HYPERLINK(\"http://x\";\"y\")','+cmd|calc','-2+3','@SUM(A1)','-12,5','+55119999','R$ 1.000,00']])][0]")
ck('CSV injection: =,+,-,@ neutralizados; número legítimo preservado',r.count("'=HYPERLINK")==1 and "'+cmd" in r and "'-2+3" in r and "'@SUM" in r and ';-12,5;' in r and ';+55119999;' in r,r)
ev(A,"S.clients[Object.keys(S.clients)[0]].name='=HYPERLINK(\"http://evil\";\"x\")';0")
ev(A,"exportXLSX()"); A.wait_for_timeout(500)
ck('XLSX exportado',ev(A,"__caps.some(c=>/\\.xlsx$/.test(c.n))"),'')
ok_x=ev(A,"""(()=>{ const f=__caps.find(c=>/\\.xlsx$/.test(c.n)); return new Promise(async res=>{ const buf=await (await new Response(f.dummy||new Blob([]))).arrayBuffer(); res(true); }); })()""")
# lê o blob capturado: reexporta capturando o Blob
ev(A,"globalThis.offer=async function(n,d){ if(d instanceof Blob){ window.__blob=new Uint8Array(await d.arrayBuffer()); window.__bn=n;} };0")
ev(A,"exportXLSX()"); A.wait_for_timeout(800)
cel=ev(A,"""(()=>{ const wb=XLSX.read(window.__blob,{type:'array'}); const out=[]; for(const n of wb.SheetNames){ const ws=wb.Sheets[n]; for(const a in ws){ if(a[0]==='!') continue; const c=ws[a]; if(typeof c.v==='string'&&/^[=+\\-@]/.test(c.v)) out.push({a,t:c.t,f:c.f||null,v:c.v.slice(0,40)}); } } return out; })()""")
ck('XLSX: texto iniciado por "=" fica como string (t=s) e sem fórmula (f)',all(c['t']=='s' and not c['f'] for c in cel),cel[:4])
ev(A,"globalThis.offer=async function(n,d){window.__caps.push({n,d:typeof d==='string'?d:null});};0")
ev(A,"offer(\"infografico-carteira.html\", infographic())"); A.wait_for_timeout(500)
html=ev(A,"(__caps.find(c=>/\\.html$/.test(c.n))||{}).d")
ck('Infográfico HTML gerado',bool(html),'')
if html:
    P=ctx.new_page(); pe=[]; P.on('pageerror',lambda e: pe.append(str(e))); P.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()))
    P.set_content(html); P.wait_for_timeout(500)
    ck('Infográfico exportado com payload: sem execução',P.evaluate("window.__x||0")==0 and not P.evaluate("document.querySelectorAll('a[href^=\"javascript:\" i]').length"),pe)
    P.close()
# --- restauração de backup malicioso (prototype pollution / tipos errados)
evil=json.dumps({"clients":[{"key":"__proto__","name":"x"},{"key":"constructor","name":"y"}],"meta":{"__proto__":{"polluido":1},"constructor":{"prototype":{"polluido2":1}}},"__proto__":{"polluido3":1},"solutions":"nao-array","marcos":{"a":1},"kbExtra":{"__proto__":{"polluido4":1}}})
A.evaluate("t=>{window.__evil=new File([t],'carteira-backup.json',{type:'application/json'});}",evil)
r=ev(A,"importBackup(window.__evil,true).then(()=>({p:[({}).polluido,({}).polluido2,({}).polluido3,({}).polluido4,Object.prototype.polluido]}))")
ck('backup malicioso: Object.prototype não poluído',all(x is None for x in r['p']),r)
ck('backup malicioso: app segue funcional (render sem exceção)',ev(A,"(()=>{try{UI.view='geral';render();return true}catch(e){return String(e)}})()") is True,'')
# --- arquivos inválidos / executável / tamanho: erro por arquivo, sem derrubar o lote
A.evaluate("()=>{window.__fx=[new File([new Uint8Array([0x4d,0x5a,0x90,0,3])],'planilha.xlsx'),new File(['<html>'],'doc.pdf'),new File([new Uint8Array([0x7f,0x45,0x4c,0x46])],'a.csv'),new File(['x'],'setup.exe'),new File(['a;b\\n1;2'],'ok.csv')];}")
res=ev(A,"Promise.all(window.__fx.map(f=>readBuf(f).then(()=>'ok',e=>'ERRO:'+e.message)))")
ck('arquivo: MZ com extensão xlsx recusado',res[0].startswith('ERRO'),res)
ck('arquivo: pdf sem %PDF recusado',res[1].startswith('ERRO'),res)
ck('arquivo: ELF com extensão csv recusado',res[2].startswith('ERRO'),res)
ck('arquivo: .exe recusado',res[3].startswith('ERRO'),res)
ck('arquivo: CSV legítimo aceito (um inválido não derruba os demais)',res[4]=='ok',res)
big=ev(A,"readBuf({name:'enorme.pdf',size:90*1024*1024,arrayBuffer:async()=>new ArrayBuffer(1)}).then(()=>'ok',e=>e.message)")
ck('arquivo >80MB recusado com mensagem clara','80 MB' in big,big)
# --- zip bomb / entradas demais
zb=ev(A,"""(async()=>{ const z=new JSZip(); z.file('word/document.xml','<w:document xmlns:w="x"><w:body/></w:document>'); const b=await z.generateAsync({type:'arraybuffer'}); try{ await readDocx(b); return 'sem-erro-esperado'; }catch(e){ return e.message; } })()""")
print('docx mínimo:',zb)
zg=ev(A,"""(()=>{ const f={ _data:{uncompressedSize:61e6}, async:async()=>'x' }; return zipTxt(f).then(()=>'ok',e=>e.message); })()""")
ck('zipTxt recusa entrada >60MB descompactada','60 MB' in zg,zg)
zg2=ev(A,"""(()=>{ const files={}; for(let i=0;i<20001;i++) files['f'+i]=1; try{ zipGuard({files}); return 'ok'; }catch(e){ return e.message; } })()""")
ck('zipGuard recusa >20000 entradas','entradas demais' in zg2,zg2)
# --- poluição via XLSX.read simulada
pp=ev(A,"""(()=>{ const real=XLSX.read; XLSX.read=function(){ Object.prototype.__polu=1; return {SheetNames:[],Sheets:{}}; }; return readTable({name:'a.xlsx'},new ArrayBuffer(8)).then(()=>'sem-erro',e=>e.message).finally(()=>{ XLSX.read=real; }); })()""")
ck('guarda de protótipo: rejeita e limpa Object.prototype',('protótipo' in pp or 'internos' in pp) and ev(A,"({}).__polu===undefined"),pp)
# --- avaliação de fonte em pdf.js
ck('pdf.js: isEvalSupported:false no código',ev(A,"readPdf.toString().includes('isEvalSupported: false')"),'')
# --- CSP: nenhum bloqueio imposto no console (a política completa está só em Report-Only)
enforced=[c for c in csp if 'report-only' not in c.lower() and 'Report Only' not in c]
ck('CSP imposta não bloqueou nada durante o uso',not enforced,enforced[:3])
print('CSP report-only (informativo):',len(csp),[c[:140] for c in csp[:5]])
print('FALHAS:',F); raise SystemExit(1 if F else 0)
