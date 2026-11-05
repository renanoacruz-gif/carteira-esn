from t40_lib import *
import os, uuid
from PIL import Image
IM='/home/claude/test/data/img46/'; os.makedirs(IM,exist_ok=True)
D='/home/claude/test/data/'
email='pr%s@totvs.com.br'%uuid.uuid4().hex[:8]
pg,errs=open_h(email)
OCR=[]
TXT="Código do cliente | T00001\nCNPJ | 11.222.333/0001-81\nUF | PR\nRelease | 12.1.2410\nObservação: retrabalho na conciliação"
def rt(r):
    q=r.request.post_data_json; OCR.append((r.request.headers.get('x-provider'),bool(r.request.headers.get('x-provider-key')),q['arquivo']['nome']))
    r.fulfill(status=200,content_type='application/json',body=json.dumps({'versao':1,'tipo':'ocr_material','pedidoId':q['pedidoId'],'ok':True,'finalidade':'cliente','modelo':'gemini-stub','consultadoEm':'2026-11-05T10:00:00Z','truncado':False,'texto':TXT,'avisos':[]}))
pg.route('**/api/ocr',rt)
ev(pg,"window.confirm=()=>true;0")
pg.click('[data-a=nav][data-v=importar]'); pg.set_input_files('#f-cart',D+'carteira.xlsx'); pg.wait_for_timeout(500); pg.click('[data-a=impPrev]'); pg.wait_for_timeout(300); pg.click('[data-a=impGo]'); pg.wait_for_timeout(2500)
Image.new('RGB',(60,40),(10,120,200)).save(IM+'h1.png')
ev(pg,"UI.sel='c_T00001';UI.view='cliente';UI.ctab='fichas';render();0"); pg.wait_for_timeout(300)
pg.set_input_files('#f-prints',[IM+'h1.png']); pg.wait_for_timeout(800)
ck('hospedado sem chave Gemini: guarda e informa a ação (nada enviado)', len(OCR)==0 and 'chave do Google Gemini' in ev(pg,"document.querySelector('#prints').innerText") and ev(pg,"prRecs(S.clients['c_T00001'])[0].estado")=='autorizar')
ev(pg,"localStorage.setItem(HK_LS,JSON.stringify({gemini:'AIza-teste-0000'}));0"); ev(pg,"render();0"); pg.wait_for_timeout(300)
pg.click('[data-a=prAutPend]'); pg.wait_for_timeout(300)
ck('autorização nomeia o provedor e o servidor', 'Google Gemini' in ev(pg,"document.querySelector('#modal').innerText") and 'servidor' in ev(pg,"document.querySelector('#modal').innerText"))
pg.click('[data-a=prAutOk]'); pg.wait_for_timeout(2500)
ck('envio com chave pessoal (cabeçalhos x-provider)', OCR and OCR[0][0]=='gemini' and OCR[0][1] is True, OCR)
ck('lido e campo preenchido', ev(pg,"S.clients['c_T00001'].uf")=='PR' and ev(pg,"S.clients['c_T00001'].release")=='12.1.2410')
pg.wait_for_timeout(1500)
ev(pg,"flush()") if ev(pg,"typeof flush")=='function' else None
pg.wait_for_timeout(1500)
pg.reload(); pg.wait_for_timeout(3500)
ck('hospedado: persiste no servidor e sobrevive ao recarregar', ev(pg,"S.ocr.filter(o=>o.origem==='print'&&o.estado==='lido').length")==1 and ev(pg,"S.ocrimg.length")>=1 and ev(pg,"S.clients['c_T00001'].prFill.uf.imagem")=='h1.png', ev(pg,"[S.ocr.length,S.ocrimg.length,Object.keys(S.clients).length]"))
ev(pg,"UI.sel='c_T00001';UI.view='cliente';UI.ctab='raiox';render();0"); pg.wait_for_timeout(500)
ck('raio-X após recarregar mostra origem do print', 'Extraído de print por OCR' in ev(pg,"document.getElementById('app').innerText"))
ck('chave do provedor não vai para o registro gravado', 'AIza-teste' not in json.dumps(ev(pg,"[freezeClient(S.clients['c_T00001']),S.ocr]")))
ck('sem erros de página', not errs, errs[:3])
b.close(); print('FALHAS:',F); raise SystemExit(1 if F else 0)
