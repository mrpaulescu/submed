(() => {
  const all = typeof UNIQUE_COMPOUNDS !== 'undefined' ? UNIQUE_COMPOUNDS : [];
  const $ = id => document.getElementById(id);
  const labels = {
    toate: 'Toate clasele', alcani:'Alcani și cicloalcani', alchene:'Alchene și alcadiene', alchine:'Alchine',
    aromatici:'Arene', halogenati:'Derivați halogenați', alcooli:'Alcooli și polioli', fenoli:'Fenoli',
    amine:'Amine', nitroderivati:'Nitroderivați', carbonilici:'Aldehide și cetone', carboxilici:'Acizi carboxilici',
    'acizi grasi':'Acizi grași', 'derivati acizi':'Esteri, amide și nitrili', aminoacizi:'Aminoacizi', zaharide:'Zaharide'
  };
  const state = { category:'toate', pool:[], index:0, score:0, wrong:[], answered:false, current:null };
  const drawer = typeof SmilesDrawer !== 'undefined' ? new SmilesDrawer.Drawer({width:560,height:320}) : null;
  const normal = value => (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[‐‑‒–—]/g,'-').replace(/\s+/g,' ').trim();
  const compact = value => normal(value).replace(/\s*-\s*/g,'-');
  // Exact o inserare, ștergere sau substituție; transpoziția a două litere nu e o singură editare.
  function oneEdit(a,b) {
    if (Math.abs(a.length-b.length)>1) return false;
    let i=0,j=0,edits=0;
    while(i<a.length && j<b.length) {
      if(a[i]===b[j]) {i++;j++;continue;}
      if(++edits>1) return false;
      if(a.length>b.length) i++;
      else if(a.length<b.length) j++;
      else {i++;j++;}
    }
    return edits+(a.length-i)+(b.length-j)<=1;
  }
  // Nu tolerăm erori în cifrele locanților, fiindcă pot desemna izomeri diferiți.
  function locants(text) {return (text.match(/\d+/g)||[]).join(',');}
  function accepted(input, compound) {
    const u=compact(input);
    if(!u) return {ok:false,typo:false};
    const options=[compound.iupacRo,compound.commonRo,...(compound.aliasesRo||[])].filter(Boolean);
    if(options.some(name=>compact(name)===u)) return {ok:true,typo:false};
    if(u.length<5) return {ok:false,typo:false};
    const match=options.some(name=>{
      const n=compact(name);
      return n.length>=5 && locants(u)===locants(n) && oneEdit(u,n) &&
        // Cifrele, parantezele și separatorii sunt semnificativi, nu litere.
        u.replace(/[a-zăâîșț]/g,'')===n.replace(/[a-zăâîșț]/g,'');
    });
    if(!match) return {ok:false,typo:false};
    // Nu acceptăm o literă greșită dacă rezultatul este exact numele unui ALT compus.
    const collides=all.some(other=>other!==compound &&
      [other.iupacRo,other.commonRo,...(other.aliasesRo||[])].some(name=>compact(name)===u));
    return {ok:!collides,typo:!collides};
  }
  function shuffle(items) {
    const out=items.slice();
    for(let i=out.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
    return out;
  }
  function renderCategories() {
    const categories=['toate',...Object.keys(labels).filter(x=>x!=='toate')];
    $('categoryGrid').replaceChildren();
    categories.forEach(cat=>{
      const count=cat==='toate'?all.length:all.filter(x=>x.category===cat).length;
      if(!count) return;
      const b=document.createElement('button');
      b.type='button';b.className='iq-cat'+(state.category===cat?' active':'');
      b.innerHTML='<span></span><small></small>';
      b.querySelector('span').textContent=labels[cat];
      b.querySelector('small').textContent=count;
      b.setAttribute('aria-pressed',String(state.category===cat));
      b.addEventListener('click',()=>start(cat));
      $('categoryGrid').append(b);
    });
  }
  function draw(smiles) {
    const canvas=$('moleculeCanvas');
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(!drawer){renderError('Biblioteca de desenare nu s-a încărcat. Reîncarcă pagina.');return;}
    SmilesDrawer.parse(smiles,tree=>drawer.draw(tree,'moleculeCanvas','light',false),error=>{
      console.error('Structură SMILES invalidă:',smiles,error);
      renderError('Structura nu poate fi afișată. Treci la următorul compus.');
    });
  }
  function renderError(message) {
    const c=$('moleculeCanvas'),ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#535F79';ctx.textAlign='center';ctx.font='16px sans-serif';ctx.fillText(message,c.width/2,c.height/2);
  }
  function updateStats() {
    $('currentNum').textContent=state.index+1;
    $('totalCount').textContent=state.pool.length;
    $('score').textContent=state.score;
    $('wrongCount').textContent=state.wrong.length;
    $('quizProgress').style.width=(state.pool.length?((state.index+(state.answered?1:0))/state.pool.length)*100:0)+'%';
  }
  function showCurrent() {
    if(state.index>=state.pool.length){finish();return;}
    state.current=state.pool[state.index];state.answered=false;
    $('answerForm').hidden=false;$('quizDone').hidden=true;
    $('answerInput').value='';$('answerInput').disabled=false;$('answerInput').className='';
    $('feedback').textContent='';$('feedback').className='iq-feedback';
    $('btnCheck').disabled=false;$('btnNext').disabled=true;
    $('moleculeHint').textContent='Identifică denumirea';
    draw(state.current.smiles);updateStats();
  }
  function start(category, subset) {
    state.category=category;state.pool=shuffle(subset||all.filter(c=>category==='toate'||c.category===category));
    state.index=0;state.score=0;state.wrong=[];state.answered=false;
    $('activeCategory').textContent=labels[category]||'Recapitulare';
    $('compoundCount').textContent=state.pool.length+' compuși';
    $('categoryCount').textContent=all.length+' compuși';
    renderCategories();showCurrent();
  }
  function check(event) {
    event.preventDefault();
    if(state.answered||!state.current)return;
    const value=$('answerInput').value.trim();
    if(!value){$('feedback').textContent='Scrie mai întâi o denumire.';$('feedback').className='iq-feedback wrong';return;}
    const result=accepted(value,state.current);
    state.answered=true;$('answerInput').disabled=true;$('btnCheck').disabled=true;$('btnNext').disabled=false;
    const compound=state.current;
    if(result.ok)state.score++;else state.wrong.push(compound);
    $('answerInput').classList.add(result.ok?'correct':'wrong');
    $('feedback').className='iq-feedback '+(result.ok?'correct':'wrong');
    const main=document.createElement('strong');
    main.textContent=result.ok?(result.typo?'Corect! Am tolerat o literă greșită.':'Corect!'):'Nu chiar. Reține denumirile:';
    const details=document.createElement('small');
    details.textContent='IUPAC: '+compound.iupacRo+(compound.commonRo&&normal(compound.commonRo)!==normal(compound.iupacRo)?' · Uzual: '+compound.commonRo:'');
    $('feedback').replaceChildren(main,details);
    $('moleculeHint').textContent=compound.category ? (labels[compound.category]||'') : '';
    updateStats();
    if(state.index===state.pool.length-1)$('btnNext').textContent='Vezi rezultatul →';
  }
  function finish() {
    $('answerForm').hidden=true;$('quizDone').hidden=false;
    $('doneSummary').textContent='Ai identificat corect '+state.score+' din '+state.pool.length+' compuși. '+(state.wrong.length?'Poți repeta cei '+state.wrong.length+' compuși greșiți.':'Ai rezolvat toate structurile corect!');
    $('retryWrongBtn').hidden=!state.wrong.length;
    $('quizProgress').style.width='100%';
  }
  $('answerForm').addEventListener('submit',check);
  $('btnNext').addEventListener('click',()=>{if(!state.answered)return;state.index++;$('btnNext').textContent='Următorul compus →';showCurrent();});
  $('resetBtn').addEventListener('click',()=>start(state.category));
  $('retryAllBtn').addEventListener('click',()=>start(state.category));
  $('retryWrongBtn').addEventListener('click',()=>start(state.category,state.wrong.slice()));
  if(!all.length){$('feedback').textContent='Baza de compuși nu a putut fi încărcată.';return;}
  start('toate');
})();