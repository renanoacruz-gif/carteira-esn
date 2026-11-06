# Conteúdo das páginas legais. Fatos técnicos conferidos no código (worker.js, adm.js, schema, wrangler.toml, README).
CONTATO = 'renan.oscar@totvs.com.br'
DATA = '06/11/2026'
VERSAO = '1.0'

def tb(head, rows):
    h = ''.join(f'<th>{c}</th>' for c in head)
    r = ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in row) + '</tr>' for row in rows)
    return f'<div class="tw"><table><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table></div>'

PAGES = {}

PAGES['termos-de-uso'] = dict(
  titulo='Termos de Uso', curto='Termos de Uso',
  resumo='As regras para acessar e usar a Gestão de Carteira TOTVS ESN.',
  secoes=[
  ('Aceitação e objeto', f'''<p>A <b>Gestão de Carteira TOTVS ESN</b> ("sistema") é uma ferramenta interna de apoio aos Executivos de Soluções e Negócios (ESN) da TOTVS para organizar a carteira de clientes, reunir fichas, prints e contratos, e apoiar a leitura de oportunidades e a preparação de reuniões.</p>
<p>Ao entrar no sistema, você declara ter lido e aceito estes Termos, a <a href="/sobre/politica-de-uso/">Política de Uso</a>, a <a href="/sobre/privacidade/">Política de Privacidade</a> e as informações sobre a <a href="/sobre/lgpd/">LGPD</a>.</p>'''),
  ('Quem pode usar', '''<p>O acesso é restrito a colaboradores com e-mail <b>@totvs.com.br</b>. A entrada é feita pelo Cloudflare Access, com código de uso único enviado ao e-mail, e o sistema confere o domínio do e-mail a cada requisição.</p>
<p>O acesso é pessoal e intransferível. Você é responsável pela sua caixa de e-mail e pelos códigos que recebe: não os compartilhe e avise o administrador se suspeitar de acesso indevido.</p>'''),
  ('O que o sistema oferece e o que não oferece', '''<ul><li>Importação da carteira, página do cliente, fichas, imagens e prints (OCR), raio-X, oportunidades, inteligência de mercado, base de soluções e briefing pré-reunião.</li>
<li>As análises, oportunidades e leituras são <b>sugestões</b> geradas a partir dos dados que você informou e de regras do sistema. Confira-as antes de decidir ou de levá-las ao cliente.</li>
<li>Recursos que usam IA podem errar ou omitir informação. A revisão humana é obrigatória.</li>
<li>O sistema não substitui os sistemas oficiais da TOTVS (como o CRM) nem os documentos contratuais.</li></ul>'''),
  ('Conteúdo que você insere', '''<p>Você é responsável pela adequação e pela licitude dos dados que insere (planilhas, fichas, prints, notas). Insira apenas o necessário para o seu trabalho e não insira dados pessoais sensíveis nem dados de terceiros sem fundamento para isso.</p>
<p>O <b>catálogo de soluções é compartilhado</b> entre os executivos: nunca coloque nele dados de clientes. A carteira é privada, vinculada ao seu e-mail.</p>'''),
  ('Chaves de IA', '''<p>Os recursos de IA e OCR usam a <b>sua</b> chave de um provedor (Gemini, OpenAI, Anthropic ou Groq). A chave fica no seu navegador e não é gravada pelo servidor. Custos, limites e termos do provedor são de sua responsabilidade. O conteúdo só é enviado ao provedor quando você aciona o recurso e autoriza o envio.</p>'''),
  ('Disponibilidade, suporte e backup', '''<p>O sistema está em evolução e é oferecido sem garantia de disponibilidade contínua e sem acordo de nível de serviço. Pode haver indisponibilidades, mudanças de função e correções.</p>
<p>Exporte periodicamente o backup da sua carteira pelo próprio sistema. Dúvidas e sugestões vão para o administrador (seção Contato).</p>'''),
  ('Propriedade intelectual', '''<p>Marcas, logotipos e conteúdos da TOTVS pertencem à TOTVS. Os dados que você insere permanecem sob a responsabilidade do controlador descrito na Política de Privacidade.</p>'''),
  ('Suspensão de acesso', '''<p>O acesso pode ser suspenso em caso de descumprimento destes Termos ou da Política de Uso, de desligamento ou mudança de função do colaborador, ou por razões de segurança.</p>'''),
  ('Alterações destes Termos', f'''<p>Estes Termos podem mudar. A versão vigente, com data, fica sempre nesta página. Versão {VERSAO}, de {DATA}.</p>'''),
  ('Lei aplicável', '''<p>Aplica-se a legislação brasileira. Eventuais controvérsias seguem os procedimentos internos da TOTVS.</p>'''),
  ('Contato', f'''<p>Administrador do sistema: <a href="mailto:{CONTATO}">{CONTATO}</a>.</p>'''),
  ])

