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
    // Ex.: áudio no WhatsApp: "0:08 / 1,0x / 15:07" não é mensagem.
    const mediaControls=cleaned.replace(/×/g,'x').replace(/\s+/g,' ').trim();
    if(/^\d{1,2}:\d{2}(?:\s+\d+(?:[,.]\d+)?x)?(?:\s+\d{1,2}:\d{2})?$/.test(mediaControls))return;
    messages.push({role,text:cleaned,confidence});
  };
  // Cada bolha pode conter uma mensagem citada, botão de áudio, horário e
  // anexos. Apenas o corpo da mensagem ATUAL integra o histórico.
  const QUOTE='[data-testid*="quoted" i],[data-testid*="reply-preview" i],[data-testid*="reply-context" i],[class*="quoted" i],[class*="reply-preview" i],[class*="replyPreview"],[aria-label*="mensagem citada" i],[aria-label*="quoted message" i]';
  const MEDIA='[data-testid*="audio" i],[data-testid*="ptt" i],[data-testid*="document" i],[data-icon*="audio" i],[data-icon*="document" i],[data-icon*="ptt" i],audio,video';
  const MESSAGE_TEXT='.selectable-text,[data-testid="msg-text"],[data-testid*="message-text"],[class*="message-text"],[class*="messageText"],[class*="text-content"],[class*="textContent"]';
  function insideQuotedPart(el,node){
    let cur=el;
    while(cur&&cur!==node){
      try{
        if(cur.matches?.(QUOTE))return true;
      }catch{}
      // A prévia citada do WhatsApp é um bloco clicável dentro do balão.
      // O corpo novo é texto comum, fora deste bloco.
      if(cur.getAttribute?.('role')==='button')return true;
      cur=cur.parentElement;
    }
    return false;
  }
  function extractOwnText(node,source){
    const selectors=source==='wa'
      ?'.selectable-text.copyable-text,.copyable-text .selectable-text,.selectable-text,[data-testid="msg-text"],[data-testid="caption"]'
      :MESSAGE_TEXT;
    const leaves=[...node.querySelectorAll(selectors)]
      .filter(el=>visible(el)&&!insideQuotedPart(el,node))
      .filter(el=>![...el.querySelectorAll(selectors)].some(child=>visible(child)&&!insideQuotedPart(child,node)));
    // Evitar incluir o mesmo corpo duas vezes por causa de wrappers aninhados.
    const chunks=[];
    for(const el of leaves){
      const value=clean(el.innerText||el.textContent);
      if(value&&!chunks.includes(value))chunks.push(value);
    }
    if(chunks.length)return clean(chunks.join('\n'));
    // Mensagens sem texto (áudio, documento, imagem) não devem ser
    // interpretadas por sua interface: duração, velocidade, arquivo ou hora.
    if(node.querySelector(MEDIA))return '';
    // Fallback restrito: corpo textual simples, sem as prévias citadas.
    const copy=node.querySelector('.copyable-text,[data-testid="msg-text"],[dir="auto"]');
    if(!copy||insideQuotedPart(copy,node))return '';
    const clone=copy.cloneNode(true);
    for(const el of [...clone.querySelectorAll(QUOTE+',[role="button"],[data-testid*="time" i],[data-testid*="metadata" i]')])el.remove();
    return clean(clone.textContent);
  }
  // WhatsApp e Tallos: a posição real da bolha prevalece sobre nomes de classes
  // que variam entre versões. Esquerda = Cliente; direita = Equipe.
  function detectVisualSide(node,paneRect){
    if(!paneRect||paneRect.width<200)return null;
    const search='[data-testid="msg-text"],[data-testid*="message-text"],.selectable-text,.copyable-text,[class*="message-text"],[class*="messageText"],[class*="text-content"],[class*="textContent"],[class*="bubble-content"],[class*="bubbleContent"]';
    let elements=[...node.querySelectorAll(search)].filter(visible);
    // Quando o site não fornece seletores semânticos, localizamos o texto
    // efetivamente renderizado, e não a linha de largura total.
    if(!elements.length){
      const descendants=[...node.querySelectorAll('span,p,div')].slice(0,350);
      elements=descendants.filter(el=>{
        if(!visible(el))return false;
        const text=clean(el.innerText||el.textContent);
        if(!text||text.length>2000||/^(?:\d{1,2}:\d{2}|\d+[.,]\dx|ok)$/i.test(text))return false;
        return ![...el.children].some(child=>clean(child.innerText||child.textContent)===text);
      });
    }
    const validRect=el=>{
      if(!el)return false;
      const box=elementRect(el);
      return box.width>=12&&box.height>=6&&box.width<paneRect.width*0.96&&
        box.left>=paneRect.left-30&&box.right<=paneRect.right+30;
    };
    elements=elements.filter(validRect);
    // Mensagens compostas de múltiplas linhas podem ter vários blocos:
    // priorizamos o corpo mais informativo, não o horário da mensagem.
    elements.sort((a,b)=>{
      const score=el=>{
        const t=clean(el.innerText||el.textContent);
        const r=elementRect(el);
        return Math.min(t.length,450)+(r.width>=50?25:0);
      };
      return score(b)-score(a);
    });
    const anchor=elements[0]||node;
    // A bolha colorida costuma ser um ancestral do texto.
    // Se não existir, a própria posição do texto funciona.
    let selected=anchor,cursor=anchor;
    for(let steps=0;cursor&&steps<6;steps++,cursor=cursor.parentElement){
      if(cursor!==node&&!node.contains(cursor))break;
      if(!validRect(cursor))continue;
      const bg=String(getComputedStyle(cursor).backgroundColor||'').replace(/\s+/g,'').toLowerCase();
      const colored=bg&&bg!=='transparent'&&bg!=='rgba(0,0,0,0)'&&bg!=='#00000000';
      if(colored){selected=cursor;break;}
    }
    if(!validRect(selected))return null;
    const rect=elementRect(selected);
    const leftGap=Math.max(0,rect.left-paneRect.left);
    const rightGap=Math.max(0,paneRect.right-rect.right);
    const delta=leftGap-rightGap;
    const threshold=Math.max(22,paneRect.width*0.085);
    if(delta>threshold)return {role:'Equipe',confidence:0.96,method:'visual-right'};
    if(delta< -threshold)return {role:'Cliente',confidence:0.96,method:'visual-left'};
    return null;
  }
  if(wa){
    const main=document.querySelector('#main');
    if(!main)return {ok:false,source:'WhatsApp Web',messages:[],reason:'Abra uma conversa no WhatsApp Web.'};
    const wrappers=[...main.querySelectorAll('.message-in,.message-out')].filter(visible);
    const nodes=wrappers.length?wrappers:[...main.querySelectorAll('[data-testid="msg-container"]')].filter(visible);
    for(const node of nodes){
      const wrapper=node.closest('.message-in,.message-out')||node;
      const declared=wrapper.classList.contains('message-out')?'Equipe':wrapper.classList.contains('message-in')?'Cliente':null;
      const visual=detectVisualSide(node,elementRect(main));
      // O marcador message-in/out é explícito; quando ausente, medir a bolha.
      const role=declared||visual?.role||'Mensagem';
      const text=extractOwnText(node,'wa');
      add(role,text,role==='Mensagem'?0:(declared?1:visual.confidence));
    }
  }else{
    const composerSelector='[contenteditable="true"][data-placeholder],[contenteditable="true"][role="textbox"],.ProseMirror[contenteditable="true"],textarea[placeholder*="digite" i],textarea[placeholder*="mensagem" i]';
    const editorVisible=el=>{
      if(!el||!el.isConnected||el.closest('[hidden],[aria-hidden="true"],nav,aside,[role="navigation"],[role="search"]'))return false;
      const css=getComputedStyle(el),rect=elementRect(el);
      return css.display!=='none'&&css.visibility!=='hidden'&&rect.width>0&&rect.height>0;
    };
    // Os campos de digitação da Tallos podem ficar dentro de um footer:
    // só o leitor de mensagens deve excluir rodapés, não o editor ativo.
    const editors=[...document.querySelectorAll(composerSelector)].filter(editorVisible);
    // Escolhe o editor selecionado, não a primeira conversa da página.
    const focus=document.activeElement;
    const composer=editors.find(el=>el===focus||el.contains?.(focus)) ||
      editors.find(el=>el.getAttribute?.('data-sra-luck-last-composer')==='true') ||
      editors.at(-1)||document.querySelector(composerSelector);
    if(!composer)return {ok:false,source:'Tallos',messages:[],reason:'Abra uma conversa da Tallos com o campo de digitação disponível.'};
    const editor=elementRect(composer);
    const candidates=[
      '[data-testid*="message-list"]','[data-testid*="messages-list"]',
      '[class*="messages-list"]','[class*="messagesList"]',
      '[class*="chat-messages"]','[class*="chatMessages"]',
      '[class*="conversation-messages"]','[class*="conversationMessages"]',
      '[class*="message-container"]','[class*="messages-container"]',
      '[class*="chat-body"]','[class*="conversation-body"]',
      '[class*="chat-history"]','[class*="ChatHistory"]','[class*="messages-wrapper"]',
      '[class*="messagesWrapper"]','[class*="message-list-container"]','[data-testid*="chat-scroll"]'
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
        const count=parent.querySelectorAll('[data-message-id],[class*="message-bubble"],[class*="messageBubble"],[class*="message-item"],[class*="messageItem"],[class*="chat-message"],[class*="chat-bubble"],[class*="message-row"],[data-testid*="message-item"]').length;
        if(count>0){root=parent;break;}
      }
    }
    if(!root)return {ok:false,source:'Tallos',messages:[],reason:'Não encontrei a conversa ativa nesta versão da Tallos. Cole as últimas mensagens manualmente.'};
    const selector='[data-testid*="message-item"],[data-testid*="message-bubble"],[data-testid*="msg-item"],[data-message-id],[class*="message-bubble"],[class*="messageBubble"],[class*="message-item"],[class*="messageItem"],[class*="message-row"],[class*="messageRow"],[class*="chat-message"],[class*="chatMessage"],[class*="chat-bubble"],[class*="ChatBubble"],[class*="msg-bubble"]';
    let nodes=[...root.querySelectorAll(selector)].filter(el=>visible(el)&&near(el)&&!el.contains(composer));
    nodes=nodes.filter(el=>!nodes.some(other=>other!==el&&el.contains(other)));
    // As versões da Tallos podem expor a direção via data-*, classes CSS,
    // flexbox ou posição da bolha. Nunca inferir pelo conteúdo da mensagem.
    // O editor ocupa aproximadamente a mesma largura da conversa. Isso evita
    // confundir a largura de cada linha de mensagem com a largura do chat.
    const rootBox=elementRect(root);
    const viewport=editor.width>=240?editor:rootBox;
    function detectRole(node){
      const visual=detectVisualSide(node,viewport);
      if(visual)return visual;
      const markers=[];
      let current=node,depth=0;
      // Não ler classes do contêiner compartilhado por conversas ou mensagens.
      while(current&&current!==root&&depth++<5){
        // Não herdar atributos de um ancestral que misture vários remetentes.
        if(depth>1){
          const found=[...current.querySelectorAll?.(selector)||[]];
          const independent=found.filter(el=>!found.some(other=>other!==el&&el.contains(other)));
          if(independent.length>1)break;
        }
        const keys=['data-side','data-align','data-message-role','data-message-owner',
          'data-author-type','data-sender-role','data-is-incoming',
          'class','data-direction','data-message-direction','data-sender-type',
          'data-message-type','data-from-me','data-is-outbound','data-is-mine',
          'data-origin','data-testid','aria-label','data-owner'];
        for(const key of keys){
          const value=current.getAttribute?.(key);
          if(value)markers.push({key,value:String(value)});
        }
        current=current.parentElement;
      }
      // Algumas implementações deixam os metadados no elemento filho.
      const child=node.querySelector?.('[data-direction],[data-message-direction],[data-from-me],[data-sender-type],[data-is-outbound],[data-is-incoming],[data-side],[data-message-owner],[data-sender-role]');
      if(child){
        for(const key of ['data-direction','data-message-direction','data-from-me','data-sender-type','data-is-outbound','data-is-incoming','data-side','data-message-owner','data-sender-role']){
          const value=child.getAttribute?.(key);
          if(value!==null&&value!==undefined)markers.push({key,value:String(value)});
        }
      }
      let outbound=false,inbound=false;
      for(const {key,value} of markers){
        const v=value.toLowerCase().trim();
        if(['data-from-me','data-is-outbound','data-is-mine','data-is-incoming'].includes(key)){
          if(key==='data-is-incoming'){
            if(v==='true'||v==='1')inbound=true;
            if(v==='false'||v==='0')outbound=true;
          }else{
            if(v==='true'||v==='1')outbound=true;
            if(v==='false'||v==='0')inbound=true;
          }
        }else if(['data-sender-type','data-origin','data-owner','data-message-owner','data-author-type','data-sender-role','data-message-role'].includes(key)){
          if(/^(?:agent|operator|staff|business|company|me|attendant|atendente|equipe)$/.test(v))outbound=true;
          if(/^(?:client|customer|contact|user|cliente|consumer)$/.test(v))inbound=true;
        }else if(['data-direction','data-message-direction','data-message-type','data-side','data-align'].includes(key)){
          if(/^(?:outgoing|outbound|sent|from-me|right|mine|end|out)$/.test(v))outbound=true;
          if(/^(?:incoming|inbound|received|left|from-client|start|in)$/.test(v))inbound=true;
        }else{
          if(key==='aria-label'){
            if(/mensagem (?:enviada|de saída)|sent message|enviada pela equipe/i.test(v))outbound=true;
            if(/mensagem (?:recebida|de entrada)|received message|recebida do cliente/i.test(v))inbound=true;
          }
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
      const textBlock=node.querySelector?.('[data-testid*="message-text"],[class*="message-text"],[class*="messageText"],[class*="text-content"],[class*="textContent"],.selectable-text');
      const rootRect=elementRect(root);
      // Uma linha Tallos pode ocupar toda a largura; medir o texto interno.
      const rect=elementRect(bubble||textBlock||node);
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
      const text=extractOwnText(node,'tallos');
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
  // Evitar interpretação de resposta solta sem a pergunta anterior.
  const usable=safeSuffix.some(m=>m.role==='Cliente')&&safeSuffix.length>=2?safeSuffix:[];
  const reliable=usable.length>0;
  const skipped=lastUnknown>=0&&reliable?lastUnknown+1:0;
  return {ok:true,source:wa?'WhatsApp Web':'Tallos',
    messages:reliable?usable:recent,
    reliable,unknownRecent:unknown,skippedCount:skipped,
    reason:reliable?(skipped?'Mensagens antigas sem identificação foram descartadas.':''):
      'Não foi possível localizar visualmente as bolhas da conversa ativa. Atualize a página do chat e tente novamente.'};
})();
