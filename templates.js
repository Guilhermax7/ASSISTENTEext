'use strict';
// Catálogo de mensagens: um item da lista = um clique para inserir.
// Apenas os templates que usam {{data}} abrem o mini calendário primeiro.
// A interface tem apenas duas áreas. Subtipos internos (PIX, baixa, acordos)
// continuam no cadastro para compatibilidade, mas pertencem à Cobrança.
const templateAreas = ['cobranca','atendimento'];
function templateAreaOf(template){return template.category==='atendimento'?'atendimento':'cobranca';}
const templateLibrary = [
  {
    id:'atendimento-abertura',category:'atendimento',title:'Iniciar atendimento',
    body:`{{saudacao_capitalizada}}, {{primeiro_nome}}! Tudo bem? 😊💖

Como posso ajudá-la hoje?`
  },
  {
    id:'atendimento-apresentacao',category:'atendimento',title:'Apresentar equipe',
    body:`{{saudacao_capitalizada}}, {{primeiro_nome}}! 😊

Sou da equipe de atendimento da Sra. Luck e estou à disposição para te auxiliar.

Me conta, como posso ajudar? 💖`
  },
  {
    id:'atendimento-detalhar',category:'atendimento',title:'Entender a solicitação',
    body:`Claro, {{primeiro_nome}}! 💖

Para te orientar da melhor forma, poderia me explicar um pouquinho mais sobre sua solicitação? Assim consigo verificar o que precisamos fazer. 😊`
  },
  {
    id:'atendimento-consultar',category:'atendimento',title:'Conferir no sistema',
    body:`Perfeito, {{primeiro_nome}}! 😊

Vou conferir as informações no sistema para te passar uma orientação correta.

Obrigada por aguardar! 💖`
  },
  {
    id:'atendimento-encaminhar',category:'atendimento',title:'Encaminhar ao responsável',
    body:`{{primeiro_nome}}, compreendi sua solicitação. 💖

Vou encaminhar sua demanda à equipe responsável para uma análise mais detalhada.

Assim que houver um posicionamento, retornaremos por aqui. 😊`
  },
  {
    id:'atendimento-retorno',category:'atendimento',title:'Retomar atendimento',
    body:`{{saudacao_capitalizada}}, {{primeiro_nome}}! Tudo bem? 😊

Estou retomando nosso atendimento para saber se a senhora ainda precisa de ajuda com sua solicitação.

Fico à disposição! 💖`
  },
  {
    id:'atendimento-acolhimento',category:'atendimento',title:'Acolher imprevisto',
    body:`Compreendo, {{primeiro_nome}}. 💖

Sei que imprevistos acontecem e que às vezes é necessário reorganizar os planos.

Me conta qual é sua maior dificuldade neste momento para que eu possa entender sua situação e buscar a melhor orientação possível. 😊`
  },
  {
    id:'atendimento-duvida-contrato',category:'atendimento',title:'Dúvida sobre contrato',
    body:`{{primeiro_nome}}, posso te ajudar a entender melhor as informações do seu contrato. 💖

Qual ponto a senhora gostaria que eu esclarecesse primeiro? Assim consigo te explicar de forma objetiva. 😊`
  },
  {
    id:'atendimento-cancelamento',category:'atendimento',title:'Pedido de cancelamento',
    body:`{{primeiro_nome}}, recebi sua solicitação de cancelamento e compreendo sua decisão. 💖

Para te orientar sobre os próximos passos e as condições previstas em contrato, poderia me contar o principal motivo do pedido? Vou verificar as informações necessárias para seu atendimento. 😊`
  },
  {
    id:'atendimento-voucher',category:'atendimento',title:'Explicar voucher de consulta',
    body:`{{primeiro_nome}}, vou te esclarecer como funciona o voucher de consulta. 💖

Nossa política prevê um voucher de consulta por contrato. Caso ele já tenha sido utilizado, uma nova avaliação com outro profissional poderá ser realizada de forma particular, conforme os valores e a disponibilidade da clínica escolhida.

Se precisar, posso ajudar com outras informações do seu planejamento. 😊`
  },
  {
    id:'atendimento-disponibilidade',category:'atendimento',title:'Perguntar melhor horário',
    body:`Perfeito, {{primeiro_nome}}! 😊💖

Para darmos continuidade ao seu atendimento, qual período seria melhor para a senhora: manhã ou tarde?`
  },
  {
    id:'atendimento-confirmacao-agenda',category:'atendimento',title:'Confirmar agendamento',needsDate:true,
    body:`{{saudacao_capitalizada}}, {{primeiro_nome}}! 😊

Estou entrando em contato para confirmar seu agendamento previsto para *{{data}}*.

A senhora poderá participar conforme combinado? Aguardo sua confirmação. 💖`
  },
  {
    id:'atendimento-qual-procedimento',category:'atendimento',title:'Perguntar procedimento',
    body:`{{primeiro_nome}}, quero entender melhor o seu planejamento. 💖

Qual procedimento a senhora deseja realizar? 😊`
  },
  {
    id:'atendimento-quando-procedimento',category:'atendimento',title:'Perguntar prazo desejado',
    body:`E em quanto tempo a senhora pretende realizar esse procedimento, {{primeiro_nome}}? 😊

Assim conseguimos pensar no planejamento mais adequado ao seu objetivo. 💖`
  },
  {
    id:'atendimento-concluir',category:'atendimento',title:'Encerrar atendimento',
    body:`{{primeiro_nome}}, foi um prazer te atender! 💖

Caso surja alguma outra dúvida, pode nos chamar por aqui. Seguimos à disposição para ajudar.

Tenha um ótimo dia! ✨`
  },
  {
    id:'parcela-em-aberto', category:'cobranca', title:'Parcela em aberto', needsDate:true,
    body:`{{saudacao_capitalizada}}, {{primeiro_nome}}! 😊💖

Tudo bem?

A parcela com vencimento em *{{data}}* consta em aberto no sistema.

Caso precise, posso auxiliar com a chave PIX ou demais informações para regularização. ✨

Fico à disposição para ajudar. 💖`
  },
  {
    id:'confirmacao-pagamento',category:'cobranca',title:'Confirmar pagamento',
    body:`Olá, {{saudacao}}! Tudo bem? 😊

Gostaria de confirmar se a senhora conseguiu realizar o pagamento da parcela para que possamos conferir e dar baixa no sistema.

Fico no aguardo do seu retorno! 💖`
  },
  {
    id:'previsao-pagamento',category:'cobranca',title:'Solicitar previsão de pagamento',
    body:`Olá, {{primeiro_nome}}! Tudo bem? 💖

Identificamos uma parcela em aberto e gostaríamos de saber se a senhora já tem uma previsão para regularizá-la.

Se houve algum imprevisto, me avise para verificarmos as possibilidades de atendimento. 😊`
  },
  {
    id:'pagamento-nao-identificado',category:'cobranca',title:'Pagamento não identificado',
    body:`Olá, {{primeiro_nome}}! 😊

Até o momento, não identificamos a compensação do pagamento da sua parcela em nosso sistema.

Se já realizou o pagamento, poderia nos encaminhar o comprovante para conferência? Caso ainda não tenha conseguido, fico à disposição para ajudar. 💖`
  },
  {
    id:'lembrete-hoje',category:'agendamentos',title:'Pagamento agendado para hoje',
    body:`Olá, {{saudacao}}! Tudo bem? ☺️

Consta em nosso sistema um pagamento agendado para hoje. A senhora gostaria que eu encaminhasse a chave PIX para facilitar a regularização? 💖`
  },
  {
    id:'lembrete-hoje-leve',category:'agendamentos',title:'Lembrete de hoje — acolhedor',
    body:`Olá, {{saudacao}}! Tudo bem por aí? 💖

Passando para lembrar, com carinho, que temos um pagamento combinado para hoje. Posso encaminhar a chave PIX para facilitar? ☺️`
  },
  {
    id:'agendamento-telefone',category:'agendamentos',title:'Confirmar acordo por telefone',needsDate:true,
    body:`{{saudacao_capitalizada}}!

{{primeiro_nome}}, conforme nosso contato telefônico, ficou *agendado o pagamento da sua parcela para o dia {{data}}*.

Ficamos no aguardo da regularização na data combinada. Se precisar de alguma informação, estou à disposição. 😊💖`
  },
  {
    id:'agendamento-confirmacao',category:'agendamentos',title:'Registrar data combinada',needsDate:true,
    body:`Olá, {{primeiro_nome}}! 😊

Conforme combinamos, deixei registrada a previsão de pagamento da sua parcela para *{{data}}*.

Agradeço pelo retorno e fico à disposição caso precise de ajuda para realizar o pagamento. 💖`
  },
  {
    id:'chave-pix-completa',category:'pix',title:'Chave PIX — Sicredi',
    body:`Segue nossa chave PIX para facilitar seu pagamento:

🔑 Sicredi - CNPJ
Pix : 65.180.628/0001-61
Em nome de: Luck Gestao e Servicos Ltda..

Após o pagamento, me envie o comprovante para confirmação.
Qualquer dúvida, estou à disposição.💖✨`
  },
  {
    id:'comprovante',category:'pix',title:'Solicitar comprovante',
    body:`Poderia nos encaminhar o comprovante de pagamento, por gentileza? Assim, conseguimos conferir e realizar a baixa da parcela no sistema. 💖`
  },
  {
    id:'oferecer-pix',category:'pix',title:'Oferecer chave PIX',
    body:`Posso encaminhar a chave PIX para facilitar o pagamento da sua parcela? 😊`
  },
  {
    id:'pix-reenvio',category:'pix',title:'Reenviar informações do PIX',
    body:`Olá, {{primeiro_nome}}! 💖

Se precisar, posso reenviar os dados para pagamento via PIX. Assim que realizar a transferência, pedimos que nos encaminhe o comprovante para conferência. 😊`
  },
  {
    id:'baixa-realizada',category:'baixa',title:'Confirmar baixa da parcela',needsDate:true,
    body:`Perfeito! Realizei a baixa da parcela referente a *{{data}}* em nosso sistema. 💖

Agradeço pelo envio e permaneço à disposição! 😊`
  },
  {
    id:'agradecimento',category:'baixa',title:'Agradecer regularização',
    body:`Olá, {{primeiro_nome}}! 💖

Agradecemos pela regularização da sua parcela e pela confiança. Qualquer dúvida sobre os próximos vencimentos, estamos à disposição para ajudar! 😊`
  },
  {
    id:'negociacao',category:'baixa',title:'Oferecer negociação',
    body:`Olá, {{primeiro_nome}}! Tudo bem? 💖

Sabemos que imprevistos acontecem. Gostaria de entender sua situação para verificar se há alguma condição de regularização disponível para o seu contrato.

A senhora pode me contar qual seria a melhor previsão para o pagamento? 😊`
  }
];

