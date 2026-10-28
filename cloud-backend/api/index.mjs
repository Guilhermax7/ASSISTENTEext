import crypto from 'node:crypto';
import {handleBackup} from '../lib/freellmapi-backup.mjs';
import {authHandler,validateCookieApi} from './auth.mjs';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {load,save,reserve} from './storage.mjs';
const agents={
 cobranca:'Especialista em cobrança humanizada da Sra. Luck. Seja profissional, natural, direta quando necessário, respeitosa e estratégica. Não invente multas, juros, pagamentos, promoções, descontos, prazos ou aprovações. Evite pressão e constrangimento. Toda proposta financeira exige validação humana. Entregue apenas a resposta.',
 atendimento:'Especialista em atendimento humanizado da Sra. Luck. Seja natural, objetiva e acolhedora quando necessário. Não invente serviços, políticas, ações concluídas ou acordos. Entregue apenas a resposta.'
};
const fresh=()=>({policy:{free_only:true},agents:{cobranca:{primary:'',model:'',fallback:[],allowExternal:false},atendimento:{primary:'',model:'',fallback:[],allowExternal:false}},connections:[]});
const bad=(code,message,status=400,retryable=false)=>Object.assign(new Error(message),{code,status,retryable});
function key(master){return crypto.scryptSync(master,'sra-luck-v1',32)}
function encrypt(plain,master){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key(master),iv),value=Buffer.concat([c.update(plain,'utf8'),c.final()]);return [iv,c.getAuthTag(),value].map(x=>x.toString('base64url')).join('.')}
function decrypt(encoded,master){const [i,t,x]=encoded.split('.'),d=crypto.createDecipheriv('aes-256-gcm',key(master),Buffer.from(i,'base64url'));d.setAuthTag(Buffer.from(t,'base64url'));return Buffer.concat([d.update(Buffer.from(x,'base64url')),d.final()]).toString('utf8')}
function target(value){let u;try{u=new URL(value)}catch{throw bad('INVALID_URL','URL FreeLLMAPI inválida.')}const allow=(process.env.SRA_LUCK_ALLOWED_EXTERNAL_HOSTS||'').toLowerCase().split(',').map(x=>x.trim());if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search||!['/','/v1','/v1/'].includes(u.pathname)||isIP(u.hostname)||u.hostname==='localhost')throw bad('INVALID_URL','A Vercel exige URL HTTPS remota do FreeLLMAPI terminando em /v1.');if(!allow.includes(u.hostname.toLowerCase()))throw bad('HOST_NOT_ALLOWED','Host não autorizado pelo administrador.',403);u.pathname='/v1';return u}
function external(ip){if(isIP(ip)===4){const x=ip.split('.').map(Number);return !(x[0]===0||x[0]===10||x[0]===127||x[0]>=224||x[0]===169&&x[1]===254||x[0]===172&&x[1]>=16&&x[1]<=31||x[0]===192&&x[1]===168||x[0]===100&&x[1]>=64&&x[1]<=127)}if(isIP(ip)===6){const s=ip.toLowerCase();return !(s==='::'||s==='::1'||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('fe8')||s.startsWith('fe9')||s.startsWith('fea')||s.startsWith('feb')||s.startsWith('::ffff:'))}return false}
async function proxy(conn,operation,master,body){
 const u=target(conn.base_url);u.pathname='/v1/'+operation;if(operation==='models')u.searchParams.set('execution_status','ready');
 const ips=await lookup(u.hostname,{all:true,verbatim:true});if(!ips.length||ips.some(x=>!external(x.address)))throw bad('SSRF_BLOCK','Destino remoto recusado.',403);
 const content=body?JSON.stringify(body):null;if(content&&Buffer.byteLength(content)>48000)throw bad('REQUEST_TOO_LARGE','Contexto excedeu o limite.',413);
 return await new Promise((resolve,reject)=>{
 const req=https.request(u,{method:content?'POST':'GET',timeout:25000,lookup:(_h,_o,cb)=>cb(null,ips[0].address,ips[0].family),headers:{Authorization:'Bearer '+decrypt(conn.secret,master),Accept:'application/json',...(content?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(content)}:{})}},res=>{
  const chunks=[];let size=0;res.on('data',v=>{size+=v.length;if(size>1048576)req.destroy(new Error('Limite excedido'));else chunks.push(v)});
  res.on('end',()=>{let data={};try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{}resolve({status:res.statusCode||500,data})});
 });
 req.on('timeout',()=>req.destroy(new Error('timeout')));
 req.on('error',()=>reject(bad('PROVIDER_OFFLINE','FreeLLMAPI indisponível.',502,true)));
 if(content)req.write(content);req.end();
 });
}
function outgoing(state){return {policy:state.policy,agents:state.agents,connections:state.connections.map(({secret,...c})=>({...c,has_key:!!secret})),logs:[]}}
function strip(text){return String(text).replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,'[CPF]').replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g,'[CNPJ]').replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi,'[EMAIL]').replace(/(?:\+55\s?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}\b/g,'[TELEFONE]')}
function response(data,status=200,origin=''){const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(origin){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin';headers['Access-Control-Allow-Headers']='Authorization,Content-Type';headers['Access-Control-Allow-Methods']='GET,POST,PUT,DELETE,OPTIONS'}return new Response(status===204?null:JSON.stringify(data),{status,headers})}
async function handleWeb(req){
 const incoming=req.headers.get('origin')||'',ext=(process.env.SRA_LUCK_ALLOWED_EXTENSION_ORIGINS||'').split(',').map(x=>x.trim()).filter(x=>/^chrome-extension:\/\/[a-p]{32}$/.test(x)),web=['https://assistenteext.vercel.app','https://assistenteext-ia.vercel.app',...(process.env.SRA_LUCK_ALLOWED_WEB_ORIGINS||'').split(',')].map(x=>x.trim()).filter(x=>/^https:\/\/[a-z0-9.-]+(?::443)?$/.test(x)),origin=[...ext,...web].includes(incoming)?incoming:'';
 try{
 if(incoming&&!origin)throw bad('ORIGIN_DENIED','Origem não autorizada.',403);
 if(req.method==='OPTIONS')return response(null,204,origin);
 const master=process.env.SRA_LUCK_MASTER_KEY||'',admin=process.env.SRA_LUCK_ADMIN_TOKEN||'';if(master.length<32||admin.length<32)throw bad('SERVER_NOT_CONFIGURED','Faltam segredos técnicos do backend.',503);
 const supplied=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,''),a=Buffer.from(supplied),b=Buffer.from(admin);
 const validBearer=a.length===b.length&&crypto.timingSafeEqual(a,b);
 if(!validBearer && !(await validateCookieApi(req)))throw bad('UNAUTHORIZED','Sua sessão expirou. Entre novamente.',401);
 const parsed=new URL(req.url),route=parsed.searchParams.get('route'),path=route?'/api/'+route.replace(/^\/+/, ''):parsed.pathname;
 if(req.method==='GET'&&path==='/api/health')return response({ok:true,version:'1.4.3',provider:'freellmapi'},200,origin);
 const record=await load(),state=record.data||fresh();let version=record.version;
 async function persist(){version=await save(state,version)}
 async function read(){const x=await req.text();if(Buffer.byteLength(x)>65536)throw bad('REQUEST_TOO_LARGE','Solicitação acima de 64 KB.',413);try{return JSON.parse(x)}catch{throw bad('INVALID_JSON','JSON inválido.')}}
 if(req.method==='GET'&&path==='/api/state')return response(outgoing(state),200,origin);
 if(req.method==='POST'&&path==='/api/connections'){
 const body=await read();if(body.type!=='freellmapi')throw bad('INVALID_PROVIDER','Somente FreeLLMAPI é aceito.');
 let item=body.id?state.connections.find(x=>x.id===body.id):null;if(body.id&&!item)throw bad('NOT_FOUND','Conexão não encontrada.',404);
 if(!item&&state.connections.length)throw bad('ONE_PROVIDER','A Central aceita somente uma conexão FreeLLMAPI.');
 const address=target(body.base_url||item?.base_url||'').toString().replace(/\/$/,'');
 const newItem={...item,id:item?.id||crypto.randomUUID(),name:String(body.name||'FreeLLMAPI').slice(0,70),type:'freellmapi',base_url:address,enabled:body.enabled!==false,models:item?.models||[]};
 if(item&&item.base_url!==address)newItem.secret='';
 if(body.api_key!==undefined){const k=String(body.api_key);if(!k||k.length>1000||/[\r\n]/.test(k))throw bad('INVALID_KEY','Chave unificada inválida.');newItem.secret=encrypt(k,master)}
 if(!newItem.secret)throw bad('INVALID_KEY','Informe a chave unificada do FreeLLMAPI.');
 if(item)Object.assign(item,newItem);else state.connections.push(newItem);await persist();return response({ok:true,id:newItem.id},200,origin);
 }
 const match=path.match(/^\/api\/connections\/([\w-]+)(?:\/(discover|test))?$/);
 if(match){const item=state.connections.find(x=>x.id===match[1]);if(!item)throw bad('NOT_FOUND','Conexão não encontrada.',404);
  if(req.method==='DELETE'&&!match[2]){state.connections=[];for(const a of Object.values(state.agents)){a.primary='';a.model='';a.fallback=[]}await persist();return response({ok:true},200,origin)}
  if(req.method==='POST'&&match[2]){if(!item.enabled)throw bad('DISABLED','Conexão desativada.');const start=Date.now(),r=await proxy(item,'models',master);if(r.status>=400)throw bad(r.status===401?'INVALID_KEY':'PROVIDER_ERROR','Descoberta FreeLLMAPI: HTTP '+r.status,502,[429,503].includes(r.status));
   const models=Array.isArray(r.data?.data)?r.data.data:[];item.models=models.filter(x=>typeof x.id==='string').map(x=>({id:x.id,status:x.execution_status||x.status||'unknown'}));item.last_check=new Date().toISOString();item.last_latency_ms=Date.now()-start;await persist();return response({ok:true,models:item.models,latency_ms:item.last_latency_ms},200,origin)}
 }
 if(req.method==='PUT'&&path==='/api/settings'){const b=await read();if(typeof b.free_only==='boolean')state.policy.free_only=b.free_only;for(const name of Object.keys(agents)){if(b.agents?.[name]){const x=b.agents[name];if(x.primary&&!state.connections.some(c=>c.id===x.primary))throw bad('INVALID_ROUTE','Conexão inexistente.');state.agents[name]={primary:x.primary||'',model:String(x.model||'').slice(0,160),allowExternal:x.allowExternal===true,fallback:[]}}}await persist();return response(outgoing(state),200,origin)}
 if(req.method==='POST'&&path==='/api/generate'){
 const b=await read();if(!Object.hasOwn(agents,b.agent))throw bad('INVALID_AGENT','Agente inválido.');
 if(b.context_authorized!==true)throw bad('CONSENT_REQUIRED','Autorize o envio do contexto.',403);
 if(state.policy.free_only)throw bad('FREE_ONLY_BLOCK','FreeLLMAPI remoto não teve gratuidade comprovada. Verifique custos antes de autorizar.',403);
 const config=state.agents[b.agent];if(!config.allowExternal)throw bad('EXTERNAL_NOT_AUTHORIZED','Autorize o envio externo neste agente.',403);
 const item=state.connections.find(x=>x.enabled&&x.id===config.primary);if(!item||!config.model)throw bad('NOT_CONFIGURED','Configure conexão e modelo.');
 if(!Array.isArray(b.messages)||!b.messages.length||b.messages.length>30)throw bad('INVALID_MESSAGES','Forneça entre 1 e 30 mensagens.');
 const content=b.messages.map(x=>({role:x.role==='assistant'?'assistant':'user',content:strip(String(x.content||'').slice(0,12000))}));if(content.some(x=>!x.content.trim()))throw bad('INVALID_MESSAGES','Mensagem vazia.');
 if(b.request_id){if(typeof b.request_id!=='string'||!/^[\w-]{16,90}$/.test(b.request_id))throw bad('INVALID_ID','Identificador inválido.');if(!await reserve(b.request_id))throw bad('DUPLICATE_REQUEST','Solicitação repetida.',409)}
 const instruction=b.task==='template'?' Organize um template reutilizável. Responda somente JSON válido com title e body, sem inventar condições.':'';
 const started=Date.now(),r=await proxy(item,'chat/completions',master,{model:config.model,messages:[{role:'system',content:agents[b.agent]+instruction},...content],stream:false,max_tokens:Math.min(1600,Math.max(100,Number(b.max_tokens)||800)),temperature:Math.max(0,Math.min(1,Number(b.temperature)||0.5))});
 if(r.status>=400)throw bad(r.status===429?'RATE_LIMIT':'PROVIDER_ERROR','FreeLLMAPI respondeu HTTP '+r.status,r.status,[429,503].includes(r.status));
 const text=r.data?.choices?.[0]?.message?.content;if(typeof text!=='string'||!text.trim())throw bad('EMPTY_RESPONSE','Modelo não retornou texto.',502);
 return response({text:text.trim(),provider:item.id,model:r.data.model||config.model,latency_ms:Date.now()-started,usage:{input_tokens:r.data.usage?.prompt_tokens??null,output_tokens:r.data.usage?.completion_tokens??null}},200,origin);
 }
 throw bad('NOT_FOUND','Rota não encontrada.',404);
 }catch(e){return response({error:{code:e.code||'INTERNAL_ERROR',message:e.code?e.message:'Falha interna da Central.',retryable:!!e.retryable}},e.status||500,origin)}
}

// Vercel Node.js chama (IncomingMessage, ServerResponse), não Request/Response.
export default async function handler(req,res){
 try{
  const requestedPath=new URL(req.url,'https://central.invalid');
  if(requestedPath.pathname==='/api/backup' || requestedPath.searchParams.get('route')==='backup') return await handleBackup(req,res);
  if(await authHandler(req,res))return;
  let body;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
   if(req.body!==undefined)body=typeof req.body==='string'?req.body:JSON.stringify(req.body);
   else{const chunks=[];for await(const c of req)chunks.push(c);body=Buffer.concat(chunks);}
  }
  const web=new Request('https://central.invalid'+req.url,{method:req.method,headers:req.headers,...(body!==undefined?{body}:{})});
  const result=await handleWeb(web);
  res.statusCode=result.status;
  for(const [key,value] of result.headers)res.setHeader(key,value);
  res.end(result.status===204?'':await result.text());
 }catch(error){res.statusCode=500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:{code:'INTERNAL_ERROR',message:'Falha interna da Central.'}}));}
}
