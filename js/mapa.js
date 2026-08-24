(function() {
"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
 
const TYPES = {
  wall:["Parede",2.4,.12],
  door:["Porta",.9,.12],
  window:["Janela",1.5,.12],
  bench:["Bancada",2.4,.75],
  benchL:["Bancada L",2.2,2.2],
  sink:["Pia",.7,.6],
  hood:["Capela",1.8,.85],
  cabinet:["Armário",1.2,.55],
  shelf:["Estante",1.1,.5],
  equipment:["Equipamento",.65,.55],
  zone:["Circulação",2,1.2],
  chemical:["Risco químico",1.1,1.1],
  biological:["Risco biológico",1.1,1.1],
  physical:["Risco físico",1.1,1.1],
  fire:["Risco de incêndio",1.1,1.1],
  electrical:["Risco elétrico",1.1,1.1],
  ergonomic:["Risco ergonômico",1.1,1.1],
  radiation:["Risco de radiação",1.1,1.1],
  slip:["Risco de queda",1.1,1.1],
  shower:["Chuveiro de emergência",.55,.55],
  eyewash:["Lava-olhos",.45,.45],
  extinguisher:["Extintor",.25,.25],
  exit:["Saída de emergência",.9,.12]
};

const RISK_TYPES = ["chemical","biological","physical","fire","electrical","ergonomic","radiation","slip"];
const RISK_COLORS = {chemical:"#c8a16d",biological:"#8fb09a",physical:"#a9a0bf",fire:"#c8836f",electrical:"#d2b36e",ergonomic:"#9da8b5",radiation:"#b79cbd",slip:"#93aebc"};

const EQUIPMENT_TYPES = ["shower", "eyewash", "extinguisher"];

// Dicionário nativo para geração vetorial completa no SVG exportado
const NATIVE_SVG_TEMPLATES = {
  extinguisher: '<circle cx="50" cy="50" r="44" fill="#ef444422" stroke="#ef4444" stroke-width="3.5"/><rect x="40" y="38" width="20" height="35" rx="4" fill="#ef4444" opacity="0.85"/><path d="M38 73 h24" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/><path d="M46 38 v-5 h8 v5" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 33 l8 -6" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/><path d="M60 44 c6 0 8 6 4 12" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>',
  eyewash: '<circle cx="50" cy="50" r="44" fill="#0ea5e922" stroke="#0ea5e9" stroke-width="3.5"/><path d="M36 55 c0 11 28 11 28 0 z" fill="#0ea5e9" opacity="0.8"/><path d="M47 55 v13 h6 v-13" fill="#0ea5e9"/><rect x="38" y="68" width="24" height="4" rx="2" fill="#0ea5e9"/><path d="M38 52 q-4 -12 5 -15" fill="none" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/><path d="M62 52 q4 -12 -5 -15" fill="none" stroke="#0ea5e9" stroke-width="3" stroke-linecap="round"/><path d="M43 37 q7 -7 14 0" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>',
  shower: '<circle cx="50" cy="50" r="44" fill="#0ea5e922" stroke="#0ea5e9" stroke-width="3.5"/><path d="M36 28 h22 c3 0 5 2 5 5 v4" fill="none" stroke="#0ea5e9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M54 37 h18 l-3 8 h-12 z" fill="#0ea5e9"/><path d="M51 54 l-3 10 M59 54 v12 M67 54 l3 10" fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 4"/>',
  biological: '<circle cx="50" cy="50" r="44" fill="#8fb09a22" stroke="#8fb09a" stroke-width="3.5"/><circle cx="50" cy="38" r="12" fill="none" stroke="#8fb09a" stroke-width="4"/><circle cx="39" cy="58" r="12" fill="none" stroke="#8fb09a" stroke-width="4"/><circle cx="61" cy="58" r="12" fill="none" stroke="#8fb09a" stroke-width="4"/><circle cx="50" cy="50" r="5" fill="#8fb09a"/><path d="M50 44 v12 M44 50 h12" stroke="#0a0f13" stroke-width="2"/>',
  chemical: '<circle cx="50" cy="50" r="44" fill="#c8a16d22" stroke="#c8a16d" stroke-width="3.5"/><path d="M42 24 h16 v12 l15 29 c2 4 -1 9 -6 9 H33 c-5 0 -8 -5 -6 -9 l15 -29 v-12 z" fill="#c8a16d1a" stroke="#c8a16d" stroke-width="4" stroke-linejoin="round"/><path d="M30 60 q20 6 40 0 v8 a6 6 0 0 1 -6 6 H36 a6 6 0 0 1 -6 -6 z" fill="#c8a16d" opacity="0.6"/><path d="M45 42 h10" stroke="#c8a16d" stroke-width="3" stroke-linecap="round"/>',
  electrical: '<circle cx="50" cy="50" r="44" fill="#d2b36e22" stroke="#d2b36e" stroke-width="3.5"/><polygon points="56,22 34,52 51,52 44,78 70,44 52,44" fill="#d2b36e" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>',
  ergonomic: '<circle cx="50" cy="50" r="44" fill="#9da8b522" stroke="#9da8b5" stroke-width="3.5"/><rect x="35" y="60" width="30" height="24" rx="2" fill="none" stroke="#9da8b5" stroke-width="3.5"/><path d="M35 69 h30" stroke="#9da8b5" stroke-width="2"/><path d="M50 60 v9" stroke="#9da8b5" stroke-width="2"/><circle cx="40" cy="30" r="5.5" fill="#9da8b5"/><path d="M43 36 C40 45 42 53 48 60" fill="none" stroke="#9da8b5" stroke-width="5" stroke-linecap="round"/><path d="M43 40 L50 60" fill="none" stroke="#9da8b5" stroke-width="4" stroke-linecap="round"/><path d="M48 60 L32 68 L26 82" fill="none" stroke="#9da8b5" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 35 C66 42 66 50 60 58" fill="none" stroke="#c8836f" stroke-width="3" stroke-linecap="round"/><path d="M57 37 L60 33 L63 37" fill="none" stroke="#c8836f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  fire: '<circle cx="50" cy="50" r="44" fill="#c8836f22" stroke="#c8836f" stroke-width="3.5"/><path d="M50 20 c0 22 -17 27 -17 43 a17 17 0 0 0 34 0 c0 -16 -17 -21 -17 -43 z" fill="#c8836f" opacity="0.85"/><path d="M50 36 c0 11 -8 13 -8 21 a8 8 0 0 0 16 0 c0 -8 -8 -10 -8 -21 z" fill="#f1f3f4" opacity="0.9"/>',
  physical: '<circle cx="50" cy="50" r="44" fill="#a9a0bf22" stroke="#a9a0bf" stroke-width="3.5"/><path d="M30 50 a20 20 0 0 1 40 0" fill="none" stroke="#a9a0bf" stroke-width="4" stroke-linecap="round"/><path d="M22 40 a32 32 0 0 1 56 0" fill="none" stroke="#a9a0bf" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/><path d="M14 30 a44 44 0 0 1 72 0" fill="none" stroke="#a9a0bf" stroke-width="3" stroke-linecap="round" opacity="0.4"/><circle cx="50" cy="62" r="8" fill="#a9a0bf"/><path d="M42 75 h16" stroke="#a9a0bf" stroke-width="4" stroke-linecap="round"/>',
  radiation: '<circle cx="50" cy="50" r="44" fill="#b79cbd22" stroke="#b79cbd" stroke-width="3.5"/><circle cx="50" cy="50" r="7" fill="#b79cbd"/><g fill="#b79cbd"><path d="M50 50 m0 -10 a22 22 0 0 1 19 -11 l-3.5 18.5 a12 12 0 0 0 -15.5 -0.5 z" transform="rotate(0 50 50)"/><path d="M50 50 m0 -10 a22 22 0 0 1 19 -11 l-3.5 18.5 a12 12 0 0 0 -15.5 -0.5 z" transform="rotate(120 50 50)"/><path d="M50 50 m0 -10 a22 22 0 0 1 19 -11 l-3.5 18.5 a12 12 0 0 0 -15.5 -0.5 z" transform="rotate(240 50 50)"/></g>',
  slip: '<circle cx="50" cy="50" r="44" fill="#93aebc22" stroke="#93aebc" stroke-width="3.5"/><path d="M25 78 Q50 70 75 78" fill="none" stroke="#93aebc" stroke-width="4" stroke-linecap="round"/><path d="M38 84 Q50 80 62 84" fill="none" stroke="#93aebc" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/><circle cx="34" cy="34" r="6" fill="#93aebc"/><path d="M38 42 L52 62" fill="none" stroke="#93aebc" stroke-width="6" stroke-linecap="round"/><path d="M42 45 L24 40" fill="none" stroke="#93aebc" stroke-width="4" stroke-linecap="round"/><path d="M45 48 L60 38" fill="none" stroke="#93aebc" stroke-width="4" stroke-linecap="round"/><path d="M52 62 L72 68" fill="none" stroke="#93aebc" stroke-width="5" stroke-linecap="round"/><path d="M52 62 L66 74" fill="none" stroke="#93aebc" stroke-width="4" stroke-linecap="round"/><path d="M68 62 L78 58 M62 55 L70 50" stroke="#93aebc" stroke-width="2.5" stroke-linecap="round"/>'
};

const CATEGORIES = {
  estrutura: {
    label: "Estrutura & Acessos",
    types: ["wall", "door", "window", "zone", "exit"]
  },
  mobiliario: {
    label: "Mobiliário & Pias",
    types: ["bench", "benchL", "sink", "cabinet", "shelf"]
  },
  equipamentos: {
    label: "Equipamentos & Exaustão",
    types: ["hood", "equipment"]
  },
  seguranca: {
    label: "Segurança de Emergência",
    types: EQUIPMENT_TYPES
  },
  riscos: {
    label: "Sinalização de Riscos",
    types: RISK_TYPES
  }
};

const state = {
  room:{w:12,h:8},
  cam:{x:6,y:4,zoom:70},
  grid:true,snap:true,ruler:false,tool:"select",
  selected:null,drag:null,pan:false,last:null,
  history:[],future:[],
  objects:[]
};

const riskImages = {};
RISK_TYPES.forEach(type => {
  const img = new Image();
  img.src = `assets/svg/risk-${type}.svg`;
  img.onload = () => { draw(); };
  riskImages[type] = img;
});

const equipmentImages = {};
EQUIPMENT_TYPES.forEach(type => {
  const img = new Image();
  img.src = `assets/svg/equipment-${type}.svg`;
  img.onload = () => { draw(); };
  equipmentImages[type] = img;
});

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const snapVal = v => state.snap ? Math.round(v/.1)*.1 : v;
const num = v => Number.parseFloat(v);

function pushHistory(){
  state.history.push(JSON.stringify(state.objects));
  if(state.history.length>50) state.history.shift();
  state.future.length=0;
}
function undo(){
  if(!state.history.length) return;
  state.future.push(JSON.stringify(state.objects));
  state.objects=JSON.parse(state.history.pop());
  state.selected=null; updateUI(); draw();
}
function redo(){
  if(!state.future.length) return;
  state.history.push(JSON.stringify(state.objects));
  state.objects=JSON.parse(state.future.pop());
  state.selected=null; updateUI(); draw();
}

function resizeCanvas(){
  const r=canvas.getBoundingClientRect(), d=window.devicePixelRatio||1;
  canvas.width=Math.max(1,Math.floor(r.width*d));
  canvas.height=Math.max(1,Math.floor(r.height*d));
  ctx.setTransform(d,0,0,d,0,0);
  draw();
}

function fitRoom(){
  const cw=canvas.clientWidth,ch=canvas.clientHeight;
  if(!cw||!ch) return;
  const margin=80;
  state.cam.x=state.room.w/2;
  state.cam.y=state.room.h/2;
  state.cam.zoom=Math.max(10,Math.min((cw-margin)/state.room.w,(ch-margin)/state.room.h));
  updateZoomText(); draw();
}

function updateZoomText(){ $("zoomText").textContent=Math.round(state.cam.zoom/70*100)+"%"; }

function worldToScreen(x,y){
  return {x:(x-state.cam.x)*state.cam.zoom+canvas.clientWidth/2,y:(y-state.cam.y)*state.cam.zoom+canvas.clientHeight/2};
}
function screenToWorld(x,y){
  return {x:(x-canvas.clientWidth/2)/state.cam.zoom+state.cam.x,y:(y-canvas.clientHeight/2)/state.cam.zoom+state.cam.y};
}

function normalizeObject(o){
  o.w=Math.max(.05,Math.min(state.room.w,o.w));
  o.h=Math.max(.05,Math.min(state.room.h,o.h));
  o.x=clamp(o.x,0,Math.max(0,state.room.w-o.w));
  o.y=clamp(o.y,0,Math.max(0,state.room.h-o.h));
  o.rot=((o.rot||0)%360+360)%360;
}
function normalizeAll(){state.objects.forEach(normalizeObject);}

function applyRoom(){
  const w=num($("roomW").value), h=num($("roomH").value);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<2||h<2||w>100||h>100){
    $("roomFeedback").textContent="Use valores entre 2,0 e 100,0 m.";
    $("roomFeedback").classList.add("error");
    return false;
  }
  pushHistory();
  state.room.w=Math.round(w*10)/10;
  state.room.h=Math.round(h*10)/10;
  normalizeAll();
  $("roomW").value=state.room.w.toFixed(1);
  $("roomH").value=state.room.h.toFixed(1);
  $("roomFeedback").textContent=`Sala atual: ${state.room.w.toFixed(1).replace(".",",")} × ${state.room.h.toFixed(1).replace(".",",")} m`;
  $("roomFeedback").classList.remove("error");
  fitRoom();
  updateUI();
  return true;
}

function setRoomFeedback(){
  const w=num($("roomW").value),h=num($("roomH").value);
  if(Number.isFinite(w)&&Number.isFinite(h)){
    $("roomFeedback").textContent=`Novo tamanho: ${w.toFixed(1).replace(".",",")} × ${h.toFixed(1).replace(".",",")} m`;
    $("roomFeedback").classList.remove("error");
  }
}
$("roomW").addEventListener("input",setRoomFeedback);
$("roomH").addEventListener("input",setRoomFeedback);

function addObject(type,x,y){
  if(!TYPES[type]) return;
  pushHistory();
  const [label,w0,h0]=TYPES[type];
  let w=w0,h=h0;
  if(type==="wall"||type==="door"||type==="window") { w=Math.min(w,state.room.w); }
  const o={id:crypto.randomUUID(),type,x:x-w/2,y:y-h/2,w,h,rot:0};
  normalizeObject(o);
  state.objects.push(o);
  state.selected=o;
  updateUI(); draw();
}

function hitTest(sx,sy){
  const p=screenToWorld(sx,sy);
  for(let i=state.objects.length-1;i>=0;i--){
    const o=state.objects[i];
    const cx=o.x+o.w/2,cy=o.y+o.h/2;
    const a=-(o.rot||0)*Math.PI/180;
    const dx=p.x-cx,dy=p.y-cy;
    const rx=dx*Math.cos(a)-dy*Math.sin(a);
    const ry=dx*Math.sin(a)+dy*Math.cos(a);
    if(Math.abs(rx)<=o.w/2 && Math.abs(ry)<=o.h/2) return o;
  }
  return null;
}

function draw(){
  const W=canvas.clientWidth,H=canvas.clientHeight;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle="#0a0f13";ctx.fillRect(0,0,W,H);

  const tl=worldToScreen(0,0), rw=state.room.w*state.cam.zoom,rh=state.room.h*state.cam.zoom;
  ctx.fillStyle="#c6ccd0";ctx.fillRect(tl.x,tl.y,rw,rh);

  if(state.grid){
    ctx.save();ctx.beginPath();ctx.rect(tl.x,tl.y,rw,rh);ctx.clip();
    const step=Math.max(5,state.cam.zoom*.1);
    ctx.strokeStyle="#78858b30";ctx.lineWidth=1;
    for(let x=tl.x;x<=tl.x+rw;x+=step){ctx.beginPath();ctx.moveTo(x,tl.y);ctx.lineTo(x,tl.y+rh);ctx.stroke();}
    for(let y=tl.y;y<=tl.y+rh;y+=step){ctx.beginPath();ctx.moveTo(tl.x,y);ctx.lineTo(tl.x+rw,y);ctx.stroke();}
    ctx.restore();
  }

  ctx.strokeStyle="#f1f3f4";ctx.lineWidth=Math.max(4,state.cam.zoom*.12);ctx.strokeRect(tl.x,tl.y,rw,rh);

  ctx.fillStyle="#27323a";ctx.font="10px Arial";
  ctx.fillText(`${state.room.w.toFixed(1)} m`,tl.x+rw/2-18,tl.y-10);
  ctx.save();ctx.translate(tl.x-10,tl.y+rh/2);ctx.rotate(-Math.PI/2);ctx.fillText(`${state.room.h.toFixed(1)} m`,0,0);ctx.restore();

  state.objects.forEach(drawObject);
  if(state.selected) drawSelection(state.selected);
  if(state.ruler) drawRulers();
}

function drawObject(o){
  const p=worldToScreen(o.x+o.w/2,o.y+o.h/2),w=o.w*state.cam.zoom,h=o.h*state.cam.zoom;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate((o.rot||0)*Math.PI/180);ctx.translate(-w/2,-h/2);

  if(RISK_TYPES.includes(o.type)){
    drawRisk(o.type,w,h);
  } else if(EQUIPMENT_TYPES.includes(o.type)){
    drawEquipment(o.type,w,h);
  } else if(o.type==="wall"){
    ctx.fillStyle="#e2e8f0";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#475569";ctx.lineWidth=1.5;ctx.strokeRect(0,0,w,h);
  } else if(o.type==="bench"){
    drawBench(w,h);
  } else if(o.type==="benchL"){
    const t=Math.max(10,Math.min(w,h)*0.28);
    ctx.fillStyle="#64748b";ctx.fillRect(0,0,w,t);ctx.fillRect(0,0,t,h);
    ctx.fillStyle="#94a3b8";ctx.fillRect(0,0,w,Math.max(3,t*0.15));ctx.fillRect(0,0,Math.max(3,t*0.15),h);
    ctx.strokeStyle="#475569";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(t,t);ctx.lineTo(w,t);ctx.moveTo(t,t);ctx.lineTo(t,h);ctx.stroke();
  } else if(o.type==="door"){
    ctx.fillStyle="#1b2329";
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#94a3b8";
    ctx.lineWidth=1.5;
    ctx.strokeRect(0,0,w,h);
    
    ctx.strokeStyle="#f8fbfc";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(0,h);
    ctx.lineTo(0,0);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(0, h, w, -Math.PI/2, 0);
    ctx.strokeStyle="#fcf8f8";
    ctx.lineWidth=1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if(o.type==="window"){
    ctx.fillStyle="#0ea5e922";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#cbd5e1";ctx.lineWidth=2;ctx.strokeRect(0,0,w,h);
    ctx.strokeStyle="#38bdf8";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
  } else if(o.type==="sink"){
    ctx.fillStyle="#94a3b8";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#cbd5e1";
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(w*0.12, h*0.12, w*0.76, h*0.76, 4);
    else ctx.rect(w*0.12, h*0.12, w*0.76, h*0.76);
    ctx.fill();ctx.strokeStyle="#475569";ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle="#1e293b";ctx.beginPath();ctx.arc(w/2, h*0.22, Math.min(w,h)*0.08, 0, Math.PI*2);ctx.fill();
  } else if(o.type==="hood"){
    ctx.fillStyle="#334155";ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#64748b";ctx.fillRect(w*0.06,h*0.12,w*0.88,h*0.76);
    ctx.fillStyle="#0f172a";ctx.fillRect(w*0.1,h*0.18,w*0.8,h*0.55);
    ctx.fillStyle="#38bdf8";ctx.beginPath();ctx.arc(w/2, h*0.45, Math.min(w,h)*0.12, 0, Math.PI*2);ctx.fill();
  } else if(["cabinet","shelf"].includes(o.type)){
    ctx.fillStyle="#475569";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#94a3b8";ctx.lineWidth=1.5;ctx.strokeRect(0,0,w,h);
    if(o.type==="shelf"){
      ctx.strokeStyle="#cbd5e1";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    } else {
      ctx.strokeStyle="#1e293b";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();
    }
  } else if(o.type==="equipment"){
    ctx.fillStyle="#cbd5e1";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#334155";ctx.lineWidth=1.5;ctx.strokeRect(0,0,w,h);
    ctx.fillStyle="#0f172a";ctx.fillRect(w*0.12,h*0.15,w*0.76,h*0.3);
    ctx.fillStyle="#22c55e";ctx.beginPath();ctx.arc(w*0.8, h*0.3, Math.min(w,h)*0.06, 0, Math.PI*2);ctx.fill();
  } else if(o.type==="zone"){
    ctx.fillStyle="rgba(56, 189, 248, 0.08)";ctx.fillRect(0,0,w,h);
    ctx.setLineDash([6,4]);ctx.strokeStyle="#38bdf8";ctx.lineWidth=1.5;ctx.strokeRect(0,0,w,h);ctx.setLineDash([]);
  } else if(o.type==="exit"){
    ctx.fillStyle="#22c55e";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#14532d";ctx.lineWidth=1.5;ctx.strokeRect(0,0,w,h);
    ctx.fillStyle="#ffffff";ctx.font=`bold ${Math.max(8,w*0.28)}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("SAÍDA",w/2,h/2);
  }
  ctx.restore();
}

function drawBench(w,h){
  ctx.fillStyle="#64748b";ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#94a3b8";ctx.fillRect(0,0,w,Math.max(3,h*0.16));
  ctx.fillStyle="#334155";ctx.fillRect(w*0.04,h*0.2,w*0.92,h*0.72);
}

function drawRisk(type, w, h){
  const img = riskImages[type];
  if (img && img.complete && img.naturalHeight !== 0) {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    const c = RISK_COLORS[type] || "#aebbc2";
    const r = Math.min(w, h) * 0.38;
    ctx.fillStyle = c + "33"; 
    ctx.strokeStyle = c; 
    ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2); 
    ctx.fill(); 
    ctx.stroke();
    
    ctx.fillStyle = c;
    ctx.font = `bold ${Math.max(10, Math.min(w, h) * 0.36)}px Arial`;
    ctx.textAlign = "center"; 
    ctx.textBaseline = "middle";
    const symbol = {chemical:"Q", biological:"B", physical:"F", fire:"I", electrical:"E", ergonomic:"G", radiation:"R", slip:"C"}[type] || "?";
    ctx.fillText(symbol, w / 2, h / 2);
    ctx.textAlign = "left"; 
    ctx.textBaseline = "alphabetic";
  }
}

function drawEquipment(type, w, h){
  const img = equipmentImages[type];
  if (img && img.complete && img.naturalHeight !== 0) {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    const c = type === "extinguisher" ? "#ef4444" : "#0ea5e9";
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = type === "extinguisher" ? "#991b1b" : "#0369a1";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(8, w * 0.32)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = type === "extinguisher" ? "EXT" : (type === "shower" ? "DU" : "LO");
    ctx.fillText(text, w / 2, h / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
}

function drawSelection(o){
  const p=worldToScreen(o.x+o.w/2,o.y+o.h/2),w=o.w*state.cam.zoom,h=o.h*state.cam.zoom;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate((o.rot||0)*Math.PI/180);ctx.strokeStyle="#d4a45b";ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.strokeRect(-w/2-3,-h/2-3,w+6,h+6);ctx.setLineDash([]);ctx.fillStyle="#d4a45b";ctx.fillRect(w/2-4,h/2-4,8,8);ctx.restore();
}

function drawRulers(){
  const tl = worldToScreen(0,0);
  ctx.strokeStyle = "#50636d";
  ctx.fillStyle = "#91a1a9";
  ctx.font = "9px Arial";

  for(let x = 0; x <= state.room.w; x++){
    const p = worldToScreen(x, 0);
    if(x % 1 === 0){
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 4);
      ctx.lineTo(p.x, p.y - 10);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(x), p.x, p.y - 13);
    }
  }

  for(let y = 0; y <= state.room.h; y++){
    const p = worldToScreen(0, y);
    if(y % 1 === 0){
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y);
      ctx.lineTo(p.x - 10, p.y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(y), p.x - 13, p.y);
    }
  }
  
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function setMode(tool){
  state.tool=tool;
  document.querySelectorAll(".mode").forEach(b=>b.classList.remove("active"));
  if(tool==="select") $("selectMode").classList.add("active");
  if(tool==="pan") $("panMode").classList.add("active");
  document.querySelectorAll("#palette button").forEach(b=>b.classList.toggle("chosen",b.dataset.type===tool));
}

canvas.addEventListener("pointerdown", e => {
  const p={x:e.offsetX,y:e.offsetY};
  
  if(window.innerWidth <= 1024){
    const leftPanel = document.querySelector(".left-panel");
    const rightPanel = document.querySelector(".right-panel");
    if(leftPanel) leftPanel.classList.remove("open");
    if(rightPanel) rightPanel.classList.remove("open");
  }

  if(state.tool==="pan" || e.button===1){
    state.pan=true; state.last=p;
  } else {
    const hit=hitTest(p.x,p.y);
    if(hit){
      state.selected=hit;
      state.drag={o:hit,dx:screenToWorld(p.x,p.y).x-hit.x,dy:screenToWorld(p.x,p.y).y-hit.y};
      pushHistory();
    } else {
      state.selected=null;
    }
    updateUI(); draw();
  }
});

canvas.addEventListener("pointermove",e=>{
  const p={x:e.offsetX,y:e.offsetY};
  if(state.pan){
    state.cam.x-=(p.x-state.last.x)/state.cam.zoom;
    state.cam.y-=(p.y-state.last.y)/state.cam.zoom;
    state.last=p; draw();
  } else if(state.drag){
    const q=screenToWorld(p.x,p.y);
    state.drag.o.x=snapVal(q.x-state.drag.dx);
    state.drag.o.y=snapVal(q.y-state.drag.dy);
    normalizeObject(state.drag.o);
    updateUI(); draw();
  }
});

canvas.addEventListener("pointerup",()=>{state.pan=false;state.drag=null;});

canvas.addEventListener("wheel",e=>{
  e.preventDefault();const before=screenToWorld(e.offsetX,e.offsetY);
  state.cam.zoom=clamp(state.cam.zoom*(e.deltaY<0?1.1:.9),15,220);
  const after=screenToWorld(e.offsetX,e.offsetY);
  state.cam.x+=before.x-after.x;state.cam.y+=before.y-after.y;updateZoomText();draw();
},{passive:false});

document.querySelectorAll("#palette button").forEach(b=>b.addEventListener("click",()=>{
  const type=b.dataset.type;
  if(type==="wall"||type==="door"||type==="window"||type==="bench"||type==="benchL"||type==="sink"||type==="hood"||type==="cabinet"||type==="shelf"||type==="equipment"||type==="zone"||RISK_TYPES.includes(type)||EQUIPMENT_TYPES.includes(type)||(TYPES[type]&&type!=="select"&&type!=="pan")){
    addObject(type,state.room.w/2,state.room.h/2);
  }
  canvas.focus();
}));

$("selectMode").onclick=()=>setMode("select");
$("panMode").onclick=()=>setMode("pan");
$("grid").onclick=()=>{state.grid=!state.grid;$("grid").classList.toggle("active",state.grid);draw();};
$("snap").onclick=()=>{state.snap=!state.snap;$("snap").classList.toggle("active",state.snap);};
$("ruler").onclick=()=>{state.ruler=!state.ruler;$("ruler").classList.toggle("active",state.ruler);draw();};
$("zoomIn").onclick=()=>{state.cam.zoom=clamp(state.cam.zoom*1.15,15,220);updateZoomText();draw();};
$("zoomOut").onclick=()=>{state.cam.zoom=clamp(state.cam.zoom*.87,15,220);updateZoomText();draw();};
$("fitRoom").onclick=fitRoom;
$("applyRoom").onclick=applyRoom;
$("undo").onclick=undo;$("redo").onclick=redo;

const btnBack = $("btnBack");
if(btnBack){
  btnBack.onclick = () => {
    state.selected = null;
    updateUI();
    draw();
  };
}

$("rotate").onclick=()=>{
  if(!state.selected)return;pushHistory();state.selected.rot=(state.selected.rot+90)%360;normalizeObject(state.selected);updateUI();draw();
};
$("duplicate").onclick=()=>{
  if(!state.selected)return;pushHistory();
  const o={...state.selected,id:crypto.randomUUID(),x:state.selected.x+.2,y:state.selected.y+.2};normalizeObject(o);
  state.objects.push(o);state.selected=o;updateUI();draw();
};
$("delete").onclick=()=>{
  if(!state.selected)return;pushHistory();state.objects=state.objects.filter(o=>o!==state.selected);state.selected=null;updateUI();draw();
};
$("rot").oninput=e=>$("rotVal").textContent=e.target.value+"°";
$("applyProps").onclick=()=>{
  if(!state.selected)return;
  const vals={x:num($("x").value),y:num($("y").value),w:num($("w").value),h:num($("h").value),rot:num($("rot").value)};
  if(Object.values(vals).some(v=>!Number.isFinite(v)))return;
  pushHistory();Object.assign(state.selected,vals);normalizeObject(state.selected);updateUI();draw();
};

const btnToggleTools = document.getElementById("btnToggleTools");
const btnToggleProps = document.getElementById("btnToggleProps");
const leftPanelElem = document.querySelector(".left-panel");
const rightPanelElem = document.querySelector(".right-panel");

if (btnToggleTools && leftPanelElem) {
  btnToggleTools.addEventListener("click", (e) => {
    e.stopPropagation();
    leftPanelElem.classList.toggle("open");
    if (rightPanelElem) rightPanelElem.classList.remove("open");
    btnToggleTools.classList.toggle("active-panel", leftPanelElem.classList.contains("open"));
    if (btnToggleProps) btnToggleProps.classList.remove("active-panel");
  });
}

if (btnToggleProps && rightPanelElem) {
  btnToggleProps.addEventListener("click", (e) => {
    e.stopPropagation();
    rightPanelElem.classList.toggle("open");
    if (leftPanelElem) leftPanelElem.classList.remove("open");
    btnToggleProps.classList.toggle("active-panel", rightPanelElem.classList.contains("open"));
    if (btnToggleTools) btnToggleTools.classList.remove("active-panel");
  });
}

function renderObjectsTree() {
  const treeContainer = $("objectsTree");
  const totalBadge = $("totalObjectsBadge");
  if (!treeContainer) return;

  if (state.objects.length === 0) {
    totalBadge.textContent = "0 itens";
    treeContainer.innerHTML = `<div class="empty-tree-msg">Nenhum elemento adicionado ao laboratório ainda.</div>`;
    return;
  }

  totalBadge.textContent = `${state.objects.length} item${state.objects.length > 1 ? 's' : ''}`;
  let html = "";

  Object.keys(CATEGORIES).forEach(catKey => {
    const cat = CATEGORIES[catKey];
    const itemsInCat = state.objects.filter(o => cat.types.includes(o.type));

    if (itemsInCat.length > 0) {
      html += `
        <div class="tree-category">
          <div class="tree-category-title">${cat.label} (${itemsInCat.length})</div>
          <div class="tree-category-items">
      `;

      itemsInCat.forEach((o, index) => {
        const typeName = TYPES[o.type]?.[0] || o.type;
        const isSelected = state.selected && state.selected.id === o.id;
        html += `
          <div class="tree-item ${isSelected ? 'active' : ''}" data-id="${o.id}">
            <span class="tree-item-name">${typeName} #${index + 1}</span>
            <span class="tree-item-coords">(${o.x.toFixed(1)}m, ${o.y.toFixed(1)}m)</span>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    }
  });

  treeContainer.innerHTML = html;

  treeContainer.querySelectorAll(".tree-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      const found = state.objects.find(obj => obj.id === id);
      if (found) {
        state.selected = found;
        updateUI();
        draw();
      }
    });
  });
}