// Dois assistentes contextuais integram o mesmo ranking dos demais modelos.
templateLibrary.unshift(
  {id:'ai-cobranca',category:'cobranca',title:'Resposta inteligente · Cobrança',isAI:true,body:''},
  {id:'ai-atendimento',category:'atendimento',title:'Resposta inteligente · Atendimento',isAI:true,body:''}
);
// Modelos personalizados são persistidos localmente, nunca enviados sem revisão.
const CUSTOM_KEY='sraLuckCustomTemplatesV1';
let customTemplates=[];
async function saveCustomTemplate(mode,title,body){
  const cleanTitle=String(title||'').trim().slice(0,72);
  const cleanBody=String(body||'').replace(/\r\n?/g,'\n').trim().slice(0,5000);
  if(cleanTitle.length<4||cleanBody.length<15)throw new Error('Informe título (4+ caracteres) e mensagem (15+ caracteres).');
  if(/{{(?!primeiro_nome}}|data}}|saudacao}}|saudacao_capitalizada}})/.test(cleanBody))throw new Error('Use somente variáveis reconhecidas: {{primeiro_nome}}, {{data}} e {{saudacao}}.');
  const category=mode==='atendimento'?'atendimento':'cobranca';
  if(customTemplates.some(t=>t.category===category&&normalSearch(t.title)===normalSearch(cleanTitle)))throw new Error('Já existe um template com este título nesta área. Escolha outro nome.');
  const item={id:'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),category,title:cleanTitle,body:cleanBody,needsDate:cleanBody.includes('{{data}}'),custom:true};
  customTemplates.push(item);
  await chrome.storage.local.set({[CUSTOM_KEY]:customTemplates});
  templateLibrary.push(item);templatesById.set(item.id,item);
  templateDiscovery[item.id]=[category==='cobranca'?'💜':'💬',cleanTitle,'Criado por você · clique para inserir'];
  renderLibrary();return item;
}
const templateRoot=document.getElementById('templateList');
const searchInput=document.getElementById('templateSearch');
const searchCount=document.getElementById('templateCount');
const calendarViews=new Map();
const templatesById=new Map(templateLibrary.map(item=>[item.id,item]));
let openTemplateId=null;
let lastClickPending=false;
let selectedTemplateCategory='cobranca';
let templateUsage={};
let templateFavorites=[];
const templateDiscovery={
  'atendimento-abertura':['👋','Saudação + como posso ajudar?','Primeiro contato com nome e horário automáticos'],
  'atendimento-apresentacao':['💬','Apresentar Sra. Luck','Boas-vindas e identificação da equipe'],
  'atendimento-detalhar':['❓','Entender o pedido','Pede detalhes antes de orientar'],
  'atendimento-consultar':['🔍','Vou conferir no sistema','Informa que consultará os dados da cliente'],
  'atendimento-encaminhar':['📨','Encaminhar solicitação','Direcionar demanda ao setor responsável'],
  'atendimento-retorno':['🔁','Retomar conversa','Contato para continuidade do atendimento'],
  'atendimento-acolhimento':['💗','Acolher dificuldade','Escuta e orientação para imprevistos'],
  'atendimento-duvida-contrato':['📄','Esclarecer contrato','Identifica qual ponto gera dúvidas'],
  'atendimento-cancelamento':['📝','Receber pedido de cancelamento','Acolhe e pergunta o motivo da solicitação'],
  'atendimento-voucher':['🩺','Explicar voucher de consulta','Orientações sobre o voucher contratual'],
  'atendimento-disponibilidade':['🕘','Perguntar período disponível','Consulta manhã ou tarde'],
  'atendimento-confirmacao-agenda':['📅','Confirmar agendamento','Abre calendário para escolher o dia'],
  'atendimento-qual-procedimento':['✨','Perguntar procedimento','Etapa da qualificação comercial'],
  'atendimento-quando-procedimento':['⏳','Quando deseja realizar?','Pergunta o prazo do planejamento'],
  'atendimento-concluir':['🌷','Finalizar atendimento','Despedida cordial e canal aberto'],
  'parcela-em-aberto':['📌','Cobrar parcela vencida','Mensagem objetiva com data do vencimento'],
  'confirmacao-pagamento':['🔎','Confirmar se pagou','Pergunta se o pagamento foi realizado'],
  'previsao-pagamento':['🗓️','Perguntar quando vai pagar','Solicita previsão de regularização'],
  'pagamento-nao-identificado':['⚠️','Pagamento não localizado','Pede comprovante para localizar a baixa'],
  'lembrete-hoje':['⏰','Pagamento previsto hoje','Lembra o compromisso e oferece PIX'],
  'lembrete-hoje-leve':['💗','Lembrete gentil de hoje','Tom acolhedor para compromisso de hoje'],
  'agendamento-telefone':['📞','Acordo feito por telefone','Confirma agendamento com data'],
  'agendamento-confirmacao':['🤝','Registrar data combinada','Formaliza uma previsão de pagamento'],
  'chave-pix-completa':['🔑','Enviar PIX Sicredi','CNPJ, beneficiário e pedido de comprovante'],
  'comprovante':['🧾','Pedir comprovante','Solicita comprovante para baixa'],
  'oferecer-pix':['💳','Oferecer chave PIX','Pergunta se pode encaminhar'],
  'pix-reenvio':['↪️','Reenviar PIX','Oferta de reenvio da chave'],
  'baixa-realizada':['✅','Baixa de parcela realizada','Confirma baixa com data'],
  'agradecimento':['💖','Agradecer pagamento','Agradece a regularização'],
  'negociacao':['🤲','Abrir negociação','Consulta possibilidade de acordo']
};
const templateQuickPicks=['ai-cobranca','ai-atendimento','parcela-em-aberto','chave-pix-completa','comprovante','lembrete-hoje','confirmacao-pagamento','baixa-realizada','previsao-pagamento','atendimento-abertura','atendimento-consultar','atendimento-encaminhar','atendimento-retorno'];
function templateSorted(items){return [...items].sort((a,b)=>{
  const aUse=Number(templateUsage[a.id]||0),bUse=Number(templateUsage[b.id]||0);
  return bUse-aUse||Number(templateFavorites.includes(b.id))-Number(templateFavorites.includes(a.id))||templateSortWeight(a)-templateSortWeight(b);
});}
function templateSortWeight(t){const index=templateQuickPicks.indexOf(t.id);return index<0?100+templateLibrary.indexOf(t):index;}
async function loadTemplatePreferences(){
  try{const stored=await chrome.storage.local.get(['templateUsageV1','templateFavoritesV1',CUSTOM_KEY]);
    templateUsage=stored.templateUsageV1||{};templateFavorites=Array.isArray(stored.templateFavoritesV1)?stored.templateFavoritesV1:[];
    const additions=Array.isArray(stored[CUSTOM_KEY])?stored[CUSTOM_KEY]:[];
    for(const raw of additions.slice(0,500)){
      if(!raw?.custom||!/^custom-[a-z0-9-]+$/i.test(raw.id)||!['cobranca','atendimento'].includes(raw.category)||typeof raw.title!=='string'||typeof raw.body!=='string')continue;
      const item={id:raw.id,category:raw.category,title:raw.title.slice(0,72),body:raw.body.slice(0,5000),needsDate:raw.body.includes('{{data}}'),custom:true};
      if(templatesById.has(item.id))continue;
      customTemplates.push(item);templateLibrary.push(item);templatesById.set(item.id,item);
      templateDiscovery[item.id]=[item.category==='cobranca'?'💜':'💬',item.title,'Criado por você · clique para inserir'];
    }}catch{}
  renderLibrary();
}
async function countTemplateUse(id){
  templateUsage[id]=Math.max(0,Number(templateUsage[id])||0)+1;
  try{await chrome.storage.local.set({templateUsageV1:templateUsage});}catch{}
  renderLibrary();
}
async function toggleFavorite(id){
  templateFavorites=templateFavorites.includes(id)?templateFavorites.filter(v=>v!==id):[...templateFavorites,id];
  try{await chrome.storage.local.set({templateFavoritesV1:templateFavorites});}catch{}
  renderLibrary();
}


