'use strict';
// Lê apenas a conversa ativa, mediante clique explícito. Se a autoria for
// incerta, não classifica arbitrariamente a mensagem como cliente/equipe.
(() => {
  const host=location.hostname.toLowerCase();
  const wa=host==='web.whatsapp.com';
  const tallos=host==='app.tallos.com.br'||host.endsWith('.tallos.com.br');
  if(!wa&&!tallos)return {ok:false,source:'unsupported',messages:[],reason:'Abra uma conversa na Tallos ou no WhatsApp Web.'};
  const clean=value=>String(value||'').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\r/g,'').replace(/\n{3,}/g,'\n\n').trim();
  const visible=el=>{
    if(!el||!el.isConnected||el.closest('[hidden],[aria-hidden="true"],nav,aside,footer,[role="navigation"],[role="search"],script,style,textarea'))return false;
    const style=getComputedStyle(el);
    return style.display!=='none'&&style.visibility!=='hidden';
  };
  const elementRect=el=>el?.getBoundingClientRect?.()||{left:0,right:0,width:0,height:0,top:0,bottom:0};
  const messages=[];
  const add=(role,text,confidence=1)=>{
    const cleaned=clean(text);
    if(!cleaned||cleaned.length>2200||/^(?:responder|editar|copiar|reagir|enviar|digitando|anexo|mensagem apagada)$/i.test(cleaned))return;
    messages.push({role,text:cleaned,confidence});
  };
  const textFrom=(node,selectors)=>{
    const found=[...node.querySelectorAll(selectors)].filter(el=>visible(el)&&!el.querySelector(selectors));
    if(found.length)return clean(found.map(el=>el.innerText||el.textContent).join('\n'));
    const copy=node.querySelector('.copyable-text');
    return clean(copy?.innerText||node.innerText||node.textContent);
  };
  if(wa){
    const main=document.querySelector('#main');
    if(!main)return {ok:false,source:'WhatsApp Web',messages:[],reason:'Abra uma conversa no WhatsApp Web.'};
    const wrappers=[...main.querySelectorAll('.message-in,.message-out')].filter(visible);
    const nodes=wrappers.length?wrappers:[...main.querySelectorAll('[data-testid="msg-container"]')].filter(visible);
    for(const node of nodes){
      const wrapper=node.closest('.message-in,.message-out')||node;
      const role=wrapper.classList.contains('message-out')?'Equipe':wrapper.classList.contains('message-in')?'Cliente':'Mensagem';
      const text=textFrom(node,'.copyable-text .selectable-text,[data-testid="msg-text"],.message-text');
      add(role,text,role==='Mensagem'?0:1);
    }
  }else{
    const composer=document.querySelector('[contenteditable="true"][data-placeholder],[contenteditable="true"][role="textbox"],.ProseMirror[contenteditable="true"],textarea[placeholder*="digite" i],textarea[placeholder*="mensagem" i]');
    if(!composer)return {ok:false,source:'Tallos',messages:[],reason:'Abra uma conversa da Tallos com o campo de digitação disponível.'};
    const editor=elementRect(composer);
    const candidates=[
      '[data-testid*="message-list"]','[data-testid*="messages-list"]',
      '[class*="messages-list"]','[class*="messagesList"]',
      '[class*="chat-messages"]','[class*="chatMessages"]',
      '[class*="conversation-messages"]','[class*="conversationMessages"]',
      '[class*="message-container"]','[class*="messages-container"]',
      '[class*="chat-body"]','[class*="conversation-body"]'
    ];
    const near=el=>{
      const r=elementRect(el);
      return r.width>0&&r.height>0&&r.right>editor.left-80&&r.left<editor.right+80&&r.top<editor.bottom+150;
    };
    let root=null;
    for(const selector of candidates){
      const options=[...document.querySelectorAll(selector)].filter(el=>visible(el)&&near(el)&&el!==composer&&!el.contains(composer));
      if(options.length){root=options.sort((a,b)=>b.querySelectorAll('*').length-a.querySelectorAll('*').length)[0];break;}
    }
    if(!root){
      let parent=composer.parentElement;
      for(let i=0;i<7&&parent&&parent!==document.body;i++,parent=parent.parentElement){
        const count=parent.querySelectorAll('[class*="message-bubble"],[class*="messageBubble"],[class*="message-item"],[class*="messageItem"],[class*="chat-message"],[data-testid*="message-item"]').length;
        if(count>0){root=parent;break;}
      }
    }
    if(!root)return {ok:false,source:'Tallos',messages:[],reason:'Não encontrei a conversa ativa nesta versão da Tallos. Cole as últimas mensagens manualmente.'};
    const selector='[data-testid*="message-item"],[data-testid*="message-bubble"],[class*="message-bubble"],[class*="messageBubble"],[class*="message-item"],[class*="messageItem"],[class*="chat-message"],[class*="chatMessage"]';
    let nodes=[...root.querySelectorAll(selector)].filter(el=>visible(el)&&near(el)&&!el.contains(composer));
    nodes=nodes.filter(el=>!nodes.some(other=>other!==el&&el.contains(other)));
    // Não presumir que "right" equivale a equipe quando a estrutura divergir.
    function detectRole(node){
      let current=node,up=0;
      const parts=[];
      while(current&&current!==root&&up++<3){
        const attrs=['class','data-direction','data-message-direction','data-sender-type','data-message-type','data-from-me','data-is-outbound','data-origin'];
        for(const attr of attrs){const v=current.getAttribute?.(attr);if(v)parts.push(attr+'='+v);}
        current=current.parentElement;
      }
      const desc=parts.join(' ');
      const outgoing=/(?:^|[^a-z])(outgoing|outbound|sent|mine|from-me|is-me|message-out|messageOut|bubble-out|staff-message|agent-message|operator-message)(?:$|[^a-z])/i.test(desc)||/data-from-me=true|data-is-outbound=true/i.test(desc);
      const incoming=/(?:^|[^a-z])(incoming|inbound|received|message-in|messageIn|bubble-in|client-message|customer-message)(?:$|[^a-z])/i.test(desc)||/data-from-me=false|data-is-outbound=false/i.test(desc);
      if(outgoing!==incoming)return {role:outgoing?'Equipe':'Cliente',confidence:1,method:'metadata'};
      const rootRect=elementRect(root),rect=elementRect(node);
      // Alinhamento só vale se a bolha for visivelmente deslocada para um
      // lado e estreita em relação à coluna de mensagens.
      if(rootRect.width>200&&rect.width>30&&rect.width<rootRect.width*0.76){
        const leftGap=rect.left-rootRect.left,rightGap=rootRect.right-rect.right;
        if(leftGap>=90&&leftGap>rightGap+95)return {role:'Equipe',confidence:0.8,method:'alignment'};
        if(rightGap>=90&&rightGap>leftGap+95)return {role:'Cliente',confidence:0.8,method:'alignment'};
      }
      return {role:'Mensagem',confidence:0,method:'unknown'};
    }
    for(const node of nodes){
      const {role,confidence}=detectRole(node);
      const text=textFrom(node,'[data-testid*="message-text"],[class*="message-text"],[class*="messageText"],[class*="text-content"],[class*="textContent"]');
      add(role,text,confidence);
    }
  }
  const deduped=[];
  for(const item of messages){
    const previous=deduped.at(-1);
    if(previous?.text===item.text&&previous.role===item.role)continue;
    deduped.push(item);
  }
  const recent=deduped.slice(-18);
  if(!recent.length)return {ok:false,source:wa?'WhatsApp Web':'Tallos',messages:[],reason:'Não encontrei mensagens de texto da conversa ativa. Você pode colar o histórico manualmente.'};
  const unresolved=recent.slice(-8).filter(item=>item.role==='Mensagem').length;
  const roleCount=recent.filter(item=>item.role!=='Mensagem').length;
  return {ok:true,source:wa?'WhatsApp Web':'Tallos',messages:recent,
    reliable:unresolved===0&&roleCount>=1,unknownRecent:unresolved,
    reason:unresolved?'Não consegui identificar com segurança '+unresolved+' mensagens recentes. Revise as marcações Cliente/Equipe antes de gerar.':''};
})();
