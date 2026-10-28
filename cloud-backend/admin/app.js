'use strict';
const $=id=>document.getElementById(id);
let csrf='',state=null;
const message=m=>{$('message').textContent=m;};
function option(select,val,text){const el=document.createElement('option');el.value=val;el.textContent=text;select.add(el);}
async function jsonRequest(route,method='GET',body,headers={}){
 const r=await fetch(route,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 let data;try{data=await r.json()}catch{throw Error('Servidor indisponível ou resposta inválida.');}
 if(!r.ok)throw Error(data?.error?.message||'Erro HTTP '+r.status);
 return data;
}
async function api(route,method='GET',body){
 if(!csrf)throw Error('Sua sessão não está ativa. Entre novamente.');
 try{
  return await jsonRequest(route,method,body,!['GET','HEAD'].includes(method)?{'X-Sra-CSRF':csrf}:{});
 }catch(e){
  if(e.message.includes('Sua sessão expirou'))showLogin();
  throw e;
 }
}
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
async function refresh(){state=await api('/api/state');$('workspace').hidden=false;$('connectionCount').textContent=`${state.connections.length} cadastradas`;
 $('freeOnly').checked=state.policy.free_only;renderConnections();renderAgents();renderLogs();}
function renderConnections(){const wrap=$('connections');wrap.replaceChildren();if(!state.connections.length)wrap.append(node('p','hint','Nenhuma conexão cadastrada. Adicione sua conexão FreeLLMAPI.'));
 for(const c of state.connections){const box=node('div','conn'+(!c.enabled?' off':'')),head=node('div','heading'),label=node('strong','',`${c.name} ${c.enabled?'●':'○'}`),controls=node('div','tools');head.append(label);box.append(head,node('small','',`${c.type} · ${c.base_url} · chave ${c.has_key?'configurada':'não configurada'}`));
 if(c.last_check)box.append(node('small','',`Consulta: ${new Date(c.last_check).toLocaleString('pt-BR')} · ${c.last_latency_ms??'?'} ms`));
 const buttons=[['↻ Detectar modelos',async()=>{message('Consultando modelos do FreeLLMAPI. Se a Render estiver hibernando, a primeira consulta pode demorar até um minuto.');const r=await api(`/api/connections/${c.id}/discover`,'POST');message(`${r.models.length} modelos retornados pela API de ${c.name}.`);await refresh();}],['Testar',async()=>{message('Testando conexão com a Render. Aguarde a inicialização do servidor, caso esteja hibernando.');const r=await api(`/api/connections/${c.id}/test`,'POST');message(`${c.name}: conexão validada · ${r.latency_ms} ms.`);await refresh();}],['Editar',async()=>{ $('connId').value=c.id;$('connName').value=c.name;$('connType').value=c.type;$('connUrl').value=c.base_url;$('connKey').value='';$('connEnabled').checked=c.enabled;window.scrollTo({top:250,behavior:'smooth'});message('Edite os campos e salve; deixe a chave vazia para preservá-la.');}],['Excluir',async()=>{if(!confirm(`Excluir a conexão ${c.name}?`))return;await api(`/api/connections/${c.id}`,'DELETE');await refresh();}]];
 for(const [label,fn]of buttons){const b=node('button','',label);b.addEventListener('click',()=>fn().catch(e=>message(e.message)));controls.append(b);}box.append(controls);
 const list=node('div','models');for(const m of c.models||[])list.append(node('span','model '+m.status,`${m.id} · ${m.status}`));if(list.childNodes.length)box.append(list);wrap.append(box);
 }}
function fillModelOptions(select,id,selected){select.replaceChildren();option(select,'','Selecione um modelo');const c=state.connections.find(c=>c.id===id);for(const m of c?.models||[])option(select,m.id,`${m.id} (${m.status})`);
 for(const id of ['auto','auto:fast','auto:smart','auto:reliable'])if(![...select.options].some(o=>o.value===id))option(select,id,id+' (estratégia: confirmar disponibilidade)');
 option(select,'__manual__','Outro modelo (manual via identificador)');if(selected&&[...select.options].some(o=>o.value===selected))select.value=selected;
 else if(selected){option(select,selected,selected+' (não consultado)');select.value=selected;}
}
function renderAgents(){for(const name of ['cobranca','atendimento']){const root=document.querySelector(`[data-agent="${name}"]`),a=state.agents[name];
 const p=root.querySelector('[data-field="primary"]'),f=root.querySelector('[data-field="fallback"]'),m=root.querySelector('[data-field="model"]'),fm=root.querySelector('[data-field="fallbackModel"]');p.replaceChildren();f.replaceChildren();option(p,'','Selecione conexão');option(f,'','Sem fallback');
 for(const c of state.connections){option(p,c.id,c.name+(c.enabled?'':' (inativa)'));option(f,c.id,c.name+(c.enabled?'':' (inativa)'));}
 p.value=a.primary||'';f.value=a.fallback?.[0]?.id||'';
 fillModelOptions(m,p.value,a.model);fillModelOptions(fm,f.value,a.fallback?.[0]?.model);
 root.querySelector('[data-field="external"]').checked=a.allowExternal===true;
 p.onchange=()=>fillModelOptions(m,p.value,'');f.onchange=()=>fillModelOptions(fm,f.value,'');
 }}
function readModel(root,name){const value=root.querySelector(`[data-field="${name}"]`).value;return value==='__manual__'?prompt('Digite o identificador exato do modelo na API:','')?.trim()||'':value;}
function renderLogs(){const logs=$('logs');logs.replaceChildren();if(!state.logs.length)logs.append(node('p','hint','Nenhuma execução registrada nesta sessão do serviço.'));
 for(const e of state.logs)logs.append(node('div','log',`${new Date(e.at).toLocaleTimeString('pt-BR')} · ${e.type} · ${e.agent||''} · ${e.provider||''} · ${e.model||''} · ${e.code||''} ${e.usage?.input_tokens!=null?'· '+e.usage.input_tokens+' entrada / '+e.usage.output_tokens+' saída':''}`));
}
function showLogin(){
 csrf='';state=null;$('workspace').hidden=true;$('signedInBar').hidden=true;$('authScreen').hidden=false;
 $('authLoading').hidden=true;$('loginForm').hidden=false;$('setupForm').hidden=true;
}
function showSetup(){
 csrf='';state=null;$('workspace').hidden=true;$('signedInBar').hidden=true;$('authScreen').hidden=false;
 $('authLoading').hidden=true;$('loginForm').hidden=true;$('setupForm').hidden=false;
}
function showError(text){
 $('authError').textContent=text;$('authError').hidden=!text;
}
async function showDashboard(result){
 csrf=result.csrf;
 $('userEmail').textContent=result.email||'Administrador';
 $('authScreen').hidden=true;$('signedInBar').hidden=false;
 showError('');
 await refresh();
 message('Acesso à Central autorizado. Sua sessão está protegida neste navegador.');
}
$('loginForm').onsubmit=async e=>{
 e.preventDefault();const b=$('loginForm').querySelector('button[type=submit]');b.disabled=true;showError('');
 try{
  const result=await jsonRequest('/api/auth/login','POST',{email:$('loginEmail').value.trim(),password:$('loginPassword').value,remember:$('loginRemember').checked});
  $('loginPassword').value='';await showDashboard(result);
 }catch(err){showError(err.message);}finally{b.disabled=false;}
};
$('setupForm').onsubmit=async e=>{
 e.preventDefault();if($('setupPassword').value!==$('setupConfirm').value)return showError('As senhas digitadas não coincidem.');
 const b=$('setupForm').querySelector('button[type=submit]');b.disabled=true;showError('');
 try{
  const result=await jsonRequest('/api/auth/setup','POST',{email:$('setupEmail').value.trim(),password:$('setupPassword').value,adminToken:$('setupToken').value});
  $('setupPassword').value='';$('setupConfirm').value='';$('setupToken').value='';
  await showDashboard(result);
 }catch(err){showError(err.message);}finally{b.disabled=false;}
};
$('logout').onclick=async()=>{
 try{await jsonRequest('/api/auth/logout','POST',{}, {'X-Sra-CSRF':csrf});}catch(e){message(e.message);}
 showLogin();message('Sessão encerrada neste navegador.');
};
$('connType').onchange=()=>{$('connUrl').value='https://sra-luck-freellmapi.onrender.com/v1';};
$('connClear').onclick=()=>{$('connectionForm').reset();$('connId').value='';$('connType').onchange();};
$('connectionForm').onsubmit=async e=>{e.preventDefault();const data={id:$('connId').value||undefined,name:$('connName').value.trim(),type:$('connType').value,base_url:$('connUrl').value.trim(),enabled:$('connEnabled').checked};if($('connKey').value)data.api_key=$('connKey').value;
 try{await api('/api/connections','POST',data);$('connKey').value='';$('connId').value='';message('Conexão salva. Use Detectar modelos para verificar a disponibilidade.');await refresh();}catch(e){message(e.message);}};
$('savePolicy').onclick=async()=>{try{const agents={};for(const name of ['cobranca','atendimento']){const root=document.querySelector(`[data-agent="${name}"]`),primary=root.querySelector('[data-field="primary"]').value,fallback=root.querySelector('[data-field="fallback"]').value;
 const model=readModel(root,'model');
 agents[name]={primary,model,allowExternal:root.querySelector('[data-field="external"]').checked,fallback:[]};}
 state=await api('/api/settings','PUT',{free_only:$('freeOnly').checked,agents});message('Política e modelos salvos.');await refresh();}catch(e){message(e.message);}};
$('testRun').onclick=async()=>{if(!$('testConsent').checked){message('Confirme o consentimento para enviar a mensagem fictícia.');return;}const out=$('testOutput');out.textContent='Executando teste autorizado…';try{const d=await api('/api/generate','POST',{agent:$('testAgent').value,task:'reply',context_authorized:true,messages:[{role:'user',content:$('testMessage').value}],max_tokens:300});out.textContent=`Provedor: ${d.provider}\nModelo: ${d.model}\nLatência: ${d.latency_ms} ms\n\n${d.text}`;await refresh();}catch(e){out.textContent='Erro: '+e.message;message(e.message);}};
$('refresh').onclick=()=>refresh().catch(e=>message(e.message));
(async()=>{
 try{
  const session=await jsonRequest('/api/auth/session');
  await showDashboard(session);
 }catch(err){
  try{const status=await jsonRequest('/api/auth/status');if(status.configured)showLogin();else showSetup();}
  catch(e){$('authLoading').textContent='Não foi possível verificar seu login. '+e.message;showError('Confira a configuração do backend ou tente atualizar a página.');}
 }
})();
