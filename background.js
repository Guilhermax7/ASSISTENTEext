'use strict';
// A carteira ocupa o painel lateral nativo e acompanha a navegação.
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true})
  .catch(error=>console.error('Não foi possível configurar o painel lateral:',error));
function trackField(tabId) {
  if (tabId) chrome.scripting.executeScript({target:{tabId,allFrames:true},files:['target.js']}).catch(()=>{});
}
chrome.action.onClicked.addListener(tab=>trackField(tab.id));
chrome.tabs.onActivated.addListener(info=>trackField(info.tabId));
chrome.tabs.onUpdated.addListener((tabId,info)=>{if(info.status==='complete')trackField(tabId);});
async function trackOpenPages() {
  const tabs=await chrome.tabs.query({url:['https://*/*','http://*/*']});
  tabs.forEach(tab=>trackField(tab.id));
}
chrome.runtime.onInstalled.addListener(()=>trackOpenPages().catch(()=>{}));
chrome.runtime.onStartup.addListener(()=>trackOpenPages().catch(()=>{}));

// Contagem local de padrões de mensagens QUE O OPERADOR ENVIOU, com opt-in.
// Não salva conversas completas nem envia dados à IA sem solicitação explícita.
const REPEAT_ENABLED='sraLuckRepeatMonitorEnabledV1';
const REPEAT_DATA='sraLuckRepeatPatternsV1';
function scrubRepeat(text){
  return String(text||'').replace(/\r\n?/g,'\n').trim()
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,'[dado removido]')
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,'[dado removido]')
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi,'[e-mail removido]')
    .replace(/(?:\+55\s?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g,'[telefone removido]')
    .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g,'{{data}}')
    .replace(/\bR\$\s*[\d.,]+/gi,'[valor a conferir]')
    .replace(/\b(?:olá|oi|bom dia|boa tarde|boa noite)\s*,?\s+([A-ZÀ-Ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-Ÿ][a-zà-ÿ]+){0,3})(\s*[,!😊💖]|\s*\n)/giu,(whole,_name,tail)=>whole.replace(_name,'{{primeiro_nome}}'))
    .replace(/\b\d{6,}\b/g,'[número removido]').slice(0,1100);
}
let repeatWrite=Promise.resolve();
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type!=='SRA_REPEAT_OUTGOING_V1')return false;
  // Verifica remetente: apenas content scripts da Tallos/WhatsApp Web.
  let host='';try{host=new URL(sender.url||'').hostname;}catch{}
  if(host!=='web.whatsapp.com'&&host!=='tallos.com.br'&&!host.endsWith('.tallos.com.br')){sendResponse({ok:false});return false;}
  repeatWrite=repeatWrite.then(async()=>{
    const v=await chrome.storage.local.get([REPEAT_ENABLED,REPEAT_DATA]);
    if(v[REPEAT_ENABLED]!==true)return {ok:false};
    const scrubbed=scrubRepeat(msg.text);
    if(scrubbed.length<35)return {ok:false};
    const key=scrubbed.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const items=Array.isArray(v[REPEAT_DATA])?v[REPEAT_DATA].slice(0,180):[];
    const found=items.find(t=>t.key===key);
    if(found){found.count=Math.min(9999,(Number(found.count)||0)+1);found.last=Date.now();}
    else items.unshift({key,text:scrubbed,count:1,last:Date.now(),dismissed:false});
    items.sort((a,b)=>b.last-a.last);
    await chrome.storage.local.set({[REPEAT_DATA]:items.slice(0,180)});
    return {ok:true};
  }).catch(()=>({ok:false}));
  repeatWrite.then(sendResponse);
  return true;
});