function updateUI(){
  const o=state.selected;
  $("title").textContent=o?(TYPES[o.type]?.[0]||o.type):"Visão Geral do Mapa";
  $("sub").textContent=o?"Edite posição, tamanho e rotação.":"Lista de elementos posicionados por categoria.";
  
  if(btnBack) btnBack.classList.toggle("hidden", !o);

  $("emptyProps").classList.toggle("hidden",!!o);
  $("props").classList.toggle("hidden",!o);

  if(!o){
    renderObjectsTree();
  } else {
    $("x").value=o.x.toFixed(2);
    $("y").value=o.y.toFixed(2);
    $("w").value=o.w.toFixed(2);
    $("h").value=o.h.toFixed(2);
    $("rot").value=o.rot;
    $("rotVal").textContent=o.rot+"°";
  }

  const count={};
  RISK_TYPES.forEach(t=>count[t]=0);
  state.objects.forEach(x=>{if(count[x.type]!==undefined)count[x.type]++;});
  $("riskList").innerHTML=RISK_TYPES.filter(t=>count[t]).map(t=>`<div class="risk-row"><span><i class="risk-dot" style="background:${RISK_COLORS[t]}"></i>${TYPES[t][0]}</span><b>${count[t]}</b></div>`).join("") || '<div class="risk-row">Nenhum risco inserido.</div>';
  
  const dimValid = state.room.w >= 3 && state.room.h >= 3 && (state.room.w * state.room.h) >= 12;
  const exitValid = state.objects.some(o => o.type === "door" || o.type === "exit");
  const safetyValid = state.objects.some(o => ["shower", "eyewash"].includes(o.type));
  const fireValid = state.objects.some(o => o.type === "extinguisher");
  const electricalValid = state.objects.some(o => o.type === "electrical" || o.type === "equipment");
  const chemicalBioValid = state.objects.some(o => o.type === "chemical" || o.type === "biological");
  const ventilationValid = state.objects.some(o => o.type === "hood" || o.type === "window");

  const checks = [
    { id: "check-dim", valid: dimValid },
    { id: "check-exit", valid: exitValid },
    { id: "check-safety", valid: safetyValid },
    { id: "check-fire", valid: fireValid },
    { id: "check-electrical", valid: electricalValid },
    { id: "check-chemical-bio", valid: chemicalBioValid },
    { id: "check-ventilation", valid: ventilationValid }
  ];

  let validCount = 0;
  checks.forEach(c => {
    const el = $(c.id);
    if (el) {
      el.classList.toggle("ok", c.valid);
      el.classList.toggle("checked", c.valid);
      if (c.valid) validCount++;
    }
  });

  const complianceBadge = $("compliance-badge");
  if (complianceBadge) {
    complianceBadge.textContent = `${validCount}/7`;
    complianceBadge.classList.toggle("complete", validCount === 7);
  }
}

