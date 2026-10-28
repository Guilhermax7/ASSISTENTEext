'use strict';
// Negociação de mensalidades Sra. Luck. Encargos: multa única de 2% + juros simples
// de 0,20% por dia CORRIDO em atraso, sobre o principal. Descontos só nos encargos.
// Os valores são simulações, nunca uma aprovação automática de acordo.
const NegMath = (() => {
  const round = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
  const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
  const value = text => {
    let v=String(text||'').replace(/[^0-9.,-]/g,'').trim();
    if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');
    else if(/^\d{1,3}(\.\d{3})+$/.test(v))v=v.replace(/\./g,'');
    return Number.parseFloat(v)||0;
  };
  const dateISO = text => {
    const s=String(text||'').trim();
    let y,m,d;
    let match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if(match){d=+match[1];m=+match[2];y=+match[3];}
    else if((match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s))){y=+match[1];m=+match[2];d=+match[3];}
    else return '';
    const x=new Date(Date.UTC(y,m-1,d));
    return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d
      ? `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
  };
  const showDate = iso => {const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');return match?`${match[3]}/${match[2]}/${match[1]}`:iso||'';};
  const daysLate = (due,asOf) => {
    if(!dateISO(due)||!dateISO(asOf))return 0;
    const n=d=>{const [y,m,day]=d.split('-').map(Number);return Date.UTC(y,m-1,day);};
    return Math.max(0,Math.round((n(asOf)-n(due))/86400000));
  };
  // Leitura de linhas copiadas do Conta Azul: Markdown, tabela simples, colunas TSV,
  // CSV com ';' e linhas avulsas. Nunca pressupõe uma posição fixa de coluna.
  const dateRx=/\b(\d{2}\/\d{2}\/\d{4})\b/g;
  const moneyCellRx=/^(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*,\d{2}$|^(?:R\$\s*)?-?\d+,\d{2}$/i;
  const amountRx=/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|(?:R\$\s*)?\d+,\d{2}/g;
  function cleanCell(cell){
    return String(cell||'').replace(/<br\s*\/?\s*>/gi,' ').replace(/\*\*/g,'').replace(/__([^_]+)__/g,'$1').replace(/&nbsp;|\u00a0/gi,' ').trim();
  }
  function isSeparator(line){
    const s=cleanCell(line).replace(/[|;\t:\s-]/g,'');
    return !s || (/^[\s|:\-]+$/.test(line)) || /^(?:vencimento|compet[eê]ncia|descri[cç][aã]o|valor original)(?:\s*\||\s*\t)/i.test(line);
  }
  function columns(line){
    if(line.includes('|'))return line.split('|').map(cleanCell).filter(Boolean);
    if(line.includes('\t'))return line.split('\t').map(cleanCell).filter(Boolean);
    if(line.includes(';'))return line.split(';').map(cleanCell).filter(Boolean);
    return [];
  }
  function parseOne(line){
    const raw=String(line||'');
    if(!raw.trim()||isSeparator(raw))return null;
    // Linhas recebidas como "Pago", "Baixado" ou "Cancelado" não fazem parte da cobrança.
    // "Pagamento agendado" não significa "pago".
    if(/\b(?:pago|paga|liquidado|baixado|cancelado)\b/i.test(raw) && !/\bem\s+aberto\b/i.test(raw))return null;
    const cols=columns(raw);
    const dates=[...raw.matchAll(dateRx)].map(m=>m[1]).filter(d=>dateISO(d));
    if(!dates.length)return null;
    // Conta Azul pode repetir a data em duas colunas ou deslocá-la por células vazias.
    const due=dateISO(dates[0]);
    let candidate='';
    if(cols.length){
      const datePosition=cols.findIndex(c=>dateISO(c));
      const firstMoney=cols.findIndex((c,i)=>i>datePosition && moneyCellRx.test(c));
      if(firstMoney>=0)candidate=cols[firstMoney];
      if(!candidate){
        // Alguns exports têm moeda com espaços ou uma coluna "R$" separada.
        const m=cols.slice(Math.max(datePosition+1,0)).join(' ').match(amountRx);
        if(m)candidate=m[0];
      }
    }
    if(!candidate){
      const firstPos=raw.indexOf(dates[0]);
      const after=raw.slice(firstPos+dates[0].length);
      const monetary=after.match(amountRx);
      if(monetary)candidate=monetary[0];
      else{
        const minimal=/^\s*(?:[-–—:]\s*|\|\s*|R\$\s*)(\d+(?:\.\d+)?)\s*(?:\||$)/.exec(after);
        if(minimal)candidate=minimal[1];
      }
    }
    const original=round(value(candidate));
    if(!(original>0))return null;
    // A cliente normalmente está imediatamente antes das colunas monetárias.
    let name='';
    if(cols.length){
      const priceAt=cols.findIndex(c=>moneyCellRx.test(c));
      if(priceAt>0){
        const possible=cols[priceAt-1].trim();
        if(/^[\p{L}][\p{L}\s.'’-]{3,}$/u.test(possible) && !/^(?:carn[eê]|sicredi|santander|brb|banco|em aberto)/i.test(possible))name=possible.replace(/\s+/g,' ');
      }
    }
    return {due,original,name};
  }
  function parse(text){
    const original=String(text||'').replace(/\r\n?/g,'\n').replace(/<br\s*\/?\s*>/gi,' ');
    // Nas cópias em HTML, os registros podem vir colados sem uma quebra após <tr>.
    const normalized=original.replace(/<\/tr\s*>/gi,'\n').replace(/<\/t[dh]\s*>/gi,' | ').replace(/<[^>]+>/g,' ');
    const lines=normalized.split('\n');
    const rows=[],skipped=[],names=[];
    for(let i=0;i<lines.length;i++){
      const line=lines[i].trim();
      if(!line||isSeparator(line))continue;
      let item=parseOne(line);
      // Admite duas linhas: vencimento isolado e valor original na próxima linha.
      if(!item&&/^\*{0,2}\d{2}\/\d{2}\/\d{4}\*{0,2}$/.test(line) && i+1<lines.length){
        const next=lines[i+1].trim();
        if(!/\b\d{2}\/\d{2}\/\d{4}\b/.test(next)){
          item=parseOne(line+' | '+next);
          if(item)i++;
        }
      }
      if(item){rows.push({due:item.due,original:item.original});if(item.name)names.push(item.name);}
      else if(/\b\d{2}\/\d{2}\/\d{4}\b/.test(line) && !/\b(?:pago|paga|liquidado|baixado|cancelado)\b/i.test(line))skipped.push(line.slice(0,120));
    }
    const distinctNames=Array.from(new Set(names.map(n=>n.trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR'))));
    return {rows,skipped,suggestedName:names[0]||'',multipleNames:distinctNames.length>1};
  }
  // Gera vencimentos mensais sem salto do dia (ex.: 31/01 → 28/02 → 31/03).
  function monthlyDue(iso,monthShift){
    const validated=dateISO(iso);
    if(!validated||!Number.isSafeInteger(monthShift)||monthShift<0)return '';
    const [year,month,day]=validated.split('-').map(Number);
    const offset=new Date(Date.UTC(year,month-1+monthShift,1));
    const y=offset.getUTCFullYear(),m=offset.getUTCMonth();
    const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    return `${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;
  }
  function expandMonthly(due,original,count){
    const n=Number(count);
    if(!dateISO(due)||!(Number(original)>0)||!Number.isSafeInteger(n)||n<1)return [];
    const rows=[];
    for(let i=0;i<n;i++){
      const month=monthlyDue(due,i);
      if(!month)break;
      rows.push({due:month,original:round(original)});
    }
    return rows;
  }
  function calculateItem(item,asOf,finePct=2,dailyPct=0.20){
    const original=round(item.original),days=daysLate(item.due,asOf);
    const fine=days?round(original*finePct/100):0;
    const interest=days?round(original*dailyPct/100*days):0;
    const fees=round(fine+interest);
    return {...item,days,fine,interest,fees,updated:round(original+fees)};
  }
  function recommend(rows){
    if(!rows.length)return {percent:0,reason:'Adicione parcelas para receber uma sugestão.'};
    const latest=Math.max(...rows.map(x=>x.days));
    const principal=round(rows.reduce((s,x)=>s+x.original,0));
    const fees=round(rows.reduce((s,x)=>s+x.fees,0));
    const ratio=principal?fees/principal:0;
    const late=rows.filter(x=>x.days>0).length;
    let percent=latest<=7?0:latest<=30?30:latest<=60?50:latest<=90?70:90;
    if(ratio>=.40)percent=Math.max(percent,90);
    else if(ratio>=.20)percent=Math.max(percent,70);
    if(late>=3&&latest>=30)percent=Math.max(percent,70);
    let reason=latest<=7?'Atraso recente: priorize uma abordagem de lembrete e regularização simples.':
      ratio>=.4?'Encargos muito elevados frente ao principal: considere uma redução expressiva dos encargos.':
      late>=3?'Várias parcelas em atraso: uma condição concentrada pode facilitar a regularização.':
      latest>60?'Atraso prolongado: uma condição mais flexível pode apoiar a retomada.':
      'Proposta intermediária para estimular a regularização sem reduzir o principal.';
    if(!fees){percent=0;reason='Sem encargos calculados na data de referência.';}
    return {percent,reason};
  }
  function proposal(rows,discountPct,scope='all'){
    const set=scope==='oldest'&&rows.length>1?[...rows].sort((a,b)=>a.due.localeCompare(b.due))[0]:null;
    const selected=set?[set]:rows;
    const discounted=selected.map(p=>{
      const discount=round(p.fees*discountPct/100);
      return {...p,discount,offered:round(p.updated-discount)};
    });
    const sum=key=>round(discounted.reduce((s,x)=>s+x[key],0));
    return {items:discounted,original:sum('original'),fees:sum('fees'),updated:sum('updated'),discount:sum('discount'),total:sum('offered'),discountPct,scope};
  }
  const firstName = text => {
    const first=String(text||'').trim().split(/\s+/)[0];
    if(!first)return '';
    return first.toLocaleLowerCase('pt-BR').replace(/(^|['’-])([\p{L}])/gu,(_,a,b)=>a+b.toLocaleUpperCase('pt-BR'));
  };
  function composeClient(all,offer,asOf,name){
    if(!offer.items.length)return '';
    const first=firstName(name),sorted=[...offer.items].sort((a,b)=>a.due.localeCompare(b.due));
    const late=sorted.filter(x=>x.days>0).length;
    const header=first?`Olá, ${first}! Tudo bem? 💖`:'Olá! Tudo bem? 💖';
    const items=sorted.map(x=>`📅 *${showDate(x.due)}* — *${money(x.updated)}*`).join('\n');
    const totalLine=sorted.length>1?`*Total atualizado: ${money(offer.updated)}*`:`*Valor atualizado: ${money(offer.updated)}*`;
    const many=sorted.length>1;
    const special=offer.discount>0;
    const pct=String(offer.discountPct).replace('.',',');
    const lines=[header,''];
    if(special){
      const strong=offer.discountPct>=70;
      const title=strong?'✨ *CONDIÇÃO ESPECIAL DE REGULARIZAÇÃO* ✨':'💖 *CONDIÇÃO FACILITADA PARA REGULARIZAÇÃO*';
      lines.push(title,'');
      if(offer.scope==='oldest'&&all.length>1){
        lines.push('Separei uma oportunidade para começar pela parcela mais antiga e facilitar a retomada do seu contrato.','');
      }else if(many && late>=2){
        lines.push('Preparei uma condição especial para você regularizar suas parcelas em aberto e retomar seu planejamento com mais tranquilidade.','');
      }else if(sorted[0].days>=60){
        lines.push('Pensando em facilitar a regularização do seu contrato, preparei uma condição diferenciada para a sua parcela.','');
      }else{
        lines.push('Temos uma condição especial para facilitar a regularização da sua parcela!','');
      }
      lines.push(many?'*Parcelas atualizadas:*':'*Parcela atualizada:*',items,'',totalLine,'');
      lines.push(`🎁 *${pct}% DE DESCONTO NOS ENCARGOS!*`);
      lines.push(`💰 *Você economiza ${money(offer.discount)}.*`);
      lines.push(`✅ *Valor especial para regularização: ${money(offer.total)}*`);
      if(offer.scope==='oldest'&&all.length>1){
        lines.push('','Essa condição contempla a parcela mais antiga. As demais continuam em aberto e poderão ser negociadas separadamente.');
      }
      lines.push('','Posso te encaminhar a chave PIX para aproveitar essa condição? 💖✨');
    }else if(late===0){
      lines.push('Estou entrando em contato para compartilhar os próximos vencimentos do seu contrato.','',many?'*Parcelas:*':'*Parcela:*',items,'',totalLine,'','Posso encaminhar a chave PIX para facilitar o pagamento? 😊');
    }else if(late===1&&sorted[0].days<=10){
      lines.push('Identifiquei uma parcela recente em aberto e gostaria de ajudar você a manter seu contrato em dia.','',many?'*Parcelas e valores atualizados:*':'*Parcela e valor atualizado:*',items,'',totalLine,'','Se já realizou o pagamento, pode me enviar o comprovante? Caso contrário, posso encaminhar a chave PIX. 💖');
    }else{
      lines.push('Gostaria de facilitar a regularização das parcelas em aberto do seu contrato.','',many?'*Parcelas e valores atualizados:*':'*Parcela e valor atualizado:*',items,'',totalLine,'','Posso encaminhar a chave PIX para facilitar a regularização? 💖');
    }
    return lines.join('\n');
  }
  function composeReport(all,offer,asOf,name,finePct,dailyPct,recommended){
    if(!all.length)return '';
    const total=k=>round(all.reduce((s,p)=>s+p[k],0));
    const lines=['LEVANTAMENTO DE NEGOCIAÇÃO — SRA. LUCK',`Cliente: ${String(name||'Não informado').trim()||'Não informado'}`,`Data de atualização: ${showDate(asOf)}`,'',`Regra: multa de ${String(finePct).replace('.',',')}% por parcela vencida + juros simples de ${String(dailyPct).replace('.',',')}% ao dia corrido sobre o valor original.`,'',`PARCELAS IDENTIFICADAS (${all.length})`];
    for(const [i,p] of all.entries())lines.push('',`${i+1}. Vencimento: ${showDate(p.due)}`,`Original: ${money(p.original)}`,`Dias de atraso: ${p.days}`,`Multa: ${money(p.fine)}`,`Juros: ${money(p.interest)}`,`Total dos encargos: ${money(p.fees)}`,`Atualizada: ${money(p.updated)}`);
    lines.push('','RESUMO',`Principal: ${money(total('original'))}`,`Multas: ${money(total('fine'))}`,`Juros: ${money(total('interest'))}`,`Encargos totais: ${money(total('fees'))}`,`Total atualizado: ${money(total('updated'))}`,'','PROPOSTA SIMULADA',`Estratégia: ${offer.scope==='oldest'&&all.length>1?'Priorizar a parcela mais antiga':'Regularizar todas as parcelas'}`,`Desconto escolhido: ${String(offer.discountPct).replace('.',',')}% exclusivamente sobre os encargos`, `Principal incluído: ${money(offer.original)}`,`Encargos incluídos: ${money(offer.fees)}`,`Desconto em encargos: ${money(offer.discount)}`,`Valor atualizado incluído: ${money(offer.updated)}`,`Valor proposto: ${money(offer.total)}`,`Referência da sugestão: ${recommended.reason}`,'','IMPORTANTE: simulação para avaliação e aprovação interna. Não altera automaticamente o contrato ou a dívida.');
    return lines.join('\n');
  }
  return {round,money,value,dateISO,showDate,daysLate,parse,monthlyDue,expandMonthly,calculateItem,recommend,proposal,firstName,composeClient,composeReport};
})();
if(typeof globalThis!=='undefined')globalThis.SraLuckNegotiationMath=NegMath;

if(typeof document!=='undefined')(() => {
  const $=id=>document.getElementById(id);
  const state={rows:[],scope:'all',discount:0,manualDiscount:false,loadingName:false,authorized:false};
  const todayLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  $('negAsOf').value=todayLocal();
  function rates(){return {fine:Math.min(100,Math.max(0,Number($('negFinePct').value)||0)),daily:Math.min(100,Math.max(0,Number($('negDailyPct').value)||0))};}
  function computed(){const r=rates(),asOf=$('negAsOf').value;return state.rows.filter(p=>NegMath.dateISO(p.due)&&p.original>0).map(p=>NegMath.calculateItem(p,asOf,r.fine,r.daily));}
  function button(tag,text,cls='') {const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;return b;}
  function renderRows(rows){
    const target=$('negRows');target.replaceChildren();
    if(!rows.length){const p=document.createElement('p');p.className='neg-empty';p.textContent='Nenhuma parcela adicionada. Cole do Conta Azul ou informe a data e o valor.';target.append(p);return;}
    for(const [index,p] of rows.entries()){
      const el=document.createElement('div');el.className='neg-item';
      const main=document.createElement('div');main.className='neg-item-top';
      const due=document.createElement('input');due.type='date';due.value=p.due;due.setAttribute('aria-label',`Vencimento da parcela ${index+1}`);
      const amount=document.createElement('input');amount.type='text';amount.inputMode='decimal';amount.value=NegMath.money(p.original);amount.setAttribute('aria-label',`Valor original da parcela ${index+1}`);
      const remove=button('button','×','neg-item-remove');remove.title='Remover parcela';remove.setAttribute('aria-label',`Remover parcela ${index+1}`);
      const detail=document.createElement('div');detail.className='neg-item-detail';
      detail.textContent=`${p.days} ${p.days===1?'dia':'dias'} · multa ${NegMath.money(p.fine)} · juros ${NegMath.money(p.interest)}`;
      const total=document.createElement('strong');total.textContent=NegMath.money(p.updated);
      const info=document.createElement('div');info.className='neg-item-bottom';info.append(detail,total);
      due.addEventListener('change',()=>{if(NegMath.dateISO(due.value)){state.rows[index].due=due.value;state.authorized=false;render();}});
      amount.addEventListener('change',()=>{const parsed=NegMath.value(amount.value);if(parsed>0){state.rows[index].original=NegMath.round(parsed);state.authorized=false;render();}else{amount.value=NegMath.money(state.rows[index].original);}});
      remove.addEventListener('click',()=>{state.rows.splice(index,1);state.authorized=false;render();});
      main.append(due,amount,remove);el.append(main,info);target.append(el);
    }
  }
  let current=null;
  function render(){
    const all=computed(),r=rates();
    renderRows(all);
    const t=NegMath.round(all.reduce((s,p)=>s+p.original,0)),f=NegMath.round(all.reduce((s,p)=>s+p.fees,0));
    const updated=NegMath.round(t+f);
    $('negOverview').replaceChildren();
    const overview=[['Parcelas',String(all.length)],['Principal',NegMath.money(t)],['Encargos',NegMath.money(f)],['Atualizado',NegMath.money(updated)]];
    for(const [title,val] of overview){const box=document.createElement('div');const a=document.createElement('span');a.textContent=title;const b=document.createElement('strong');b.textContent=val;box.append(a,b);$('negOverview').append(box);}
    const recommended=NegMath.recommend(all);
    if(!state.manualDiscount)state.discount=recommended.percent;
    const suggestion=$('negRecommendation');suggestion.hidden=!all.length;
    suggestion.textContent=`✦ Sugestão: ${recommended.percent}% sobre encargos — ${recommended.reason} Requer aprovação.`;
    const choices=Array.from(new Set([0,recommended.percent,50,70,90,100])).sort((a,b)=>a-b);
    $('negDiscounts').replaceChildren();
    for(const pct of choices){
      const b=button('button',`${pct}%${recommended.percent===pct?' ★':''}`,'neg-discount'+(state.discount===pct?' active':''));
      b.title=`Desconto de ${pct}% sobre os encargos, sem reduzir o principal`;
      b.setAttribute('aria-pressed',String(state.discount===pct));
      b.addEventListener('click',()=>{state.discount=pct;state.manualDiscount=true;state.authorized=false;$('negCustomDiscount').value='';render();});
      $('negDiscounts').append(b);
    }
    $('negDiscountInfo').textContent=`• ${NegMath.money(f)} em encargos`;
    $('negScope').hidden=all.length<2;
    for(const b of $('negScope').querySelectorAll('button[data-neg-scope]'))b.classList.toggle('active',state.scope===b.dataset.negScope);
    const offer=NegMath.proposal(all,state.discount,state.scope);
    current={all,offer,asOf:$('negAsOf').value,...r,recommended};
    const res=$('negResult');res.replaceChildren();
    const small=document.createElement('span');small.textContent=offer.items.length?`Proposta · ${offer.scope==='oldest'&&all.length>1?'1ª parcela':'todas as parcelas'}`:'Proposta simulada';
    const big=document.createElement('strong');big.textContent=all.length?NegMath.money(offer.total):'Adicione uma parcela';
    const line=document.createElement('small');line.textContent=all.length?`Atualizado: ${NegMath.money(offer.updated)} · desconto: ${NegMath.money(offer.discount)} · principal preservado`:'Informe vencimento e valor para calcular.';
    res.append(small,big,line);
    $('negApprovedWrap').hidden=!(offer.discount>0);
    $('negApproved').checked=state.authorized;
    $('negTextCliente').textContent=NegMath.composeClient(all,offer,current.asOf,$('negName').value);
    $('negTextInterno').textContent=NegMath.composeReport(all,offer,current.asOf,$('negName').value,r.fine,r.daily,recommended);
  }
  async function identifyName(){
    if($('negName').value.trim()||state.loadingName)return;
    state.loadingName=true;
    try{
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      if(!tab?.id||!/^https?:\/\//.test(tab.url||''))return;
      const result=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['name-reader.js']});
      const name=String(result?.[0]?.result?.firstName||'').trim();
      if(name&&!$('negName').value.trim()){$('negName').value=name;render();}
    }catch{}finally{state.loadingName=false;}
  }
  $('negImport').addEventListener('click',()=>{
    const parsed=NegMath.parse($('negPaste').value);
    if(!parsed.rows.length){$('negImportHint').textContent='Não localizei vencimento + valor. Cole uma linha completa ou adicione manualmente.';return;}
    if(parsed.multipleNames){$('negImportHint').textContent='Encontrei nomes diferentes nas linhas. Importe apenas parcelas da mesma cliente para evitar misturar contratos.';return;}
    // Acrescenta linhas, sem apagar os dados já conferidos.
    state.rows.push(...parsed.rows);state.authorized=false;
    // O nome copiado do Conta Azul prevalece sobre a leitura automática da conversa,
    // evitando usar o nome de outro atendimento ao importar parcelas.
    if(parsed.suggestedName)$('negName').value=parsed.suggestedName.toLocaleLowerCase('pt-BR').replace(/(^|\s)(\p{L})/gu,(_,a,b)=>a+b.toLocaleUpperCase('pt-BR'));
    $('negPaste').value='';
    $('negImportHint').textContent=`${parsed.rows.length} parcela(s) identificada(s).${parsed.skipped.length?' '+parsed.skipped.length+' linha(s) exigem conferência.':''} Confira datas e valores abaixo.`;
    state.manualDiscount=false;
    render();
  });
  $('negAdd').addEventListener('click',()=>{
    const date=NegMath.dateISO($('negManualDate').value),amount=NegMath.value($('negManualValue').value);
    if(!date||!Number.isFinite(amount)||amount<=0){$('negImportHint').textContent='Informe vencimento e valor original válidos.';return;}
    const count=Number($('negManualCount').value);
    if(!Number.isSafeInteger(count)||count<1){$('negImportHint').textContent='Informe uma quantidade válida de parcelas, a partir de 1.';return;}
    const expanded=NegMath.expandMonthly(date,amount,count);
    if(expanded.length!==count){$('negImportHint').textContent='Não consegui gerar os vencimentos. Verifique a data e a quantidade.';return;}
    state.rows.push(...expanded);state.authorized=false;
    $('negImportHint').textContent=`${expanded.length} parcela(s) incluída(s), com vencimento mensal e valor de ${NegMath.money(amount)}.`;
    // Conserva valor e data para permitir novos lançamentos rápidos.
    $('negManualDate').value=NegMath.monthlyDue(date,count);
    state.manualDiscount=false;render();
  });
  for(const id of ['negAsOf','negFinePct','negDailyPct','negName']){
    $(id).addEventListener('change',()=>{if(id!=='negName')state.authorized=false;render();});
    if(id==='negName'||id.includes('Pct'))$(id).addEventListener('input',()=>{if(id!=='negName')state.authorized=false;render();});
  }
  $('negCustomDiscount').addEventListener('input',()=>{
    if($('negCustomDiscount').value.trim()!==''){
      state.discount=Math.min(100,Math.max(0,Number($('negCustomDiscount').value.replace(',','.'))||0));
      state.manualDiscount=true;state.authorized=false;render();
    }else{state.manualDiscount=false;state.authorized=false;render();}
  });
  $('negApproved').addEventListener('change',()=>{state.authorized=$('negApproved').checked;});
  $('negScope').addEventListener('click',e=>{
    const b=e.target.closest('[data-neg-scope]');if(b){state.scope=b.dataset.negScope;state.authorized=false;render();}
  });
  async function act(kind,action){
    if(!current?.all.length||!NegMath.dateISO($('negAsOf').value)){status('Adicione parcelas e uma data de atualização válida.',true);return;}
    if(kind==='cliente'&&current.offer.discount>0&&!state.authorized){status('Confirme que o desconto está autorizado antes de compartilhar essa condição com a cliente.',true);$('negApproved').focus();return;}
    const txt=$(kind==='cliente'?'negTextCliente':'negTextInterno').textContent;
    try{
      if(action==='copy'){await navigator.clipboard.writeText(txt);status('Texto copiado. Confira a condição antes de enviar.');return;}
      const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
      if(!tab?.id||!/^https?:\/\//i.test(tab.url||'')){status('Abra a conversa e o campo de digitação para inserir.',true);return;}
      const response=await insertConversationMessage(tab.id,txt,tab.url);
      if(response.ok)status('Texto inserido sem envio. Confira os valores antes de enviar.');
      else{
        const copied=tab.url.startsWith('https://web.whatsapp.com/')?await copyFormattedFallback(txt):false;
        status((response.reason||'Não localizei o campo de conversa.')+(copied?' Copiado: use Ctrl+V no WhatsApp.':''),true);
      }
    }catch{status('Não foi possível inserir. Abra a conversa ou use Copiar.',true);}
  }
  $('simNegociacaoBlock').addEventListener('click',e=>{
    const b=e.target.closest('[data-neg-action]');if(b)void act(b.dataset.negOutput,b.dataset.negAction);
  });
  $('negReset').addEventListener('click',()=>{
    state.rows=[];state.scope='all';state.manualDiscount=false;state.discount=0;state.authorized=false;
    $('negPaste').value='';$('negName').value='';$('negManualDate').value='';$('negManualValue').value='';$('negManualCount').value='1';$('negCustomDiscount').value='';$('negAsOf').value=todayLocal();
    $('negImportHint').textContent='Aceita colunas, tabulações ou data + valor.';
    render();
  });
  render();
  globalThis.SraLuckNegotiation={onAreaChange:()=>{void identifyName();render();}};
})();
