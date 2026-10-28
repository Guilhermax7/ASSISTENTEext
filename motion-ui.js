'use strict';
globalThis.CarteiraUI = (()=>{
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run=(element,frames,options)=>{
    if(reduced()||!globalThis.Motion||!element)return Promise.resolve();
    try{return Motion.animate(element,frames,options);}catch{return Promise.resolve();}
  };
  return {
    enter(){const rows=[...document.querySelectorAll('.client')].slice(0,14);if(rows.length)run(rows,{opacity:[0,1],y:[9,0]},{duration:.32,delay:globalThis.Motion?.stagger(.025),ease:[.22,1,.36,1]});},
    focus(row){run(row,{scale:[1,.987,1]},{duration:.26,ease:[.22,1,.36,1]});},
    reveal(panel){run(panel,{opacity:[0,1],y:[-5,0]},{duration:.24});},
    async exit(row){await run(row,{opacity:[1,0],x:[0,24],scale:[1,.97]},{duration:.2,ease:'easeOut'});},
    watch(row){row.addEventListener('pointermove',e=>{const r=row.getBoundingClientRect();row.style.setProperty('--mx',`${e.clientX-r.left}px`);row.style.setProperty('--my',`${e.clientY-r.top}px`);});}
  };
})();
