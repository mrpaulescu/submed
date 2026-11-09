(() => {
'use strict';
const all=typeof UNIQUE_COMPOUNDS!=='undefined'?UNIQUE_COMPOUNDS:[];
const $=id=>document.getElementById(id), svg=$('lewisCanvas'), NS='http://www.w3.org/2000/svg';
const categories={alcani:'Alcani și cicloalcani',alchene:'Alchene și alcadiene',alchine:'Alchine',aromatici:'Arene',halogenati:'Derivați halogenați',alcooli:'Alcooli și polioli',fenoli:'Fenoli',amine:'Amine',nitroderivati:'Nitroderivați',carbonilici:'Aldehide și cetone',carboxilici:'Acizi carboxilici','acizi grasi':'Acizi grași','derivati acizi':'Esteri, amide și nitrili',aminoacizi:'Aminoacizi',zaharide:'Zaharide'};
const valence={C:4,N:3,O:2,F:1,Cl:1,Br:1,I:1,S:2,P:3,H:1};
const loneExpected={C:0,N:1,O:2,F:3,Cl:3,Br:3,I:3,S:2,P:1,H:0};
let atoms=[],bonds=[],nextId=1,tool='atom',element='C',order=1,bondFirst=null,drag=null,current=null,challengePool=[];
const allowedElements=['C','H','O','N','F','Cl','Br','I','S','P'];
function parseSmiles(smiles){
 const nodes=[],edges=[],stack=[],rings={},s=smiles;let i=0,prev=null,pending=null;
 const add=(el,arom=false)=>{const n={id:nodes.length,el,arom};nodes.push(n);if(prev!==null){let b=pending??(arom&&nodes[prev].arom?1.5:1);edges.push({a:prev,b:n.id,order:b});}prev=n.id;pending=null;};
 while(i<s.length){
  const ch=s[i];
  if(ch==='('){if(prev===null)throw Error('branch');stack.push(prev);i++;continue;}
  if(ch===')'){prev=stack.pop();if(prev===undefined)throw Error('branch close');i++;continue;}
  if(ch==='-'||ch==='='||ch==='#'||ch===':'){pending=ch==='='?2:ch==='#'?3:ch===':'?1.5:1;i++;continue;}
  if(/\d/.test(ch)){const key=ch;if(rings[key]){const r=rings[key];edges.push({a:r.atom,b:prev,order:pending??r.order??(nodes[prev].arom&&nodes[r.atom].arom?1.5:1)});delete rings[key];}else rings[key]={atom:prev,order:pending};pending=null;i++;continue;}
  let el=null,arom=false;
  if(ch==='['){const end=s.indexOf(']',i);if(end<0)throw Error('bracket');const inside=s.slice(i+1,end);const m=inside.match(/^(Cl|Br|[A-Z][a-z]?|[cnosp])/);if(!m)throw Error('bracket atom');el=m[1];arom=el===el.toLowerCase();el=el[0].toUpperCase()+el.slice(1);i=end+1;}
  else if(/[A-Z]/.test(ch)){const two=s.slice(i,i+2);el=['Cl','Br'].includes(two)?two:ch;i+=el.length;}
  else if(/[cnosp]/.test(ch)){el=ch.toUpperCase();arom=true;i++;}
  else if(ch==='\\'||ch==='/'||ch==='@'||ch==='+'||ch==='-'){i++;continue;}
  else throw Error('unsupported token '+ch);
  if(!valence[el])throw Error('unsupported element '+el);
  add(el,arom);
 }
 if(stack.length||Object.keys(rings).length)throw Error('unclosed ring or branch');
 const used=nodes.map(n=>edges.filter(e=>e.a===n.id||e.b===n.id).reduce((a,e)=>a+e.order,0));
 nodes.forEach((n,k)=>{
  let target=valence[n.el];
  if(n.arom&&n.el==='C')target=4;
  if(n.arom&&n.el==='N')target=3;
  let h=Math.round(target-used[k]);
  if(h<0||h>4)throw Error('invalid valence '+n.el+' '+used[k]);
  for(let z=0;z<h;z++){const id=nodes.length;nodes.push({id,el:'H',arom:false});edges.push({a:n.id,b:id,order:1});}
 });
 // Kekule form: alternating single/double bonds for aromatic rings.
 const aromatic = edges.filter(e=>e.order===1.5);
 aromatic.forEach((e,k)=>{e.order=(k%2===0)?2:1;});
 return {nodes,edges};
}
function supported(compound){try{const g=parseSmiles(compound.smiles);return g.nodes.length<=45&&g.nodes.every(n=>allowedElements.includes(n.el))&&g.nodes.every(n=>loneExpected[n.el]!==undefined);}catch(e){return false;}}
function formula(compound){const g=parseSmiles(compound.smiles),counts={};g.nodes.forEach(n=>counts[n.el]=(counts[n.el]||0)+1);return ['C','H','N','O','S','P','F','Cl','Br','I'].filter(x=>counts[x]).map(x=>x+(counts[x]>1?counts[x]:'')).join('');}
function getPoint(e){const r=svg.getBoundingClientRect(),v=svg.viewBox.baseVal;return{x:(e.clientX-r.left)*v.width/r.width,y:(e.clientY-r.top)*v.height/r.height};}
function hit(x,y){return atoms.find(a=>Math.hypot(a.x-x,a.y-y)<25);}
function el(name,attrs){const n=document.createElementNS(NS,name);Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,v));return n;}
function render(){
 svg.replaceChildren();
 bonds.forEach(b=>{const a=atoms.find(x=>x.id===b.a),c=atoms.find(x=>x.id===b.b);if(!a||!c)return;const dx=c.x-a.x,dy=c.y-a.y,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len;for(let j=0;j<b.order;j++){const off=(j-(b.order-1)/2)*5;svg.append(el('line',{x1:a.x+px*off,y1:a.y+py*off,x2:c.x+px*off,y2:c.y+py*off,stroke:'#407bff','stroke-width':3,'stroke-linecap':'round'}));}});
 atoms.forEach(a=>{const g=el('g');g.append(el('circle',{cx:a.x,cy:a.y,r:22,fill:'#fff',stroke:bondFirst===a?'#2563eb':'#cbd5e1','stroke-width':2}));const pairs=a.lonePairs||0;for(let p=0;p<pairs;p++){const angle=(-Math.PI/2)+(2*Math.PI*p/Math.max(pairs,1));g.append(el('circle',{cx:a.x+Math.cos(angle)*15,cy:a.y+Math.sin(angle)*15,r:2.8,fill:'#2563eb'}));}const t=el('text',{x:a.x,y:a.y+5,'text-anchor':'middle','font-family':'JetBrains Mono,monospace','font-size':a.element.length>1?13:16,'font-weight':700,fill:'#17243c'});t.textContent=a.element;g.append(t);svg.append(g);});
}
function resetCanvas(){atoms=[];bonds=[];nextId=1;bondFirst=null;$('result').className='lb-result';$('result').textContent='';render();}
function setTool(t){tool=t;bondFirst=null;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));render();}
function setElement(e){element=e;document.querySelectorAll('[data-element]').forEach(b=>b.classList.toggle('active',b.dataset.element===e));}
function addAtom(pt){if(hit(pt.x,pt.y))return;atoms.push({id:nextId++,element,x:pt.x,y:pt.y,lonePairs:0});}
function pointerDown(e){const p=getPoint(e),a=hit(p.x,p.y);if(tool==='atom'&&!a){addAtom(p);render();return;}if(tool==='delete'&&a){atoms=atoms.filter(x=>x!==a);bonds=bonds.filter(b=>b.a!==a.id&&b.b!==a.id);render();return;}if(tool==='lone'&&a){a.lonePairs=(a.lonePairs+1)%5;render();return;}if(tool==='bond'&&a){if(!bondFirst){bondFirst=a;}else if(bondFirst!==a){const old=bonds.find(b=>(b.a===a.id&&b.b===bondFirst.id)||(b.a===bondFirst.id&&b.b===a.id));if(old)old.order=order;else bonds.push({a:bondFirst.id,b:a.id,order});bondFirst=null;}render();return;}if(a){drag={atom:a,pointer:e.pointerId};svg.setPointerCapture(e.pointerId);}}
function pointerMove(e){if(!drag)return;const p=getPoint(e);drag.atom.x=Math.max(25,Math.min(875,p.x));drag.atom.y=Math.max(25,Math.min(405,p.y));render();}
function pointerUp(){drag=null;}
function graphFromCanvas(){return{nodes:atoms.map(a=>({el:a.element,lp:a.lonePairs||0})),edges:bonds.map(b=>({a:atoms.findIndex(x=>x.id===b.a),b:atoms.findIndex(x=>x.id===b.b),order:b.order}))};}
function isomorphic(user,expected){
 if(user.nodes.length!==expected.nodes.length||user.edges.length!==expected.edges.length)return false;
 const degree=g=>g.nodes.map((n,i)=>g.edges.filter(e=>e.a===i||e.b===i).length);
 const du=degree(user),de=degree(expected),order=Array.from(user.nodes.keys()).sort((a,b)=>du[b]-du[a]);
 const map=Array(user.nodes.length).fill(-1),used=new Set();
 function compatible(u,v){const x=user.nodes[u],y=expected.nodes[v];if(x.el!==y.el||x.lp!==y.lp||du[u]!==de[v])return false;for(let k=0;k<user.nodes.length;k++)if(map[k]!==-1){const ue=user.edges.find(e=>(e.a===u&&e.b===k)||(e.a===k&&e.b===u));const ve=expected.edges.find(e=>(e.a===v&&e.b===map[k])||(e.a===map[k]&&e.b===v));if(Boolean(ue)!==Boolean(ve)||(ue&&Math.abs(ue.order-ve.order)>0.01))return false;}return true;}
 function visit(pos){if(pos===order.length)return true;const u=order[pos];for(let v=0;v<expected.nodes.length;v++){if(used.has(v)||!compatible(u,v))continue;map[u]=v;used.add(v);if(visit(pos+1))return true;used.delete(v);map[u]=-1;}return false;}
 return visit(0);
}
function expectedGraph(compound){const g=parseSmiles(compound.smiles);g.nodes.forEach((n,i)=>{n.lp=loneExpected[n.el];});return g;}
function validate(){if(!current)return;const expected=expectedGraph(current),user=graphFromCanvas();const ok=isomorphic(user,expected);const r=$('result');r.className='lb-result '+(ok?'ok':'no');r.textContent=ok?'Structură corectă! Atomii, legăturile și perechile neparticipante corespund compusului.':'Structura nu corespunde încă. Verifică numărul atomilor, legăturile simple/duble/triple și perechile neparticipante.';if(!ok){const detail=document.createElement('div');detail.style.marginTop='5px';detail.textContent='Desenul tău: '+user.nodes.length+' atomi și '+user.edges.length+' legături. Structura-țintă: '+expected.nodes.length+' atomi și '+expected.edges.length+' legături.';r.append(detail);}}
function newTask(){const cat=$('categorySelect').value,diff=$('difficultySelect').value;challengePool=all.filter(c=>(cat==='all'||c.category===cat)&&supported(c));if(diff==='small')challengePool=challengePool.filter(c=>parseSmiles(c.smiles).nodes.filter(n=>n.el!=='H').length<=6);if(diff==='medium')challengePool=challengePool.filter(c=>{const n=parseSmiles(c.smiles).nodes.filter(n=>n.el!=='H').length;return n>=7&&n<=12;});if(!challengePool.length){$('taskName').textContent='Nu există compuși compatibili';$('taskMeta').textContent='Alege altă clasă sau alt nivel.';current=null;resetCanvas();return;}current=challengePool[Math.floor(Math.random()*challengePool.length)];$('taskName').textContent=current.iupacRo;$('taskMeta').textContent=(current.commonRo&&current.commonRo!==current.iupacRo?'Denumire uzuală: '+current.commonRo+' · ':'')+'Formula: '+formula(current)+' · '+(categories[current.category]||current.category);resetCanvas();}
function init(){const opts=[['all','Toate clasele'],...Object.entries(categories)];$('categorySelect').innerHTML=opts.map(([v,l])=>'<option value="'+v+'">'+l+'</option>').join('');$('elementTools').innerHTML=allowedElements.map(e=>'<button class="lb-tool'+(e==='C'?' active':'')+'" data-element="'+e+'">'+e+'</button>').join('');$('elementTools').querySelectorAll('[data-element]').forEach(b=>b.addEventListener('click',()=>setElement(b.dataset.element)));document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));document.querySelectorAll('[data-order]').forEach(b=>b.addEventListener('click',()=>{order=Number(b.dataset.order);document.querySelectorAll('[data-order]').forEach(x=>x.classList.toggle('active',x===b));}));svg.addEventListener('pointerdown',pointerDown);svg.addEventListener('pointermove',pointerMove);svg.addEventListener('pointerup',pointerUp);svg.addEventListener('pointercancel',pointerUp);$('clearBtn').addEventListener('click',resetCanvas);$('newTaskBtn').addEventListener('click',newTask);$('validateBtn').addEventListener('click',validate);$('categorySelect').addEventListener('change',newTask);$('difficultySelect').addEventListener('change',newTask);$('supportedCount').textContent=all.filter(supported).length+' / '+all.length+' compuși din biblioteca comună pot fi exersați în builder în versiunea curentă.';newTask();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();