$("save").onclick=()=>{
  const data={version:3,date:new Date().toISOString(),room:state.room,objects:state.objects};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="mapa-de-riscos-laboratorio.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
};

// EXPORTAÇÃO SVG CORRIGIDA COM GERENCIAMENTO NATIVO DE POSIÇÃO, ROTAÇÃO E DIRECIONAMENTO
const exportSvgBtn = $("exportSvg");
if (exportSvgBtn) {
  exportSvgBtn.onclick = () => {
    const scale = 50;
    const svgW = state.room.w * scale;
    const svgH = state.room.h * scale;

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%">`;
    svgContent += `<rect width="${svgW}" height="${svgH}" fill="#c6ccd0" stroke="#f1f3f4" stroke-width="8"/>`;

    state.objects.forEach(o => {
      const ox = o.x * scale;
      const oy = o.y * scale;
      const ow = o.w * scale;
      const oh = o.h * scale;
      const rot = o.rot || 0;
      const cx = ox + ow / 2;
      const cy = oy + oh / 2;

      svgContent += `<g transform="translate(${cx}, ${cy}) rotate(${rot}) translate(${-ow / 2}, ${-oh / 2})">`;

      if (NATIVE_SVG_TEMPLATES[o.type]) {
        // Gera o SVG nativamente embutido utilizando o viewBox 100x100 original dimensionado ao objeto
        svgContent += `<svg viewBox="0 0 100 100" width="${ow}" height="${oh}" x="0" y="0">${NATIVE_SVG_TEMPLATES[o.type]}</svg>`;
      } else if (o.type === "door") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#1b2329" stroke="#94a3b8" stroke-width="1.5"/>`;
        svgContent += `<path d="M0 ${oh} L0 0" stroke="#f8fbfc" stroke-width="2"/>`;
        svgContent += `<path d="M0 ${oh} A ${ow} ${oh} 0 0 1 ${ow} 0" fill="none" stroke="#fcf8f8" stroke-width="1.5" stroke-dasharray="4, 4"/>`;
      } else if (o.type === "window") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#0ea5e922" stroke="#cbd5e1" stroke-width="2"/>`;
        svgContent += `<line x1="0" y1="${oh/2}" x2="${ow}" y2="${oh/2}" stroke="#38bdf8" stroke-width="1.5"/>`;
      } else if (o.type === "wall") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#e2e8f0" stroke="#475569" stroke-width="1.5"/>`;
      } else if (o.type === "bench") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#64748b"/>`;
        svgContent += `<rect width="${ow}" height="${Math.max(3, oh*0.16)}" fill="#94a3b8"/>`;
        svgContent += `<rect x="${ow*0.04}" y="${oh*0.2}" width="${ow*0.92}" height="${oh*0.72}" fill="#334155"/>`;
      } else if (o.type === "benchL") {
        const t = Math.max(10, Math.min(ow, oh) * 0.28);
        svgContent += `<rect width="${ow}" height="${t}" fill="#64748b"/>`;
        svgContent += `<rect width="${t}" height="${oh}" fill="#64748b"/>`;
        svgContent += `<rect width="${ow}" height="${Math.max(3, t*0.15)}" fill="#94a3b8"/>`;
        svgContent += `<rect width="${Math.max(3, t*0.15)}" height="${oh}" fill="#94a3b8"/>`;
      } else if (o.type === "sink") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#94a3b8"/>`;
        svgContent += `<rect x="${ow*0.12}" y="${oh*0.12}" width="${ow*0.76}" height="${oh*0.76}" rx="4" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/>`;
        svgContent += `<circle cx="${ow/2}" cy="${oh*0.22}" r="${Math.min(ow,oh)*0.08}" fill="#1e293b"/>`;
      } else if (o.type === "hood") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#334155"/>`;
        svgContent += `<rect x="${ow*0.06}" y="${oh*0.12}" width="${ow*0.88}" height="${oh*0.76}" fill="#64748b"/>`;
        svgContent += `<rect x="${ow*0.1}" y="${oh*0.18}" width="${ow*0.8}" height="${oh*0.55}" fill="#0f172a"/>`;
        svgContent += `<circle cx="${ow/2}" cy="${oh*0.45}" r="${Math.min(ow,oh)*0.12}" fill="#38bdf8"/>`;
      } else if (o.type === "cabinet" || o.type === "shelf") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#475569" stroke="#94a3b8" stroke-width="1.5"/>`;
        if (o.type === "shelf") {
          svgContent += `<line x1="0" y1="${oh/2}" x2="${ow}" y2="${oh/2}" stroke="#cbd5e1" stroke-width="1"/>`;
        } else {
          svgContent += `<line x1="${ow/2}" y1="0" x2="${ow/2}" y2="${oh}" stroke="#1e293b" stroke-width="1"/>`;
        }
      } else if (o.type === "equipment") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#cbd5e1" stroke="#334155" stroke-width="1.5"/>`;
        svgContent += `<rect x="${ow*0.12}" y="${oh*0.15}" width="${ow*0.76}" height="${oh*0.3}" fill="#0f172a"/>`;
        svgContent += `<circle cx="${ow*0.8}" cy="${oh*0.3}" r="${Math.min(ow,oh)*0.06}" fill="#22c55e"/>`;
      } else if (o.type === "zone") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="rgba(56, 189, 248, 0.08)" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6,4"/>`;
      } else if (o.type === "exit") {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#22c55e" stroke="#14532d" stroke-width="1.5"/>`;
        svgContent += `<text x="${ow/2}" y="${oh/2}" fill="#ffffff" font-weight="bold" font-size="${Math.max(8, ow*0.28)}" text-anchor="middle" dominant-baseline="middle">SAÍDA</text>`;
      } else {
        svgContent += `<rect width="${ow}" height="${oh}" fill="#6c7880" stroke="#404b52" stroke-width="1"/>`;
      }

      svgContent += `</g>`;
    });

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mapa-de-riscos-laboratorio.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };
}

