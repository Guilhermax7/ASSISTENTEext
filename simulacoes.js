'use strict';
// Cálculos transcritos da calculadora@.html fornecida, sem alterar as fórmulas.
// IMPORTANTE: simulação estimativa; percentuais/taxa/multa devem ser conferidos com contrato.
const SraCalcRates=Object.freeze({12:25,18:32,24:41,36:59,48:63,60:77,72:83});
const SraCalcTerms=Object.freeze([12,18,24,36,48,60,72]);
const SraCalcKinds=Object.freeze({
  aumentoCarta:{label:'Aumento da carta',request:d=>`AUMENTO DA CARTA DE CRÉDITO PARA ${moneyBR(d.valorCartaSimulacao)} COM REPARCELAMENTO EM ${d.selectedSimulation.quantidade}X`,message:d=>`Olá! Segue abaixo a simulação detalhada para o aumento da sua carta de crédito para ${moneyBR(d.novoValorCarta||d.valorCartaSimulacao)}.`},
  diminuicaoCarta:{label:'Diminuição da carta',request:d=>`DIMINUIÇÃO DA CARTA DE CRÉDITO PARA ${moneyBR(d.valorCartaSimulacao)} COM REPARCELAMENTO EM ${d.selectedSimulation.quantidade}X (TAXA ADMINISTRATIVA MANTIDA OU SUPERIOR À ATUAL)`,message:d=>`Olá! Segue abaixo a simulação detalhada para a diminuição da sua carta de crédito para ${moneyBR(d.novoValorCarta||d.valorCartaSimulacao)}.`},
  aumentoParcelas:{label:'Aumento de parcelas',request:d=>`AUMENTO DA QUANTIDADE DE PARCELAS PARA ${d.selectedSimulation.quantidade}X`,message:()=>`Olá! Segue abaixo a simulação detalhada para o aumento do prazo de parcelamento do seu contrato.`},
  reducaoParcelas:{label:'Redução do valor das parcelas',request:d=>`REPARCELAMENTO ${d.selectedSimulation.quantidade}X`,message:d=>`Olá! Segue abaixo a simulação detalhada para o reparcelamento da CARTA DE ${d.valorCartaSimulacao>=1000?Math.round(d.valorCartaSimulacao/1000)+'MIL':moneyBR(d.valorCartaSimulacao)}.`}
});
function moneyBR(n){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);}
function roundBR(n){return Math.round((Number(n)||0)*100)/100;}
function moneyNum(s){
  if(!s)return 0;
  let v=String(s).replace(/[^\d,.-]/g,'');
  // Permite entrada natural "10000", "10000,50" e formato brasileiro "10.000,50".
  if(v.includes(','))v=v.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(v))v=v.replace(/\./g,'');
  return Number.parseFloat(v)||0;
}
function qty(n){const x=parseInt(n,10);return Number.isFinite(x)&&x>0?x:0;}
function moneyValue(id){return moneyNum(document.getElementById(id).value);}
function intValue(id){return qty(document.getElementById(id).value);}
function textVal(id,fallback='Não informado'){return document.getElementById(id).value.trim()||fallback;}
function optMoney(id,automatic){return document.getElementById(id).value.trim()?roundBR(moneyValue(id)):automatic;}
function contract(carta,prazo,taxaOverride,parcelaOverride){
  const taxaPct=SraCalcRates[prazo]||0;
  const taxaAuto=roundBR(carta*taxaPct/100);
  const taxaAdm=optMoney(taxaOverride,taxaAuto);
  const valorTotal=roundBR(carta+taxaAdm);
  const parcelaAuto=prazo>0?roundBR(valorTotal/prazo):0;
  const valorParcela=optMoney(parcelaOverride,parcelaAuto);
  return {valorCarta:carta,quantidade:prazo,taxaPct,taxaAdm,valorTotal,valorParcela};
}
function currentContract(){return contract(moneyValue('simCarta'),intValue('simPrazo'),'simTaxa','simParcela');}
function cancelData(){
  const original=currentContract();
  const hasAltered=document.getElementById('simCancelAlterado').checked;
  const alterado=hasAltered ? {...contract(moneyValue('simCartaAlterada')>0?moneyValue('simCartaAlterada'):original.valorCarta,intValue('simPrazoAlterado'),'simTaxaAlterada','simParcelaAlterada'),ativo:true} : {valorCarta:0,quantidade:0,taxaAdm:0,valorTotal:0,valorParcela:0,ativo:false};
  const contratoBase=hasAltered?alterado:original;
  const qtdPagoOriginal=intValue('simPagas');
  const qtdPagoAlterado=hasAltered?intValue('simPagasAlterada'):0;
  const totalPagoOriginal=roundBR(qtdPagoOriginal*original.valorParcela);
  const totalPagoAlterado=roundBR(qtdPagoAlterado*alterado.valorParcela);
  const totalPago=roundBR(totalPagoOriginal+totalPagoAlterado);
  const selected=document.getElementById('simMulta').value;
  const multaPct=selected==='thf'?null:selected==='custom'?Math.max(0,parseFloat(document.getElementById('simMultaCustom').value.replace(',','.'))||0):Number(selected.replace('pct',''));
  const multa=selected==='thf'?contratoBase.taxaAdm:roundBR(contratoBase.valorTotal*multaPct/100);
  const saldoFinal=roundBR(totalPago-multa);
  const valorRestituicao=saldoFinal>0?saldoFinal:0,valorDevido=saldoFinal<0?Math.abs(saldoFinal):0;
  const totalParcelasPagas=qtdPagoOriginal+qtdPagoAlterado;
  const parcelasRestituicao=valorRestituicao>0?totalParcelasPagas:0;
  const valorParcelaRestituicao=parcelasRestituicao?roundBR(valorRestituicao/parcelasRestituicao):0;
  return {nome:textVal('simNome','cliente'),cpf:textVal('simCpf'),contrato:textVal('simNumero'),original,alterado,contratoBase,qtdPagoOriginal,qtdPagoAlterado,totalPagoOriginal,totalPagoAlterado,totalPago,multaPct,multaInfo:{kind:selected==='thf'?'thf':'percent',key:selected},multa,saldoFinal,valorRestituicao,valorDevido,totalParcelasPagas,parcelasRestituicao,valorParcelaRestituicao};
}
function cancellationReport(d){
  const b=d.contratoBase, pagoParcela=d.totalParcelasPagas>0?roundBR(d.saldoFinal/d.totalParcelasPagas):0;
  return [`LEVANTAMENTO PARA CANCELAMENTO Nº ${d.contrato}`,'',`CLIENTE: ${d.nome}`,'',`CPF: ${d.cpf}`,'',`VALOR DA CARTA: ${moneyBR(b.valorCarta)}`,'',`TAXA ADM: ${moneyBR(b.taxaAdm)}`,'',`VALOR TOTAL DO CONTRATO: ${moneyBR(b.valorTotal)}`,'',`TOTAL DE PARCELAS: ${b.quantidade||0}x de ${moneyBR(b.valorParcela)}`,'',`PARCELAS PAGAS: ${d.totalParcelasPagas}x de ${moneyBR(b.valorParcela)}`,'',`VALOR TOTAL DE PARCELAS PAGAS: ${moneyBR(d.totalPago)}`,'',`MULTA RESCISÓRIA (${d.multaInfo.kind==='thf'?'THF':(d.multaPct.toLocaleString('pt-BR')+'%')}): ${moneyBR(d.multa)}`,'',`SALDO A RESTITUIR: ${moneyBR(d.saldoFinal)}`,'',`DEVOLUÇÃO: ${d.totalParcelasPagas}x de ${moneyBR(pagoParcela)}`].join('\n');
}
function cancellationMessage(d){
  const first=d.nome!=='cliente'?d.nome.split(' ')[0]:'cliente';
  const describe=(n,v)=>n>0?`${n}x de ${moneyBR(v)}`:'0x de R$ 0,00';
  const pagos=d.alterado.ativo?`Original: ${describe(d.qtdPagoOriginal,d.original.valorParcela)}\nApós alteração: ${describe(d.qtdPagoAlterado,d.alterado.valorParcela)}`:describe(d.qtdPagoOriginal,d.original.valorParcela);
  const regra=d.multaInfo.kind==='thf'?`THF — taxa administrativa integral de ${moneyBR(d.contratoBase.taxaAdm)}`:`${d.multaPct.toLocaleString('pt-BR')}% sobre ${moneyBR(d.contratoBase.valorTotal)}`;
  const lines=[`Olá, ${first}! Tudo bem?`,'','Segue o levantamento referente ao cancelamento do seu contrato.','','📋 LEVANTAMENTO DE CANCELAMENTO','','💼 Valor total do contrato:',moneyBR(d.contratoBase.valorTotal),'','✅ Parcelas pagas:',pagos,'','💰 Total pago:',moneyBR(d.totalPago),'',`⚠️ Multa contratual (${regra}):`,moneyBR(d.multa),''];
  if(d.valorRestituicao>0)lines.push('💚 Saldo a ser restituído:',moneyBR(d.valorRestituicao),'','📆 Forma de restituição','',`${d.parcelasRestituicao}x de ${moneyBR(d.valorParcelaRestituicao)}`,'','(conforme quantidade de parcelas pagas, previsto em contrato)','','Qualquer dúvida, estou à disposição.');
  else if(d.valorDevido>0)lines.push('🔴 Valor devido para conclusão do cancelamento:',moneyBR(d.valorDevido),'','Qualquer dúvida, estou à disposição.');
  else lines.push('Saldo final zerado.','','Qualquer dúvida, estou à disposição.');
  return lines.join('\n');
}
function readPaidRows(){return [...document.querySelectorAll('.sim-paid-row')].map(row=>{
  const quantidade=qty(row.querySelector('[data-paid-qty]').value);
  const valor=roundBR(moneyNum(row.querySelector('[data-paid-value]').value));
  return {quantidade,valor,total:roundBR(quantidade*valor)};
}).filter(row=>row.quantidade>0&&row.valor>0);}
let simSelectedTerm=48;
function alterationData(){
  const tipo=document.getElementById('simTipo').value;
  const atual=currentContract();
  const faixas=readPaidRows();
  const totalPagoCalculado=roundBR(faixas.reduce((sum,p)=>sum+p.total,0));
  const valorPagoAbater=optMoney('simAbater',totalPagoCalculado);
  const novoValorCarta=moneyValue('simNovoValor');
  const valorCartaSimulacao=['aumentoCarta','diminuicaoCarta'].includes(tipo)?(novoValorCarta>0?novoValorCarta:atual.valorCarta):atual.valorCarta;
  const simulacoes=SraCalcTerms.map(quantidade=>{
    const taxaPct=SraCalcRates[quantidade];
    const taxaAdmCalculada=roundBR(valorCartaSimulacao*taxaPct/100);
    const taxaAdm=tipo==='diminuicaoCarta'?Math.max(taxaAdmCalculada,atual.taxaAdm):taxaAdmCalculada;
    const custoTotalBruto=roundBR(valorCartaSimulacao+taxaAdm);
    const custoTotal=roundBR(custoTotalBruto-valorPagoAbater);
    const valorParcela=roundBR(custoTotal/quantidade);
    return {quantidade,valorCarta:valorCartaSimulacao,taxaPct,taxaAdm,taxaAdmCalculada,taxaAdmTravada:tipo==='diminuicaoCarta'&&taxaAdmCalculada<atual.taxaAdm,custoTotalBruto,custoTotal,valorParcela};
  });
  const selectedSimulation=simulacoes.find(s=>s.quantidade===simSelectedTerm)||simulacoes[4];
  return {tipo,atendimento:{nome:textVal('simNome'),cpf:textVal('simCpf'),numero:textVal('simNumero')},contratoAtual:atual,faixas,faixasTexto:faixas.length?faixas.map(f=>`${f.quantidade}x de ${moneyBR(f.valor)}`).join(' + '):'0x de R$ 0,00',totalPagoCalculado,valorPagoAbater,novoValorCarta,valorCartaSimulacao,simulacoes,selectedSimulation};
}
function alterationRequest(d){return SraCalcKinds[d.tipo].request(d);}
function alterationReport(d){
  const s=d.selectedSimulation;
  const pagas=!d.faixas.length?'0 pagas.':d.faixas.length===1?`${d.faixas[0].quantidade} pagas.`:`${d.faixasTexto}.`;
  return [`LEVANTAMENTO PARA ALTERAÇÃO N° ${d.atendimento.numero}`,'',`CLIENTE: ${d.atendimento.nome}`,`CPF: ${d.atendimento.cpf}`,`CONTRATO ATUAL: ${moneyBR(d.contratoAtual.valorCarta)}`,`TX: ${moneyBR(d.contratoAtual.taxaAdm)}`,`VALOR TOTAL DO CONTRATO: ${moneyBR(d.contratoAtual.valorTotal)}`,`TOTAL DE PARCELAS: ${d.contratoAtual.quantidade||0}X PARCELAS NO VALOR DE ${moneyBR(d.contratoAtual.valorParcela)}`,`PARCELAS PAGAS: ${pagas}`,`VALOR TOTAL DE PARCELAS PAGAS: ${moneyBR(d.totalPagoCalculado)}`,`ALTERAÇÃO SOLICITADA: ${alterationRequest(d)}`,`NOVA TX: ${moneyBR(s.taxaAdm)}`,`NOVO CONTRATO: ${moneyBR(s.custoTotalBruto)}`,`PAGO ATÉ AGORA: ${moneyBR(d.valorPagoAbater)}`,`SALDO DEVEDOR: ${moneyBR(s.custoTotal)}`,'SIMULAÇÃO:',`${s.quantidade}x ${moneyBR(s.custoTotal)} ÷ ${s.quantidade} = ${moneyBR(s.valorParcela)}`].join('\n');
}
function alterationMessage(d){return [SraCalcKinds[d.tipo].message(d),...d.simulacoes.map(s=>`🗓️ ${s.quantidade}x de ${moneyBR(s.valorParcela)}`),'Qualquer dúvida, estamos à disposição! 😊'].join('\n');}
const sel=id=>document.getElementById(id);
let simMode='cancelamento';
function addPaidRow(quantidade='',valor=''){
  const row=document.createElement('div');row.className='sim-paid-row';
  row.innerHTML='<label>Qtd. pagas<input type="number" data-paid-qty min="0" placeholder="0" /></label><label>Valor de cada (R$)<input type="text" data-paid-value inputmode="decimal" placeholder="0,00" /></label><button type="button" data-remove-paid title="Excluir faixa" aria-label="Excluir faixa">×</button>';
  row.querySelector('[data-paid-qty]').value=quantidade;
  row.querySelector('[data-paid-value]').value=valor;
  sel('simPaidRows').append(row);
}
function compareCancel(d){
  sel('simComparison').replaceChildren();
  for(const [key,label] of [['pct10','10%'],['pct20','20%'],['pct30','30%'],['thf','THF']]){
    const val=key==='thf'?d.contratoBase.taxaAdm:roundBR(d.contratoBase.valorTotal*Number(key.replace('pct',''))/100);
    const net=roundBR(d.totalPago-val);
    const tile=document.createElement('div');tile.className='sim-fine-tile';
    if(sel('simMulta').value===key)tile.classList.add('current');
    tile.textContent=`${label}: ${moneyBR(val)} · ${net>=0?'Restituição':'Devido'} ${moneyBR(Math.abs(net))}`;
    sel('simComparison').append(tile);
  }
}
function showCurrentHint(){
  const contractData=currentContract();
  sel('simCurrentHint').textContent=`Taxa da tabela: ${contractData.taxaPct}% · Parcela calculada: ${moneyBR(contractData.valorTotal/(contractData.quantidade||1))} · Total: ${moneyBR(contractData.valorTotal)}. Campos de taxa e parcela são editáveis.`;
}
function warningList(d){
  const warnings=[];
  if(!d.contratoAtual?.valorCarta&&!d.original?.valorCarta)warnings.push('Informe o valor da carta.');
  const cur=d.contratoAtual||d.original;
  if(!cur.quantidade)warnings.push('Selecione o prazo original para aplicar a taxa fixa.');
  if(textVal('simNome','')==='')warnings.push('Nome não informado: confira antes de enviar.');
  if(simMode==='cancelamento'){
    if(d.alterado.ativo&&!d.alterado.quantidade)warnings.push('Informe o prazo do contrato após alteração.');
    if(d.totalParcelasPagas===0)warnings.push('Nenhuma parcela paga informada; confirme o histórico.');
  }else{
    if(d.faixas.length===0)warnings.push('Nenhuma faixa de pagamentos preenchida; abatimento calculado como zero.');
    if(['aumentoCarta','diminuicaoCarta'].includes(d.tipo)&&!d.novoValorCarta)warnings.push('Novo valor da carta não informado: simulação usa o valor atual.');
    if(d.tipo==='diminuicaoCarta'&&d.novoValorCarta>0&&d.novoValorCarta>=d.contratoAtual.valorCarta)warnings.push('A carta informada não é menor que a original.');
  }
  return warnings;
}
function recalcSim(){
  if(simMode==='negociacao')return;
  showCurrentHint();
  sel('simMultaCustomWrap').hidden=sel('simMulta').value!=='custom';
  sel('simCancelAlteradoFields').hidden=!sel('simCancelAlterado').checked;
  sel('simNovoValorWrap').hidden=!['aumentoCarta','diminuicaoCarta'].includes(sel('simTipo').value);
  const d=simMode==='cancelamento'?cancelData():alterationData();
  if(simMode==='cancelamento'){
    compareCancel(d);
    sel('simResultMain').textContent=d.valorRestituicao>0?`Restituir ${moneyBR(d.valorRestituicao)}`:d.valorDevido>0?`Saldo devido ${moneyBR(d.valorDevido)}`:'Saldo zerado';
    sel('simResultDetails').textContent=`Pago: ${moneyBR(d.totalPago)} · Multa: ${moneyBR(d.multa)}${d.valorRestituicao>0?` · ${d.parcelasRestituicao}x de ${moneyBR(d.valorParcelaRestituicao)}`:''}`;
    sel('simResult').dataset.result=d.valorRestituicao>0?'refund':d.valorDevido>0?'owe':'neutral';
    sel('simTextCliente').textContent=cancellationMessage(d);
    sel('simTextInterno').textContent=cancellationReport(d);
  }else{
    sel('simPaidTotal').textContent=moneyBR(d.totalPagoCalculado);
    sel('simOptions').replaceChildren();
    for(const sim of d.simulacoes){
      const b=document.createElement('button');b.type='button';b.dataset.term=sim.quantidade;b.className='sim-option'+(sim.quantidade===simSelectedTerm?' chosen':'');
      b.innerHTML=`<strong>${sim.quantidade}x</strong><span>${moneyBR(sim.valorParcela)}</span>`;
      b.title=`Taxa: ${sim.taxaPct}%. Taxa administrativa: ${moneyBR(sim.taxaAdm)}${sim.taxaAdmTravada?' (nunca menor que a atual)':''}`;
      b.setAttribute('aria-pressed',String(sim.quantidade===simSelectedTerm));
      sel('simOptions').append(b);
    }
    sel('simResult').dataset.result='alteration';
    sel('simResultMain').textContent=`${d.selectedSimulation.quantidade}x de ${moneyBR(d.selectedSimulation.valorParcela)}`;
    sel('simResultDetails').textContent=`Novo contrato: ${moneyBR(d.selectedSimulation.custoTotalBruto)} · Abatimento: ${moneyBR(d.valorPagoAbater)} · Saldo: ${moneyBR(d.selectedSimulation.custoTotal)}`;
    sel('simTextCliente').textContent=alterationMessage(d);
    sel('simTextInterno').textContent=alterationReport(d);
  }
  const warnings=warningList(d);
  sel('simWarnings').textContent=warnings.length?`Conferir: ${warnings.join(' ')}`:'Simulação pronta para conferência; valores não constituem aprovação contratual.';
  sel('simWarnings').dataset.attention=warnings.length?'yes':'no';
}
async function simAutoName(){
  try{
    if(sel('simNome').value.trim())return;
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!/^https?:\/\//i.test(tab.url||''))return;
    const result=await chrome.scripting.executeScript({target:{tabId:tab.id},files:['name-reader.js']});
    const found=String(result?.[0]?.result?.firstName||'').trim();
    if(found&&!sel('simNome').value.trim()){
      sel('simNome').value=found;
      sel('simNome').title='Nome sugerido automaticamente; confira e complete se necessário.';
      recalcSim();
    }
  }catch{}
}
async function simOutputAction(kind,action){
  const t=sel(kind==='cliente'?'simTextCliente':'simTextInterno').textContent;
  const d=simMode==='cancelamento'?cancelData():alterationData();
  const warnings=warningList(d);
  if(warnings.some(x=>x.includes('valor da carta')||x.includes('prazo original')||x.includes('prazo do contrato após'))){status('Preencha os valores obrigatórios antes de utilizar a simulação.',true);return;}
  try{
    if(action==='copy'){
      await navigator.clipboard.writeText(t);
      status(`${kind==='cliente'?'Mensagem':'Levantamento'} copiado.`);return;
    }
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!/^https?:\/\//i.test(tab.url||'')){status('Abra a conversa e selecione o campo de digitação.',true);return;}
    const result=await insertConversationMessage(tab.id,t,tab.url);
    if(result.ok)status('Texto inserido sem envio. Confira antes de enviar.');
    else {
      const copied=tab.url.startsWith('https://web.whatsapp.com/')?await copyFormattedFallback(t):false;
      status((result.reason||'Não encontrei o campo de digitação.')+(copied?' Texto copiado: use Ctrl+V no campo do WhatsApp.':''),true);
    }
  }catch{status('Não foi possível inserir. Confira as permissões do site e tente novamente.',true);}
}
function resetSim(){
  for(const el of document.querySelectorAll('#simulacoesView input:not([type=checkbox]),#simulacoesView select')){
    if(el.id==='simPagas'||el.id==='simPagasAlterada')el.value='0';
    else if(el.id==='simMultaCustom')el.value='20';
    else if(el.tagName==='SELECT')el.selectedIndex=0;
    else el.value='';
  }
  sel('simPrazo').value='48';sel('simPrazoAlterado').value='48';sel('simMulta').value='pct20';
  sel('simCancelAlterado').checked=false;
  sel('simTipo').value='aumentoCarta';
  simSelectedTerm=48;sel('simPaidRows').replaceChildren();addPaidRow();recalcSim();
}
for(const id of ['simPrazo','simPrazoAlterado']){
  const el=sel(id);el.append(new Option('Selecionar…','0'));
  for(const q of SraCalcTerms)el.append(new Option(`${q}x · ${SraCalcRates[q]}%`,String(q)));
  el.value='48';
}
sel('simPrazo').value='48';
addPaidRow();
sel('simulacoesView').addEventListener('input',e=>{
  if(e.target.closest('input,select'))recalcSim();
});
sel('simulacoesView').addEventListener('change',e=>{
  if(e.target.closest('input,select'))recalcSim();
});
sel('simulacoesView').addEventListener('click',event=>{
  const btn=event.target.closest('button');if(!btn)return;
  if(btn.dataset.simMode){simMode=btn.dataset.simMode;for(const b of document.querySelectorAll('[data-sim-mode]'))b.classList.toggle('active',b===btn);sel('simContractTool').hidden=simMode==='negociacao';sel('simNegociacaoBlock').hidden=simMode!=='negociacao';sel('simCancelBlock').hidden=simMode!=='cancelamento';sel('simAlterBlock').hidden=simMode!=='alteracao';if(simMode==='negociacao')globalThis.SraLuckNegotiation?.onAreaChange();else recalcSim();return;}
  if(btn.id==='simAddPaid'){addPaidRow();recalcSim();return;}
  if(btn.hasAttribute('data-remove-paid')){if(document.querySelectorAll('.sim-paid-row').length>1)btn.closest('.sim-paid-row').remove();else{btn.closest('.sim-paid-row').querySelectorAll('input').forEach(i=>i.value='');}recalcSim();return;}
  if(btn.dataset.term){simSelectedTerm=Number(btn.dataset.term);recalcSim();return;}
  if(btn.dataset.simAction){void simOutputAction(btn.dataset.simOutput,btn.dataset.simAction);return;}
  if(btn.id==='simReset')resetSim();
});
for(const el of document.querySelectorAll('#simulacoesView input[inputmode="decimal"]')){
  el.addEventListener('blur',()=>{if(el.value.trim()){el.value=moneyBR(moneyNum(el.value));recalcSim();}});
}
recalcSim();
globalThis.SraLuckSimulacoes={onAreaChange:()=>{if(simMode==='negociacao')globalThis.SraLuckNegotiation?.onAreaChange();else void simAutoName();}};