PAGES['politica-de-uso'] = dict(
  titulo='Política de Uso', curto='Política de Uso',
  resumo='O que é esperado de quem usa o sistema: usos permitidos, proibidos e boas práticas.',
  secoes=[
  ('Finalidade', '''<p>Esta política define o uso aceitável da Gestão de Carteira TOTVS ESN, para proteger os dados dos clientes, a segurança do ambiente e a confiabilidade das análises.</p>'''),
  ('Usos permitidos', '''<ul><li>Organizar e analisar a sua carteira de clientes e preparar reuniões.</li>
<li>Anexar fichas, contratos e prints necessários ao seu trabalho.</li>
<li>Cadastrar e validar soluções no catálogo compartilhado, sem dados de clientes.</li>
<li>Usar recursos de IA e OCR com a sua chave, para tarefas profissionais.</li></ul>'''),
  ('Usos proibidos', '''<ul><li>Compartilhar o seu acesso, os códigos recebidos ou a sua chave de IA.</li>
<li>Inserir dados pessoais sensíveis (como saúde, origem racial, filiação sindical ou religiosa) ou dados desnecessários ao trabalho.</li>
<li>Inserir dados de clientes ou de pessoas no catálogo compartilhado.</li>
<li>Tentar acessar a carteira de outro usuário, contornar o login, os limites de uso ou as proteções do sistema, ou explorar falhas.</li>
<li>Automatizar requisições em volume que prejudique o serviço ou os provedores de IA.</li>
<li>Usar o sistema para fins alheios ao trabalho ou contrários a políticas da TOTVS e à lei.</li>
<li>Enviar à IA conteúdo que você não está autorizado a compartilhar com o provedor.</li></ul>'''),
  ('Boas práticas', '''<ul><li><b>Revise</b> as análises e oportunidades antes de usá-las; trate IA e OCR como rascunho.</li>
<li><b>Minimize</b> o que entra: antes de colar um print, veja se há dados que não precisam estar nele.</li>
<li><b>Faça backup</b> da carteira com regularidade e guarde o arquivo em local seguro, pois ele contém dados de clientes.</li>
<li><b>Apague</b> dados que deixaram de ser necessários, usando as funções de gerenciamento de dados do sistema.</li>
<li><b>Mantenha</b> o navegador e o computador atualizados e bloqueie a tela ao se ausentar.</li></ul>'''),
  ('Limites técnicos', '''<p>O sistema aplica limites de uso aos recursos de IA (por minuto e por dia) e pode recusar requisições fora do padrão. Os limites existem para proteger o serviço e os custos.</p>'''),
  ('Registro de uso', '''<p>Eventos de uso (recurso, data e hora, resultado e tempo de processamento) são registrados para acompanhar o funcionamento do sistema. Nunca são gravados o conteúdo de fichas, prints, pesquisas, contratos ou respostas da IA, nem nomes de clientes, CNPJs ou valores. Detalhes na <a href="/sobre/privacidade/">Política de Privacidade</a>.</p>'''),
  ('Incidentes e dúvidas', f'''<p>Se perceber acesso indevido, perda de dispositivo com acesso, envio equivocado de dados ou comportamento suspeito, avise imediatamente <a href="mailto:{CONTATO}">{CONTATO}</a>, informando o que aconteceu e quando.</p>'''),
  ('Consequências', '''<p>O descumprimento pode levar à suspensão do acesso e à comunicação à gestão, sem prejuízo das medidas previstas nas políticas internas da TOTVS.</p>'''),
  ('Vigência', f'''<p>Versão {VERSAO}, de {DATA}.</p>'''),
  ])

