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
    // As versões da Tallos podem expor a direção via data-*, classes CSS,
    // flexbox ou posição da bolha. Nunca inferir pelo conteúdo da mensagem.
    function detectRole(node){
      const markers=[];
      let current=node,depth=0;
      // Não ler classes do contêiner compartilhado por conversas ou mensagens.
      while(current&&current!==root&&depth++<5){
        const keys=['class','data-direction','data-message-direction','data-sender-type',
          'data-message-type','data-from-me','data-is-outbound','data-is-mine',
          'data-origin','data-testid','aria-label','data-owner'];
        for(const key of keys){
          const value=current.getAttribute?.(key);
          if(value)markers.push({key,value:String(value)});
        }
        current=current.parentElement;
      }
      // Algumas implementações deixam os metadados no elemento filho.
      const child=node.querySelector?.('[data-direction],[data-message-direction],[data-from-me],[data-sender-type],[data-is-outbound]');
      if(child){
        for(const key of ['data-direction','data-message-direction','data-from-me','data-sender-type','data-is-outbound']){
          const value=child.getAttribute?.(key);
          if(value!==null&&value!==undefined)markers.push({key,value:String(value)});
        }
      }
      let outbound=false,inbound=false;
      for(const {key,value} of markers){
        const v=value.toLowerCase().trim();
        if(['data-from-me','data-is-outbound','data-is-mine'].includes(key)){
          if(v==='true'||v==='1')outbound=true;
          if(v==='false'||v==='0')inbound=true;
        }else if(key==='data-sender-type'||key==='data-origin'||key==='data-owner'){
          if(/^(?:agent|operator|staff|business|company|me|attendant|atendente|equipe)$/.test(v))outbound=true;
          if(/^(?:client|customer|contact|user|cliente|consumer)$/.test(v))inbound=true;
        }else if(key==='data-direction'||key==='data-message-direction'||key==='data-message-type'){
          if(/^(?:outgoing|outbound|sent|from-me|right|mine)$/.test(v))outbound=true;
          if(/^(?:incoming|inbound|received|left|from-client)$/.test(v))inbound=true;
        }else{
          const parts=v.split(/[\s,;]+/);
          if(parts.some(p=>/^(?:outgoing|outbound|sent|mine|from-me|message-out|messageout|bubble-out|message--sent|msg-out|message-right|from-agent|agent-message|operator-message)$/.test(p)))outbound=true;
          if(parts.some(p=>/^(?:incoming|inbound|received|message-in|messagein|bubble-in|message--received|msg-in|message-left|from-client|client-message|customer-message)$/.test(p)))inbound=true;
        }
      }
      if(outbound&&inbound)return {role:'Mensagem',confidence:0,method:'conflict'};
      if(outbound||inbound)return {role:outbound?'Equipe':'Cliente',confidence:1,method:'metadata'};
      // Para o layout em flex, alinhamento do elemento que contém a bolha.
      // Só aceitar sinais unívocos; "justify-between" ou "center" não contam.
      let container=node,hops=0;
      while(container&&container!==root&&hops++<4){
        const cls=String(container.getAttribute?.('class')||'').toLowerCase().split(/\s+/);
        const out=cls.some(c=>/^(?:justify-end|self-end|ml-auto|float-right|flex-row-reverse)$/.test(c));
        const ins=cls.some(c=>/^(?:justify-start|self-start|mr-auto|float-left)$/.test(c));
        if(out!==ins)return {role:out?'Equipe':'Cliente',confidence:0.9,method:'layout-class'};
        if(out&&ins)break;
        const st=getComputedStyle(container);
        const row=elementRect(container).width>elementRect(root).width*0.65;
        const styleOut=st.alignSelf==='flex-end' ||
          st.marginLeft==='auto'&&st.marginRight!=='auto' ||
          row&&(st.display==='flex'||st.display==='inline-flex')&&st.justifyContent==='flex-end';
        const styleIn=st.alignSelf==='flex-start' ||
          st.marginRight==='auto'&&st.marginLeft!=='auto' ||
          row&&(st.display==='flex'||st.display==='inline-flex')&&st.justifyContent==='flex-start';
        if(styleOut!==styleIn)return {role:styleOut?'Equipe':'Cliente',confidence:0.8,method:'layout-style'};
        container=container.parentElement;
      }
      // Comparar também a bolha interna: muitas mensagens Tallos têm linha
      // de largura total; medir essa linha daria falso "Mensagem".
      const bubble=node.querySelector?.('[data-testid*="message-bubble"],[class*="message-bubble"],[class*="messageBubble"],[class*="bubble"],[class*="Bubble"]');
      const rootRect=elementRect(root);
      const rect=elementRect(bubble||node);
      if(rootRect.width>200&&rect.width>30&&rect.width<rootRect.width*0.84){
        const leftGap=rect.left-rootRect.left,rightGap=rootRect.right-rect.right;
        const difference=leftGap-rightGap;
        if(difference>Math.max(40,rootRect.width*0.16))return {role:'Equipe',confidence:0.8,method:'position'};
        if(-difference>Math.max(40,rootRect.width*0.16))return {role:'Cliente',confidence:0.8,method:'position'};
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
  // Se houver mensagens antigas sem direção, considerar apenas o sufixo
  // consecutivo com autoria identificada. Nunca pular uma fala ambígua
  // que veio depois da última mensagem da cliente.
  const unknown=recent.filter(m=>m.role==='Mensagem').length;
  const lastUnknown=recent.findLastIndex(m=>m.role==='Mensagem');
  const safeSuffix=lastUnknown>=0?recent.slice(lastUnknown+1):recent;
  const usable=safeSuffix.some(m=>m.role==='Cliente')&&safeSuffix.length>=1?safeSuffix:[];
  const reliable=usable.length>0;
  const skipped=lastUnknown>=0&&reliable?lastUnknown+1:0;
  return {ok:true,source:wa?'WhatsApp Web':'Tallos',
    messages:reliable?usable:recent,
    reliable,unknownRecent:unknown,skippedCount:skipped,
    reason:reliable?(skipped?'Algumas mensagens anteriores sem remetente foram desconsideradas.':''):
      'A conversa mais recente não tem remetente identificado com segurança. Tente reler com o chat aberto ou revise apenas as últimas falas.'};
})();
