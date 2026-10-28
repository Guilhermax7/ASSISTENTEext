'use strict';
const {banks, parseReport, cleanState, importBank, sortClients} = Carteira;
const $ = id => document.getElementById(id);
let state = {clients:[]}, pending = null, storageFailed = false;
let selectedClient = '';
const clientKey = c => JSON.stringify([c.bank||'',c.name]);
let saving = Promise.resolve();
let statusTimer;
function status(message, error=false) { clearTimeout(statusTimer); $('status').textContent=message; $('status').classList.toggle('error',error); if(!error)statusTimer=setTimeout(()=>{$('status').textContent='';},3200); }
function save() {
  const snapshot=JSON.parse(JSON.stringify(state));
  const operation=saving.then(()=>chrome.storage.local.set({carteira:snapshot}));
  saving=operation.catch(()=>{});
  return operation;
}
function option(bank) { const el=document.createElement('option'); el.value=bank.id; el.textContent=bank.name; return el; }
function updateTotals() {
  $('totalNames').textContent=state.clients.length;
  $('totalLabel').textContent=state.clients.length===1?'nome na carteira':'nomes na carteira';
  $('empty').hidden=state.clients.length>0;
}
function render(animate=true) {
  updateTotals();
  const term=$('search').value.trim().toLocaleLowerCase('pt-BR'); const filter=$('bankFilter').value;
  const visible=state.clients.filter(c=>(filter==='all'||c.bank===filter) &&
    (!term||c.name.toLocaleLowerCase('pt-BR').includes(term)));
  $('list').replaceChildren(); $('empty').hidden=state.clients.length>0;
  if (!visible.length && state.clients.length) { const p=document.createElement('p');p.textContent='Nenhuma cliente corresponde ao filtro.';$('list').append(p); }
  for (const c of sortClients(visible)) {
    const bank=banks.find(b=>b.id===c.bank)||banks[0];
    const row=document.createElement('article');row.className='client';row.style.setProperty('--bank',bank.color);
    row.style.setProperty('--bank-bg',bank.surface);row.style.setProperty('--bank-border',bank.border);row.title=bank.name;
    row.dataset.clientKey=clientKey(c);row.classList.toggle('selected',selectedClient===clientKey(c));
    const left=document.createElement('div');left.className='client-identity';
    const name=document.createElement('button');name.className='name';name.textContent=c.name;name.title='Inserir este nome no campo selecionado da página';
    name.setAttribute('aria-pressed',String(selectedClient===clientKey(c)));
    row.addEventListener('click',()=>{
      selectedClient=clientKey(c);
      for(const item of $('list').querySelectorAll('.client')) {
        const selected=item.dataset.clientKey===selectedClient;
        item.classList.toggle('selected',selected);
        item.querySelector('.name').setAttribute('aria-pressed',String(selected));
      }
      chrome.storage.local.set({selectedClient}).catch(()=>status('Não foi possível salvar o destaque.',true));
      globalThis.CarteiraUI?.focus(row);
      insertName(c.name);
    });
    const meta=document.createElement('span');meta.className='days-badge';meta.textContent=`${c.days} ${c.days===1?'dia':'dias'}`;meta.setAttribute('aria-label',`${c.days} dias em atraso`);
    meta.dataset.urgency=c.days>=60?'high':c.days>=15?'medium':'low';
    left.append(name);
    // A identificação do banco fica visível também nas listas escuras.
    // A cor continua vindo da configuração original de cada banco.
    const label=document.createElement('span');label.className='bank-badge';label.textContent=bank.name;left.append(label);
    const right=document.createElement('div');right.className='client-tags';
    const done=document.createElement('button');done.className='done-button';done.textContent='✓';
    done.title='Concluir e retirar da lista';done.setAttribute('aria-label',`Concluir e retirar ${c.name} da lista`);
    done.addEventListener('click',async event=>{
      event.stopPropagation();
      if(done.disabled)return;
      done.disabled=true;
      const index=state.clients.indexOf(c);
      state={...state,clients:state.clients.filter(item=>item!==c)};
      row.remove();updateTotals();
      try{await save();}
      catch{
        if(!state.clients.includes(c)){
          const clients=[...state.clients];clients.splice(Math.min(index,clients.length),0,c);state={...state,clients};
        }
        render(false);status('Não foi possível salvar esta conclusão. A cliente voltou à lista.',true);
      }
    });
    right.append(meta,done);row.append(left,right);$('list').append(row);globalThis.CarteiraUI?.watch(row);
  }
  if(animate!==false)globalThis.CarteiraUI?.enter();
}
// Executada somente na aba escolhida pelo usuário ao abrir a extensão.
// Resolve o editor real de mensagem, inclusive Tallos (TipTap/ProseMirror,
// Quill, textarea ou editor rico). Nunca seleciona a busca ou outra conversa.
async function fillActiveField(name, mode) {
  const remembered=globalThis.__sraLuckField;
  const isWhatsapp=location.hostname==='web.whatsapp.com';
  const isTallos=location.hostname.endsWith('.tallos.com.br');
  const editable=e=>e&&(
    e instanceof HTMLTextAreaElement ||
    e instanceof HTMLInputElement && ['text','search','tel','url','email',''].includes(e.type) ||
    e.isContentEditable
  );
  let active=document.activeElement;
  while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;
  const notComposer=e=>!e||e.disabled||e.readOnly||
    e instanceof HTMLInputElement && e.type==='search'||
    !!e.closest('nav,aside,[role="search"],[data-testid="chat-list"],'+
      '[class*="search"],[class*="Search"],[class*="filter"],[class*="Filter"]')||
    /(?:buscar|pesquisar|pesquisa|search|filter)/i.test([
      e.id,e.getAttribute('name'),e.getAttribute('placeholder'),
      e.getAttribute('aria-label'),e.getAttribute('data-placeholder')].filter(Boolean).join(' '));
  const candidates=[];
  function offer(e,baseline){
    if(!editable(e)||notComposer(e)||!e.isConnected)return;
    const cs=getComputedStyle(e);
    if(cs.visibility==='hidden'||cs.display==='none')return;
    const details=[e.getAttribute('placeholder'),e.getAttribute('data-placeholder'),e.getAttribute('aria-label'),
      e.getAttribute('title'),e.getAttribute('data-testid'),e.getAttribute('data-slate-editor')].filter(Boolean).join(' ');
    const containers=e.closest('[class*="composer"],[class*="Composer"],[class*="footer"],'+
      '[class*="Footer"],[class*="editor"],[class*="Editor"],[class*="reply"],'+
      '[class*="Reply"],[data-testid*="composer"],[data-testid*="message"],'+
      '[class*="message-input"],[class*="chat-input"]');
    let score=baseline;
    if(/digite aqui|escreva|enviar mensagem|escreva uma mensagem|digite sua mensagem|responder|mensagem|message|resposta/i.test(details))score+=24;
    if(containers)score+=12;
    if(e.matches('.ProseMirror,.ql-editor,.tiptap,[data-lexical-editor="true"],[data-slate-editor="true"]'))score+=12;
    if(e instanceof HTMLTextAreaElement)score+=6;
    if(e.isContentEditable)score+=6;
    if(e===remembered?.element)score+=22;
    if(e===active)score+=12;
    if(e.getAttribute('contenteditable')==='false')return;
    const rect=e.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0)return;
    if(rect.top>innerHeight*0.5)score+=4;
    candidates.push({element:e,score});
  }
  if(mode==='message'||mode==='probe'){
    const selectors=isWhatsapp?
      '#main footer [contenteditable="true"],[data-testid="conversation-compose-box-input"][contenteditable="true"]':
      '[contenteditable="true"],[role="textbox"][contenteditable],textarea,div.ql-editor,div.ProseMirror,'+
      '[data-testid="message-composer"],[data-testid="message-composer"] textarea,[data-testid*="composer"] [contenteditable]';
    document.querySelectorAll(selectors).forEach(e=>offer(e,0));
    offer(remembered?.element,4);
    offer(active,0);
    candidates.sort((a,b)=>b.score-a.score);
    const best=candidates[0];
    if(mode==='probe')return {ok:!!best&&best.score>=7,score:best?.score||0,
      hasComposer:!!best,source:isTallos?'Tallos':isWhatsapp?'WhatsApp':'Outra página'};
    if(!best||best.score<7)return {ok:false,reason:'Não encontrei o campo da mensagem. Abra a conversa e clique em “Digite aqui...”.'};
    active=best.element;
  }else if(!editable(active)&&remembered?.element?.isConnected){active=remembered.element;}
  if(!editable(active)||(mode==='message'&&notComposer(active)))return {ok:false,reason:'Selecione a caixa da conversa, não a pesquisa.'};
  const el=active;
  if(el instanceof HTMLInputElement&&String(name).includes('\n'))return {ok:false,reason:'A caixa selecionada aceita apenas uma linha.'};
  if(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement){
    el.focus();
    const pos=remembered?.element===el?remembered:null;
    const start=pos?.start??el.selectionStart??el.value.length;
    const end=pos?.end??el.selectionEnd??start;
    const next=el.value.slice(0,start)+String(name)+el.value.slice(end);
    const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,next);
    try{el.setSelectionRange(start+String(name).length,start+String(name).length);}catch{}
    el.dispatchEvent(new InputEvent('input',{bubbles:true,data:String(name),inputType:'insertText'}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return {ok:el.value===next,reason:el.value!==next?'O campo não aceitou o texto.':''};
  }
  if(el.isContentEditable){
    el.focus();
    const selection=window.getSelection();
    if(remembered?.element===el&&remembered.range&&el.contains(remembered.range.commonAncestorContainer)){
      selection?.removeAllRanges();selection?.addRange(remembered.range);
    }else if(!selection?.rangeCount||!el.contains(selection.anchorNode)){
      const range=document.createRange();range.selectNodeContents(el);range.collapse(false);
      selection?.removeAllRanges();selection?.addRange(range);
    }
    const before=el.innerText||el.textContent||'';
    const lines=String(name).replace(/\r\n?/g,'\n').split('\n');
    let success=true;
    for(let i=0;i<lines.length;i++){
      if(i>0){
        if(!document.execCommand('insertLineBreak',false,null)&&
          !document.execCommand('insertHTML',false,'<br>')){success=false;break;}
      }
      if(lines[i]&&!document.execCommand('insertText',false,lines[i])){success=false;break;}
    }
    if(!success)return {ok:false,reason:'O editor recusou uma parte da mensagem. Confira o campo antes de tentar novamente.'};
    await new Promise(resolve=>setTimeout(resolve,70));
    const after=el.innerText||el.textContent||'';
    if(before===after)return {ok:false,reason:'O editor não registrou a inserção.'};
    return {ok:true};
  }
  return {ok:false,reason:'Não encontrei um campo de edição compatível.'};
}

