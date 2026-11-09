(() => {
'use strict';
const all=typeof UNIQUE_COMPOUNDS!=='undefined'?UNIQUE_COMPOUNDS:[];
const $=id=>document.getElementById(id),svg=$('lewisCanvas'),NS='http://www.w3.org/2000/svg';
const categories={alcani:'Alcani și cicloalcani',alchene:'Alchene și alcadiene',alchine:'Alchine',aromatici:'Arene',halogenati:'Derivați halogenați',alcooli:'Alcooli și polioli',fenoli:'Fenoli',amine:'Amine',nitroderivati:'Nitroderivați',carbonilici:'Aldehide și cetone',carboxilici:'Acizi carboxilici','acizi grasi':'Acizi grași','derivati acizi':'Esteri, amide și nitrili',aminoacizi:'Aminoacizi',zaharide:'Zaharide'};
const valence={C:4,N:3,O:2,F:1,Cl:1,Br:1,I:1,S:2,P:3};
const electrons={C:4,N:5,O:6,F:7,Cl:7,Br:7,I:7,S:6,P:5};
const allowedElements=['C','H','O','N','F','Cl','Br','I','S','P'];
let atoms=[],bonds=[],nextId=1,tool='atom',element='C',order=1,bondFirst=null,drag=null,current=null,charge=0;
function parseSmiles(smiles){
 const nodes=[],edges=[],stack=[],rings={};let i=0,prev=null,pending=null;
 const add=(el,arom=false,formalCharge=0,explicitH=0)=>{
  const n={id:nodes.length,el,arom,charge:formalCharge,explicitH};nodes.push(n);
  if(prev!==null)edges.push({a:prev,b:n.id,order:pending??(arom&&nodes[prev].arom?1.5:1)});
  prev=n.id;pending=null;
 };
 while(i<smiles.length){
  const ch=smiles[i];
  if(ch==='('){if(prev===null)throw Error('branch fără atom');stack.push(prev);i++;continue;}
  if(ch===')'){prev=stack.pop();if(prev===undefined)throw Error('paranteză invalidă');i++;continue;}
  if(ch==='-'||ch==='='||ch==='#'||ch===':'){pending=ch==='='?2:ch==='#'?3:ch===':'?1.5:1;i++;continue;}
  if(/\d/.test(ch)){const key=ch;if(rings[key]){const r=rings[key];edges.push({a:r.atom,b:prev,order:pending??r.order??(nodes[prev].arom&&nodes[r.atom].arom?1.5:1)});delete rings[key];}else rings[key]={atom:prev,order:pending};pending=null;i++;continue;}
  let el=null,arom=false,q=0,h=0;
  if(ch==='['){
   const end=smiles.indexOf(']',i);if(end<0)throw Error('atom bracket invalid');
   const inside=smiles.slice(i+1,end),m=inside.match(/^(Cl|Br|[A-Z][a-z]?|[cnosp])/);if(!m)throw Error('atom bracket unsupported');
   el=m[1];arom=el===el.toLowerCase();el=el[0].toUpperCase()+el.slice(1);
   const hm=inside.match(/H(\d*)/);if(hm)h=Number(hm[1]||1);
   const qm=inside.match(/([+-])(\d*)/);if(qm)q=(qm[1]==='+'?1:-1)*Number(qm[2]||1);
   i=end+1;
  } else if(/[A-Z]/.test(ch)){const two=smiles.slice(i,i+2);el=['Cl','Br'].includes(two)?two:ch;i+=el.length;}
  else if(/[cnosp]/.test(ch)){el=ch.toUpperCase();arom=true;i++;}
  else if(ch==='\\'||ch==='/'||ch==='@'){i++;continue;}
  else throw Error('simbol SMILES necunoscut: '+ch);
  if(!valence[el])throw Error('element nesuportat: '+el);
  add(el,arom,q,h);
 }
 if(stack.length||Object.keys(rings).length)throw Error('ciclu sau ramificație neînchisă');
 // Convert aromatic bonds into a Kekulé matching: one double bond per aromatic atom.
 const aromaticEdges=edges.filter(e=>e.order===1.5), aromaticNodes=new Set();
 aromaticEdges.forEach(e=>{aromaticNodes.add(e.a);aromaticNodes.add(e.b);e.order=1;});
 const ordered=[...aromaticNodes].sort((a,b)=>a-b),matched=new Set();
 function matchAromatic(pos){
  while(pos<ordered.length&&matched.has(ordered[pos]))pos++;
  if(pos>=ordered.length)return true;
  const a=ordered[pos];
  for(const e of aromaticEdges){
   const b=e.a===a?e.b:e.b===a?e.a:-1;
   if(b<0||matched.has(b))continue;
   matched.add(a);matched.add(b);e.order=2;
   if(matchAromatic(pos+1))return true;
   matched.delete(a);matched.delete(b);e.order=1;
  }
  return false;
 }
 if(ordered.length%2===0)matchAromatic(0);
 const implicitH=[];
 nodes.forEach((n,k)=>{
  const used=edges.filter(e=>e.a===k||e.b===k).reduce((sum,e)=>sum+e.order,0);
  let target=valence[n.el];
  if(n.charge>0)target+=n.charge;
  if(n.charge<0)target+=n.charge;
  if(n.arom&&n.el==='C')target=4;
  const h=Math.max(0,Math.round(target-used-n.explicitH));
  if(h>4)throw Error('valență invalidă '+n.el);
  implicitH[k]=n.explicitH+h;
 });
 nodes.forEach((n,k)=>n.implicitH=implicitH[k]);
 return {nodes,edges};
}
function expectedLonePairs(n,graph,index){
 const used=graph.edges.filter(e=>e.a===index||e.b===index).reduce((s,e)=>s+e.order,0);
 const bondHydrogens=n.implicitH||0;
 return Math.max(0,Math.round((electrons[n.el]-(n.charge||0)-used-bondHydrogens)/2));
}
function expectedGraph(compound){
 const g=parseSmiles(compound.smiles);
 g.nodes.forEach((n,i)=>n.lp=expectedLonePairs(n,g,i));
 return g;
}
function supported(compound){
 try{const g=expectedGraph(compound);return g.nodes.length<=45&&g.nodes.every(n=>allowedElements.includes(n.el)&&Number.isInteger(n.lp));}
 catch(e){return false;}
}
function formula(compound){
 const g=parseSmiles(compound.smiles),counts={};
 g.nodes.forEach(n=>{counts[n.el]=(counts[n.el]||0)+1;if(n.implicitH)counts.H=(counts.H||0)+n.implicitH;});
 return ['C','H','N','O','S','P','F','Cl','Br','I'].filter(x=>counts[x]).map(x=>x+(counts[x]>1?counts[x]:'')).join('');
}
function getPoint(e){const r=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;return{x:(e.clientX-r.left)*v.width/r.width,y:(e.clientY-r.top)*v.height/r.height};}
function hit(x,y){return atoms.find(a=>Math.hypot(a.x-x,a.y-y)<25);}
function el(name,attrs){const n=document.createElementNS(NS,name);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,v));return n;}
function render(){
 svg.replaceChildren();
 bonds.forEach(b=>{const a=atoms.find(x=>x.id===b.a),c=atoms.find(x=>x.id===b.b);if(!a||!c)return;const dx=c.x-a.x,dy=c.y-a.y,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len;for(let j=0;j<b.order;j++){const off=(j-(b.order-1)/2)*5;svg.append(el('line',{x1:a.x+px*off,y1:a.y+py*off,x2:c.x+px*off,y2:c.y+py*off,stroke:'#407bff','stroke-width':3,'stroke-linecap':'round'}));}});
 atoms.forEach(a=>{const g=el('g');g.append(el('circle',{cx:a.x,cy:a.y,r:22,fill:'#fff',stroke:bondFirst===a?'#2563eb':'#cbd5e1','stroke-width':2}));for(let p=0;p<(a.lonePairs||0);p++){const angle=(-Math.PI/2)+(2*Math.PI*p/Math.max(a.lonePairs,1));g.append(el('circle',{cx:a.x+Math.cos(angle)*15,cy:a.y+Math.sin(angle)*15,r:2.8,fill:'#2563eb'}));}const t=el('text',{x:a.x,y:a.y+5,'text-anchor':'middle','font-family':'JetBrains Mono,monospace','font-size':a.element.length>1?13:16,'font-weight':700,fill:'#17243c'});t.textContent=a.element;g.append(t);if(a.charge){const q=el('text',{x:a.x+17,y:a.y-14,'font-size':12,'font-weight':800,fill:a.charge>0?'#d9485f':'#2563eb'});q.textContent=(Math.abs(a.charge)>1?Math.abs(a.charge):'')+(a.charge>0?'+':'−');g.append(q);}svg.append(g);});
}
function resetCanvas(){atoms=[];bonds=[];nextId=1;bondFirst=null;$('result').className='lb-result';$('result').textContent='';render();}
function setTool(t){tool=t;bondFirst=null;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));render();}
function setElement(e){element=e;document.querySelectorAll('[data-element]').forEach(b=>b.classList.toggle('active',b.dataset.element===e));}
function graphFromCanvas(){
 const heavy=atoms.filter(a=>a.element!=='H'),index=new Map(heavy.map((a,i)=>[a.id,i]));
 return{nodes:heavy.map(a=>({el:a.element,charge:a.charge||0,lp:a.lonePairs||0})),edges:bonds.filter(b=>index.has(b.a)&&index.has(b.b)).map(b=>({a:index.get(b.a),b:index.get(b.b),order:b.order}))};
}
function isomorphic(user,expected){
 if(user.nodes.length!==expected.nodes.length||user.edges.length!==expected.edges.length)return false;
 const degree=g=>g.nodes.map((n,i)=>g.edges.filter(e=>e.a===i||e.b===i).length);
 const du=degree(user),de=degree(expected),order=Array.from(user.nodes.keys()).sort((a,b)=>du[b]-du[a]);
 const map=Array(user.nodes.length).fill(-1),used=new Set();
 function compatible(u,v){
  const x=user.nodes[u],y=expected.nodes[v];
  if(x.el!==y.el||x.charge!==(y.charge||0)||x.lp!==y.lp||du[u]!==de[v])return false;
  for(let k=0;k<user.nodes.length;k++)if(map[k]!==-1){
   const ue=user.edges.find(e=>(e.a===u&&e.b===k)||(e.a===k&&e.b===u));
   const ve=expected.edges.find(e=>(e.a===v&&e.b===map[k])||(e.a===map[k]&&e.b===v));
   if(Boolean(ue)!==Boolean(ve)||(ue&&Math.abs(ue.order-ve.order)>0.01))return false;
  }
  return true;
 }
 function visit(pos){
  if(pos===order.length)return true;
  const u=order[pos];
  for(let v=0;v<expected.nodes.length;v++){
   if(used.has(v)||!compatible(u,v))continue;
   map[u]=v;used.add(v);
   if(visit(pos+1))return true;
   used.delete(v);map[u]=-1;
  }
  return false;
 }
 return visit(0);
}
function validate(){
 if(!current)return;
 const expected=expectedGraph(current),user=graphFromCanvas(),ok=isomorphic(user,expected),r=$('result');
 r.className='lb-result '+(ok?'ok':'no');
 r.textContent=ok?'Structură corectă. Hidrogenii au fost considerați implicit.':'Structura nu corespunde. Verifică atomii grei, legăturile, sarcinile și perechile neparticipante.';
 if(!ok){const d=document.createElement('div');d.style.marginTop='5px';d.textContent='Desen: '+user.nodes.length+' atomi / '+user.edges.length+' legături. Așteptat: '+expected.nodes.length+' atomi / '+expected.edges.length+' legături.';r.append(d);}
}
function newTask(){
 const cat=$('categorySelect').value,diff=$('difficultySelect').value;
 challengePool=all.filter(c=>(cat==='all'||c.category===cat)&&supported(c));
 if(diff==='small')challengePool=challengePool.filter(c=>parseSmiles(c.smiles).nodes.length<=6);
 if(diff==='medium')challengePool=challengePool.filter(c=>{const n=parseSmiles(c.smiles).nodes.length;return n>=7&&n<=12;});
 if(!challengePool.length){$('taskName').textContent='Nu există compuși compatibili';$('taskMeta').textContent='';current=null;resetCanvas();return;}
 current=challengePool[Math.floor(Math.random()*challengePool.length)];
 $('taskName').textContent=current.iupacRo;
 $('taskMeta').textContent=(current.commonRo&&current.commonRo!==current.iupacRo?current.commonRo+' · ':'')+formula(current);
 resetCanvas();
}
function pointerDown(e){
 const p=getPoint(e),a=hit(p.x,p.y);
 if(tool==='atom'&&!a){atoms.push({id:nextId++,element,x:p.x,y:p.y,lonePairs:0,charge:0});render();return;}
 if(tool==='delete'&&a){atoms=atoms.filter(x=>x!==a);bonds=bonds.filter(b=>b.a!==a.id&&b.b!==a.id);render();return;}
 if(tool==='lone'&&a){a.lonePairs=(a.lonePairs+1)%5;render();return;}
 if(tool==='charge'&&a){a.charge=charge;render();return;}
 if(tool==='bond'&&a){if(!bondFirst)bondFirst=a;else if(bondFirst!==a){const old=bonds.find(b=>(b.a===a.id&&b.b===bondFirst.id)||(b.a===bondFirst.id&&b.b===a.id));if(old)old.order=order;else bonds.push({a:bondFirst.id,b:a.id,order});bondFirst=null;}render();return;}
 if(a){drag={atom:a};svg.setPointerCapture(e.pointerId);}
}
function pointerMove(e){if(!drag)return;const p=getPoint(e);drag.atom.x=Math.max(25,Math.min(875,p.x));drag.atom.y=Math.max(25,Math.min(405,p.y));render();}
function pointerUp(){drag=null;}
function init(){
 $('categorySelect').innerHTML=[['all','Toate clasele'],...Object.entries(categories)].map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('');
 $('elementTools').innerHTML=allowedElements.filter(e=>e!=='H').map(e=>'<button class="lb-tool'+(e==='C'?' active':'')+'" data-element="'+e+'">'+e+'</button>').join('');
 $('elementTools').querySelectorAll('[data-element]').forEach(b=>b.addEventListener('click',()=>setElement(b.dataset.element)));
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
 document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>{order=Number(b.dataset.order);document.querySelectorAll('[data-order]').forEach(x=>x.classList.toggle('active',x===b));}));
 document.querySelectorAll('[data-charge]').forEach(b=>b.addEventListener('click',()=>{charge=Number(b.dataset.charge);document.querySelectorAll('[data-charge]').forEach(x=>x.classList.toggle('active',x===b));}));
 svg.addEventListener('pointerdown',pointerDown);svg.addEventListener('pointermove',pointerMove);svg.addEventListener('pointerup',pointerUp);svg.addEventListener('pointercancel',pointerUp);
 $('clearBtn').addEventListener('click',resetCanvas);$('newTaskBtn').addEventListener('click',newTask);$('validateBtn').addEventListener('click',validate);
 $('categorySelect').addEventListener('change',newTask);$('difficultySelect').addEventListener('change',newTask);
 $('supportedCount').textContent=all.filter(supported).length+' / '+all.length+' compuși disponibili';
 newTask();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();