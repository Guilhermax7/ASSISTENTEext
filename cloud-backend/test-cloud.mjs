import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './api/index.mjs';

const origin='chrome-extension://'+'a'.repeat(32);
const token='t'.repeat(48);
const master='m'.repeat(48);
async function call(method,url,headers={},body){
 const req={method,url,headers,...(body===undefined?{}:{body})};
 let payload='',status=200,meta={};
 const res={setHeader(k,v){meta[k.toLowerCase()]=v;},set statusCode(v){status=v;},get statusCode(){return status;},end(v){payload=String(v||'');}};
 await handler(req,res);
 return {status,body:payload?JSON.parse(payload):null,headers:meta};
}
function configure(){process.env.SRA_LUCK_ADMIN_TOKEN=token;process.env.SRA_LUCK_MASTER_KEY=master;process.env.SRA_LUCK_ALLOWED_EXTENSION_ORIGINS=origin;}
test('recusa execução sem segredos técnicos',async()=>{delete process.env.SRA_LUCK_ADMIN_TOKEN;delete process.env.SRA_LUCK_MASTER_KEY;const r=await call('GET','/api/health');assert.equal(r.status,503);assert.equal(r.body.error.code,'SERVER_NOT_CONFIGURED');});
test('recusa token administrativo incorreto',async()=>{configure();const r=await call('GET','/api/health',{authorization:'Bearer wrong'});assert.equal(r.status,401);});
test('retorna health com autenticação',async()=>{configure();const r=await call('GET','/api/health',{authorization:'Bearer '+token});assert.equal(r.status,200);assert.equal(r.body.provider,'freellmapi');});
test('nega origens Chrome não autorizadas',async()=>{configure();const r=await call('GET','/api/health',{authorization:'Bearer '+token,origin:'chrome-extension://'+'b'.repeat(32)});assert.equal(r.status,403);});
test('preflight somente para origem autorizada',async()=>{configure();const r=await call('OPTIONS','/api/generate',{origin,authorization:'Bearer '+token});assert.equal(r.status,204);assert.equal(r.headers['access-control-allow-origin'],origin);});
test('não confunde build com banco configurado',async()=>{configure();delete process.env.DATABASE_URL;delete process.env.POSTGRES_URL;const r=await call('GET','/api/state',{authorization:'Bearer '+token});assert.equal(r.status,500);assert.equal(r.body.error.code,'INTERNAL_ERROR');});

test('permite origem do painel web publicado',async()=>{configure();const r=await call('OPTIONS','/api/state',{origin:'https://assistenteext.vercel.app'});assert.equal(r.status,204);assert.equal(r.headers['access-control-allow-origin'],'https://assistenteext.vercel.app');});
test('bloqueia sites de terceiros mesmo em preflight',async()=>{configure();const r=await call('OPTIONS','/api/state',{origin:'https://exemplo-malicioso.com'});assert.equal(r.status,403);assert.equal(r.headers['access-control-allow-origin'],undefined);});

test('rota de backup exige segredo próprio, sem reutilizar Admin Token',async()=>{
 delete process.env.SRA_LUCK_FREELLMAPI_BACKUP_TOKEN;
 const a=await call('GET','/api/backup');
 assert.equal(a.status,503); assert.equal(a.body.error.code,'BACKUP_NOT_CONFIGURED');
 const b=await call('GET','/api/index?route=backup');
 assert.equal(b.status,503); assert.equal(b.body.error.code,'BACKUP_NOT_CONFIGURED');
});
