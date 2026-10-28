'use strict';
// Observa somente envios iniciados pelo usuário APÓS opt-in. Não lê histórico anterior.
(() => {
  const ENABLED='sraLuckRepeatMonitorEnabledV1';
  let enabled=false, pending=null, scheduled=null;
  const isWA=location.hostname==='web.whatsapp.com';
  const looksLikeComposer=el=>{
    if(!el||!(el instanceof Element))return false;
    const editor=el.closest('textarea,[contenteditable="true"],.ProseMirror');
    if(!editor)return false;
    const hint=((editor.getAttribute('data-placeholder')||'')+' '+(editor.getAttribute('placeholder')||'')+' '+(editor.getAttribute('aria-label')||'')+' '+(editor.className||'')).toLowerCase();
    if(/search|pesquis|buscar|filter|filtrar|assunto|subject/.test(hint))return false;
    if(isWA)return Boolean(editor.closest('footer')||editor.matches('[data-testid="conversation-compose-box-input"],div[contenteditable][data-tab]'));
    return /digite|mensagem|message|editor|prosemirror|texto/.test(hint)||Boolean(editor.closest('form,[class*="composer"],[class*="reply"],[class*="inputChat"]'));
  };
  function composer(){
    const nodes=[...document.querySelectorAll('footer [contenteditable="true"],.ProseMirror[contenteditable="true"],textarea[placeholder*="digite" i],textarea[placeholder*="mensagem" i],[contenteditable="true"][role="textbox"]')];
    return nodes.find(looksLikeComposer)||null;
  }
  function editorText(editor){return (editor?.value||editor?.innerText||editor?.textContent||'').replace(/\r/g,'').trim();}
  function norm(txt){return String(txt||'').replace(/[\u200b\u00a0]/g,' ').replace(/\s+/g,' ').toLowerCase().trim();}
  function outgoingText(node){
    const content=node.querySelector('[data-testid="msg-text"],.selectable-text,[class*="message-text"],[class*="messageText"],[class*="text-content"]');
    return (content?.innerText||content?.textContent||node.innerText||'').trim();
  }
  function outgoingNodes(){
    // Usa estruturas de bolhas enviadas, nunca a lista lateral de contatos.
    const selector=isWA?'.message-out':'[class*="message-out"],[class*="messageOut"],[class*="outgoing"],[class*="sent-message"],[data-testid*="message-out"]';
    return [...document.querySelectorAll(selector)].filter(n=>n.getBoundingClientRect().width>0).slice(-20);
  }
  function confirmSent(){
    if(!enabled||!pending||Date.now()>pending.expires){pending=null;return;}
    const candidates=outgoingNodes();
    const match=candidates.some(n=>{const text=norm(outgoingText(n));return text===pending.norm||text.includes(pending.norm)&&pending.norm.length>24;});
    if(match){
      const message=pending.text;pending=null;
      chrome.runtime.sendMessage({type:'SRA_REPEAT_OUTGOING_V1',text:message}).catch(()=>{});
    }
  }
  function afterSend(text){
    if(!enabled||text.length<35||text.length>2500)return;
    pending={text,norm:norm(text),expires:Date.now()+6000};
    for(const ms of [180,600,1300,2800])setTimeout(confirmSent,ms);
  }
  document.addEventListener('keydown',event=>{
    if(!enabled||event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.isComposing)return;
    if(!looksLikeComposer(event.target))return;
    const editor=event.target.closest('textarea,[contenteditable="true"],.ProseMirror');
    afterSend(editorText(editor));
  },true);
  document.addEventListener('click',event=>{
    if(!enabled)return;
    const button=event.target.closest('button,[role="button"]');if(!button)return;
    const label=((button.getAttribute('aria-label')||'')+' '+(button.getAttribute('title')||'')+' '+(button.getAttribute('data-testid')||'')+' '+(button.className||'')).toLowerCase();
    if(!/\bsend\b|enviar|send-btn|submit-message|compose-btn-send/.test(label))return;
    const editor=composer();if(editor)afterSend(editorText(editor));
  },true);
  const observer=new MutationObserver(()=>{
    if(!enabled||!pending)return;
    clearTimeout(scheduled);scheduled=setTimeout(confirmSent,90);
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  chrome.storage.local.get(ENABLED).then(r=>{enabled=r[ENABLED]===true;}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local'&&changes[ENABLED]){enabled=changes[ENABLED].newValue===true;pending=null;}
  });
})();
