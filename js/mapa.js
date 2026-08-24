(() => {
"use strict";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const TYPES = {
  wall:["Parede",2.4,.12],door:["Porta",.9,.12],window:["Janela",1.5,.12],
  bench:["Bancada",2.4,.75],benchL:["Bancada L",2.2,2.2],sink:["Pia",.7,.6],
  hood:["Capela",1.8,.85],cabinet:["Armário",1.2,.55],shelf:["Estante",1.1,.5],
  equipment:["Equipamento",.65,.55],zone:["Circulação",2,1.2],
  chemical:["Risco químico",1.1,1.1],biological:["Risco biológico",1.1,1.1],
  physical:["Risco físico",1.1,1.1],fire:["Risco de incêndio",1.1,1.1],
  electrical:["Risco elétrico",1.1,1.1],ergonomic:["Risco ergonômico",1.1,1.1],
  radiation:["Risco de radiação",1.1,1.1],slip:["Risco de queda",1.1,1.1],
  shower:["Chuveiro de emergência",.55,.55],eyewash:["Lava-olhos",.45,.45],
  extinguisher:["Extintor",.25,.25],exit:["Saída de emergência",.9,.12]
};

const RISK_TYPES = ["chemical","biological","physical","fire","electrical","ergonomic","radiation","slip"];
const RISK_COLORS = {chemical:"#c8a16d",biological:"#8fb09a",physical:"#a9a0bf",fire:"#c8836f",electrical:"#d2b36e",ergonomic:"#9da8b5",radiation:"#b79cbd",slip:"#93aebc"};

const state = {
  room:{w:12,h:8},
  cam:{x:6,y:4,zoom:70},
  grid:true,snap:true,ruler:false,tool:"select",
  selected:null,drag:null,pan:false,last:null,
  history:[],future:[],
  objects:[
    {id:"b1",type:"bench",x:1.2,y:1.7,w:3,h:.75,rot:0},
    {id:"b2",type:"bench",x:5,y:1.7,w:3,h:.75,rot:0},
    {id:"h1",type:"hood",x:9.2,y:.8,w:1.8,h:.85,rot:0},
    {id:"s1",type:"sink",x:9.3,y:2,w:.8,h:.6,rot:0},
    {id:"d1",type:"door",x:5.55,y:7.88,w:.9,h:.12,rot:0},
    {id:"z1",type:"zone",x:4,y:4.3,w:4,h:1.5,rot:0}
  ]
};

const $ = id => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const snap = v => state.snap ? Math.round(v/.1)*.1 : v;
const num = v => Number.parseFloat(v);

function deepCopyObjects(){ return JSON.parse(JSON.stringify(state.objects)); }
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

function roomPointInside(x,y){return x>=0&&y>=0&&x<=state.room.w&&y<=state.room.h;}

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
  } else if(o.type==="wall"){
    ctx.fillStyle="#f1f3f4";ctx.fillRect(0,0,w,h);
  } else if(o.type==="bench"){
    drawBench(w,h);
  } else if(o.type==="benchL"){
    const t=Math.max(8,Math.min(w,h)*.25);ctx.fillStyle="#6c7880";ctx.fillRect(0,0,w,t);ctx.fillRect(0,0,t,h);ctx.fillStyle="#8e9aa1";ctx.fillRect(0,0,w,Math.max(3,t*.18));ctx.fillRect(0,0,Math.max(3,t*.18),h);
  } else if(o.type==="door"){
    ctx.fillStyle="#ddd";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#c5a46d";ctx.lineWidth=3;ctx.strokeRect(1,1,w-2,h-2);
  } else if(o.type==="window"){
    ctx.fillStyle="#85a5b8";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#dce5e9";ctx.strokeRect(0,0,w,h);ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();
  } else if(o.type==="sink"){
    ctx.fillStyle="#aab5bb";ctx.fillRect(0,0,w,h);ctx.fillStyle="#5f6c74";ctx.fillRect(w*.15,h*.15,w*.7,h*.7);
  } else if(o.type==="hood"){
    ctx.fillStyle="#66747d";ctx.fillRect(0,0,w,h);ctx.fillStyle="#aab5bc";ctx.fillRect(w*.08,h*.18,w*.84,h*.62);ctx.fillStyle="#303940";ctx.fillRect(w*.08,h*.1,w*.84,h*.08);
  } else if(["cabinet","shelf"].includes(o.type)){
    ctx.fillStyle="#58656d";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#aeb7bd";ctx.strokeRect(0,0,w,h);
    if(o.type==="shelf"){ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();}
  } else if(o.type==="equipment"){
    ctx.fillStyle="#d7dde1";ctx.fillRect(0,0,w,h);ctx.strokeStyle="#48535b";ctx.strokeRect(0,0,w,h);ctx.fillStyle="#273038";ctx.fillRect(w*.12,h*.15,w*.76,h*.28);
  } else if(o.type==="zone"){
    ctx.fillStyle="#8198a833";ctx.fillRect(0,0,w,h);ctx.setLineDash([5,4]);ctx.strokeStyle="#8199a7";ctx.strokeRect(0,0,w,h);ctx.setLineDash([]);
  } else if(["shower","eyewash","extinguisher"].includes(o.type)){
    ctx.fillStyle="#8fa4ad";ctx.beginPath();ctx.arc(w/2,h/2,Math.min(w,h)*.42,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#223039";ctx.stroke();
  } else if(o.type==="exit"){
    ctx.strokeStyle="#8fa4ad";ctx.lineWidth=3;ctx.strokeRect(1,1,w-2,h-2);
    ctx.beginPath();ctx.moveTo(w*.15,h/2);ctx.lineTo(w*.85,h/2);ctx.moveTo(w*.65,h*.25);ctx.lineTo(w*.85,h/2);ctx.lineTo(w*.65,h*.75);ctx.stroke();
  }
  ctx.restore();
}

function drawBench(w,h){ctx.fillStyle="#6c7880";ctx.fillRect(0,0,w,h);ctx.fillStyle="#8e9aa1";ctx.fillRect(0,0,w,Math.max(3,h*.14));ctx.fillStyle="#404b52";ctx.fillRect(w*.05,h*.18,w*.9,h*.72);}
function drawRisk(type,w,h){
  const c=RISK_COLORS[type]||"#aebbc2";
  const r=Math.min(w,h)*.36;
  ctx.fillStyle=c+"33";ctx.strokeStyle=c;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(w/2,h/2,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle=c;ctx.font=`bold ${Math.max(10,Math.min(w,h)*.34)}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";
  const symbol={chemical:"Q",biological:"B",physical:"F",fire:"I",electrical:"E",ergonomic:"G",radiation:"R",slip:"C"}[type]||"?";
  ctx.fillText(symbol,w/2,h/2);
  ctx.textAlign="left";ctx.textBaseline="alphabetic";
}

function drawSelection(o){
  const p=worldToScreen(o.x+o.w/2,o.y+o.h/2),w=o.w*state.cam.zoom,h=o.h*state.cam.zoom;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate((o.rot||0)*Math.PI/180);ctx.strokeStyle="#d4a45b";ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.strokeRect(-w/2-3,-h/2-3,w+6,h+6);ctx.setLineDash([]);ctx.fillStyle="#d4a45b";ctx.fillRect(w/2-4,h/2-4,8,8);ctx.restore();
}

function drawRulers(){
  const tl=worldToScreen(0,0);
  ctx.strokeStyle="#50636d";ctx.fillStyle="#91a1a9";ctx.font="9px Arial";
  for(let x=0;x<=state.room.w;x++){const p=worldToScreen(x,0);if(x%1===0){ctx.beginPath();ctx.moveTo(p.x,p.y-4);ctx.lineTo(p.x,p.y-10);ctx.stroke();ctx.fillText(String(x),p.x-3,p.y-13);}}
}

function setMode(tool){
  state.tool=tool;
  document.querySelectorAll(".mode").forEach(b=>b.classList.remove("active"));
  if(tool==="select") $("selectMode").classList.add("active");
  if(tool==="pan") $("panMode").classList.add("active");
  document.querySelectorAll("#palette button").forEach(b=>b.classList.toggle("chosen",b.dataset.type===tool));
}

canvas.addEventListener("pointerdown",e=>{
  const p={x:e.offsetX,y:e.offsetY};state.last=p;
  if(e.button===1||e.shiftKey||state.tool==="pan"){state.pan=true;canvas.setPointerCapture(e.pointerId);return;}
  if(state.tool==="select"){
    const o=hitTest(p.x,p.y);state.selected=o;
    if(o){pushHistory();const q=screenToWorld(p.x,p.y);state.drag={o,dx:q.x-o.x,dy:q.y-o.y};}
    updateUI();draw();
  } else {
    const q=screenToWorld(p.x,p.y);
    if(roomPointInside(q.x,q.y)) addObject(state.tool,q.x,q.y);
  }
});
canvas.addEventListener("pointermove",e=>{
  const p={x:e.offsetX,y:e.offsetY};
  if(state.pan){state.cam.x-=(p.x-state.last.x)/state.cam.zoom;state.cam.y-=(p.y-state.last.y)/state.cam.zoom;state.last=p;draw();}
  else if(state.drag){const q=screenToWorld(p.x,p.y);state.drag.o.x=snap(q.x-state.drag.dx);state.drag.o.y=snap(q.y-state.drag.dy);normalizeObject(state.drag.o);updateUI();draw();}
});
canvas.addEventListener("pointerup",()=>{state.pan=false;state.drag=null;});
canvas.addEventListener("wheel",e=>{
  e.preventDefault();const before=screenToWorld(e.offsetX,e.offsetY);
  state.cam.zoom=clamp(state.cam.zoom*(e.deltaY<0?1.1:.9),15,220);
  const after=screenToWorld(e.offsetX,e.offsetY);
  state.cam.x+=before.x-after.x;state.cam.y+=before.y-after.y;updateZoomText();draw();
},{passive:false});

document.querySelectorAll("#palette button").forEach(b=>b.addEventListener("click",()=>{setMode(b.dataset.type);canvas.focus();}));
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

function updateUI(){
  const o=state.selected;
  $("title").textContent=o?(TYPES[o.type]?.[0]||o.type):"Nenhum elemento";
  $("sub").textContent=o?"Edite posição, tamanho e rotação.":"Selecione um objeto no mapa para editar.";
  $("emptyProps").classList.toggle("hidden",!!o);$("props").classList.toggle("hidden",!o);
  if(o){$("x").value=o.x.toFixed(2);$("y").value=o.y.toFixed(2);$("w").value=o.w.toFixed(2);$("h").value=o.h.toFixed(2);$("rot").value=o.rot;$("rotVal").textContent=o.rot+"°";}
  const count={};RISK_TYPES.forEach(t=>count[t]=0);state.objects.forEach(x=>{if(count[x.type]!==undefined)count[x.type]++;});
  $("riskList").innerHTML=RISK_TYPES.filter(t=>count[t]).map(t=>`<div class="risk-row"><span><i class="risk-dot" style="background:${RISK_COLORS[t]}"></i>${TYPES[t][0]}</span><b>${count[t]}</b></div>`).join("") || '<div class="risk-row">Nenhum risco inserido.</div>';
  $("c1").classList.toggle("ok",state.room.w>=2&&state.room.h>=2);
  $("c2").classList.toggle("ok",state.objects.some(o=>o.type==="door"||o.type==="exit"));
  $("c3").classList.toggle("ok",state.objects.some(o=>["bench","benchL","equipment"].includes(o.type)));
  $("c4").classList.toggle("ok",state.objects.some(o=>o.type==="zone"));
  $("c5").classList.toggle("ok",state.objects.some(o=>["shower","eyewash","extinguisher"].includes(o.type)));
  $("c6").classList.toggle("ok",state.objects.some(o=>RISK_TYPES.includes(o.type)));
}

$("save").onclick=()=>{
  const data={version:2,date:new Date().toISOString(),room:state.room,objects:state.objects};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="mapa-de-riscos-laboratorio.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
};
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