// WhatsApp Web utiliza um editor Lexical, não uma textarea comum.
// Enviar um único evento de colagem para o editor nativo preserva parágrafos,
// inclusive linhas vazias. Executar no mundo MAIN para que ClipboardEvent /
// DataTransfer pertençam ao mesmo JavaScript realm dos listeners do WhatsApp.
async function fillWhatsAppMessage(message) {
  const composer=document.querySelector(
    '#main footer [contenteditable="true"][data-lexical-editor="true"],'+
    '#main footer [contenteditable="true"][role="textbox"],'+
    '#main footer [contenteditable="true"][data-tab],'+
    '#main footer [contenteditable="true"],'+
    '[data-testid="conversation-compose-box-input"][contenteditable="true"]'
  );
  if(!composer || !composer.isContentEditable) {
    return {ok:false,reason:'Abra uma conversa do WhatsApp Web e clique na caixa de mensagem.'};
  }
  if(!composer.closest('#main footer') && !composer.matches('[data-testid="conversation-compose-box-input"]')){
    return {ok:false,reason:'Não localizei a caixa de digitação da conversa. A busca não será modificada.'};
  }
  const text=String(message||'').replace(/\r\n?/g,'\n');
  if(!text.trim())return {ok:false,reason:'Não há mensagem para inserir.'};
  const normalize=value=>String(value||'').replace(/\r/g,'').replace(/\u00a0/g,' ').replace(/\u200b/g,'').replace(/[ \t]+(?=\n)/g,'').trim();
  const readEditor=()=>{
    // O Lexical normalmente representa cada linha em um <p> próprio.
    // innerText do contêiner sozinho acrescenta quebras extras entre <p>.
    const pieces=Array.from(composer.childNodes);
    if(!pieces.length)return '';
    return pieces.map(n=>{
      if(n.nodeType===3)return n.nodeValue;
      if(n.nodeType!==1)return '';
      if(n.matches('p,div'))return !n.textContent.trim()&&n.querySelector('br')?'':n.innerText;
      return n.innerText||n.textContent||'';
    }).join('\n');
  };
  const original=readEditor();
  composer.focus();
  const selection=window.getSelection();
  // Preserva o cursor atual quando ele pertence ao editor. Caso o painel
  // tenha retirado o foco, posiciona no fim sem tocar na pesquisa do WhatsApp.
  if(!selection?.rangeCount||!composer.contains(selection.anchorNode)||!composer.contains(selection.focusNode)){
    const range=document.createRange();range.selectNodeContents(composer);range.collapse(false);
    selection?.removeAllRanges();selection?.addRange(range);
  }
  let pasted=false;
  try{
    const data=new DataTransfer();
    data.setData('text/plain',text);
    // WhatsApp usa Shift+Enter para quebra de linha sem envio. Inserir <br>
    // dentro de um único parágrafo gera as mesmas quebras e linhas vazias,
    // sem espaçamento extra de margem entre elementos <p> separados.
    const escape=part=>part.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const html='<p>'+text.split('\n').map(escape).join('<br>')+'</p>';
    data.setData('text/html',html);
    const event=new ClipboardEvent('paste',{bubbles:true,cancelable:true,composed:true,clipboardData:data});
    composer.dispatchEvent(event);
    pasted=event.defaultPrevented;
  }catch{
    return {ok:false,reason:'O WhatsApp bloqueou a colagem automática.'};
  }
  if(!pasted)return {ok:false,reason:'O WhatsApp não aceitou a colagem automática.'};
  // O Lexical concilia seu modelo com o DOM após o evento (assíncrono).
  await new Promise(resolve=>setTimeout(resolve,150));
  const after=readEditor();
  const expected=normalize(text);
  const observed=normalize(after);
  if(observed.includes(expected))return {ok:true};
  // Checagem conservadora: nunca declarar sucesso quando as linhas vazias
  // desapareceram. Evita repetir a mensagem automaticamente por engano.
  return {ok:false,reason:normalize(original)===observed
    ? 'O WhatsApp não inseriu a mensagem.'
    : 'O WhatsApp alterou as quebras de linha. Apague o texto incorreto antes de colar novamente.'};
}

