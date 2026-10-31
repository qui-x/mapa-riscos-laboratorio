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
const DEFAULT_EPI_BY_RISK = {
  chemical: "Luvas nitrílicas, óculos de proteção e jaleco",
  biological: "Luvas descartáveis, máscara e óculos de proteção",
  physical: "Óculos de proteção e proteção adequada ao agente físico",
  fire: "Óculos de proteção, luvas resistentes ao calor e jaleco",
  electrical: "Luvas isolantes, calçado de segurança e proteção facial",
  ergonomic: "Ajuste ergonômico do posto e mobiliário adequado",
  radiation: "Dosímetro e proteção individual adequada ao tipo de radiação",
  slip: "Calçado de segurança antiderrapante"
};
const EQUIPMENT_TYPES = ["shower", "eyewash", "extinguisher"];
const SOLID_BLOCKERS = ["bench", "benchL", "sink", "hood", "cabinet", "shelf", "equipment", "shower", "eyewash", "extinguisher"];
const TIPOS_APOIADOS = ["equipment", "sink", "shower", "eyewash", "extinguisher"];
const TIPOS_BASE = ["bench", "benchL", "hood", "cabinet", "shelf"];
const EXITS = ["door", "exit"];
const CIRCULATION = ["zone"];
const EXIT_CLEARANCE = 1.2;

const MODELOS = [
  {
    id: "lab-basico",
    nome: "Laboratório Básico",
    descricao: "Sala retangular com bancada central, capela e saída de emergência.",
    areas: [{
      nome: "Laboratório", tipo: "laboratorio", dimensoes: { w: 10, h: 8 }, posicaoGlobal: { x: 0, y: 0 },
      objetos: [
        { type: "wall", x: 0, y: 0, w: 10, h: 0.15, rot: 0 },
        { type: "wall", x: 0, y: 7.85, w: 10, h: 0.15, rot: 0 },
        { type: "wall", x: 0, y: 0, w: 0.15, h: 8, rot: 0 },
        { type: "wall", x: 9.85, y: 0, w: 0.15, h: 8, rot: 0 },
        { type: "door", x: 4.5, y: 7.73, w: 0.9, h: 0.12, rot: 0 },
        { type: "bench", x: 2, y: 2, w: 2.4, h: 0.75, rot: 0 },
        { type: "benchL", x: 5, y: 1, w: 2.2, h: 2.2, rot: 0 },
        { type: "hood", x: 1, y: 5, w: 1.8, h: 0.85, rot: 0 }
      ]
    }]
  },
  {
    id: "lab-almox",
    nome: "Laboratório + Almoxarifado",
    descricao: "Duas áreas conectadas por uma porta interna e fluxo entre ambientes.",
    areas: [
      {
        templateId: "lab", nome: "Laboratório", tipo: "laboratorio", dimensoes: { w: 12, h: 8 }, posicaoGlobal: { x: 0, y: 0 },
        objetos: [
          { type: "wall", x: 0, y: 0, w: 12, h: 0.15, rot: 0 },
          { type: "wall", x: 0, y: 7.85, w: 12, h: 0.15, rot: 0 },
          { type: "wall", x: 0, y: 0, w: 0.15, h: 8, rot: 0 },
          { type: "wall", x: 11.85, y: 0, w: 0.15, h: 8, rot: 0 },
          { type: "door", x: 11.72, y: 3.2, w: 0.13, h: 1.0, rot: 0, connectionTemplateId: "almox" },
          { type: "bench", x: 2, y: 2, w: 3.2, h: 0.8, rot: 0 },
          { type: "benchL", x: 6.5, y: 1.2, w: 2.4, h: 2.4, rot: 0 },
          { type: "hood", x: 1, y: 5.2, w: 2.0, h: 0.9, rot: 0 }
        ]
      },
      {
        templateId: "almox", nome: "Almoxarifado", tipo: "almoxarifado", dimensoes: { w: 6, h: 5 }, posicaoGlobal: { x: 14, y: 0 },
        objetos: [
          { type: "wall", x: 0, y: 0, w: 6, h: 0.15, rot: 0 },
          { type: "wall", x: 0, y: 4.85, w: 6, h: 0.15, rot: 0 },
          { type: "wall", x: 0, y: 0, w: 0.15, h: 5, rot: 0 },
          { type: "wall", x: 5.85, y: 0, w: 0.15, h: 5, rot: 0 },
          { type: "door", x: 0.02, y: 2.0, w: 0.13, h: 1.0, rot: 0, connectionTemplateId: "lab" },
          { type: "shelf", x: 1, y: 0.8, w: 1.4, h: 3.2, rot: 0 },
          { type: "shelf", x: 3.1, y: 0.8, w: 1.4, h: 3.2, rot: 0 },
          { type: "cabinet", x: 4.8, y: 0.8, w: 0.75, h: 3.2, rot: 0 }
        ]
      }
    ]
  }
];