function digits(n){return String(n).padStart(2,'0');}
function isoDate(year,month,day){return `${year}-${digits(month+1)}-${digits(day)}`;}
function formattedDate(iso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return '';
  const [year,month,day]=iso.split('-').map(Number);
  const d=new Date(year,month-1,day);
  return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day?`${digits(day)}/${digits(month)}/${year}`:'';
}
function normalSearch(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
}
function greeting(now=new Date()){
  // 08:00–11:59: bom dia; a partir de 12:00: boa tarde.
  // Antes de 08:00, mantém “bom dia” para evitar a saudação “boa tarde” de madrugada.
  return now.getHours()<12?'bom dia':'boa tarde';
}
function expandTemplate(id){
  openTemplateId=openTemplateId===id?null:id;
  for(const entry of templateLibrary.filter(t=>t.needsDate)){
    const panel=document.getElementById(`template-panel-${entry.id}`);
    if(!panel)continue; // As outras categorias podem não estar renderizadas no filtro atual.
    const trigger=templateRoot.querySelector(`[data-template-id="${entry.id}"] .library-trigger`);
    const expanded=entry.id===openTemplateId;
    panel.hidden=!expanded;
    trigger?.setAttribute('aria-expanded',String(expanded));
    if(expanded)drawCalendar(entry);
  }
}
function drawCalendar(template){
  const panel=document.getElementById(`template-panel-${template.id}`);
  if(!panel)return;
  const [year,month]=calendarViews.get(template.id)||[new Date().getFullYear(),new Date().getMonth()];
  panel.querySelector('[data-month-title]').textContent=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(year,month,1));
  const days=panel.querySelector('[data-calendar-days]');
  days.replaceChildren();
  for(let i=0;i<new Date(year,month,1).getDay();i++){
    const empty=document.createElement('span');
    empty.className='calendar-empty';empty.setAttribute('aria-hidden','true');days.append(empty);
  }
  const today=new Date();
  for(let day=1;day<=new Date(year,month+1,0).getDate();day++){
    const button=document.createElement('button');
    button.className='calendar-day';button.type='button';button.textContent=String(day);
    button.dataset.day=String(day);
    button.dataset.today=String(year===today.getFullYear()&&month===today.getMonth()&&day===today.getDate());
    button.setAttribute('aria-label',`${digits(day)}/${digits(month+1)}/${year} — inserir template`);
    days.append(button);
  }
}
function makeAIInlinePanel(template){
  const panel=document.createElement('div');
  panel.className='ai-inline-panel';panel.id=`ai-panel-${template.id}`;
  panel.hidden=true;panel.dataset.mode=template.category;
  panel.innerHTML=`
    <div class="ai-inline-head"><span class="ai-orbit" aria-hidden="true">✦</span><div><strong>IA Coringa · ${template.category==='cobranca'?'Cobrança humanizada':'Atendimento humanizado'}</strong><small>Responda clientes, crie modelos e aprenda com repetições</small></div><button type="button" class="ai-panel-close" data-ai-action="close" aria-label="Fechar assistente">×</button></div>
    <div class="ai-smart-prompt" data-ai-smart-prompt hidden role="status"><div><strong data-ai-prompt-title>Mensagem repetida detectada</strong><small>Quer transformar em um template reutilizável?</small></div><button type="button" data-ai-action="prompt-view">Ver sugestão</button></div>
    <div class="ai-workflows" role="group" aria-label="Ferramentas do card inteligente">
      <button type="button" class="active" data-ai-workflow="reply" aria-pressed="true">✦ Responder</button>
      <button type="button" data-ai-workflow="create" aria-pressed="false">＋ Criar template</button>
      <button type="button" data-ai-workflow="suggestions" aria-pressed="false">☷ Repetidos <span data-ai-suggestion-count></span></button>
    </div>
    <div class="ai-inline-config" data-ai-view="config" hidden>
      <p class="ai-hint"><strong>Configure sua IA uma vez.</strong> Para armazenamento de chaves no serviço protegido e agentes independentes, selecione <strong>Central de IA</strong>. O modo direto antigo permanece apenas para compatibilidade e armazena chaves no navegador.</p><button type="button" class="ai-primary" data-ai-action="central-panel">⚙ Abrir Central de IA · Conexões e agentes</button>
      <label class="ai-field-label">Provedor<select data-ai-field="provider"><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="anthropic">Anthropic / Claude</option><option value="openrouter">OpenRouter</option><option value="groq">Groq</option><option value="deepseek">DeepSeek</option><option value="ollama">Ollama (local / cloud)</option><option value="central">Central de IA (serviço seguro multiprovedor)</option><option value="compatible">API compatível com OpenAI</option></select></label>
      <label class="ai-field-label" data-ai-ollama-choices hidden>Onde está seu Ollama?
        <select data-ai-field="ollamaTarget" aria-label="Tipo de conexão Ollama">
          <option value="local">No meu computador · sem chave</option>
          <option value="cloud">Ollama Cloud · com chave</option>
          <option value="remote">Servidor remoto HTTPS · personalizado</option>
        </select>
      </label>
      <p class="ai-hint" data-ai-ollama-hint hidden>Para uso local, instale e execute o Ollama no computador. A lista mostra os modelos instalados. Se a extensão não conseguir conectar, autorize a origem dela na variável OLLAMA_ORIGINS.</p>
      <label class="ai-field-label">Modelo disponível
        <select data-ai-field="modelChoice" aria-label="Modelos da sua API"><option value="">Selecione o provedor e busque modelos</option><option value="__manual__">✎ Informar outro modelo</option></select>
      </label>
      <div class="ai-model-tools"><button type="button" data-ai-action="discover-models">↻ Detectar modelos disponíveis</button><span data-ai-model-status role="status" aria-live="polite">A lista será consultada no provedor selecionado.</span></div>
      <label class="ai-field-label ai-model-manual" data-ai-manual-label hidden>Identificador do modelo (manual)<input data-ai-field="model" type="text" spellcheck="false" placeholder="Ex.: modelo-do-provedor" autocomplete="off" /></label>
      <label class="ai-field-label">Endereço da API <input data-ai-field="endpoint" type="url" spellcheck="false" placeholder="https://..." autocomplete="off" /></label>
      <label class="ai-field-label" data-ai-key-label>Chave de API <input data-ai-field="key" type="password" autocomplete="off" placeholder="Chave do provedor" /></label>
      <label class="ai-remember"><input data-ai-field="remember" type="checkbox" checked /> Reutilizar configuração neste navegador <span>(armazenamento local sem criptografia adicional)</span></label>
      <label class="ai-remember"><input data-ai-field="mask" type="checkbox" checked /> Ocultar CPF, CNPJ, telefone e e-mail antes de enviar contexto</label>
      <p class="ai-hint">O conteúdo só é enviado ao seu provedor quando você solicita uma geração. Use serviços autorizados pela empresa.</p>
      <button type="button" class="ai-primary" data-ai-action="save">Salvar conexão e continuar ↗</button>
      <button type="button" class="ai-forget" data-ai-action="forget">Esquecer chave salva</button>
    </div>
    <div class="ai-inline-busy" data-ai-view="busy" hidden role="status" aria-live="polite"><span class="ai-pulse-icon">✦</span><div><strong data-ai-busy-label>Analisando…</strong><small>A resposta aparecerá aqui para você revisar</small></div><span class="ai-dots" aria-hidden="true"><b></b><b></b><b></b></span></div>
    <div class="ai-inline-result" data-ai-view="result" hidden>
      <div class="ai-inline-context-row"><span class="ai-read-tag" data-ai-context-info>✦ Próxima resposta sugerida</span><button type="button" data-ai-action="settings">⚙ API</button></div>
      <label class="ai-field-label">Resposta contextual · editável</label>
      <textarea data-ai-field="draft" rows="7" spellcheck="true" aria-label="Próxima resposta sugerida"></textarea>
      <div class="ai-inline-actions"><button type="button" class="ai-primary" data-ai-action="insert">↗ Usar na conversa</button><button type="button" data-ai-action="regenerate">↻ Outra versão</button><button type="button" data-ai-action="copy">Copiar</button></div>
      <button type="button" class="ai-inline-link" data-ai-action="from-reply">＋ Transformar esta resposta em template</button>
    </div>
    <div class="ai-inline-context" data-ai-view="context" hidden>
      <p class="ai-hint">A IA considera o histórico e sugere a <strong>próxima resposta</strong>. Confira as mensagens; se a Tallos não permitir leitura, cole o trecho aqui.</p>
      <textarea data-ai-field="transcript" rows="5" placeholder="Conversa recente entre cliente e equipe…"></textarea>
      <div class="ai-inline-options"><label>Estilo<select data-ai-field="tone"><option value="adaptativo" selected>Adaptar à situação</option><option value="objetivo">Direto</option><option value="acolhedor">Acolhedor</option><option value="firme">Firme e respeitoso</option></select></label><label>Tamanho<select data-ai-field="length"><option value="curto">Curta</option><option value="medio" selected>Equilibrada</option><option value="detalhado">Detalhada</option></select></label></div>
      <label class="ai-field-label">Orientação extra (opcional)<textarea data-ai-field="instruction" rows="2" placeholder="Ex.: a cliente teve imprevisto. Seja direta e pergunte previsão."></textarea></label>
      <div class="ai-inline-actions"><button type="button" class="ai-primary" data-ai-action="generate">✦ Sugerir próxima resposta</button><button type="button" data-ai-action="reread">↻ Reler conversa</button></div>
    </div>
    <div data-ai-view="create" class="ai-creator" hidden>
      <p class="ai-hint">Descreva com suas palavras o que quer comunicar. A IA organiza uma mensagem natural, com parágrafos e possíveis variáveis automáticas.</p>
      <label class="ai-field-label">O que este template deve dizer?<textarea data-ai-field="brief" rows="5" placeholder="Ex.: pedir o comprovante sem pressionar, com tom gentil; mencionar que precisamos dar baixa no sistema…"></textarea></label>
      <div class="ai-inline-options"><label>Estilo<select data-ai-field="createTone"><option value="adaptativo">Natural e profissional</option><option value="objetivo">Curto e objetivo</option><option value="acolhedor">Acolhedor</option><option value="firme">Assertivo e respeitoso</option></select></label><label>Tamanho<select data-ai-field="createLength"><option value="curto">Curto</option><option value="medio" selected>Médio</option><option value="detalhado">Detalhado</option></select></label></div>
      <div class="ai-inline-actions"><button type="button" class="ai-primary" data-ai-action="create-generate">✦ Organizar com IA</button><button type="button" data-ai-action="create-manual">✎ Preparar manualmente</button></div>
    </div>
    <div data-ai-view="template" class="ai-template-preview" hidden>
      <div class="ai-inline-context-row"><strong>Prévia do novo template</strong><span class="ai-read-tag">Não salvo</span></div>
      <label class="ai-field-label">Nome na carteira<input data-ai-field="newTitle" type="text" maxlength="72" placeholder="Ex.: Comprovante de pagamento" /></label>
      <label class="ai-field-label">Texto editável<textarea data-ai-field="newBody" rows="7" placeholder="Texto do novo template…"></textarea></label>
      <div class="ai-variable-help">Variáveis: <code>{{primeiro_nome}}</code> · <code>{{saudacao_capitalizada}}</code> · <code>{{data}}</code> (abre calendário ao usar).</div>
      <div class="ai-preview-message" data-ai-preview aria-label="Prévia do template formatado"></div>
      <div class="ai-inline-actions"><button type="button" class="ai-primary" data-ai-action="create-save">✓ Salvar na carteira</button><button type="button" data-ai-action="create-rewrite">↻ Melhorar com IA</button><button type="button" data-ai-action="create-discard">Descartar</button></div>
    </div>
    <div data-ai-view="suggestions" class="ai-repeats" hidden>
      <p class="ai-hint">O detector identifica mensagens <strong>que você enviou</strong> repetidamente, no WhatsApp Web e na Tallos. Só funciona após sua autorização, sem ler conversas anteriores à ativação.</p>
      <label class="ai-remember ai-monitor-toggle"><input data-ai-field="monitor" type="checkbox" /> Ativar sugestões de mensagens repetidas <span>Somente textos enviados por você; padrões tratados ficam neste navegador. Não são enviados à IA automaticamente.</span></label>
      <div data-ai-monitor-info class="ai-monitor-info"></div>
      <div data-ai-suggestion-list class="ai-suggestion-list"></div>
      <button type="button" data-ai-action="clear-monitor" class="ai-forget">Limpar histórico local de repetições</button>
    </div>
    <div class="ai-inline-footer"><button type="button" data-ai-action="context" class="ai-inline-link">✎ Ajustar conversa e tom</button><button type="button" data-ai-action="settings" class="ai-inline-link">⚙ Conexão</button><button type="button" data-ai-action="central-panel" class="ai-inline-link">◈ Central IA</button><span>Revisão antes de enviar</span></div>
    <div class="ai-inline-error" data-ai-error hidden role="alert"></div>
    <div class="ai-inline-error-tools" data-ai-error-tools hidden><button type="button" data-ai-action="retry">↻ Tentar novamente</button><button type="button" data-ai-action="settings">⚙ Trocar modelo</button></div>`
  return panel;
}
function makeCard(template,rank){
  const card=document.createElement('div');card.className='library-item';card.dataset.templateId=template.id;card.dataset.category=templateAreaOf(template);
  const trigger=document.createElement('button');trigger.className='library-trigger';trigger.type='button';
  trigger.dataset.useTemplate=template.id;
  trigger.setAttribute('aria-label',template.isAI?'Abrir assistente de IA e gerar próxima resposta':`${template.title}${template.needsDate?' — escolher data e inserir':' — inserir na conversa'}`);
  if(template.isAI){trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',`ai-panel-${template.id}`);card.classList.add('library-ai-card');}
  if(template.needsDate){trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',`template-panel-${template.id}`);}
  trigger.innerHTML='<span class="library-symbol" aria-hidden="true"></span><span class="library-info"><span class="library-title"></span><span class="library-desc"></span></span><span class="library-row-end" aria-hidden="true"></span>';
  const discovery=template.isAI ? ['✦',template.title,'Responda, crie modelos e descubra mensagens repetidas'] : (templateDiscovery[template.id]||['✉️',template.title,'Mensagem rápida']);
  trigger.querySelector('.library-symbol').textContent=discovery[0];
  trigger.querySelector('.library-title').textContent=discovery[1];
  trigger.querySelector('.library-desc').textContent=discovery[2];
  trigger.querySelector('.library-row-end').innerHTML=template.needsDate?'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>':'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m5 12 14 0m-6-6 6 6-6 6"/></svg>';
  const usage=Number(templateUsage[template.id]||0);
  // A classificação só aparece quando existem inserções reais registradas.
  if(rank<=3&&usage>0){
    const rankMarker=document.createElement('span');rankMarker.className='library-rank';
    rankMarker.textContent=rank+'º';rankMarker.title=rank+'º mais usado nesta área';
    trigger.prepend(rankMarker);
  }
  card.append(trigger);
  const fav=document.createElement('button');fav.type='button';fav.className='library-favorite';fav.dataset.favorite=template.id;fav.textContent=templateFavorites.includes(template.id)?'★':'☆';
  fav.title=templateFavorites.includes(template.id)?'Retirar dos favoritos':'Favoritar template';fav.setAttribute('aria-label',fav.title);card.append(fav);
  if(usage>0){const used=document.createElement('span');used.className='library-use-count';used.textContent=usage+'×';used.title='Inserções realizadas por esta extensão';card.append(used);}

  if(template.isAI)card.append(makeAIInlinePanel(template));
  if(template.needsDate){
    const panel=document.createElement('div');panel.id=`template-panel-${template.id}`;panel.className='library-panel';panel.hidden=true;
    panel.innerHTML='<div class="calendar-caption">Selecione a data para inserir a mensagem</div><div class="mini-calendar" aria-label="Escolha a data"><div class="calendar-top"><button type="button" class="calendar-nav" data-calendar-nav="prev" aria-label="Mês anterior">‹</button><span class="calendar-month" data-month-title></span><button type="button" class="calendar-nav" data-calendar-nav="next" aria-label="Próximo mês">›</button></div><div class="calendar-weekdays" aria-hidden="true"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div><div class="calendar-days" data-calendar-days role="group" aria-label="Dias do mês"></div></div>';
    card.append(panel);
  }
  return card;
}
function renderLibrary(){
  globalThis.SraLuckAI?.close(); // uma renderização pode substituir o card aberto
  templateRoot.replaceChildren();
  const area=templateAreas.includes(selectedTemplateCategory)?selectedTemplateCategory:'cobranca';
  const items=templateSorted(templateLibrary.filter(t=>templateAreaOf(t)===area));
  // A lista é única e completa; o ranking reordena os itens, sem divisões de assunto.
  const group=document.createElement('section');
  group.className='template-group smart-group';group.dataset.category=area;
  items.forEach((t,i)=>group.append(makeCard(t,i+1)));
  templateRoot.append(group);
  const used=items.filter(t=>Number(templateUsage[t.id]||0)>0).length;
  const label=document.getElementById('templateSortLabel');
  if(label)label.textContent=used
    ? `🏆 Mais usados primeiro · ${used} ${used===1?'modelo utilizado':'modelos utilizados'}`
    : '★ Sugestões iniciais · ranking cresce conforme você usa';
  for(const btn of document.querySelectorAll('#templateFilters [data-category]')){
    const active=btn.dataset.category===area;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',String(active));
  }
  const serviceCount=document.getElementById('areaCountAtendimento');
  const billingCount=document.getElementById('areaCountCobranca');
  if(serviceCount)serviceCount.textContent=`${templateLibrary.filter(t=>templateAreaOf(t)==='atendimento').length} modelos`;
  if(billingCount)billingCount.textContent=`${templateLibrary.filter(t=>templateAreaOf(t)==='cobranca').length} modelos`;
  searchTemplates();
}
function searchTemplates(){
  const filter=normalSearch(searchInput?.value);
  let visible=0;
  for(const card of templateRoot.querySelectorAll('.library-item')){
    const item=templatesById.get(card.dataset.templateId);
    const labels=templateDiscovery[item.id]||[];
    const show=normalSearch(`${item.title} ${item.category} ${labels.join(' ')} ${item.body}`).includes(filter);
    card.hidden=!show;if(show)visible++;
  }
  for(const group of templateRoot.querySelectorAll('.template-group')){
    const shown=group.querySelector('.library-item:not([hidden])');
    group.hidden=!shown;
  }
  if(searchCount)searchCount.textContent=`${visible} ${visible===1?'modelo':'modelos'}`;
  const empty=document.getElementById('templatesEmpty');if(empty)empty.hidden=visible>0;
}
function formatMessage(template,name,date){
  if(template.needsDate&&!formattedDate(date))return '';
  const salute=greeting();
  let body=template.body;
  if(!name){
    // Se o contato ainda não tiver um nome reconhecível, não bloqueia a
    // mensagem e tampouco deixa "Olá, !" ou "Nome, compreendi".
    body=body.replace(/,\s*{{primeiro_nome}}/g,'');
    body=body.replace(/^\s*{{primeiro_nome}},\s*/gm,(_m,offset,original)=>'');
    body=body.replaceAll('{{primeiro_nome}}','');
    body=body.replace(/(^|\n)([a-záéíóúâêôãõç])/gu,(_m,sep,l)=>sep+l.toLocaleUpperCase('pt-BR'));
  }
  return body
    .replaceAll('{{primeiro_nome}}',name||'')
    .replaceAll('{{data}}',formattedDate(date))
    .replaceAll('{{saudacao_capitalizada}}',salute[0].toLocaleUpperCase('pt-BR')+salute.slice(1))
    .replaceAll('{{saudacao}}',salute);
}
async function identifyCurrentName(tabId){
  // Consulta todos os frames acessíveis: em algumas telas da Tallos,
  // cabeçalho e editor da conversa ficam em quadros diferentes.
  let responses=[];
  try{responses=await chrome.scripting.executeScript({target:{tabId,allFrames:true},files:['name-reader.js']});}
  catch{responses=await chrome.scripting.executeScript({target:{tabId},files:['name-reader.js']});}
  const names=responses.map(x=>x.result).filter(x=>x?.firstName);
  names.sort((a,b)=>(b.score+(b.hasComposer?2:0))-(a.score+(a.hasComposer?2:0)));
  const name=String(names[0]?.firstName||'');
  const match=name.trim().match(/^([\p{L}]+(?:[-'’][\p{L}]+)?)$/u);
  if(!match)return '';
  return match[1].toLocaleLowerCase('pt-BR').replace(/(^|[-'’])(\p{L})/gu,(_m,sep,c)=>sep+c.toLocaleUpperCase('pt-BR'));
}
async function insertTemplate(template,date){
  if(lastClickPending)return;
  lastClickPending=true;
  const card=templateRoot.querySelector(`[data-template-id="${template.id}"]`);
  card?.classList.add('library-loading');
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!/^https?:\/\//i.test(tab.url||'')){
      status('Abra uma conversa em uma página do navegador para inserir a mensagem.',true);return;
    }
    let name='';
    if(template.body.includes('{{primeiro_nome}}')){
      try{name=await identifyCurrentName(tab.id);}catch{}
      // Não interrompe a colagem se o nome não estiver exposto no cabeçalho.
      // Nesse caso, a mensagem é montada sem o nome e o usuário é avisado.
    }
    const message=formatMessage(template,name,date);
    if(!message){status('Selecione uma data válida no calendário.',true);return;}
    const [currentTab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(currentTab?.id!==tab.id){status('A conversa ativa mudou. Clique no modelo novamente.',true);return;}
    const result=await insertConversationMessage(tab.id,message,tab.url);
    if(result.ok){
      status(!name&&template.body.includes('{{primeiro_nome}}')
        ? 'Mensagem inserida sem nome: o site não exibiu um nome reconhecível. Confira antes de enviar.'
        : 'Mensagem inserida na conversa. Confira antes de enviar.');
      await countTemplateUse(template.id);
      if(template.needsDate&&openTemplateId===template.id)expandTemplate(template.id);
    }else {
      const copied=await copyFormattedFallback(message);
      status((result.reason||'Selecione o campo de digitação da conversa e tente novamente.') +
        (copied?' Mensagem copiada: clique em “Digite aqui...” e use Ctrl+V.':''),true);
    }
  }catch(error){
    const reason=String(error?.message||'');
    status(/permission|host permission|Cannot access contents/i.test(reason)
      ? 'Permita o acesso da extensão ao site nas configurações do Chrome e recarregue a conversa.'
      : 'Não foi possível inserir. Clique no campo onde está escrevendo e tente novamente.',true);
  }finally{
    lastClickPending=false;
    card?.classList.remove('library-loading');
  }
}

templateRoot.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||lastClickPending)return;
  const card=button.closest('[data-template-id]');
  const template=templatesById.get(card?.dataset.templateId);if(!template)return;
  if(button.dataset.favorite){void toggleFavorite(template.id);return;}
  if(button.dataset.useTemplate){
    if(template.isAI){globalThis.SraLuckAI?.open(template.category);return;}
    if(template.needsDate)expandTemplate(template.id);
    else void insertTemplate(template);
    return;
  }
  if(button.dataset.calendarNav){
    const view=calendarViews.get(template.id)||[new Date().getFullYear(),new Date().getMonth()];
    const newMonth=new Date(view[0],view[1]+(button.dataset.calendarNav==='next'?1:-1),1);
    if(newMonth.getFullYear()<2000||newMonth.getFullYear()>2100)return;
    calendarViews.set(template.id,[newMonth.getFullYear(),newMonth.getMonth()]);
    drawCalendar(template);return;
  }
  if(button.dataset.day){
    const [year,month]=calendarViews.get(template.id)||[new Date().getFullYear(),new Date().getMonth()];
    void insertTemplate(template,isoDate(year,month,Number(button.dataset.day)));
  }
});
searchInput?.addEventListener('input',()=>{
  if(openTemplateId){expandTemplate(openTemplateId);}
  searchTemplates();
});
document.getElementById('templateFilters')?.addEventListener('click',event=>{
  const btn=event.target.closest('[data-category]');if(!btn)return;
  if(!templateAreas.includes(btn.dataset.category)||btn.dataset.category===selectedTemplateCategory)return;
  globalThis.SraLuckAI?.close();
  selectedTemplateCategory=btn.dataset.category;
  if(searchInput)searchInput.value='';
  openTemplateId=null;renderLibrary();
});
document.getElementById('templateResetSearch')?.addEventListener('click',()=>{
  if(searchInput)searchInput.value='';openTemplateId=null;renderLibrary();
});
renderLibrary();
void loadTemplatePreferences();

// Atalho disponível nas duas abas: usa exatamente o mesmo mecanismo da carteira.
document.getElementById('quickPix').addEventListener('click',()=>{
  void insertTemplate(templatesById.get('chave-pix-completa'));
});
// A Carteira não precisa monitorar nomes: lê a cliente só no instante de inserir.
globalThis.SraLuckTemplates={onAreaChange:()=>{},saveCustomTemplate,renderLibrary};
