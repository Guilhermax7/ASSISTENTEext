#!/bin/sh
set -eu
# Render Free é publicamente acessível. Sem provisionamento, não inicializar o painel.
node - <<'NODE'
const e=process.env;
const hex=x=>/^[0-9a-f]{64}$/i.test(String(x||''));
if(!hex(e.ENCRYPTION_KEY)||!hex(e.FREEAPI_DB_BACKUP_KEY)) {
 console.error('STARTUP_BLOCKED: configure as chaves de criptografia no Render.');
 process.exit(78);
}
if(!e.FREEAPI_DB_BACKUP_TOKEN||e.FREEAPI_DB_BACKUP_TOKEN.length<32||e.FREEAPI_DB_BACKUP_URL!=='https://assistenteext-ia.vercel.app/api/backup'){
 console.error('STARTUP_BLOCKED: backup seguro não configurado.');
 process.exit(78);
}
let cfg;try{cfg=JSON.parse(e.FREEAPI_CONFIG_JSON||'null')}catch{}
if(!cfg?.admin?.email||!/^\S+@\S+\.\S+$/.test(cfg.admin.email)||!cfg.admin.password||cfg.admin.password.length<20){
 console.error('STARTUP_BLOCKED: configure FREEAPI_CONFIG_JSON com email e senha administrativa forte.');
 process.exit(78);
}
console.log('Startup guard: configuração de segurança presente.');
NODE
exec /usr/local/bin/docker-entrypoint.sh "$@"
