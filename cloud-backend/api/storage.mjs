import {neon} from '@neondatabase/serverless';
let client,initializing;
function sql(){if(!client){const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;if(!url||!/^postgres(ql)?:\/\//.test(url))throw Error('DATABASE_URL não configurada.');client=neon(url)}return client}
async function init(){if(!initializing)initializing=(async()=>{
 await sql()`CREATE TABLE IF NOT EXISTS sra_luck_ia_state (id TEXT PRIMARY KEY,payload JSONB NOT NULL,version BIGINT NOT NULL DEFAULT 1,updated_at TIMESTAMPTZ DEFAULT now())`;
 await sql()`CREATE TABLE IF NOT EXISTS sra_luck_ia_requests (id TEXT PRIMARY KEY,expires_at TIMESTAMPTZ NOT NULL)`;
})().catch(e=>{initializing=null;throw e});await initializing}
export async function load(){await init();const r=await sql()`SELECT payload,version FROM sra_luck_ia_state WHERE id='central' LIMIT 1`;return r[0]?{data:r[0].payload,version:Number(r[0].version)}:{data:null,version:0}}
export async function save(data,version){await init();const value=JSON.stringify(data);let rows;
if(!version)rows=await sql()`INSERT INTO sra_luck_ia_state(id,payload,version) VALUES('central',${value}::jsonb,1) ON CONFLICT(id) DO NOTHING RETURNING version`;
else rows=await sql()`UPDATE sra_luck_ia_state SET payload=${value}::jsonb,version=version+1,updated_at=now() WHERE id='central' AND version=${version} RETURNING version`;
if(!rows.length)throw Object.assign(Error('Outra sessão alterou as configurações. Atualize o painel.'),{code:'STORAGE_CONFLICT',status:409});return Number(rows[0].version)}
export async function reserve(id){await init();const rows=await sql()`INSERT INTO sra_luck_ia_requests(id,expires_at) VALUES(${id},now()+interval '120 seconds') ON CONFLICT(id) DO UPDATE SET expires_at=EXCLUDED.expires_at WHERE sra_luck_ia_requests.expires_at < now() RETURNING id`;return rows.length>0}