PAGES['privacidade'] = dict(
  titulo='Política de Privacidade', curto='Privacidade',
  resumo='Quais dados o sistema trata, para quê, com quem compartilha e por quanto tempo.',
  secoes=[
  ('Quem trata os dados', f'''<ul><li><b>Controlador:</b> TOTVS S.A.</li>
<li><b>Operador técnico:</b> o administrador do sistema, que mantém o ambiente e o banco de dados.</li>
<li><b>Suboperador de infraestrutura:</b> Cloudflare (hospedagem do aplicativo, banco D1 e controle de acesso).</li>
<li><b>Contato de privacidade:</b> <a href="mailto:{CONTATO}">{CONTATO}</a> (canal provisório até a definição de um canal oficial do Encarregado).</li></ul>'''),
  ('Quais dados são tratados', tb(['Dado','Finalidade','Observações'], [
    ['<b>Identificação do usuário</b>: e-mail corporativo, nome (quando informado pelo Access), data do primeiro e do último acesso, número de acessos','Autenticar, autorizar e administrar o acesso','Vem do login do Cloudflare Access'],
    ['<b>Carteira</b>: empresas, CNPJ, contratos, produtos, faturamento, notas, fichas, imagens e prints, e pessoas de contato quando informadas','Análise da carteira e preparo de reuniões','Privada: só o próprio e-mail acessa. É inserida por você'],
    ['<b>Registro de uso</b>: recurso usado, data e hora, resultado, tempo de processamento, e-mail do usuário e medidas de desempenho da abertura (tempos do navegador e quantidade de clientes)','Acompanhar adoção e funcionamento, e medir desempenho','Nunca grava conteúdo de fichas, prints, pesquisas, contratos ou respostas de IA, nem nomes de clientes, CNPJs ou valores'],
    ['<b>Tentativas de acesso negadas</b>: data, e-mail informado, motivo e rota','Segurança','Guardadas por 90 dias'],
    ['<b>Observações de segurança do navegador</b>: regra de segurança acionada e destino bloqueado, com contagem','Segurança e correção de falhas','Sem identificação de usuário'],
    ['<b>Preferências locais</b>: chave de IA, avisos já vistos e configurações, no armazenamento do seu navegador','Funcionamento do sistema','Ficam no seu navegador; a chave de IA não é gravada pelo servidor'],
  ])+'''<p>As páginas públicas (landing e documentos) não usam cookies de rastreamento nem ferramentas de análise de audiência.</p>'''),
  ('Base legal', '''<p>O tratamento tem como base, em regra, o <b>legítimo interesse</b> da TOTVS na gestão da sua operação comercial e na segurança do ambiente (LGPD, art. 7º, IX) e, quando aplicável, a execução das atividades decorrentes da relação de trabalho e de contratos com clientes (art. 7º, V). As bases são definidas e validadas pelo controlador e pelo Encarregado.</p>'''),
  ('Com quem os dados são compartilhados', '''<ul><li><b>Cloudflare:</b> hospeda o aplicativo e o banco, e controla o acesso. Quem administra a conta do Cloudflare tem acesso técnico ao banco.</li>
<li><b>Provedores de IA</b> (Google Gemini, OpenAI, Anthropic, Groq): só quando você aciona um recurso de IA ou OCR com a sua chave e autoriza o envio. Vai apenas o conteúdo necessário àquela tarefa.</li>
<li><b>Fontes externas consultadas por você</b> (por exemplo, consultas públicas de CNPJ, TDN e Planilhas Google): vai só o necessário para a consulta, como o identificador ou o link informado.</li>
<li>Os dados não são vendidos nem usados para publicidade.</li></ul>'''),
  ('Transferência internacional', '''<p>O banco de dados fica na região <b>ENAM</b> do Cloudflare D1 (leste da América do Norte), e a rede do Cloudflare e os provedores de IA podem processar dados fora do Brasil. Essas transferências ocorrem com os mecanismos previstos no art. 33 da LGPD, conforme os contratos de cada fornecedor.</p>'''),
  ('Por quanto tempo guardamos', tb(['Dado','Prazo'], [
    ['Carteira (clientes, fichas, imagens)','Até você apagar, usando as funções de gerenciamento de dados, ou até o encerramento do seu acesso, conforme as regras internas da TOTVS'],
    ['Registro de uso','180 dias, prazo que o administrador pode ajustar entre 30 e 730 dias. Eventos mais antigos são apagados automaticamente'],
    ['Tentativas de acesso negadas','90 dias'],
    ['Backups exportados por você','Ficam com você, fora do sistema. Proteja-os e apague quando não forem mais necessários'],
  ])),
  ('Como protegemos os dados', '''<ul><li>Acesso protegido pelo Cloudflare Access (código por e-mail), com conferência do domínio @totvs.com.br a cada requisição.</li>
<li>A carteira de cada usuário só é acessível pelo próprio e-mail, com regra aplicada no servidor.</li>
<li>Chave de IA mantida no navegador, enviada por cabeçalho a cada pedido e não gravada nem registrada pelo servidor; fora do backup.</li>
<li>Cabeçalhos de segurança (HSTS, proteção contra incorporação em outros sites, política de conteúdo) e validação de links externos.</li>
<li>Registro de uso sem conteúdo de carteira, com prazo de retenção e acesso restrito ao administrador.</li></ul>
<p>Nenhum sistema é totalmente imune a falhas. Por isso valem também as boas práticas da <a href="/sobre/politica-de-uso/">Política de Uso</a>.</p>'''),
  ('Seus direitos', '''<p>Você pode pedir confirmação do tratamento, acesso, correção, eliminação, portabilidade e outras medidas previstas na LGPD. Veja como exercer cada direito em <a href="/sobre/lgpd/">LGPD: direitos e conformidade</a>.</p>'''),
  ('Alterações', f'''<p>Esta política pode mudar, e a versão vigente fica sempre nesta página. Versão {VERSAO}, de {DATA}.</p>'''),
  ])