$("load").onclick=()=>$("fileInput").click();
$("fileInput").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const data=JSON.parse(await f.text());
    if(!data.room||!Array.isArray(data.objects))throw new Error("Formato inválido");
    state.room={w:num(data.room.w),h:num(data.room.h)};
    if(!Number.isFinite(state.room.w)||!Number.isFinite(state.room.h))throw new Error("Dimensões inválidas");
    state.objects=data.objects;normalizeAll();state.selected=null;
    $("roomW").value=state.room.w.toFixed(1);$("roomH").value=state.room.h.toFixed(1);
    $("roomFeedback").textContent=`Sala atual: ${state.room.w.toFixed(1).replace(".",",")} × ${state.room.h.toFixed(1).replace(".",",")} m`;
    state.history=[];state.future=[];fitRoom();updateUI();draw();
  }catch(err){alert("Não foi possível abrir o mapa: "+err.message);}
  e.target.value="";
});

window.addEventListener("keydown",e=>{
  if(e.key==="Delete")$("delete").click();
  if(e.ctrlKey&&e.key.toLowerCase()==="z"){e.preventDefault();undo();}
  if(e.ctrlKey&&e.key.toLowerCase()==="y"){e.preventDefault();redo();}
  if(e.key==="Escape"){setMode("select");state.selected=null;updateUI();draw();}
});
window.addEventListener("resize",resizeCanvas);

$("roomW").value=state.room.w.toFixed(1);$("roomH").value=state.room.h.toFixed(1);
$("roomFeedback").textContent=`Sala atual: ${state.room.w.toFixed(1).replace(".",",")} × ${state.room.h.toFixed(1).replace(".",",")} m`;
$("snap").classList.add("active");$("grid").classList.add("active");
updateUI();resizeCanvas();fitRoom();
})();
