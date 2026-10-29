'use strict';
// Lembra apenas o campo e o cursor, sem ler ou salvar o texto da página.
if (!globalThis.__sraLuckTrackerInstalled) {
  globalThis.__sraLuckTrackerInstalled = true;
  const editable = el => el && !el.disabled && !el.readOnly && (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && ['text','search','tel','url','email',''].includes(el.type)) || el.isContentEditable
  );
  const remember = () => {
    let el = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    if (!editable(el)) return;
    // Identifica o campo da conversa realmente selecionada, sem ler seu texto.
    // Impede usar a primeira janela de chat quando há vários atendimentos.
    const selector='[contenteditable="true"][data-placeholder],[contenteditable="true"][role="textbox"],.ProseMirror[contenteditable="true"],textarea[placeholder*="digite" i],textarea[placeholder*="mensagem" i]';
    if(location.hostname.endsWith('.tallos.com.br')&&el.matches?.(selector)){
      for(const old of document.querySelectorAll('[data-sra-luck-last-composer="true"]'))
        if(old!==el)old.removeAttribute('data-sra-luck-last-composer');
      el.setAttribute('data-sra-luck-last-composer','true');
    }
    const snapshot = {element:el,start:el.selectionStart,end:el.selectionEnd};
    if (el.isContentEditable) {
      const selection = window.getSelection();
      if (selection?.rangeCount && el.contains(selection.anchorNode) && el.contains(selection.focusNode)) snapshot.range=selection.getRangeAt(0).cloneRange();
    }
    globalThis.__sraLuckField = snapshot;
  };
  document.addEventListener('focusin',remember,true);
  document.addEventListener('focusout',remember,true);
  document.addEventListener('selectionchange',remember,true);
  document.addEventListener('input',remember,true);
  window.addEventListener('blur',remember,true);
  remember();
}
