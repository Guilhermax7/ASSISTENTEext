(function (root) {
  const banks = [
    {id:'', name:'Sem banco', color:'#716b7b', surface:'#f0edf4', border:'#ded8e5'},
    {id:'sicredi', name:'Sicredi', color:'#556b38', surface:'#eaf0dc', border:'#ccd8b3'},
    {id:'sicredi-luck', name:'Sicredi Luck', color:'#267365', surface:'#ddf1ea', border:'#b4dbce'},
    {id:'brb-df', name:'BRB DF', color:'#535d99', surface:'#e8eafa', border:'#cbd0ee'},
    {id:'brb-go', name:'BRB GO', color:'#2e6d88', surface:'#def0f8', border:'#b7dbe9'},
    {id:'gerencia', name:'Gerência', color:'#955d39', surface:'#fbe8dd', border:'#edcdb8'},
    {id:'bb', name:'BB', color:'#816a29', surface:'#faf0ce', border:'#e5d6a0'}
  ];
  const nameKey = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
  function parseReport(text) {
    const lines = text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
    const clients = [], rejected = []; const seen = new Set();
    let duplicates = 0;
    for (let i=0; i<lines.length; i++) {
      if (!/^Em cobran[çc]a$/i.test(lines[i])) continue;
      const name = lines[i-1] || '';
      const offset = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(lines[i+1]||'') ? 2 : 1;
      const daysMatch = /^(\d+)\s+dias?$/i.exec(lines[i+offset] || '');
      if (!name || !daysMatch) {
        rejected.push(name || 'Registro sem nome'); continue;
      }
      const key=nameKey(name);
      if (seen.has(key)) { duplicates++; continue; }
      seen.add(key);
      clients.push({name, days:Number(daysMatch[1])});
    }
    return {clients, rejected, duplicates};
  }
  function validClient(c) {
    return c && typeof c.name==='string' && c.name.length>0 && c.name.length<=300 &&
      Number.isSafeInteger(c.days) && c.days>=0;
  }
  function cleanState(data) {
    if(!data || !Array.isArray(data.clients) || !data.clients.every(validClient)) throw new Error('Dados inválidos');
    return {clients:data.clients.map(c=>({name:c.name,days:c.days,bank:banks.some(b=>b.id===c.bank)?c.bank:(banks.some(b=>b.id===data.bankByCpf?.[c.cpf])?data.bankByCpf[c.cpf]:'')}))};
  }
  function importBank(current, incoming, bank) {
    if(!banks.some(b=>b.id===bank&&b.id)) throw new Error('Escolha um banco');
    return {clients:[...current.clients.filter(c=>c.bank!==bank),...incoming.map(({name,days})=>({name,days,bank}))]};
  }
  function sortClients(clients) { return [...clients].sort((a,b)=>a.days-b.days); }
  root.Carteira = {banks, nameKey, parseReport, validClient, cleanState, importBank, sortClients};
  if (typeof module !== 'undefined') module.exports=root.Carteira;
})(typeof globalThis !== 'undefined' ? globalThis : window);
