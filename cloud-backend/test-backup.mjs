import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackupHandler} from './lib/freellmapi-backup.mjs';
import {readFileSync} from 'node:fs';

const good='a'.repeat(48);
const stored={last:null,async read(){return this.last},async write(b){this.last=Buffer.from(b)}};
const handler=createBackupHandler(stored,()=>good);

async function request(method,token=good,body,headers={}){
 let output=Buffer.alloc(0),status,metadata={};
 const req={method,headers:{...(token?{authorization:'Bearer '+token}:{}),...headers},...(body!==undefined?{body}:{})};
 const res={set statusCode(v){status=v},get statusCode(){return status},setHeader(k,v){metadata[k.toLowerCase()]=v},end(v){if(v!==undefined)output=Buffer.isBuffer(v)?v:Buffer.from(String(v))}};
 await handler(req,res);
 return {status,output,headers:metadata};
}
test('rejeita backup sem o token correto',async()=>{
 const a=await request('GET','chave-incorreta');
 assert.equal(a.status,401);
 assert.equal(a.headers['cache-control'],'no-store');
});
test('GET inicial retorna 404 sem expor credenciais',async()=>{
 stored.last=null;
 const a=await request('GET');
 assert.equal(a.status,404);
 assert.match(a.output.toString(),/NO_BACKUP/);
});
test('PUT de binário preserva bytes e GET devolve conteúdo idêntico',async()=>{
 const input=Buffer.from([0,255,1,22,133,73,0,15,8]);
 const a=await request('PUT',good,input,{'content-type':'application/octet-stream'});
 assert.equal(a.status,204);
 const b=await request('GET');
 assert.equal(b.status,200);
 assert.deepEqual(b.output,input);
 assert.equal(b.headers['content-type'],'application/octet-stream');
});
test('backups vazios são rejeitados',async()=>{
 const a=await request('PUT',good,Buffer.alloc(0));
 assert.equal(a.status,400);
});
test('backups acima do limite são rejeitados',async()=>{
 const a=await request('PUT',good,Buffer.alloc(3_000_001));
 assert.equal(a.status,413);
});
test('métodos desconhecidos não gravam nem leem',async()=>{
 const a=await request('DELETE');
 assert.equal(a.status,405);
});
test('endpoint fica bloqueado se segredo de backup não existe',async()=>{
 const noSecret=createBackupHandler(stored,()=>undefined);
 let status=0,body='';
 await noSecret({method:'GET',headers:{}},{set statusCode(v){status=v},setHeader(){},end(b){body=String(b||'')}});
 assert.equal(status,503);assert.match(body,/BACKUP_NOT_CONFIGURED/);
});
test('blueprint do Render exige segredos sem gravá-los no GitHub',()=>{
 const blueprint=readFileSync(new URL('../render.yaml',import.meta.url),'utf8');
 assert.match(blueprint,/runtime: image/);
 assert.match(blueprint,/plan: free/);
 assert.match(blueprint,/FREEAPI_DB_BACKUP_URL/);
 for(const name of ['ENCRYPTION_KEY','FREEAPI_DB_BACKUP_TOKEN','FREEAPI_DB_BACKUP_KEY']){
  assert.match(blueprint,new RegExp('key: '+name+'\\s*\\n\\s*sync: false'));
 }
});
