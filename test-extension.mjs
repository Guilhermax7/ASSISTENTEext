import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./ai-assistant.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url),'utf8'));

test('a extensão 1.4.4 aponta ao backend de IA, nunca à interface estática',()=>{
 assert.equal(manifest.version,'1.4.8');
 assert.match(source,/const CENTRAL_API='https:\/\/assistenteext-ia\.vercel\.app'/);
 assert.match(source,/central:\{endpoint:CENTRAL_API,model:'auto'/);
 assert.doesNotMatch(source,/central:\{endpoint:'http:\/\/127\.0\.0\.1:45421'/);
});
test('migra URL antiga da interface para backend sem alterar token',()=>{
 const begin=source.indexOf('  function validEndpoint(raw){');
 const end=source.indexOf('  function getFormConfig(root){',begin);
 assert.ok(begin>0&&end>begin);
 const code=source.slice(begin,end);
 const build=new Function('CENTRAL_API',code+';return centralEndpoint;');
 const normalize=build('https://assistenteext-ia.vercel.app');
 assert.equal(normalize('https://assistenteext.vercel.app'),'https://assistenteext-ia.vercel.app');
 assert.equal(normalize('https://assistenteext-ia.vercel.app'),'https://assistenteext-ia.vercel.app');
 assert.equal(normalize('http://127.0.0.1:45421'),'http://127.0.0.1:45421');
 assert.throws(()=>normalize('https://sra-luck-freellmapi.onrender.com/v1'),/backend da Central/);
 assert.throws(()=>normalize('https://example.org/api/generate'),/não deve conter/);
});
test('a extensão corrige a URL tanto no formulário quanto nas chamadas e revela ID para CORS',()=>{
 assert.match(source,/provider==='central'\?centralEndpoint\(/);
 assert.match(source,/const centralUrl=centralEndpoint\(linked\.url\|\|config\.endpoint\)/);
 assert.match(source,/chrome\.runtime\.id/);
 assert.match(source,/Central de IA: a rota \/api\/generate não existe/);
});
