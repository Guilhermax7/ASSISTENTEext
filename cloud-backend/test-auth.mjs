import test from 'node:test';
import assert from 'node:assert/strict';
import {equal,authHandler,sessionForRequest,validateCookieApi} from './api/auth.mjs';

function configure(){
 process.env.SRA_LUCK_ADMIN_TOKEN='t'.repeat(48);
 process.env.SRA_LUCK_MASTER_KEY='m'.repeat(48);
}
async function call(method,path,headers={}){
 let status=200,body='',headersOut={};
 const req={method,url:path,headers};
 const res={setHeader(k,v){headersOut[k.toLowerCase()]=v},set statusCode(x){status=x},get statusCode(){return status},end(x){body=String(x||'')}};
 const handled=await authHandler(req,res);
 return {status,body:body?JSON.parse(body):null,headers:headersOut,handled};
}
test('comparação de segredos rejeita chaves diferentes e aceita iguais',()=>{
 assert.equal(equal('abc','abc'),true);
 assert.equal(equal('abc','abcd'),false);
 assert.equal(equal('a'.repeat(48),'b'.repeat(48)),false);
});
test('sem cookie não autentica o usuário',async()=>{
 assert.equal(await sessionForRequest({headers:new Headers()}),null);
 assert.equal(await validateCookieApi(new Request('https://assistenteext-ia.vercel.app/api/state')),false);
});
test('rotas da extensão preservadas',async()=>{
 configure();const r=await call('GET','/api/health');
 assert.equal(r.handled,false);
});
test('rotas de autenticação não configuradas não expõem segredos',async()=>{
 delete process.env.SRA_LUCK_ADMIN_TOKEN;delete process.env.SRA_LUCK_MASTER_KEY;
 const r=await call('GET','/api/auth/status');
 assert.equal(r.status,503);
 assert.equal(r.body.error.code,'CONFIG_ERROR');
});
test('login não aceita requisição de origem externa',async()=>{
 configure();
 const r=await call('POST','/api/auth/login',{origin:'https://evil.example'});
 assert.equal(r.status,403);
});
test('setup não aceita requisição sem origem explícita',async()=>{
 configure();
 const r=await call('POST','/api/auth/setup',{});
 assert.equal(r.status,403);
});
test('consulta de sessão sem cookie retorna não autorizado',async()=>{
 configure();
 const r=await call('GET','/api/auth/session');
 assert.equal(r.status,401);
});
test('a sessão não está acessível sem autenticação no backend',async()=>{
 configure();
 const r=await call('GET','/api/auth/session',{origin:'https://evil.example'});
 assert.equal(r.status,401);
});
