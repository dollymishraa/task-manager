const KEY='gwenchana.v1', IMG='public/stickers/';
const STICKERS=['sticker-coffee.jpg','sticker-laptop.jpg','sticker-fire.jpg'];
const MILESTONES=[{n:1,f:'sticker-laptop.jpg',t:'First task done'},{n:5,f:'sticker-coffee.jpg',t:'5 tasks done'},{n:10,f:'sticker-fire.jpg',t:'10 tasks done'}];
const COMPANION={neutral:'sticker-laptop.jpg',cheerful:'sticker-coffee.jpg',determined:'sticker-fire.jpg'};
const STATUS={todo:'To Do',doing:'In Progress',done:'Completed'};
const CHEERS=['Nice work! Gwenchana, you did it!','One more down. Keep going!','Great job! Take a little bow.','You are on a roll!'];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

let state, editId=null, pickedSticker='';
let available=new Set(); // static sticker files that actually exist

// Sticker helpers: static files in public/stickers, or imported images (custom:<id>)
const customOf=f=>(state.custom||[]).find(c=>'custom:'+c.id===f);
const stickerSrc=f=>f.startsWith('custom:')?(customOf(f)?.data||''):(window.STICKER_DATA||{})[f]||IMG+f;
const stickerList=()=>[...STICKERS.filter(f=>available.has(f)),...(state.custom||[]).map(c=>'custom:'+c.id)];
const probe=()=>STICKERS.forEach(f=>{const i=new Image();i.onload=()=>{available.add(f);render()};i.src=IMG+f});

// Hide any sticker image whose file is missing
document.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.style.visibility='hidden'},true);

// localStorage with in-memory fallback (storage can be blocked in previews)
let memory=null;
const storage={
  get(){try{return localStorage.getItem(KEY)}catch(e){return memory}},
  set(v){try{localStorage.setItem(KEY,v)}catch(e){memory=v}}
};
const newTask=data=>({id:uid(),status:'todo',priority:'Medium',desc:'',due:'',category:'',sticker:'',created:Date.now(),...data});

function seed(){
  const d=new Date(Date.now()+864e5).toISOString().slice(0,16);
  return {doneEver:0,custom:[],tasks:[
    {id:uid(),title:'Welcome to gwenchana',desc:'Move me to In Progress, then mark me complete.',status:'todo',priority:'Medium',category:'Starter',due:d,sticker:'',created:Date.now()},
    {id:uid(),title:'Add your first real task',desc:'Use the New task button.',status:'todo',priority:'Low',category:'Starter',due:'',sticker:'',created:Date.now()}]};
}
function load(){
  const raw=storage.get();
  if(raw===null) return seed();
  try{const d=JSON.parse(raw); if(!d||!Array.isArray(d.tasks)) throw 0; d.doneEver=d.doneEver||0;d.custom=d.custom||[]; return d;}
  catch(e){setTimeout(()=>toast('Saved data could not be read. Starter tasks were restored.'),300); return seed();}
}
const save=()=>storage.set(JSON.stringify(state));
const isOver=t=>t.status!=='done'&&t.due&&new Date(t.due)<new Date();
const fmt=s=>s?new Date(s).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'';

function mood(){
  const T=state.tasks, n=T.length, done=T.filter(t=>t.status==='done').length, over=T.filter(isOver).length, open=n-done;
  let m='neutral', msg='Add a task and we will tackle it together.';
  if(n){
    if(over){m='determined';msg=`${over} overdue. Pick one and start small, you can do it!`}
    else if(open>=8){m='determined';msg=`${open} tasks open. One at a time, gwenchana!`}
    else if(done/n>=.7){m='cheerful';msg='So proud of you! Almost everything is done.'}
    else msg=`${done} of ${n} done. Keep it steady.`;
  }
  $('#mood').style.visibility='visible'; $('#mood').src=stickerSrc(COMPANION[m]);
  $('#msg').textContent=msg;
  $('#bar i').style.width=(n?Math.round(done/n*100):0)+'%';
}

