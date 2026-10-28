import crypto from 'node:crypto';
import {neon} from '@neondatabase/serverless';

const ORIGIN = 'https://assistenteext-ia.vercel.app';
const COOKIE = '__Host-sra_luck_session';
const SESSION_DAYS = 30;
const MAX_BODY = 4096;
let db, initPromise;
const sql = () => {
  if (!db) {
    const url=process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url || !/^postgres(?:ql)?:\/\//.test(url)) throw Error('Banco não configurado');
    db=neon(url);
  }
  return db;
};
async function init(){
  if(!initPromise) initPromise=(async()=>{
    await sql()`CREATE TABLE IF NOT EXISTS sra_luck_admin_user (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql()`CREATE TABLE IF NOT EXISTS sra_luck_admin_sessions (
      token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql()`CREATE TABLE IF NOT EXISTS sra_luck_admin_login_attempts (
      id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  })().catch(e=>{initPromise=null;throw e});
  await initPromise;
}
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
export function equal(a,b) {
  const x=Buffer.from(String(a)),y=Buffer.from(String(b));
  return x.length===y.length && crypto.timingSafeEqual(x,y);
}
const passwordHash=(password,salt)=>crypto.scryptSync(password,Buffer.from(salt,'hex'),64,{maxmem:64*1024*1024}).toString('hex');
const sessionCsrf=hash=>crypto.createHmac('sha256',process.env.SRA_LUCK_MASTER_KEY||'').update('csrf:'+hash).digest('hex');
const cookieString=(value,age)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
function send(res,status,value,cookie){
  res.statusCode=status;
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(cookie)res.setHeader('Set-Cookie',cookie);
  res.end(JSON.stringify(value));
}
const fail=(res,status,code)=>send(res,status,{error:{code,message:({
  UNAUTHORIZED:'Sessão inválida. Entre novamente.',
  RATE_LIMIT:'Muitas tentativas. Tente novamente mais tarde.',
  INVALID_CREDENTIALS:'E-mail ou senha incorretos.',
  SETUP_FAILED:'Não foi possível configurar o acesso. Confira o token.',
  AUTH_NOT_CONFIGURED:'Login ainda não configurado.',
  CONFIG_ERROR:'Serviço indisponível. Verifique a configuração.'
})[code]||'Falha na autenticação.'}});
function authPath(req){
  const url=new URL(req.url,'https://local.invalid');
  const route=url.searchParams.get('route');
  return route ? '/api/'+route.replace(/^\/+/, '') : url.pathname;
}
function cookieValue(headers){
  const raw=String(headers?.get?headers.get('cookie'):(headers?.cookie||''));
  const match=raw.match(/(?:^|;\s*)__Host-sra_luck_session=([A-Za-z0-9_-]{40,100})(?:;|$)/);
  return match?.[1]||'';
}
export async function sessionForRequest(req){
  const value=cookieValue(req.headers);
  if(!value)return null;
  const hash=digest(value);
  await init();
  const rows=await sql()`SELECT token_hash,expires_at FROM sra_luck_admin_sessions WHERE token_hash=${hash} AND expires_at>now() LIMIT 1`;
  if(!rows.length)return null;
  return {hash,csrf:sessionCsrf(hash),expiresAt:rows[0].expires_at};
}
export async function validateCookieApi(req){
  const session=await sessionForRequest(req);
  if(!session)return false;
  const origin=req.headers.get('origin')||'';
  if(origin && origin!==ORIGIN)return false;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)){
    if(origin!==ORIGIN)return false;
    if(!equal(req.headers.get('x-sra-csrf')||'',session.csrf))return false;
  }
  return true;
}
async function parseBody(req){
  let value=req.body;
  if(value===undefined){
    const parts=[];let count=0;
    for await(const chunk of req){count+=chunk.length;if(count>MAX_BODY)throw Error('too large');parts.push(chunk)}
    value=Buffer.concat(parts);
  }
  if(Buffer.isBuffer(value)||typeof value==='string'){
    const text=Buffer.isBuffer(value)?value.toString('utf8'):value;
    if(Buffer.byteLength(text)>MAX_BODY)throw Error('too large');
    return JSON.parse(text);
  }
  if(Buffer.byteLength(JSON.stringify(value))>MAX_BODY)throw Error('too large');
  return value;
}
async function getUser(){
  await init();
  const rows=await sql()`SELECT email,salt,password_hash FROM sra_luck_admin_user WHERE id='admin' LIMIT 1`;
  return rows[0]||null;
}
async function countFailed(){
  const rows=await sql()`INSERT INTO sra_luck_admin_login_attempts(id,attempts,updated_at)
  VALUES ('admin',1,now()) ON CONFLICT(id) DO UPDATE SET
  attempts=CASE WHEN sra_luck_admin_login_attempts.updated_at < now()-interval '15 minutes' THEN 1 ELSE sra_luck_admin_login_attempts.attempts+1 END,
  updated_at=now() RETURNING attempts`;
  return rows[0].attempts;
}
async function locked(){
  const rows=await sql()`SELECT attempts,updated_at FROM sra_luck_admin_login_attempts WHERE id='admin' LIMIT 1`;
  return !!rows.length && rows[0].attempts>=8 && new Date(rows[0].updated_at).getTime()>Date.now()-15*60*1000;
}
async function createSession(res,remember){
  const token=crypto.randomBytes(36).toString('base64url');
  const hash=digest(token);
  const hours=remember===false?12:SESSION_DAYS*24;
  await sql()`INSERT INTO sra_luck_admin_sessions(token_hash,expires_at)
    VALUES (${hash},now()+${hours}*interval '1 hour')`;
  send(res,200,{ok:true,csrf:sessionCsrf(hash),email:(await getUser()).email},cookieString(token,hours*3600));
}
export async function authHandler(req,res){
  const path=authPath(req);
  if(!path.startsWith('/api/auth/'))return false;
  try{
    if(!process.env.SRA_LUCK_ADMIN_TOKEN || !process.env.SRA_LUCK_MASTER_KEY || process.env.SRA_LUCK_ADMIN_TOKEN.length<32 || process.env.SRA_LUCK_MASTER_KEY.length<32)
      return fail(res,503,'CONFIG_ERROR'),true;
    if(req.method==='GET'&&path==='/api/auth/status'){
      const user=await getUser();
      return send(res,200,{configured:!!user}),true;
    }
    if(req.method==='GET'&&path==='/api/auth/session'){
      const session=await sessionForRequest(req);
      if(!session)return fail(res,401,'UNAUTHORIZED'),true;
      const user=await getUser();
      return send(res,200,{ok:true,email:user?.email,csrf:session.csrf}),true;
    }
    if(req.method==='POST' && (req.headers.origin||'')!==ORIGIN)
      return fail(res,403,'UNAUTHORIZED'),true;
    if(req.method==='POST'&&path==='/api/auth/setup'){
      const data=await parseBody(req);
      const mail=String(data.email||'').trim().toLowerCase();
      const pwd=String(data.password||'');
      if(!/^\S+@\S+\.\S+$/.test(mail)||mail.length>150||pwd.length<12||pwd.length>200)
        return fail(res,400,'INVALID_CREDENTIALS'),true;
      if(await getUser())return fail(res,409,'SETUP_FAILED'),true;
      if(!equal(String(data.adminToken||''),process.env.SRA_LUCK_ADMIN_TOKEN))return fail(res,401,'SETUP_FAILED'),true;
      const salt=crypto.randomBytes(16).toString('hex'),hash=passwordHash(pwd,salt);
      const rows=await sql()`INSERT INTO sra_luck_admin_user(id,email,salt,password_hash)
        VALUES('admin',${mail},${salt},${hash}) ON CONFLICT(id) DO NOTHING RETURNING id`;
      if(!rows.length)return fail(res,409,'SETUP_FAILED'),true;
      await createSession(res,true);return true;
    }
    if(req.method==='POST'&&path==='/api/auth/login'){
      const data=await parseBody(req);
      const user=await getUser();
      if(!user)return fail(res,503,'AUTH_NOT_CONFIGURED'),true;
      if(await locked())return fail(res,429,'RATE_LIMIT'),true;
      const mail=String(data.email||'').trim().toLowerCase(),pwd=String(data.password||'');
      const valid=mail===user.email && pwd.length>=12 && pwd.length<=200 && equal(passwordHash(pwd,user.salt),user.password_hash);
      if(!valid){
        const attempts=await countFailed();
        return fail(res,attempts>=8?429:401,attempts>=8?'RATE_LIMIT':'INVALID_CREDENTIALS'),true;
      }
      await sql()`DELETE FROM sra_luck_admin_login_attempts WHERE id='admin'`;
      await createSession(res,data.remember!==false);return true;
    }
    if(req.method==='POST'&&path==='/api/auth/logout'){
      const session=await sessionForRequest(req);
      const csrf=req.headers['x-sra-csrf']||'';
      if(!session||!equal(csrf,session.csrf))return fail(res,403,'UNAUTHORIZED'),true;
      await sql()`DELETE FROM sra_luck_admin_sessions WHERE token_hash=${session.hash}`;
      return send(res,200,{ok:true},cookieString('',0)),true;
    }
    return fail(res,404,'NOT_FOUND'),true;
  }catch(e){
    return fail(res,500,'CONFIG_ERROR'),true;
  }
}