PAGES['lgpd'] = dict(
  titulo='LGPD: direitos e conformidade', curto='LGPD',
  resumo='Seus direitos como titular, os papéis no tratamento e como o sistema aplica os princípios da Lei nº 13.709/2018.',
  secoes=[
  ('Papéis no tratamento', f'''{tb(['Papel','Quem'], [
    ['Controlador','TOTVS S.A.'],
    ['Operador','Administrador do sistema (operação técnica)'],
    ['Suboperador','Cloudflare (hospedagem, banco D1 e Access). Provedores de IA, apenas quando acionados por você'],
    ['Contato de privacidade',f'<a href="mailto:{CONTATO}">{CONTATO}</a> (provisório, até a definição do canal oficial do Encarregado)'],
  ])}'''),
  ('Quem são os titulares', '''<ul><li><b>Usuários do sistema</b> (executivos): e-mail, nome, acessos e registro de uso.</li>
<li><b>Pessoas de contato</b> citadas nas carteiras: dados de contato inseridos pelo executivo em fichas, prints e notas.</li></ul>'''),
  ('Direitos do titular (art. 18)', f'''<p>Mediante requisição, o titular pode obter:</p>
<ul><li>confirmação da existência de tratamento e acesso aos dados;</li>
<li>correção de dados incompletos, inexatos ou desatualizados;</li>
<li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
<li>portabilidade, conforme a regulamentação da ANPD;</li>
<li>eliminação dos dados tratados com consentimento, quando aplicável;</li>
<li>informação sobre com quem os dados são compartilhados;</li>
<li>informação sobre a possibilidade de não consentir e suas consequências, e revogação do consentimento;</li>
<li>oposição a tratamento feito com base em hipótese diferente do consentimento, em caso de descumprimento da lei.</li></ul>
<p><b>Como pedir:</b> escreva para <a href="mailto:{CONTATO}">{CONTATO}</a> com o assunto "LGPD", identificando-se e descrevendo o pedido. Para proteger os dados, podemos pedir confirmação da sua identidade. A resposta vem em formato simplificado de imediato ou, se for o caso, em declaração completa em até 15 dias (art. 19). Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>'''),
  ('Princípios e como o sistema os aplica', tb(['Princípio (art. 6º)','Como aparece no sistema'], [
    ['Finalidade e adequação','Uso restrito à gestão da carteira ESN; a Política de Uso proíbe fins alheios'],
    ['Necessidade','Registro de uso sem conteúdo de carteira, nomes de clientes, CNPJs ou valores; catálogo compartilhado sem dados de clientes'],
    ['Livre acesso e transparência','Estas páginas e o aviso de registro de uso em Configurações → Conta'],
    ['Qualidade dos dados','Campos editáveis pelo usuário, com distinção entre informado e calculado, e revisão das análises'],
    ['Segurança e prevenção','Access, isolamento da carteira no servidor, chave de IA fora do servidor, cabeçalhos de segurança, retenção limitada'],
    ['Não discriminação','Leituras e oportunidades são apoio à decisão; a decisão final é sempre humana'],
    ['Responsabilização','Autoria registrada no catálogo e registro de uso com retenção definida'],
  ])),
  ('Compartilhamento e transferência internacional', '''<p>Detalhados na <a href="/sobre/privacidade/">Política de Privacidade</a>: Cloudflare como infraestrutura (banco na região ENAM), provedores de IA somente quando você aciona o recurso, e consultas externas iniciadas por você. As transferências internacionais seguem o art. 33 da LGPD, conforme os contratos de cada fornecedor.</p>'''),
  ('Incidentes de segurança', f'''<p>Comunique qualquer suspeita de incidente a <a href="mailto:{CONTATO}">{CONTATO}</a>. Incidentes que possam acarretar risco ou dano relevante aos titulares são avaliados pelo controlador e, quando cabível, comunicados à ANPD e aos titulares no prazo regulamentado.</p>'''),
  ('Retenção e eliminação', '''<p>A carteira fica até você apagá-la ou até o encerramento do acesso, conforme as regras internas da TOTVS. O registro de uso é apagado automaticamente após o prazo de retenção (hoje 180 dias) e as tentativas negadas após 90 dias.</p>'''),
  ('Vigência', f'''<p>Versão {VERSAO}, de {DATA}.</p>'''),
  ])

ORDEM = ['termos-de-uso','politica-de-uso','privacidade','lgpd']