function filtered(){
  const q=$('#q').value.trim().toLowerCase(), fs=$('#fs').value, fc=$('#fc').value, fp=$('#fp').value;
  return state.tasks.filter(t=>(fs==='all'||t.status===fs)&&(fc==='all'||t.category===fc)&&(fp==='all'||t.priority===fp)&&(!q||(t.title+' '+t.desc).toLowerCase().includes(q)));
}
function cats(){return [...new Set(state.tasks.map(t=>t.category).filter(Boolean))].sort()}
function syncCats(){
  const cur=$('#fc').value||'all', c=cats();
  $('#fc').innerHTML='<option value="all">All categories</option>'+c.map(x=>`<option>${esc(x)}</option>`).join('');
  $('#fc').value=c.includes(cur)?cur:'all';
  $('#cats').innerHTML=c.map(x=>`<option value="${esc(x)}">`).join('');
}
function cardHTML(t){
  const o=isOver(t), order=['todo','doing','done'], i=order.indexOf(t.status);
  return `<article class="card raised p-${t.priority}${o?' over':''}">
    ${t.sticker?`<img class="st" src="${esc(stickerSrc(t.sticker))}" alt="">`:''}
    <h3>${esc(t.title)}</h3>${t.desc?`<p>${esc(t.desc)}</p>`:''}
    <span class="tag pr">${t.priority}</span>${t.category?`<span class="tag">${esc(t.category)}</span>`:''}
    ${t.due?`<span class="tag${o?' od':''}">${o?'Overdue · ':''}${fmt(t.due)}</span>`:''}
    <div class="acts">
      ${i>0?`<button data-a="mv" data-s="${order[i-1]}" data-id="${t.id}">&larr; ${STATUS[order[i-1]]}</button>`:''}
      ${i<2?`<button data-a="mv" data-s="${order[i+1]}" data-id="${t.id}">${STATUS[order[i+1]]} &rarr;</button>`:''}
      ${t.status!=='done'?`<button class="pri" data-a="mv" data-s="done" data-id="${t.id}">Complete</button>`:''}
      <button data-a="ed" data-id="${t.id}">Edit</button><button data-a="del" data-id="${t.id}">Delete</button>
    </div></article>`;
}
function render(){
  syncCats();
  const list=filtered();
  $('#board').innerHTML=['todo','doing','done'].map(s=>{
    const items=list.filter(t=>t.status===s);
    return `<div class="lane inset"><h2>${STATUS[s]}<span>${items.length}</span></h2>${items.map(cardHTML).join('')||'<div class="empty">Nothing here yet</div>'}</div>`;
  }).join('');
  mood(); renderDrawer();
}

function setStatus(id,s){
  const t=state.tasks.find(x=>x.id===id); if(!t||t.status===s) return;
  const was=t.status; t.status=s;
  if(s==='done'&&was!=='done'){
    state.doneEver++; save(); render(); celebrate();
    const m=MILESTONES.find(m=>m.n===state.doneEver);
    if(m) setTimeout(()=>toast('Sticker unlocked: '+m.t),1800);
  } else {save();render();}
}
function celebrate(){
  const cols=['#f7a8c4','#a8e6cf','#a8d4f7','#c9b6f2','#ffe6a8'];
  for(let i=0;i<50;i++){const c=document.createElement('i');c.className='conf';
    c.style.left=Math.random()*100+'vw';c.style.background=cols[i%5];c.style.animationDelay=Math.random()*.6+'s';
    document.body.appendChild(c);setTimeout(()=>c.remove(),2800);}
  try{const a=new (window.AudioContext||window.webkitAudioContext)();
    [523,659,784].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=f;o.type='triangle';
      g.gain.setValueAtTime(.15,a.currentTime+i*.12);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+i*.12+.3);
      o.connect(g);g.connect(a.destination);o.start(a.currentTime+i*.12);o.stop(a.currentTime+i*.12+.32);});}catch(e){}
  toast(CHEERS[Math.floor(Math.random()*CHEERS.length)]);
}
let tt;function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),2600);}

/* Task modal */
function stickerPicker(){
  $('#pick').innerHTML=`<label><input type="radio" name="stk" value=""><span>None</span></label>`+
    stickerList().map(f=>`<label><input type="radio" name="stk" value="${f}"><span><img src="${esc(stickerSrc(f))}" alt="sticker"></span></label>`).join('');
  const r=[...document.querySelectorAll('[name=stk]')].find(x=>x.value===pickedSticker)||document.querySelector('[name=stk]');
  r.checked=true;
}
function openTask(id){
  editId=id||null; const t=state.tasks.find(x=>x.id===id);
  $('#dlgTitle').textContent=t?'Edit task':'New task';
  $('#t').value=t?t.title:'';$('#d').value=t?t.desc:'';$('#due').value=t?t.due:'';
  $('#pr').value=t?t.priority:'Medium';$('#cat').value=t?t.category:'';
  $('#tErr').textContent='';pickedSticker=t?t.sticker:'';stickerPicker();
  $('#taskDlg').showModal();$('#t').focus();
}
function saveTask(){
  const title=$('#t').value.trim();
  if(!title){$('#tErr').textContent='Add a title before saving.';$('#t').focus();return;}
  const sel=document.querySelector('[name=stk]:checked');
  const data={title,desc:$('#d').value.trim(),due:$('#due').value,priority:$('#pr').value,category:$('#cat').value.trim(),sticker:sel?sel.value:''};
  if(editId) Object.assign(state.tasks.find(x=>x.id===editId),data);
  else state.tasks.push(newTask(data));
  save();render();$('#taskDlg').close();
}

