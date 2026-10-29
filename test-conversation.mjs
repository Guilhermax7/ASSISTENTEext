import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const reader=readFileSync(new URL('./conversation-reader.js',import.meta.url),'utf8');
const assistant=readFileSync(new URL('./ai-assistant.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('./templates.js',import.meta.url),'utf8');

function element({text='',classes=[],rect={left:0,right:500,width:500,height:80,top:200,bottom:280},attrs={},children=[]}={}){
  const set=new Set(classes);
  return {
    isConnected:true,innerText:text,textContent:text,parentElement:null,
    classList:{contains:x=>set.has(x)},
    getAttribute(name){return name==='class'?classes.join(' '):attrs[name]||null},
    closest(selector){if(selector==='.message-in,.message-out'&&(set.has('message-in')||set.has('message-out')))return this;return null},
    getBoundingClientRect(){return rect},
    querySelectorAll(selector){
      if(selector==='*')return children;
      if(selector.includes('msg-text')&&children.length)return children;
      if(selector.includes('message-item')&&children.length)return children;
      return [];
    },
    querySelector(){return null},
    contains(other){return this===other||children.includes(other)}
  };
}
const style=()=>({display:'block',visibility:'visible'});
function runWA(){
  const makeMsg=(role,text)=>{
    const content=element({text}),node=element({classes:[role],children:[content]});
    content.parentElement=node;return node;
  };
  const nodes=[makeMsg('message-in','Oi, quero o boleto.'),makeMsg('message-out','Posso encaminhar por aqui.'),makeMsg('message-in','Pode, obrigada.')];
  const main={querySelectorAll:s=>s==='.message-in,.message-out'?nodes:[]};
  return vm.runInNewContext(reader,{location:{hostname:'web.whatsapp.com'},document:{querySelector:s=>s==='#main'?main:null},getComputedStyle:style});
}
function runTallos(ambiguous=false,unknownFirst=false){
  const rootRect={left:400,right:1000,width:600,height:630,top:100,bottom:730};
  const bubble=(classes,text,rect)=>element({classes,text,rect});
  const nodes=[
    bubble(unknownFirst?['message-item']:['message-item','incoming'],'Quero pagar o boleto.',unknownFirst?{left:420,right:910,width:490,height:55,top:340,bottom:395}:{left:420,right:660,width:240,height:55,top:340,bottom:395}),
    bubble(['message-item','outgoing'],'Vou consultar o boleto.',{left:740,right:980,width:240,height:55,top:425,bottom:480}),
    bubble(ambiguous?['message-item']:['message-item','incoming'],'Pode enviar hoje?',{left:420,right:ambiguous?910:650,width:ambiguous?490:230,height:55,top:520,bottom:575})
  ];
  const root=element({rect:rootRect,classes:['messages-list'],children:nodes});
  nodes.forEach(n=>n.parentElement=root);
  const composer=element({rect:{left:420,right:970,width:550,height:35,top:735,bottom:770}});
  const doc={
    body:{},
    querySelector:s=>s.includes('contenteditable')?composer:null,
    querySelectorAll:s=>s==='[class*="messages-list"]'?[root]:[]
  };
  return vm.runInNewContext(reader,{location:{hostname:'app.tallos.com.br'},document:doc,getComputedStyle:style});
}
function runTallosLayout(){
  const r={left:400,right:1000,width:600,height:630,top:100,bottom:730};
  const full={left:410,right:990,width:580,height:60,top:320,bottom:380};
  const nodes=[
    element({classes:['message-item','flex','justify-start'],text:'Preciso de um boleto.',rect:full}),
    element({classes:['message-item','flex','justify-end'],text:'Vou verificar.',rect:full}),
    element({classes:['message-item','flex','justify-start'],text:'Você consegue enviar?',rect:full})
  ];
  const root=element({rect:r,classes:['messages-list'],children:nodes});
  nodes.forEach(n=>n.parentElement=root);
  const composer=element({rect:{left:420,right:970,width:550,height:35,top:735,bottom:770}});
  return vm.runInNewContext(reader,{
    location:{hostname:'app.tallos.com.br'},
    document:{body:{},querySelector:sel=>sel.includes('contenteditable')?composer:null,querySelectorAll:sel=>sel==='[class*="messages-list"]'?[root]:[]},
    getComputedStyle:style
  });
}

test('Tallos: com duas conversas abertas seleciona o editor focado, nunca o primeiro',()=>{
  const leftRoot=element({classes:['messages-list'],rect:{left:40,right:530,width:490,height:380,top:100,bottom:480}});
  const rightRoot=element({classes:['messages-list'],rect:{left:650,right:1180,width:530,height:380,top:100,bottom:480}});
  const leftMsg=element({classes:['message-item','incoming'],text:'Mensagem errada de outro chat.',rect:{left:75,right:300,width:225,height:50,top:210,bottom:260}});
  const rightMsg=element({classes:['message-item','incoming'],text:'Cliente certa pediu segunda via.',rect:{left:690,right:930,width:240,height:50,top:210,bottom:260}});
  const rightMsg2=element({classes:['message-item','outgoing'],text:'A equipe vai verificar.',rect:{left:880,right:1140,width:260,height:50,top:275,bottom:325}});
  leftRoot.querySelectorAll=s=>s.includes('message-item')?[leftMsg]:[];
  rightRoot.querySelectorAll=s=>s.includes('message-item')?[rightMsg,rightMsg2]:[];
  leftMsg.parentElement=leftRoot;rightMsg.parentElement=rightRoot;rightMsg2.parentElement=rightRoot;
  const firstEditor=element({rect:{left:60,right:500,width:440,height:45,top:510,bottom:555}});
  const activeEditor=element({rect:{left:680,right:1150,width:470,height:45,top:510,bottom:555}});
  // O editor correto está dentro do rodapé da conversa (layout realista da Tallos).
  activeEditor.closest=selector=>selector.includes('footer')?{tagName:'FOOTER'}:null;
  const doc={
    body:{},activeElement:activeEditor,
    querySelector:sel=>sel.includes('contenteditable')?firstEditor:null,
    querySelectorAll:sel=>sel.includes('contenteditable')?[firstEditor,activeEditor]:
      sel==='[class*="messages-list"]'?[leftRoot,rightRoot]:[]
  };
  const out=vm.runInNewContext(reader,{location:{hostname:'app.tallos.com.br'},document:doc,getComputedStyle:style});
  assert.equal(out.reliable,true,JSON.stringify(out));
  assert.equal(out.messages.length,2);
  assert.match(out.messages[0].text,/Cliente certa/);
  assert.doesNotMatch(out.messages[0].text,/outro chat/);
});
test('Seleção do editor Tallos mantém marcação local sem armazenar conteúdo de mensagens',()=>{
  const target=readFileSync(new URL('./target.js',import.meta.url),'utf8');
  assert.match(target,/data-sra-luck-last-composer/);
  assert.match(reader,/data-sra-luck-last-composer/);
  assert.match(reader,/textBlock\|\|node/);
});
test('WhatsApp: distingue mensagens da cliente e da equipe e preserva ordem',()=>{
  const out=runWA();
  assert.equal(out.ok,true);
  assert.equal(out.reliable,true);
  assert.deepEqual(Array.from(out.messages,x=>x.role),['Cliente','Equipe','Cliente']);
  assert.match(out.messages[2].text,/obrigada/);
});
test('Tallos: usa metadados de direção para identificar autor',()=>{
  const out=runTallos();
  assert.equal(out.reliable,true);
  assert.deepEqual(Array.from(out.messages,x=>x.role),['Cliente','Equipe','Cliente']);
});
test('Tallos: autoria incerta bloqueia geração automática em vez de inventar remetente',()=>{
  const out=runTallos(true);
  assert.equal(out.reliable,false);
  assert.equal(out.unknownRecent,1);
  assert.equal(out.messages[2].role,'Mensagem');
  assert.match(out.reason,/Confirme Cliente/);
});
test('Tallos: mensagem antiga incerta não impede resposta às duas mensagens seguintes',()=>{
  const out=runTallos(false,true);
  assert.equal(out.reliable,true);
  assert.equal(out.skippedCount,1);
  assert.equal(out.unknownRecent,1);
  assert.deepEqual(Array.from(out.messages,x=>x.role),['Equipe','Cliente']);
  assert.match(out.messages.at(-1).text,/Pode enviar hoje/);
});
test('Tallos: classes flex do chat detectam remetentes com linhas de largura total',()=>{
  const out=runTallosLayout();
  assert.equal(out.reliable,true);
  assert.deepEqual(Array.from(out.messages,x=>x.role),['Cliente','Equipe','Cliente']);
  assert.equal(out.unknownRecent,0);
});
test('Tallos: mensagem final sem classe/direção permanece bloqueada',()=>{
  const out=runTallos(true);
  assert.equal(out.reliable,false);
  assert.equal(out.messages.at(-1).role,'Mensagem');
});
test('Tallos: se nenhuma mensagem tem direção, não deve adivinhar autoria',()=>{
  const out=runTallos(true,true);
  assert.equal(out.reliable,false);
});
const block=assistant.slice(assistant.indexOf('  function parseConversation('),assistant.indexOf('  async function currentTab()'));
function logic(mode='cobranca'){
  const sandbox={
    normalizeContext:v=>String(v||'').trim().slice(-14000),
    field:(_root,name)=>({value:name==='length'?'curto':name==='tone'?'objetivo':''}),
    templateLibrary:[
      {id:'parcela-em-aberto',category:'cobranca',title:'Boleto e mensalidade',body:'Posso verificar o boleto da sua mensalidade e informar como obter o documento.'},
      {id:'atendimento-voucher',category:'atendimento',title:'Consulta e voucher',body:'Posso orientar como funciona a consulta com voucher.'}
    ],Date
  };
  vm.runInNewContext(block+';this.functions={parseConversation,prompt,matchingTemplates}',sandbox);
  return sandbox.functions;
}
test('Histórico sem papéis ou contendo Mensagem: exige revisão',()=>{
  const {parseConversation}=logic();
  assert.throws(()=>parseConversation('Cliente: Oi\n\nMensagem: Tudo certo?'),/Não consegui identificar a autoria/);
  assert.throws(()=>parseConversation('Oi, tudo bem?'),/formato/);
  assert.throws(()=>parseConversation('Equipe: Olá!'),/nenhuma fala da cliente/);
});
test('Prompt de Cobrança foca na última cliente e usa somente templates de Cobrança',()=>{
  const {prompt}=logic();
  const p=prompt('cobranca','', 'Cliente: Preciso do boleto.\n\nEquipe: Posso enviar PIX?\n\nCliente: Quero o boleto mesmo, por favor.',{});
  assert.match(p,/Última mensagem da CLIENTE: Quero o boleto mesmo/);
  assert.match(p,/Última resposta da EQUIPE: Posso enviar PIX/);
  assert.match(p,/COBRANÇA/);
  assert.match(p,/1 ou 2 frases curtas/);
  assert.match(p,/Boleto e mensalidade/);
  assert.doesNotMatch(p,/Consulta e voucher:/);
});
test('Prompt de Atendimento usa apenas seus templates e proíbe inserir cobrança',()=>{
  const {prompt}=logic();
  const p=prompt('atendimento','', 'Cliente: Tenho uma dúvida sobre voucher e consulta.\n\nEquipe: Como posso ajudar?',{});
  assert.match(p,/ATENDIMENTO/);
  assert.match(p,/Não introduza cobrança/);
  assert.match(p,/Consulta e voucher/);
  assert.doesNotMatch(p,/Boleto e mensalidade:/);
});
test('UI orienta revisão do remetente e usa respostas curtas por padrão',()=>{
  assert.match(ui,/identifica automaticamente/);
  assert.match(ui,/<option value="curto" selected>/);
});

test('Painel permite identificar última mensagem sem reescrever histórico',()=>{
  assert.match(ui,/data-ai-speaker-review/);
  assert.match(ui,/Foi a cliente/);
  assert.match(ui,/Foi a equipe/);
  assert.match(assistant,/async function confirmSpeaker\(/);
  assert.match(assistant,/function safeConfirmedSuffix\(/);
  assert.match(assistant,/speaker-confirm/);
  assert.match(assistant,/showSpeakerReview\(root\)/);
});
test('Confirmação não pressupõe que uma mensagem desconhecida seja da cliente',()=>{
  assert.match(assistant,/list\[index\]\.role!=='Mensagem'/);
  assert.match(assistant,/\['Equipe','Cliente'\]\.includes\(role\)/);
  assert.match(assistant,/if\(last\?\.role==='Cliente'&&\!insufficient\)/);
  assert.match(assistant,/context\.pendingMessages=null/);
});
