/* ===== BASE DE CONHECIMENTO (pesquisa na conversa em 04/11/2026; sem consulta web em tempo de execução) ===== */
const KB = (() => {
const C = '2026-11-04';
const src = (t, u, d) => ({ t, u, d: d || null });

const solutions = [
{ id:'protheus', nome:'TOTVS Backoffice – Linha Protheus (ERP)', cat:'ERP', finalidade:'ERP modular (compras, fiscal, financeiro, PCP, contabilidade, contratos, serviços); módulos contratáveis separadamente; nuvem ou servidor próprio.', publico:'Empresas de todos os segmentos (foco em médias e grandes).', integraProtheus:true,
  fonte:src('TOTVS – Conheça o sistema Protheus','https://www.totvs.com/blog/sistema-protheus/'), consulta:C, limites:'Licenciamento, módulos e quantidade de usuários não podem ser deduzidos de descrições de cobrança.', kw:/protheus|backoffice|microsiga|sigafin|sigacom|sigafis/i },
{ id:'cfgtrib', nome:'Configurador de Tributos – Linha Protheus', cat:'Fiscal', finalidade:'Motor de cálculo de tributos do Protheus; regras para IBS, CBS e IS com autonomia ao fiscal.', publico:'Clientes Protheus (release compatível).', integraProtheus:true,
  fonte:src('TOTVS Espaço Legislação – Protheus Reforma Tributária','https://espacolegislacao.totvs.com/protheus-reforma-tributaria/'), consulta:C, limites:'Requer release e pacotes de atualização compatíveis (ver TDN: CFGTRIB). Parametrização das regras é do cliente/consultoria.', kw:/configurador de tributos|cfgtrib/i },
{ id:'tit', nome:'TOTVS Inteligência Tributária', cat:'Fiscal', finalidade:'Dashboards e simulador para analisar impactos da reforma tributária no modelo operacional (documentos fiscais, tributos retidos).', publico:'Clientes com ERP TOTVS (guia TDN cita Datasul; página Protheus cita release 12.1.2510).', integraProtheus:true,
  fonte:src('TDN – TOTVS Inteligência Tributária e Simulador','https://tdn.totvs.com/x/uvX7Nw'), consulta:C, limites:'Guia TDN consultado descreve a versão Datasul; disponibilidade e pré-requisitos na linha Protheus devem ser confirmados na página oficial.', kw:/intelig[eê]ncia tribut[aá]ria/i },
{ id:'transmite', nome:'TOTVS Transmite', cat:'Fiscal', finalidade:'Gestão e transmissão de documentos fiscais eletrônicos (citado como complemento ao Protheus na página oficial).', publico:'Clientes Protheus.', integraProtheus:true,
  fonte:src('TOTVS Espaço Legislação – Protheus Reforma Tributária','https://espacolegislacao.totvs.com/protheus-reforma-tributaria/'), consulta:C, limites:'Escopo funcional detalhado não verificado nesta consulta.', kw:/totvs transmite|\btss\b/i },
{ id:'antecipa', nome:'TOTVS Antecipa (Techfin)', cat:'Techfin', finalidade:'Antecipação de recebíveis diretamente no ERP, com baixa automática dos títulos; sujeito à análise de crédito.', publico:'Empresas com carteira de recebíveis no ERP TOTVS.', integraProtheus:true,
  fonte:src('TDN – FINI136O Integração com TOTVS Antecipa','https://tdn.totvs.com/x/F2hVJQ'), consulta:C, limites:'Crédito sujeito à análise; taxas e limites não são públicos nesta fonte. Requisitos mínimos de release/binário no TDN.', kw:/antecipa/i },
{ id:'maisprazo', nome:'TOTVS Mais Prazo (Techfin)', cat:'Techfin', finalidade:'Crédito para ampliar prazo de pagamento a fornecedores, integrado ao Protheus (requisitos mínimos de binário/release no TDN).', publico:'Compradores com contas a pagar no Protheus.', integraProtheus:true,
  fonte:src('TDN – Integrações TECHFIN (Protheus)','https://tdn.totvs.com/x/KlteLg'), consulta:C, limites:'Nome em português inferido do título em inglês ("More Time to Pay"); confirmar nome comercial e condições.', kw:/mais prazo/i },
{ id:'contatechfin', nome:'Conta+Techfin (conta PJ integrada ao Protheus)', cat:'Techfin', finalidade:'Conta digital PJ integrada nativamente ao ERP: pagamentos, Pix e conciliação automática.', publico:'Clientes TOTVS Backoffice – Linha Protheus (roadmap RM, Datasul, Winthor).', integraProtheus:true,
  fonte:src('Lets Money – Techfin lança conta PJ integrada ao ERP TOTVS (imprensa)','https://www.letsmoney.com.br/noticias/techfin-conta-pj-integrada-erp-totvs/'), consulta:C, limites:'FONTE SECUNDÁRIA (imprensa). Confirmar disponibilidade e condições com a Techfin/TOTVS.', kw:/conta\s*\+?\s*techfin/i },
{ id:'pixcobranca', nome:'TOTVS Pix Cobrança (Techfin)', cat:'Techfin', finalidade:'Cobrança via Pix integrada ao ERP.', publico:'Clientes TOTVS (compatibilidade por linha a validar).', integraProtheus:null,
  fonte:src('TDN – Semana Backoffice Datasul: Jornada Financeira','https://tdn.totvs.com.br/download/attachments/791847397/Semana%20Backoffice%20-%20Jornada%20Financeira%20%281%29.pdf?api=v2'), consulta:C, limites:'Material de evento Datasul (2023). Compatibilidade com Protheus não verificada.', kw:/pix cobran/i },
{ id:'fluig', nome:'TOTVS Fluig (processos, documentos e portais)', cat:'Plataforma', finalidade:'Gestão de processos (BPM/workflow), documentos (ECM/GED), portais e colaboração; app mobile; independe do ERP.', publico:'Empresas com processos de aprovação/documentos fora do ERP.', integraProtheus:true,
  fonte:src('TDN – TOTVS Fluig: My Approval (apresentação)','https://tdn.totvs.com/download/attachments/849554714/My%20Approval_%20boas%20pr%C3%A1ticas%20que%20aceleram%20a%20tomada%20de%20decis%C3%A3o%20%28TOTVS%20Fluig%29.pdf?api=v2'), consulta:C, limites:'Integração com Protheus exige projeto (conectores/iPaaS/APIs). Não presumir fluxos prontos.', kw:/fluig/i },
{ id:'ipaas', nome:'TOTVS iPaaS', cat:'Plataforma', finalidade:'Plataforma oficial de integrações da TOTVS (fluxos por componentes).', publico:'Clientes que integram TOTVS a sistemas de terceiros.', integraProtheus:true,
  fonte:src('TDN – TOTVS Fluig: do tradicional ao inovador','https://tdn.totvs.com/download/attachments/852328296/Do%20Tradicional%20ao%20Inovador_%20Como%20o%20TOTVS%20Fluig%20pode%20Transformar%20a%20Experi%C3%AAncia%20de%20Cadastros.pdf?api=v2'), consulta:C, limites:'Escopo e licenciamento a confirmar.', kw:/ipaas/i },
{ id:'rh', nome:'TOTVS RH – Linha Protheus', cat:'RH', finalidade:'Recrutamento e seleção, treinamentos, admissão, folha de pagamento, ponto, cargos e salários.', publico:'Clientes Protheus com gestão de pessoal.', integraProtheus:true,
  fonte:src('Portal ERP – Facesign aprimora gestão de pessoas com TOTVS RH (imprensa)','https://portalerp.com/br/noticia/facesign-aprimora-gestao-de-pessoas-com-tecnologia-de-rh-da-totvs'), consulta:C, limites:'Fonte secundária para a lista de módulos; confirmar escopo no portal TOTVS RH.', kw:/totvs rh|folha|gest[aã]o de pessoas|sigagpe/i },
{ id:'ponto', nome:'TOTVS RH Ponto Eletrônico (Linha Protheus / RM / Datasul / Ahgora)', cat:'RH', finalidade:'Controle de jornada: batidas, banco de horas, acordos sindicais, fechamento e sincronização com a folha.', publico:'Empresas com controle de jornada.', integraProtheus:true,
  fonte:src('TOTVS – Ponto eletrônico','https://www.totvs.com/rh/ponto-eletronico/'), consulta:C, limites:'Cada linha (Protheus, RM, Datasul, Ahgora) é produto distinto; confirmar a linha adequada ao cliente.', kw:/ponto|ahgora|jornada/i },
{ id:'sst', nome:'SST / gestão de riscos ocupacionais (portfólio TOTVS RH) — NOME OFICIAL A VALIDAR', cat:'RH', finalidade:'Apoio ao PGR/GRO, incluindo fatores de risco psicossociais exigidos pela NR-1.', publico:'Empresas com empregados CLT.', integraProtheus:null,
  fonte:src('TOTVS Blog – NR-1 entra em vigor (página não pôde ser lida integralmente nesta consulta)','https://www.totvs.com/blog/fiscal-clientes/nr-1-entra-em-vigor-e-exige-gestao-dos-riscos-psicossociais/'), consulta:C, limites:'PRODUTO/MÓDULO ESPECÍFICO NÃO CONFIRMADO. Anexar catálogo oficial ou consultar o portal para o nome e escopo do módulo de SST.', kw:/\bsst\b|seguran[cç]a do trabalho|riscos ocupacionais|quirons/i },
{ id:'mes', nome:'TOTVS MES (execução da manufatura / OEE)', cat:'Manufatura', finalidade:'Automação e gestão à vista do chão de fábrica e indicadores como OEE; app "Minha Produção".', publico:'Indústrias.', integraProtheus:null,
  fonte:src('TDN – Semana Backoffice: Jornada Manufatura (set/2023)','https://tdn.totvs.com.br/download/attachments/791847397/_Semana%20Backoffice%20-%20Jornada%20Manufatura%20-%20set%202023.pdf?api=v2'), consulta:C, limites:'Material do contexto Datasul. Compatibilidade e escopo com Protheus a validar. (Existe POC "TOTVS MES Qualidade" em andamento em outro cliente — não reutilizar como prova.)', kw:/\bmes\b|oee/i },
{ id:'aps', nome:'TOTVS APS (planejamento e programação avançada)', cat:'Manufatura', finalidade:'Planejamento com restrições de capacidade; documento oficial descreve integração APS × Protheus.', publico:'Indústrias com PCP.', integraProtheus:true,
  fonte:src('TDN – Manual de Integração APS × Microsiga Protheus','https://tdn.totvs.com.br/download/attachments/547227767/Manual%20de%20Integra%C3%A7%C3%A3o%20APS%20X%20Microsiga%20Protheus.pdf?api=v2'), consulta:C, limites:'Manual antigo; validar versão e requisitos atuais.', kw:/\baps\b/i },
{ id:'manutencao', nome:'TOTVS Manutenção de Ativos – Linha Protheus', cat:'Manufatura', finalidade:'Gestão de ativos industriais e manutenção.', publico:'Indústrias e operações com ativos.', integraProtheus:true,
  fonte:src('Reforma Tributária (imprensa) – Requim adota TOTVS Backoffice e Manutenção de Ativos','https://www.reformatributaria.com/tecnologia/requim-vedacit-e-ademicon-trocam-de-erp-para-se-adaptar-as-novas-exigencias-da-reforma-tributaria/'), consulta:C, limites:'FONTE SECUNDÁRIA. Confirmar escopo no portal TOTVS.', kw:/manuten[cç][aã]o (de ativos|industrial)/i },
{ id:'logistica', nome:'TOTVS Suíte Logística (WMS, YMS, Agendamentos, Checklist, Coleta e Entrega, Roteirização e Entrega)', cat:'Logística', finalidade:'Cadeia de armazenagem e transporte e visibilidade logística; agnóstica a ERP segundo material oficial.', publico:'Agro, manufatura, distribuição, varejo e logística.', integraProtheus:true,
  fonte:src('Baguete – Vittia adota soluções TOTVS (14/05/2026) / TDN Semana Datasul 2023: Logística','https://www.baguete.com.br/noticias/vittia-impulsiona-a-gestao-integrada-com-conjunto-de-solucoes-da-totvs','2026-05-14'), consulta:C, limites:'Lista de módulos extraída de imprensa e de material de evento; confirmar portfólio vigente.', kw:/\bwms\b|\byms\b|roteiriza|suite log[ií]stica|su[ií]te log[ií]stica/i },
{ id:'rotas', nome:'TOTVS Planejamento de Rotas', cat:'Logística', finalidade:'Plataforma de planejamento de rotas (agro, manufatura, atacado e distribuição, varejo, logística).', publico:'Operações com entregas.', integraProtheus:null,
  fonte:src('Mundo Logística – TOTVS lança Planejamento de Rotas','https://mundologistica.com.br/noticias/totvs-lanca-solucao-para-aumentar-produtividade-ao-planejamento-logistico'), consulta:C, limites:'Data de lançamento e compatibilidade por ERP não verificadas.', kw:/planejamento de rotas/i },
{ id:'crm', nome:'TOTVS CRM – Gestão de Clientes', cat:'Vendas', finalidade:'CRM com integração nativa a Protheus e Datasul, metas, prospecção e analytics embutido.', publico:'Equipes comerciais B2B.', integraProtheus:true,
  fonte:src('TDN – Escopo funcional TOTVS CRM Gestão de Clientes','https://tdn.totvs.com.br/download/attachments/786551398/Escopo%20-%20Recursos%20Padroes%20-%20TCRM%20-%20GC%20%28v.008%29.pdf?api=v2'), consulta:C, limites:'Percentuais de ganho citados no material são do fabricante; não usar como estimativa do cliente.', kw:/\bcrm\b/i },
{ id:'bi', nome:'TOTVS Analytics / BI (inclui BI by TARGIT para Protheus e Winthor)', cat:'Dados', finalidade:'Dashboards e indicadores; BI by TARGIT integra Backoffice Linha Protheus e Winthor.', publico:'Gestores que dependem de planilhas/relatórios.', integraProtheus:true,
  fonte:src('TOTVS – BI by TARGIT','https://www.totvs.com/distribuicao/bi-by-targit/'), consulta:C, limites:'Existem múltiplas ofertas de BI; confirmar a vigente para o cliente.', kw:/analytics|\bbi\b|targit|fast analytics/i },
{ id:'obras', nome:'TOTVS Obras e Projetos – Linha RM', cat:'Construção', finalidade:'Gestão de obras e projetos (linha RM); há integração documentada RM × Protheus para RH/ponto.', publico:'Construção e projetos.', integraProtheus:null,
  fonte:src('TDN – Integração Gestão de Pessoal Protheus × TOP Mobile','https://tdn.totvs.com.br/download/attachments/547228040/Integracao%20Gestao%20de%20Pessoal%20Protheus%20X%20TOP%20Mobile%20-%20Versao%2012.pdf?api=v2'), consulta:C, limites:'É ERP de outra linha (RM). Aderência a cliente Protheus NÃO verificada. Consultar portal do segmento Construção.', kw:/obras e projetos|totvs obras|rm obras/i },
{ id:'cloud', nome:'TOTVS Cloud (nuvem proprietária)', cat:'Infra', finalidade:'Hospedagem/gestão do ambiente TOTVS (modelo PaaS citado em caso).', publico:'Clientes com ambiente on-premise ou hospedado.', integraProtheus:true,
  fonte:src('Reforma Tributária (imprensa) – Requim na TOTVS Cloud','https://www.reformatributaria.com/tecnologia/requim-vedacit-e-ademicon-trocam-de-erp-para-se-adaptar-as-novas-exigencias-da-reforma-tributaria/'), consulta:C, limites:'FONTE SECUNDÁRIA. Modalidades (Cloud Prime/Dedicado, SCC) e preços: validar com a TOTVS.', kw:/t-?cloud|totvs cloud|cloud (prime|dedicado)|\bcloud\b/i },
{ id:'scc', nome:'Serviços de sustentação / SCC (consultoria técnica)', cat:'Serviços', finalidade:'Horas de sustentação e evolução do ambiente — POSSIBILIDADE de serviço sujeita à validação de escopo, capacidade de entrega e disponibilidade comercial.', publico:'Clientes com demanda recorrente de chamados/ajustes.', integraProtheus:true,
  fonte:src('Sem oferta oficial comprovada nesta consulta — validar com portfólio de serviços TOTVS','https://www.totvs.com/'), consulta:C, limites:'Não há fonte oficial anexada; tratar como possibilidade de serviço.', kw:/\bscc\b|sustenta[cç][aã]o/i },
{ id:'assinatura', nome:'TOTVS Assinatura Eletrônica', cat:'Plataforma', finalidade:'Assinatura eletrônica citada como solução complementar ao Protheus.', publico:'Clientes Protheus.', integraProtheus:true,
  fonte:src('TOTVS – Conheça o sistema Protheus','https://www.totvs.com/blog/sistema-protheus/'), consulta:C, limites:'Apenas menção como complementar; escopo não verificado.', kw:/assinatura eletr[oô]nica/i }
];

/* Padrões para identificar produtos citados em planilha/fichas/documentos (NÃO prova parque completo) */
const productPatterns = [
 ...solutions.filter(s=>s.kw).map(s=>({id:s.id, nome:s.nome.split(' (')[0].split(' —')[0], re:s.kw})),
 {id:'rm_linha', nome:'Linha RM (módulo não especificado)', re:/\brm\b/i},{id:'datasul', nome:'Linha Datasul', re:/datasul/i},{id:'winthor', nome:'Linha Winthor', re:/winthor/i},{id:'logix', nome:'Linha Logix', re:/logix/i},{id:'techfin_geral', nome:'Techfin (genérico)', re:/techfin/i},
 {id:'cdu', nome:'Licenciamento CDU/SMSe (termo de cobrança)', re:/\bcdu\b|\bsmse\b/i}
];
const modalidadeRe = /modalidade[^\n:]{0,25}:\s*[^\n]{3,40}/i;

/* Necessidades (palavras que, na planilha/observações/documentos do próprio cliente, indicam evidência individual) */
const NEEDS = {
 fiscal:/tribut|fiscal|reforma|\bibs\b|\bcbs\b|nf-?e|nfs-?e|nota fiscal|icms|sped|cfop|\bncm\b|classifica[cç][aã]o tribut/i,
 sst:/\bsst\b|nr-?1\b|nr-?17|psicossoc|absente|afastament|esocial|\bpgr\b|\bgro\b|sa[uú]de ocupacional|banco de horas|hora extra|jornada|\bponto\b/i,
 financeiro:/capital de giro|inadimpl|cobran[cç]a|boleto|concilia|antecip|prazo de pagamento|receb[ií]ve|fluxo de caixa|\bpix\b|contas a (pagar|receber)/i,
 processos:/aprova[cç]|workflow|fluxo de trabalho|processo manual|papel\b|documentos?\b|assinatura|planilha|\bged\b|protocolo|solicita[cç]/i,
 producao:/produ[cç][aã]o|\bpcp\b|\boee\b|paradas?\b|apontamento|ch[aã]o de f[aá]brica|capacidade|programa[cç][aã]o|perdas?\b|retrabalho|manuten[cç]/i,
 analytics:/dashboard|indicador|\bkpi\b|\bbi\b|relat[oó]rio|funil|pipeline|forecast|comiss/i,
 logistica:/entrega|\brotas?\b|frota|expedi[cç]|armaz[eé]m|\bcd\b|picking|estoque|separa[cç][aã]o|agendamento|doca|transporte|frete/i,
 sustentacao:/\bscc\b|sustenta[cç]|chamados?\b|upgrade|release|vers[aã]o|atualiza[cç]|lentid|banco de dados|backup|homologa|infra/i,
 treinamento:/treinamento|capacita|ado[cç][aã]o|uso do sistema|parametriza|customiza|\bgap\b/i,
 nfse:/nfs-?e|nota de servi[cç]o|\biss\b|munic[ií]pi/i,
 obras:/\bobras?\b|empreendimento|medi[cç][aã]o|canteiro|or[cç]amento de obra|engenharia/i,
 retencao:/cancel|churn|insatisf|reclama|concorr[eê]n|troca de (erp|sistema)|migrar para|renegocia|risco de perda/i
};

/* Tendências/segmentos: cada item sourced. cls=FATO refere-se ao dado da FONTE (evidência SETORIAL, não do cliente). */
const segments = [
{ id:'manufatura', nome:'Manufatura / Indústria (inclui metalmecânica)', re:/manufat|ind[uú]stri|metal|mec[aâ]nic|siderur|usinag|fundi|caldeir|estrutura|autom[oó]t|embalag|pl[aá]stic|alimento/i, estudo:true,
 resumo:'Indústria de transformação com crescimento fraco e crédito caro; foco em produtividade, automação e digitalização.',
 processos:['Planejamento e controle da produção (PCP)','Apontamento de produção e indicadores (OEE)','Manutenção de ativos','Compras/estoque de insumos','Custos'],
 tendencias:[
  {t:'Custo do crédito (Selic em 15% a.a., segundo a Firjan) segue como principal entrave à indústria de transformação.',fonte:src('Monitor Mercantil – Firjan alerta que juros e incerteza externa travam setor industrial','https://monitormercantil.com.br/firjan-alerta-que-juros-e-incerteza-externa-travam-setor-industrial/','2026 (data exata não confirmada)'),needs:['producao'],impacto:'Menos capital para expansão: eficiência operacional e redução de perdas ganham peso.'},
  {t:'Indústria de transformação: -0,2% em 2025; CNI projeta desempenho fraco em 2026 (faturamento real -0,2%, horas trabalhadas -0,8% e capacidade utilizada -0,8% no acumulado até agosto).',fonte:src('Times Brasil – Crédito à indústria chega a R$ 755 bi, mas produção cai (CNI)','https://timesbrasil.com.br/brasil/economia-brasileira/credito-a-industria-chega-a-r-755-bilhoes-mas-setor-enfrenta-queda-na-producao-e-desafios-de-competitividade-aponta-cni/','2026-10-27'),needs:['producao'],impacto:'Capacidade ociosa e pressão por produtividade.'},
  {t:'Máquinas e equipamentos: demanda estável com foco em produtividade, automação, eficiência energética e digitalização.',fonte:src('Diário do Comércio – Eficiência e previsibilidade: perspectivas para a indústria','https://diariodocomercio.com.br/opiniao/coluna/industria-inteligente/eficiencia-previsibilidade-perspectivas-industria-brasileira/','2026'),needs:['producao','analytics'],impacto:'Digitalização do chão de fábrica e indicadores.'},
  {t:'Polo metalmecânico do Vale do Aço (MG): importações de aço e escassez de trabalhadores qualificados; setor aposta em tecnologia, automação e digitalização (EVIDÊNCIA REGIONAL).',fonte:src('Diário do Comércio – Polo metalmecânico do Vale do Aço','https://diariodocomercio.com.br/economia/polo-metalmecanico-vale-do-aco/','2025/2026'),needs:['producao','sst'],impacto:'Regional; não generalizar.'},
  {t:'Nova Indústria Brasil direciona incentivos a digitalização e inovação (análise KPMG).',fonte:src('Monitor Mercantil – Setor industrial em 2026 (KPMG)','https://monitormercantil.com.br/?p=316408','2026'),needs:['producao'],impacto:'Possível apoio a projetos de modernização (validar elegibilidade).'}
 ],
 dores:['Apontamento e programação de produção sem visibilidade em tempo real (hipótese setorial)','Paradas e perdas sem indicador consolidado (hipótese setorial)','Dependência de planilhas para PCP (hipótese setorial)'],
 demandas:['Indicadores de produtividade/OEE','Planejamento com restrição de capacidade','Gestão de manutenção'],
 aplicacoes:[{sol:'mes',porque:'Visibilidade de chão de fábrica e OEE (compatibilidade com Protheus a validar).'},{sol:'aps',porque:'Programação com restrições; há manual oficial de integração com Protheus.'},{sol:'manutencao',porque:'Gestão de ativos industriais.'},{sol:'bi',porque:'Indicadores a partir do ERP.'}],
 perguntas:['Como é feito hoje o apontamento de produção (sistema, papel, planilha)?','Há indicadores de paradas e retrabalho? Quem os acompanha?','O PCP considera capacidade finita ou é manual?','Há ordens de manutenção registradas no ERP?'] },
{ id:'construcao', nome:'Construção e Projetos / Engenharia', re:/constru[cç]|engenharia|incorpora|obra|empreend|projetos? de/i, estudo:true,
 resumo:'Custos de construção acima da inflação, escassez de mão de obra e juros altos pressionam margens; gestores buscam eficiência e tecnologia.',
 processos:['Orçamento e planejamento de obras','Medições e contratos','Suprimentos','Gestão de mão de obra/ponto','Custos por obra'],
 tendencias:[
  {t:'INCC acumulou +5,84% em 12 meses até mar/2026 (inflação 4,14%); custo da mão de obra +8,82%; juros altos revisam projeções do setor.',fonte:src('Amdjus – Construção civil cresce no 1º tri, mas custos altos diminuem projeções','https://amdjus.com.br/construcao-civil-cresce-no-1-tri-mas-custos-altos-diminuem-projecoes/','2026'),needs:['obras','financeiro'],impacto:'Margens apertadas: controle de custos por obra e fluxo de caixa.'},
  {t:'Escassez de mão de obra qualificada é um dos principais desafios; CBIC aponta investimento em tecnologia como parte da solução.',fonte:src('CBIC – Escassez de mão de obra desafia construção civil','https://cbic.org.br/escassez-de-mao-de-obra-desafia-construcao-civil-e-reforca-agenda-de-qualificacao-e-inovacao/','2026-07-07'),needs:['sst','obras'],impacto:'Gestão de pessoas e produtividade.'},
  {t:'Pesquisa Falconi/Sienge: pressão de custos e falta de profissionais levam gestores a investir em eficiência, tecnologia e qualificação.',fonte:src('Estado de Minas – Construção civil resiste à falta de mão de obra qualificada','https://www.em.com.br/mundo-corporativo/2026/04/7388960-construcao-civil-resiste-a-falta-de-mao-de-obra-qualificada.html','2026-04'),needs:['obras','processos'],impacto:'Organização da informação e processos.'},
  {t:'Dado de 2022 (Deloitte, citado pela Sienge): 79% das empresas apontam imprevisibilidade de custos como causa de baixa produtividade. (DADO ANTIGO — validar atualidade.)',fonte:src('Sienge – Trilha de implementação para gestão de obras','https://www.sienge.com.br/blog/trilha-de-implementacao-para-gestao-de-obras/','2022'),needs:['obras'],impacto:'Previsibilidade de custos.'}
 ],
 dores:['Estouro de orçamento por falta de acompanhamento por obra (hipótese setorial)','Controle de mão de obra e jornada em canteiro (hipótese setorial)'],
 demandas:['Controle de custos por obra','Gestão de contratos e medições','Gestão de pessoas/ponto'],
 aplicacoes:[{sol:'protheus',porque:'Compras, financeiro e contratos no ERP (módulos a validar).'},{sol:'obras',porque:'Linha RM de Obras e Projetos — aderência a Protheus NÃO verificada.'},{sol:'ponto',porque:'Jornada de equipes de obra.'},{sol:'fluig',porque:'Aprovações e documentos de obra (projeto de integração).'}],
 perguntas:['Como o custo é acompanhado por obra/centro de custo hoje?','Como são feitas medições e aprovações de contratos?','Há dificuldade em controlar ponto/jornada em canteiro?','O ERP atual cobre orçamento de obra ou há ferramenta paralela?'] },
{ id:'distribuicao', nome:'Distribuição / Atacado (inclui bebidas)', re:/distribui|atacad|bebida|cervej|refrigerante|comercio|com[eé]rcio|revenda|importa/i, estudo:true,
 resumo:'Logística de entrega, margem e controle de cobrança são pontos críticos na distribuição de bebidas.',
 processos:['Pedidos e faturamento','Roteirização e entrega','Armazenagem e estoque','Cobrança e conciliação','Tributação (ICMS/IBS/CBS)'],
 tendencias:[
  {t:'Logística de bebidas: custo competitivo e comunicação entre muitos elos da cadeia estão entre os desafios apontados (fonte de fornecedor de tecnologia logística).',fonte:src('Mundo Logística – Desafios da logística na indústria de bebidas','https://mundologistica.com.br/noticias/desafios-da-logistica-na-industria-de-bebidas','2026 (ed. mar–mai)'),needs:['logistica'],impacto:'Custo por entrega e nível de serviço.'},
  {t:'Caso de distribuição capilar de bebidas: rotas não otimizadas, tempo de espera no cliente, cobranças não padronizadas e pedidos divididos em vários paletes (estudo de caso de consultoria).',fonte:src('Kaizen – Otimização logística e distribuição capilar na indústria de bebidas','https://kaizen.com/pt/insights-pt/otimizacao-logistica-distribuicao-capilar-bebidas/','n/d'),needs:['logistica','financeiro'],impacto:'Caso isolado — usar como hipótese de investigação.'}
 ],
 dores:['Rotas e janelas de entrega pouco otimizadas (hipótese setorial)','Cobrança e conciliação de recebíveis manuais (hipótese setorial)'],
 demandas:['Roteirização','WMS/estoque','Conciliação financeira','BI comercial'],
 aplicacoes:[{sol:'logistica',porque:'Suíte Logística (WMS/Roteirização/Agendamentos).'},{sol:'rotas',porque:'Planejamento de rotas (compatibilidade a validar).'},{sol:'antecipa',porque:'Giro de recebíveis integrado ao ERP.'},{sol:'bi',porque:'BI by TARGIT integra Protheus.'}],
 perguntas:['Como são definidas as rotas e janelas de entrega hoje?','Qual o tempo médio de espera/devoluções por entrega?','Como é feita a conciliação de boletos/Pix e a cobrança?','Há WMS ou controle de estoque por endereço?'] },
{ id:'servicos', nome:'Serviços / Prestadores de serviço', re:/servi[cç]o|consultoria|tecnologia|software|a[eé]re|t[aá]xi a[eé]reo|aviaç|transporte a[eé]reo|facilities|terceiriza/i, estudo:true,
 resumo:'NFS-e de padrão nacional e a reforma tributária mudam a rotina fiscal de prestadores de serviço.',
 processos:['Contratos e medição de serviços','Faturamento e NFS-e','Gestão de pessoas'],
 tendencias:[
  {t:'NFS-e padrão nacional: Resolução CGSN 191/2026 prorrogou para 01/11/2026 a obrigatoriedade do emissor nacional para ME/EPP do Simples; MEI já usa desde 2023. VERIFICAR eventual novo adiamento.',fonte:src('Senior – Portal de Exigências Legais (Res. CGSN 191/2026)','https://documentacao.senior.com.br/exigenciaslegais/noticias/federal/2026/2026-08-11-simples-nacional-resolucao-cgsn-no-191-2026-utilizacao-do-emissor-da-nfs-e-de-padrao-nacional-sera-a-partir-de-novembro','2026-08-11'),needs:['nfse','fiscal'],impacto:'Rejeição/descompasso de emissão se o sistema não estiver adaptado.'}
 ],
 dores:['Emissão de NFS-e fora do padrão nacional (hipótese setorial)'], demandas:['Adequação fiscal de serviços','Gestão de contratos e serviços'],
 aplicacoes:[{sol:'protheus',porque:'Módulos de Gestão de Contratos e Gestão de Serviços (página oficial do Protheus).'},{sol:'transmite',porque:'Gestão de documentos fiscais (escopo a validar).'}],
 perguntas:['Qual o regime tributário e como a NFS-e é emitida hoje (ERP, portal municipal, emissor nacional)?','O município já adotou o padrão nacional?','Como os contratos recorrentes são faturados?'] },
{ id:'logistica_seg', nome:'Logística / Transportes', re:/log[ií]stic|transport|frete|armazen/i, estudo:true,
 resumo:'Custos (inclusive frete) pressionam; TOTVS mantém Suíte Logística agnóstica a ERP.',
 processos:['Armazenagem','Transporte e entrega','Visibilidade logística'],
 tendencias:[{t:'Na indústria de transformação, custos elevados — inclusive de frete — pressionam a recuperação em 2026.',fonte:src('Portal Tela – Indústria brasileira enfrenta desafios para voltar ao auge','https://www.portaltela.com/noticias/economia/2026/06/03/industria-brasileira-enfrenta-desafios-para-voltar-ao-auge-com-numeros-positivos/','2026-06-03'),needs:['logistica'],impacto:'Pressão por eficiência de transporte.'}],
 dores:['Custo de frete e roteirização (hipótese setorial)'], demandas:['WMS, YMS, roteirização'],
 aplicacoes:[{sol:'logistica',porque:'Suíte Logística.'},{sol:'rotas',porque:'Planejamento de rotas.'}],
 perguntas:['Como é planejada a roteirização e o agendamento de docas?','Há visibilidade do pátio e da armazenagem?'] },
{ id:'agro', nome:'Agronegócio / Agroindústria', re:/agro|rural|fazenda|pecu|capri|ovin|bovin|gr[aã]o|fertiliz|cooperativa/i, estudo:false, resumo:'ESTUDO PARCIAL: caso recente de agro adotando Suíte Logística (imprensa). Pesquisar tendências setoriais antes de abordar.',
 processos:[],tendencias:[{t:'Caso Vittia (maio/2026): empresa do agro adotou Suíte Logística TOTVS (Agendamentos, WMS SaaS, YMS, Checklist, Coleta e Entrega, Roteirização e Entrega). É EVIDÊNCIA DE CASO, não de dor do segmento.',fonte:src('Baguete – Vittia impulsiona a gestão integrada com TOTVS','https://www.baguete.com.br/noticias/vittia-impulsiona-a-gestao-integrada-com-conjunto-de-solucoes-da-totvs','2026-05-14'),needs:['logistica'],impacto:'Hipótese de logística integrada.'}],
 dores:[],demandas:[],aplicacoes:[{sol:'logistica',porque:'Caso de referência de segmento.'}],perguntas:['Qual o principal gargalo operacional hoje (colheita, armazenagem, entrega, crédito)?'] },
{ id:'saude', nome:'Saúde', re:/sa[uú]de|hospital|cl[ií]nica|laborat|farm[aá]c|odonto|operadora/i, estudo:false, resumo:'ESTUDO NÃO CARREGADO nesta versão. Pesquisar fontes oficiais (ANS/ANVISA) antes de abordar.', processos:[],tendencias:[],dores:[],demandas:[],aplicacoes:[],perguntas:[] },
{ id:'varejo', nome:'Varejo', re:/varejo|loja|farmácia|supermerc|moda|e-?commerce/i, estudo:false, resumo:'ESTUDO NÃO CARREGADO nesta versão.', processos:[],tendencias:[],dores:[],demandas:[],aplicacoes:[],perguntas:[] },
{ id:'educacional', nome:'Educacional', re:/educa|escola|faculdade|ensino|universid/i, estudo:false, resumo:'ESTUDO NÃO CARREGADO nesta versão.', processos:[],tendencias:[],dores:[],demandas:[],aplicacoes:[],perguntas:[] },
{ id:'financial', nome:'Financial Services', re:/financ|banco|seguro|cr[eé]dito|cons[oó]rcio|fintech/i, estudo:false, resumo:'ESTUDO NÃO CARREGADO nesta versão.', processos:[],tendencias:[],dores:[],demandas:[],aplicacoes:[],perguntas:[] },
{ id:'hospitalidade', nome:'Hospitalidade e Turismo', re:/hotel|hospitalid|turismo|resort|restaurante/i, estudo:false, resumo:'ESTUDO NÃO CARREGADO nesta versão.', processos:[],tendencias:[],dores:[],demandas:[],aplicacoes:[],perguntas:[] },
{ id:'juridico', nome:'Jurídico', re:/jur[ií]dic|advoc|escrit[oó]rio de advocacia/i, estudo:false, resumo:'ESTUDO NÃO CARREGADO nesta versão.', processos:[],tendencias:[],dores:[],demandas:[],aplicacoes:[],perguntas:[] }
];

/* Evidências transversais (regulatórias) — aplicam-se a clientes com base relevante identificada */
const transversal = [
{ id:'reforma', nome:'Reforma Tributária do Consumo (IBS/CBS)', need:'fiscal',
 fatos:[
  {t:'2026 é ano de teste: CBS 0,9% e IBS 0,1% destacados nos documentos fiscais; transição do IBS de 2029 (10%) a 2033 (100%), com extinção gradual de ICMS/ISS (LC 214/2025, EC 132/2023).',fonte:src('TOTVS Espaço Legislação – Base de cálculo e redução IBS/CBS (PDF, dez/2025)','https://midias-sites.totvs.com/espacolegislacao/wp-content/uploads/2025/12/01-MOMENTO-LEGISLACAO-Base-de-Calculo-_-Reducao-IBS-e-CBS.pdf','2025-12')},
  {t:'Soluções TOTVS para Protheus: Configurador de Tributos, TOTVS Inteligência Tributária (release 12.1.2510), TOTVS Transmite e Classificação Tributária by Systax.',fonte:src('TOTVS Espaço Legislação – Protheus Reforma Tributária','https://espacolegislacao.totvs.com/protheus-reforma-tributaria/','2025/2026')}
 ],
 validar:'Cronograma de obrigatoriedade dos campos IBS/CBS em documentos fiscais teve divulgação de ajustes/adiamentos em fontes secundárias: confirmar vigência no Portal NF-e e na página TOTVS antes de comunicar prazos ao cliente.' },
{ id:'nr1', nome:'NR-1 – riscos psicossociais no GRO/PGR', need:'sst',
 fatos:[
  {t:'Nova redação do capítulo 1.5 da NR-1 em vigor desde 26/05/2026 (fatores de risco psicossociais no gerenciamento de riscos ocupacionais).',fonte:src('TOTVS Blog – NR-1 entra em vigor (atualizado em 26/05/2026)','https://www.totvs.com/blog/fiscal-clientes/nr-1-entra-em-vigor-e-exige-gestao-dos-riscos-psicossociais/','2026-05-26')},
  {t:'Segundo a Buk (10/08/2026), liminar no STF (ADPF 1316) suspendia multas, com análise no Plenário prevista para 7–18/08; a vigência da norma foi mantida pelo MTE.',fonte:src('Buk – Suspensão das multas da NR-1','https://www.buk.com.br/blog/suspensao-multas-nr-1','2026-08-10')}
 ],
 validar:'Situação atual da liminar/multas após o julgamento do STF NÃO foi verificada: confirmar antes de usar urgência com o cliente.' },
{ id:'nfse', nome:'NFS-e de padrão nacional', need:'nfse',
 fatos:[{t:'Res. CGSN 191/2026: emissor nacional obrigatório para ME/EPP do Simples a partir de 01/11/2026 (antes previsto para 01/09/2026); municípios aderindo ao padrão desde 01/01/2026.',fonte:src('Senior – Portal de Exigências Legais','https://documentacao.senior.com.br/exigenciaslegais/noticias/federal/2026/2026-08-11-simples-nacional-resolucao-cgsn-no-191-2026-utilizacao-do-emissor-da-nfs-e-de-padrao-nacional-sera-a-partir-de-novembro','2026-08-11')}],
 validar:'Confirmar no portal gov.br/nfse a regra vigente para o município e o regime do cliente.' }
];

return { consulta:C, solutions, productPatterns, modalidadeRe, NEEDS, segments, transversal, sol:id=>solutions.find(s=>s.id===id) };
})();
