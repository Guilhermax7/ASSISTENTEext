'use strict';
// O conteúdo é lido somente quando a atendente clica em "Ler conversa".
// Sem monitoramento contínuo, sem armazenamento e sem busca em outras conversas.
(() => {
  const hostname=location.hostname.toLowerCase();
  const isWA=hostname==='web.whatsapp.com';
  const isTallos=hostname==='app.tallos.com.br'||hostname.endsWith('.tallos.com.br');
  if(!isWA&&!isTallos)return {ok:false,source:'unsupported',messages:[],reason:'Abra uma conversa no WhatsApp Web ou na Tallos.'};
  const visible=el=>{
    if(!el||!el.isConnected)return false;
    if(el.closest('[hidden],[aria-hidden="true"],nav,aside,footer,[role="navigation"],[role="search"],script,style,textarea'))return false;
    const s=getComputedStyle(el);
    return s.display!=='none'&&s.visibility!=='hidden';
  };
  const clean=s=>String(s||'').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
  const items=[];
  if(isWA){
    const main=document.querySelector('#main');
    if(!main)return {ok:false,source:'whatsapp',messages:[],reason:'Abra uma conversa individual no WhatsApp Web.'};
    const messageNodes=main.querySelectorAll('[data-testid="msg-container"],.message-in,.message-out');
    for(const node of messageNodes){
      if(!visible(node)||node.closest('[data-testid="msg-container"]')&&node.matches('.message-in,.message-out'))continue;
      const wrapper=node.closest('.message-in,.message-out')||node;
      const content=Array.from(node.querySelectorAll('.copyable-text .selectable-text,[data-testid="msg-text"],.message-text')).filter(el=>!el.querySelector('.selectable-text,[data-testid="msg-text"]'));
      const text=clean(content.map(e=>e.innerText||e.textContent).join('\n')||node.querySelector('.copyable-text')?.innerText||'');
      if(!text||text.length>2200)continue;
      const prefix=node.querySelector('[data-pre-plain-text]')?.getAttribute('data-pre-plain-text')||'';
      const role=wrapper.classList.contains('message-out')?'Equipe':wrapper.classList.contains('message-in')?'Cliente':/\b(eu|você)\s*:/i.test(prefix)?'Equipe':'Mensagem';
      items.push({role,text});
    }
  } else {
    // O editor define a conversa ativa. Não acessamos a lista lateral de chats.
    const composer=document.querySelector('[contenteditable="true"][data-placeholder],[contenteditable="true"][role="textbox"],.ProseMirror[contenteditable="true"],textarea[placeholder*="digite" i],textarea[placeholder*="mensagem" i]');
    if(!composer)return {ok:false,source:'tallos',messages:[],reason:'Abra a conversa e clique em “Digite aqui...”.'};
    const candidates=[
      '[data-testid*="message-list"]','[data-testid*="messages-list"]',
      '[class*="messages-list"]','[class*="messagesList"]',
      '[class*="chat-messages"]','[class*="chatMessages"]',
      '[class*="conversation-messages"]','[class*="conversationMessages"]',
      '[class*="message-container"]','[class*="messages-container"]',
      '[class*="chat-body"]','[class*="conversation-body"]'
    ];
    const editorRect=composer.getBoundingClientRect();
    const isNearEditor=el=>{
      const r=el.getBoundingClientRect();
      return r.width>0&&r.height>0&&r.right>editorRect.left-80&&r.left<editorRect.right+80;
    };
    let root=null;
    for(const s of candidates){
      const matches=Array.from(document.querySelectorAll(s)).filter(el=>visible(el)&&isNearEditor(el)&&el!==composer&&!el.contains(composer));
      if(matches.length){root=matches.sort((a,b)=>b.getBoundingClientRect().height-a.getBoundingClientRect().height)[0];break;}
    }
    if(!root){
      let parent=composer.parentElement;
      for(let i=0;i<7&&parent&&parent!==document.body;i++,parent=parent.parentElement){
        const bubbleCount=parent.querySelectorAll('[class*="message-bubble"],[class*="messageBubble"],[class*="message-item"],[class*="messageItem"],[class*="chat-message"],[data-testid*="message-item"]').length;
        if(bubbleCount>=1){root=parent;break;}
      }
    }
    if(!root)return {ok:false,source:'tallos',messages:[],reason:'Não encontrei o histórico da conversa nesta tela da Tallos. Cole as últimas mensagens no campo de contexto.'};
    const selectors='[data-testid*="message-item"],[data-testid*="message-bubble"],[class*="message-bubble"],[class*="messageBubble"],[class*="message-item"],[class*="messageItem"],[class*="chat-message"],[class*="chatMessage"]';
    let nodes=Array.from(root.querySelectorAll(selectors)).filter(el=>visible(el)&&!el.contains(composer)&&isNearEditor(el));
    nodes=nodes.filter(el=>!nodes.some(other=>other!==el&&el.contains(other)));
    for(const node of nodes){
      const content=node.querySelector('[class*="message-text"],[class*="messageText"],[class*="text-content"],[class*="textContent"],[data-testid*="message-text"]');
      const text=clean(content?.innerText||node.innerText||node.textContent);
      if(!text||text.length>2200||/^(?:responder|editar|copiar|reagir|enviar|digitando|anexo)$/i.test(text))continue;
      const classText=[node.className,node.parentElement?.className].map(x=>typeof x==='string'?x:'').join(' ');
      const role=/\b(outgoing|sent|sender|mine|operator|agent|outbound)\b|message-out|messageOut/i.test(classText)?'Equipe':/\b(incoming|received|client|customer|inbound)\b|message-in|messageIn/i.test(classText)?'Cliente':'Mensagem';
      items.push({role,text});
    }
  }
  // Remover duplicatas adjacentes (o WhatsApp pode expor classes aninhadas).
  const deduped=[];
  for(const m of items){const prev=deduped[deduped.length-1];if(prev?.text===m.text&&prev.role===m.role)continue;deduped.push(m);}
  const messages=deduped.slice(-24);
  return messages.length?{ok:true,source:isWA?'WhatsApp Web':'Tallos',messages,reason:''}
    :{ok:false,source:isWA?'WhatsApp Web':'Tallos',messages:[],reason:'Não encontrei mensagens de texto nesta conversa. Você pode colar o histórico manualmente.'};
})();