/* Drawer */
function renderDrawer(){
  const n=state.doneEver;
  $('#msCount').textContent=`${n} task${n===1?'':'s'} completed in total.`;
  $('#msList').innerHTML=MILESTONES.map(m=>`<div class="ms raised${n>=m.n?'':' lock'}"><img src="${stickerSrc(m.f)}" alt=""><div><strong>${m.t}</strong><br><small>${n>=m.n?'Unlocked':`${m.n-n} more to unlock`}</small></div></div>`).join('');
  $('#lib').innerHTML=stickerList().map(f=>`<span class="inset" style="display:flex;justify-content:center;padding:6px"><img src="${esc(stickerSrc(f))}" alt="sticker" width="56" height="56" style="object-fit:contain"></span>`).join('');
}

/* Export */
const csvCell=v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
async function exportZip(){
  if(typeof JSZip==='undefined'){toast('ZIP library failed to load. Check your connection.');return;}
  const T=state.tasks, zip=new JSZip(), done=T.filter(t=>t.status==='done');
  zip.file('tasks.json',JSON.stringify({exportedAt:new Date().toISOString(),completedTotal:state.doneEver,tasks:T},null,2));
  zip.file('tasks.csv',['title,status,priority,category,due'].concat(T.map(t=>[t.title,STATUS[t.status],t.priority,t.category,t.due].map(csvCell).join(','))).join('\n'));
  const md=['# gwenchana summary','',`Exported: ${new Date().toLocaleString()}`,''];
  if(!T.length) md.push('No tasks recorded.');
  else{
    md.push(`- Total tasks: ${T.length}`,`- Completed: ${done.length} (${Math.round(done.length/T.length*100)}%)`,`- Overdue: ${T.filter(isOver).length}`,'','## Completed tasks','');
    md.push(...(done.length?done.map(t=>`- ${t.title}${t.category?` (${t.category})`:''}`):['None yet.']));
  }
  zip.file('summary.md',md.join('\n'));
  const folder=zip.folder('stickers'), used=[...new Set(T.map(t=>t.sticker).filter(Boolean))];
  let missing=0;
  for(const f of used){try{const r=await fetch(stickerSrc(f));if(!r.ok)throw 0;folder.file(f.startsWith('custom:')?f.slice(7)+'.png':f.split('/').pop(),await r.blob());}catch(e){missing++;}}
  const blob=await zip.generateAsync({type:'blob'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gwenchana-export.zip';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast(missing?`Exported. ${missing} sticker file(s) not found in ${IMG}`:'Export downloaded.');
  $('#expDlg').close();
}

/* Events */
$('#board').addEventListener('click',e=>{
  const b=e.target.closest('button[data-a]');if(!b)return;
  const id=b.dataset.id,a=b.dataset.a;
  if(a==='mv')setStatus(id,b.dataset.s);
  else if(a==='ed')openTask(id);
  else if(a==='del'&&confirm('Delete this task?')){state.tasks=state.tasks.filter(t=>t.id!==id);save();render();}
});
['#q','#fs','#fc','#fp'].forEach(s=>$(s).addEventListener('input',render));
$('#add').onclick=()=>openTask();
$('#imp').onclick=()=>$('#impFile').click();
$('#impFile').addEventListener('change',e=>{
  const files=[...e.target.files];
  Promise.all(files.map(f=>new Promise(res=>{const r=new FileReader();r.onload=()=>res({id:uid(),data:r.result});r.readAsDataURL(f)})))
    .then(list=>{state.custom.push(...list);save();render();toast(`${list.length} sticker(s) imported.`)});
  e.target.value='';
});
$('#quick').addEventListener('submit',e=>{
  e.preventDefault();
  const title=$('#qt').value.trim();
  if(!title) return toast('Type a title first.');
  state.tasks.push(newTask({title}));
  $('#qt').value='';save();render();
});
$('#save').onclick=saveTask;$('#cancel').onclick=()=>$('#taskDlg').close();
$('#t').addEventListener('keydown',e=>{if(e.key==='Enter')saveTask()});
$('#stk').onclick=()=>$('#drawer').classList.add('open');
$('#closeDrawer').onclick=()=>$('#drawer').classList.remove('open');
$('#exp').onclick=()=>$('#expDlg').showModal();
$('#expCancel').onclick=()=>$('#expDlg').close();
$('#expGo').onclick=exportZip;

state=load();save();render();probe();
setInterval(()=>{mood();document.querySelectorAll('.card').length&&render()},60000);