// Todos os templates, o botão PIX e as simulações usam o mesmo caminho.
async function insertConversationMessage(tabId,text,tabUrl){
  const isWhatsapp=(()=>{try{return new URL(tabUrl).hostname==='web.whatsapp.com';}catch{return false;}})();
  if(isWhatsapp){
    const values=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:fillWhatsAppMessage,args:[text]});
    return values?.[0]?.result||{ok:false,reason:'Não foi possível localizar a caixa do WhatsApp.'};
  }
  // A Tallos pode hospedar a conversa dentro de iframe. Primeiro localiza
  // o frame com o editor, depois insere APENAS nele (não em todos os frames).
  let probes=[];
  try{probes=await chrome.scripting.executeScript({target:{tabId,allFrames:true},func:fillActiveField,args:['','probe']});}
  catch{probes=await chrome.scripting.executeScript({target:{tabId},func:fillActiveField,args:['','probe']});}
  const best=probes.filter(v=>v.result?.ok).sort((a,b)=>b.result.score-a.result.score)[0];
  if(!best)return {ok:false,reason:'Não localizei o editor da conversa na Tallos. Clique em “Digite aqui...” e tente novamente.'};
  const result=await chrome.scripting.executeScript({target:{tabId,frameIds:[best.frameId]},func:fillActiveField,args:[text,'message']});
  return result?.[0]?.result||{ok:false,reason:'Não foi possível confirmar a inserção.'};
}
async function copyFormattedFallback(text){
  try{await navigator.clipboard.writeText(text);return true;}catch{}
  // Alternativa para páginas da extensão em que a API assíncrona for negada.
  try{
    const temp=document.createElement('textarea');temp.value=text;
    temp.setAttribute('readonly','');temp.style.position='fixed';temp.style.left='-10000px';
    document.body.append(temp);temp.select();
    const copied=document.execCommand('copy');temp.remove();return copied;
  }catch{return false;}
}
async function insertName(name) {
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id) throw new Error('no-tab');
    if(tab.url&&!/^https?:\/\//i.test(tab.url)) {
      status('O Chrome bloqueia o preenchimento nesta página interna. Abra uma página comum ou o WhatsApp Web.',true);return;
    }
    const results=await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillActiveField,args:[name]});
    const result=results[0]?.result;
    if(result?.ok) status('Nome inserido no campo. A mensagem não foi enviada.');
    else status(result?.reason||'Não foi possível preencher este campo.',true);
  } catch(error) {
    const reason=String(error?.message||'');
    if(/permission|Cannot access contents|host permission/i.test(reason)) {
      status('O acesso a sites está bloqueado no Chrome. Nos detalhes da extensão, permita o acesso em todos os sites e recarregue a página.',true);
    } else if(/Cannot access|extensions gallery|chrome:\/\//i.test(reason)) {
      status('Esta página é protegida pelo Chrome e não permite preenchimento por extensões.',true);
    } else {
      status('Não foi possível preencher. Recarregue a página, selecione o campo de texto e tente novamente.',true);
    }
  }
}
// As abas alternam somente a visualização: a carteira continua carregada e intacta.
function selectArea(area, focusTab=false) {
  const tabs={carteira:'tabCarteira',templates:'tabTemplates',simulacoes:'tabSimulacoes'};
  for(const [key,id] of Object.entries(tabs)){
    const selected=area===key;
    $(id).setAttribute('aria-selected',String(selected));$(id).tabIndex=selected?0:-1;
    $({carteira:'carteiraView',templates:'templatesView',simulacoes:'simulacoesView'}[key]).hidden=!selected;
  }
  $('walletHeader').hidden=area!=='carteira';
  if(focusTab)$(tabs[area]).focus();
  if(area==='templates')globalThis.CarteiraUI?.reveal($('templatesIntro'));
  if(area==='simulacoes')globalThis.SraLuckSimulacoes?.onAreaChange();
  globalThis.SraLuckTemplates?.onAreaChange(area==='templates');
}
$('tabCarteira').addEventListener('click',()=>selectArea('carteira'));
$('tabTemplates').addEventListener('click',()=>selectArea('templates'));
$('tabSimulacoes').addEventListener('click',()=>selectArea('simulacoes'));
document.querySelector('.top-tabs').addEventListener('keydown',event=>{
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();
  const tabs=['carteira','templates','simulacoes'];
  const active=Math.max(0,tabs.findIndex(tab=>document.getElementById({carteira:'tabCarteira',templates:'tabTemplates',simulacoes:'tabSimulacoes'}[tab]).getAttribute('aria-selected')==='true'));
  const next=event.key==='Home'?0:event.key==='End'?2:(active+(event.key==='ArrowRight'?1:2))%3;
  selectArea(tabs[next],true);
});
$('toggleImport').addEventListener('click',()=>{$('importPanel').hidden=!$('importPanel').hidden;$('toggleImport').setAttribute('aria-expanded',String(!$('importPanel').hidden));if(!$('importPanel').hidden)globalThis.CarteiraUI?.reveal($('importPanel'));});
$('report').addEventListener('input',()=>{pending=null;$('importPreview').hidden=true;$('preview').hidden=false;});
$('importBank').addEventListener('change',()=>{pending=null;$('importPreview').hidden=true;$('preview').hidden=false;const selected=Boolean($('importBank').value);$('report').disabled=!selected;$('preview').disabled=!selected;$('report').placeholder=selected?'Cole o relatório do Monest aqui…':'Selecione o banco para colar…';$('importPanel').style.setProperty('--import-bank',banks.find(b=>b.id===$('importBank').value)?.color||'#7e907e');});
$('preview').addEventListener('click',()=>{
  if(!$('importBank').value)return;
  pending={...parseReport($('report').value),bank:$('importBank').value};
  $('importPreview').hidden=false;
  $('previewSummary').textContent=`${pending.clients.length} ${pending.clients.length===1?'cliente':'clientes'} → ${banks.find(b=>b.id===pending.bank).name}`;
  const warnings=[];
  if(pending.rejected.length) warnings.push(`${pending.rejected.length} registros incompletos: ${pending.rejected.join(', ')}.`);
  if(pending.duplicates) warnings.push(`${pending.duplicates} nomes repetidos: apenas a primeira ocorrência foi mantida. Confira antes de importar.`);
  if(!pending.clients.length) warnings.push('Nenhuma cliente reconhecida. Use o formato do exemplo, com cada informação em uma linha.');
  $('previewWarning').textContent=warnings.join(' ');$('confirmImport').disabled=!pending.clients.length||storageFailed;
  $('preview').hidden=pending.clients.length>0;
  $('confirmImport').textContent=pending.clients.length?`Importar ${pending.clients.length} ${pending.clients.length===1?'cliente':'clientes'} ↗`:'Importar lista';
});
$('confirmImport').addEventListener('click',async()=>{
  if(!pending?.clients.length||storageFailed) return;
  const old=state;const bank=pending.bank;state=importBank(state,pending.clients,bank);
  try{await save();pending=null;$('report').value='';$('preview').hidden=false;$('importPreview').hidden=true;$('importPanel').hidden=true;$('toggleImport').setAttribute('aria-expanded','false');$('bankFilter').value='all';render();status('Relatório importado.');}
  catch{state=old;status('A importação não foi salva. Sua lista anterior foi mantida.',true);}
});
$('search').addEventListener('input',render);$('bankFilter').addEventListener('change',render);
$('restore').previousElementSibling.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('restore').click();}});
$('export').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({format:'sra-luck-carteira',version:2,...cleanState(state)},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Sra-Luck-Carteira-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
});
$('restore').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>10*1024*1024)throw new Error();
    const data=JSON.parse(await file.text());
    if(data.format!=='sra-luck-carteira'||![1,2].includes(data.version))throw new Error();
    const restored=cleanState(data);
    if(!confirm(`Restaurar ${data.clients.length} clientes? A lista atual e as marcações de banco serão substituídas.`))return;
    const old=state;state=restored;
    try{await save();storageFailed=false;render();status('Backup restaurado.');}catch{state=old;throw new Error();}
  }catch{status('Não foi possível restaurar. Confira se é um backup válido desta nova versão.',true);}
  finally{event.target.value='';}
});
(async()=>{
  const all=document.createElement('option');all.value='all';all.textContent='Todos os bancos';$('bankFilter').append(all);banks.forEach(b=>$('bankFilter').append(option(b)));
  const choose=document.createElement('option');choose.value='';choose.textContent='Selecione o banco';$('importBank').append(choose);banks.filter(b=>b.id).forEach(b=>$('importBank').append(option(b)));
  try{
    const loaded=await chrome.storage.local.get(['carteira','selectedClient']);
    selectedClient=typeof loaded.selectedClient==='string'?loaded.selectedClient:'';
    const stored=loaded.carteira;
    if(stored){state=cleanState(stored);await save();}
  }catch{storageFailed=true;status('Não foi possível carregar os dados salvos. A importação foi bloqueada para evitar substituí-los. Tente reabrir a extensão.',true);}
  $('importPanel').hidden=true;render();
  try{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(tab?.id)await chrome.scripting.executeScript({target:{tabId:tab.id},files:['target.js']});}catch{}
})();
