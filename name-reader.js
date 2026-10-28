'use strict';
// Leitura sob demanda, limitada ao cabeçalho ou item de conversa selecionado.
// Nunca usa mensagens, sugestões, título da aba ou nomes de outras conversas.
(() => {
  const host=location.hostname.toLowerCase();
  const whatsapp=host==='web.whatsapp.com';
  const tallos=host==='app.tallos.com.br'||host.endsWith('.tallos.com.br');
  const bad=/^(?:whatsapp(?: web)?|tallos|sra\.?\s*luck|atendimento(?:s)?|conversa(?:s)?|chat(?:s)?|contato(?:s)?|cliente(?:s)?|informações?|dados do contato|perfil|mensagem|mensagens|novo atendimento|atendimentos ativos|financeiro|comercial|aguardando|pendente|concluído|encerrado|encerrar|transferir|buscar|pesquisar|pesquisa|menu|mais opções|fechar|online|offline|digitando|visto por último.*|última vez.*|sem nome|não identificado|não atribuído|selecione uma conversa|abrir conversa|caixa de entrada|respostas rápidas|enviar mensagem|digit[eao].*|\+?[\d()\s.-]{7,})$/i;
  const forbidden=/\b(?:financeiro|sistema|atendimento|conversa|mensagem|whatsapp|tallos|equipe|operador|protocolo|anexo|resposta|confirmar|editar|perfil|notificações|buscar|pesquisar|central|suporte|vendas|filas|fila|departamento|agente|abrir|ver|voltar|fechar|ligar|arquivar|configurar|alterar|transferir|informar|informações|dados|agenda|agendar|atualizar|enviar|receber|opções|visualizar)\b/i;
  function parse(raw){
    if(typeof raw!=='string'||!raw.trim()||raw.length>130)return null;
    let v=raw.replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim()
      .replace(/^(?:nome(?: do contato| da cliente)?|cliente|contato|conversando com|atendendo)\s*:\s*/i,'')
      .replace(/^[^\p{L}]+|[^\p{L}]+$/gu,'').trim();
    v=v.split(/\s+[|•·–—]\s+|\s+\(\s*\+?\d|\s+-\s+(?=\d)/u)[0].trim();
    if(!v||v.length>85||bad.test(v)||forbidden.test(v)||/[\d@#<>/\\:]|\b(?:https?|www)\b/i.test(v))return null;
    if(!/^[\p{L}\p{M}\s.'’\-]+$/u.test(v)||v.split(' ').length>7)return null;
    v=v.replace(/^(?:sra?\.?|senhora|dona|dra?\.?)\s+/i,'').trim();
    const m=v.match(/^([\p{L}][\p{L}\p{M}]*(?:[-'’][\p{L}\p{M}]+)?)(?:\s|$)/u);
    if(!m||m[1].length<2||bad.test(m[1]))return null;
    const firstName=m[1].toLocaleLowerCase('pt-BR').replace(/(^|[-'’])(\p{L})/gu,(_m,s,c)=>s+c.toLocaleUpperCase('pt-BR'));
    return {firstName,fullName:v};
  }
  const found=[];
  function add(node,score,selector){
    // Classes 'contact-name' também podem existir para TODAS as conversas
    // na lista lateral. Exige cabeçalho ativo para esses seletores genéricos.
    if(/\[class\*|\[id\*/.test(selector) && /(?:Name|name)/.test(selector) &&
      !node?.closest?.('[class*="header"],[class*="Header"],[data-testid*="header"],'+
        '[class*="chat-info"],[class*="contact-info"],[class*="conversation-info"],'+
        '[aria-selected="true"],[class~="active"],[class~="selected"]'))return;
    if(!node||!node.isConnected||node.closest('[aria-hidden="true"],[hidden],nav,[role="navigation"],[role="search"]'))return;
    const style=getComputedStyle(node);
    if(style.display==='none'||style.visibility==='hidden')return;
    const values=[node.getAttribute('data-name'),node.getAttribute('title'),node.getAttribute('aria-label'),node.textContent];
    for(const val of values){
      const p=parse(val);if(!p)continue;
      // Nomes completos são preferíveis a rótulos ou textos genéricos.
      found.push({...p,score:score+(p.fullName.includes(' ')?3:0),selector});break;
    }
  }
  function scan(selectors,base){
    for(let i=0;i<selectors.length;i++){
      let nodes=[];try{nodes=document.querySelectorAll(selectors[i]);}catch{continue;}
      for(const el of Array.from(nodes).slice(0,30))add(el,base-i*0.3,selectors[i]);
    }
  }
  if(whatsapp){
    scan([
      '#main header [data-testid="conversation-info-header-chat-title"]',
      '#main header [data-testid*="conversation-info"] [title]',
      '#main header span[title]',
      '#main header [dir="auto"][title]',
      '#main header [role="heading"]',
      '#main header [dir="auto"]'
    ],40);
  }else{
    scan([
      '[data-testid*="conversation-header"] [data-testid*="name"]',
      '[data-testid*="chat-header"] [data-testid*="name"]',
      '[data-testid*="contact-name"]','[data-testid*="customer-name"]',
      '[data-testid*="client-name"]','[data-testid*="contact-title"]',
      '[data-testid*="conversation-name"]',
      '[class*="contactName"]','[class*="customerName"]','[class*="clientName"]',
      '[class*="contact-name"]','[class*="customer-name"]','[class*="client-name"]',
      '[id*="contactName"]','[id*="clientName"]',
      '.conversation-header .contact-name','.chat-header .contact-name',
      '.chat-header .chat-name','.chat-header .chat-title',
      '[class*="conversationHeader"] [class*="name"]',
      '[class*="chatHeader"] [class*="name"]',
      '[class*="headerChat"] [class*="name"]',
      '[class*="headerContact"] [class*="name"]'
    ],47);
    // Em versões novas da Tallos, o nome pode ficar em um <span title>
    // dentro da barra superior, sem classe 'contact-name'.
    scan([
      '[data-testid*="conversation-header"] [title]',
      '[data-testid*="chat-header"] [title]',
      '.conversation-header [title]','.chat-header [title]',
      '[class*="conversation-header"] [title]',
      '[class*="chat-header"] [title]',
      'main header [title]', '[role="main"] header [title]',
      '.conversation-header span[title]', '.chat-header span[title]',
      '[class*="chatHeader"] span[title]',
      '[class*="conversationHeader"] [title]',
      '[class*="chatHeader"] [title]',
      '[class*="chat-info"] [title]',
      '[class*="contact-info"] [title]',
      '[class*="contact-header"] [title]',
      '[class*="chat-details"] [title]',
      '[class*="conversation-header"] h1',
      '[class*="conversation-header"] h2',
      '.chat-header h1','.chat-header h2',
      '[class*="contact-details"] h2'
    ],35);
    // Último recurso: lê apenas o elemento com nome na conversa marcada
    // como selecionada, nunca o texto completo da lista de conversas.
    scan([
      '[aria-selected="true"] [data-testid*="name"]',
      '[aria-selected="true"] [title]',
      '[class*="conversation-item"].active [title]',
      '[class*="conversation-item"].selected [title]',
      '[class*="chat-item"].active [title]',
      '[class*="chat-item"].selected [title]',
      '[data-active="true"] [data-testid*="name"]'
    ],24);
  }
  found.sort((a,b)=>b.score-a.score);
  const best=found[0];
  const composer=!!document.querySelector(
    '#main footer [contenteditable="true"],'+
    '[contenteditable="true"][data-lexical-editor],'+
    '.ProseMirror[contenteditable="true"],'+
    '[contenteditable="true"][data-placeholder],'+
    '[contenteditable="true"][role="textbox"],'+
    'textarea[placeholder*="mensagem" i],textarea[placeholder*="digite" i]'
  );
  return best ? {...best,hasComposer:composer,source:whatsapp?'WhatsApp Web':tallos?'Tallos':'Página de conversa'}
    : {firstName:'',fullName:'',hasComposer:composer,score:0,source:whatsapp?'WhatsApp Web':tallos?'Tallos':'Página atual',selector:''};
})();
