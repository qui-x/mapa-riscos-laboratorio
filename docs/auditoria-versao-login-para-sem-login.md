# Auditoria de incorporação — versão com login → editor sem login

**Origem analisada:** `versao-com-login`  
**Base de destino:** `main` (editor sem login restaurado a partir de `versao-inicial`, com Tailwind/Vite)  
**Objetivo:** identificar evoluções do editor que agregam valor independentemente de autenticação, e separar essas evoluções dos recursos de conta/sala/rede.

> Esta auditoria não importa código automaticamente. A versão com login divergiu da versão sem login e não deve ser tratada como um pacote de atualização diretamente substituível. A integração deverá acontecer em etapas pequenas, com testes de regressão.

## 1. Conclusão executiva

A versão com login contém uma evolução funcional relevante do editor 2D. Ela não se limita à autenticação: introduz um modelo de projeto com várias áreas, visão geral, ligações entre ambientes, seleção múltipla, grupos, bloqueio e ocultação de objetos, alças de redimensionamento/rotação, guias de alinhamento, modelos prontos, autosalvamento, histórico do projeto completo, importação/exportação de projetos multiárea, painel com abas, relatório por área, atalhos de teclado e melhorias de acessibilidade.

Esses recursos devem ser considerados para a versão sem login. O que não deve ser feito é transportar `index.html`, `js/mapa.js` ou `css/mapa.css` inteiros da versão com login: eles carregam telas, regras de permissão e fluxos de sessão que não fazem parte do produto escolhido, além de terem evoluído em uma linha divergente.

## 2. Inventário das melhorias a incorporar

| Recurso encontrado na versão com login | Valor para a versão sem login | Dependência / adaptação | Prioridade |
|---|---|---|---|
| Múltiplas áreas no mesmo projeto | Permite representar laboratório, almoxarifado, preparo, corredor e apoio sem simular tudo como uma sala só | Novo modelo de projeto com `areas[]`, área ativa e migração do formato antigo `room + objects` | **P0 — essencial** |
| Visão geral do projeto | Exibe a disposição global dos ambientes e suas conexões | Depende de múltiplas áreas, coordenadas globais e câmera própria | **P0 — essencial** |
| Conexão de ambientes por portas | Documenta a comunicação espacial entre áreas | Depende de IDs estáveis de área e validação de conexões quebradas | **P0 — essencial** |
| Modelos prontos de laboratório | Acelera a criação de projetos; existem modelos “Laboratório Básico” e “Laboratório + Almoxarifado” | Catálogo deve funcionar localmente, sem conta ou backend | **P0 — essencial** |
| Importação de modelos JSON | Reaproveita plantas e layouts existentes | Importador deve validar estrutura, limites e referências antes de substituir o projeto | **P0 — essencial** |
| Autosalvamento local | Evita perda de trabalho ao fechar ou atualizar o navegador | Separar salvamento local da sincronização de salas; manter recuperação e descarte explícitos | **P0 — essencial** |
| Histórico completo por projeto | Desfazer/refazer alterações em todas as áreas, não apenas na lista de objetos atual | Snapshots devem incluir áreas, área ativa, conexões e modo de visualização | **P0 — essencial** |
| Seleção múltipla e seleção por caixa | Facilita organizar conjuntos de bancadas, equipamentos e riscos | Requer `selectedObjects[]` e regras consistentes para clique, Ctrl/Cmd e arraste | **P0 — essencial** |
| Agrupar / desagrupar | Permite mover conjuntos como uma unidade lógica | Adicionar `groupId`, preservar agrupamento em JSON e no histórico | **P0 — essencial** |
| Bloquear e ocultar elementos | Ajuda a proteger paredes/estrutura e simplificar a visualização | Adicionar `locked` e `hidden`; elementos ocultos não podem interceptar seleção nem entrar nos cálculos visuais | **P0 — essencial** |
| Alças no Canvas para redimensionar e girar | Edição espacial mais direta e precisa | Interação por ponteiro precisa distinguir arraste, seleção por caixa, rotação e redimensionamento | **P0 — essencial** |
| Guias de alinhamento | Ajuda a alinhar mobiliário, paredes e equipamentos | Guias devem considerar centro, bordas, zoom e snap sem alterar coordenadas de forma inesperada | **P1 — importante** |
| Tooltip de dimensão no Canvas | Dá retorno dimensional sem consultar sempre o painel | Deve acompanhar a seleção e não encobrir handles ou controles | **P1 — importante** |
| Atalhos de teclado | Acelera edição e melhora acessibilidade | Implementar com prevenção de conflito quando o foco estiver em inputs, selects ou modais | **P1 — importante** |
| Navegação por teclado na árvore de objetos | Torna a lista de camadas utilizável sem mouse | Usar semântica ARIA e manter foco após reconstrução da árvore | **P1 — importante** |
| Abas Camadas / Propriedades / Relatório | Organiza o painel direito e reduz rolagem | Adaptar ao HTML sem login, mantendo IDs e estados de painel coerentes | **P1 — importante** |
| Modais próprios, confirmação e toasts | Feedback mais claro e confirmação consistente de ações destrutivas | São independentes da autenticação; revisar foco, Escape e acessibilidade | **P1 — importante** |
| Relatório consolidado de áreas | Resume pendências de cada ambiente e conexões | Precisa de regras verificáveis; não apresentar heurísticas como certificação legal | **P1 — importante** |
| Campo de EPI recomendado por risco | Registra orientação específica associada ao marcador de risco | Campo opcional, editável e exportado em JSON; não deve presumir EPI sem avaliação técnica | **P1 — importante** |
| Ícones próprios para riscos e equipamentos | Melhora reconhecimento visual dos elementos | Assets SVG podem ser reaproveitados após checagem de caminhos e contraste | **P1 — importante** |
| Arco de abertura da porta e seta externa | Melhora leitura da abertura e sentido de abertura | Direção externa precisa ser verificável pelo usuário; a versão analisada infere o lado pelo centro da sala | **P1 — adaptar antes de usar** |
| Exportação SVG de todas as áreas | Permite documentação visual consolidada | Depende da visão global; checar escala, áreas desconectadas e legenda | **P1 — importante** |
| Edição responsiva com painéis laterais móveis | Melhora o uso em tablets e celulares | Reaproveitar a lógica de painel/backdrop, mas redesenhar o layout com o Tailwind atual | **P1 — importante** |
| Indicador de etapas Ambiente / Riscos / Conferir | Orienta a sequência de uso | Deve permanecer informativo e não bloquear ferramentas | **P2 — opcional** |
| Loader de operações | Dá retorno em importações e tarefas maiores | Útil apenas quando existir operação realmente assíncrona no editor local | **P2 — opcional** |

## 3. Recursos que devem ficar fora da versão sem login

Não incorporar os elementos abaixo como parte do editor local:

- `loginScreen`, cadastro, login, recuperação e redefinição de senha;
- `homeScreen` vinculada a usuário, identidade de conta, logout e salas do usuário;
- `AuthAPI`, `js/auth.js`, `js/room-gas.js` e a lógica de sessão/token;
- backend `gas/Code.gs`, planilha mestra, armazenamento remoto, polling e sinalização de salas;
- WebRTC, papéis professor/estudante, bloqueios de edição por papel e mensagens de permissão;
- sincronização remota chamada junto com autosalvamento local.

**Atenção à separação de responsabilidades:** na versão com login, `scheduleAutoSave()` grava no armazenamento local e também chama `scheduleRoomSync()`. Na versão sem login, o autosalvamento deve ser exclusivamente local. Não manter chamadas de rede como efeito colateral de operações de edição.

A função `canEdit()` da versão com login é baseada no papel da sessão (`state.role`). Na versão sem login não há papéis: as ações locais devem continuar disponíveis, sem carregar o modelo de autorização professor/estudante.

## 4. Arquitetura que precisa acompanhar as melhorias

A versão sem login atual concentra a lógica do Canvas em `js/mapa.js`; a versão com login separou tipos, geometria e validação:

- `js/types.js`: catálogo de objetos, categorias de risco, cores, equipamentos, constantes e modelos;
- `js/geometry.js`: SAT para interseção de retângulos rotacionados, decomposição geométrica de bancada L, áreas de interseção, contenção e folga de saída;
- `js/validation.js`: regras de colisão, sobreposição, circulação e obstrução de saídas;
- `js/mapa.js`: estado do projeto, renderização, seleção, manipulação, interface e persistência.

A direção arquitetural é boa, mas não precisamos copiar os arquivos literalmente. A migração deve manter o runtime atual funcionando e extrair funções em módulos menores gradualmente. O contrato de domínio TypeScript e a ferramenta Vite/Tailwind já adicionados ao `main` podem sustentar essa separação ao longo do tempo.

### Contrato de projeto recomendado

Novo formato persistido:

```json
{
  "version": 4,
  "date": "2026-11-04T00:00:00.000Z",
  "areas": [
    {
      "id": "area-id",
      "nome": "Laboratório",
      "tipo": "laboratorio",
      "dimensoes": { "w": 12, "h": 8 },
      "posicaoGlobal": { "x": 0, "y": 0 },
      "objetos": [],
      "conexoes": []
    }
  ],
  "areaAtiva": "area-id"
}
```

O importador deverá continuar aceitando o formato antigo da versão sem login:

```json
{
  "room": { "w": 12, "h": 8 },
  "objects": []
}
```

Na leitura do formato antigo, criar automaticamente uma área “Laboratório” e converter `room` em `dimensoes`, e `objects` em `objetos`. Na gravação nova, usar sempre o formato de projeto versionado. Não sobrescrever autosave ou projeto aberto enquanto a validação do JSON ainda não terminou.

## 5. Pontos técnicos encontrados que exigem correção antes de incorporar

A versão com login contém melhorias valiosas, mas há trechos que não devem ser aceitos sem revisão:

1. **Cálculo de interseção da bancada L:** `getObjectRects()` divide a bancada L em retângulos alinhados aos eixos. A função de interseção usa esses retângulos sem transformar suas coordenadas pela rotação do objeto. Para bancada L rotacionada, o resultado pode divergir da geometria visual.

2. **Folga da saída:** `getExitClearanceRect()` cria um retângulo alinhado aos eixos ao redor da porta. A validação precisa considerar orientação/rotação e distinguir área de aproximação de área de giro/abertura. O valor de 1,2 m não deve ser tratado como regra universal para toda porta sem conferir o requisito normativo aplicável e a configuração do ambiente.

3. **Cálculo de obstrução da porta:** `calculateDoorBlockRatio()` projeta a largura do bloqueador sobre o eixo da porta. É usado em conjunto com a verificação de interseção, mas ainda precisa de testes com portas rotacionadas, elementos parcialmente fora do alinhamento e diferentes orientações.

4. **Direção do arco da porta:** `getDoorArcData()` decide qual lado é externo comparando o centro da porta com o centro da sala. Isso é apenas uma inferência geométrica; pode falhar em portas internas, ambientes irregulares ou portas que não estejam em uma das paredes externas. A direção deve ser configurável ou validada visualmente pelo usuário.

5. **Relatório 10/10:** `calculateCompliance()` conta a presença de certos tipos de objetos como evidência de critérios. Exemplos: qualquer objeto do tipo `equipment` satisfaz o item elétrico; o marcador de risco `fire` conta como proteção contra incêndio; armário/estante/circulação junto com qualquer risco contam como sinalização. Essas condições não demonstram conformidade normativa. O relatório pode ser incorporado como checklist preliminar, mas as regras e os rótulos precisam ser revistos antes de qualquer indicação de conformidade.

6. **Acessibilidade dos modais e navegação:** há gestão de foco e navegação por teclado, mas precisa ser testada com teclado real, leitores de tela e layouts estreitos. A presença de atributos ARIA sozinha não comprova o fluxo.

7. **Estado e histórico:** o histórico da versão com login armazena `areas`, área ativa e modo de visualização, mas precisa ser exercitado com troca de área, criação/exclusão, conexão entre portas, importação e restauração de snapshots. O histórico do editor sem login atual guarda apenas `objects`, portanto essa mudança precisa ser feita junto com o novo modelo de projeto, não isoladamente.

## 6. Sequência recomendada de incorporação

### Fase 0 — proteção da base estável

- Criar testes de regressão para as funções existentes: dimensões da sala, adição, seleção, movimentação, rotação, redimensionamento por campos, duplicação, exclusão, undo/redo, grade, snap, cotas, salvamento, abertura JSON e exportação SVG.
- Guardar fixtures JSON da versão antiga.
- Confirmar que a versão sem login continua iniciando diretamente no editor.

### Fase 1 — projeto multiárea e persistência local

- Introduzir `areas[]`, `areaAtiva`, `activeArea()` e acesso compatível a `room/objects`.
- Integrar nova área, renomear, excluir, alternar e visão geral.
- Adicionar portas com ligações entre áreas.
- Migrar undo/redo para snapshots completos.
- Implementar autosave local separado de qualquer rede.
- Preservar leitura de JSON antigo e salvar no novo formato.

### Fase 2 — edição avançada do Canvas

- Seleção múltipla, seleção por caixa e grupos.
- Ocultar/bloquear elementos.
- Handles de redimensionamento e rotação.
- Guias de alinhamento e tooltip dimensional.
- Atalhos de teclado e navegação acessível na árvore.

### Fase 3 — catálogo, validação e relatórios

- Modelos prontos e importação de modelos JSON.
- Regras geométricas com testes de rotação, colisão, bancada L, circulação e portas.
- Campo opcional de EPI.
- Checklist/relatório revisado, com critérios claros e sem prometer certificação normativa.
- Exportação SVG consolidada.

### Fase 4 — refinamento da interface

- Abas Camadas / Propriedades / Relatório.
- Modais, toasts e confirmações.
- Painéis responsivos para tablet e mobile.
- Reaproveitamento seletivo da identidade visual da versão com login, reconstruída sobre Tailwind em vez de copiar a folha CSS inteira.

## 7. Critérios de aceitação por fase

Nenhuma fase será considerada pronta apenas por compilar. Cada uma precisa passar:

- testes unitários/funcionais das regras alteradas;
- teste de leitura de JSON antigo e gravação/leitura do novo formato;
- regressão das funções que já existiam na versão sem login;
- verificação de Console e erros de rede;
- inspeção visual em desktop e viewport mobile;
- verificação de que nenhum fluxo de conta, token ou backend foi introduzido;
- teste de persistência após recarregar a página.

## 8. Referências internas do repositório analisadas

- `versao-inicial/index.html`, `versao-inicial/css/mapa.css`, `versao-inicial/js/mapa.js`;
- `versao-com-login/index.html`, `versao-com-login/css/mapa.css`, `versao-com-login/js/mapa.js`;
- `versao-com-login/js/types.js`, `js/geometry.js`, `js/validation.js`;
- `versao-com-login/js/auth.js`, `js/room-gas.js`, `js/crypto.js` e `gas/Code.gs`;
- testes `core-smoke.mjs`, `frontend-integrity-smoke.mjs`, `ui-bindings-smoke.mjs` e testes de autenticação/backend.

---

**Recomendação final:** incorporar as capacidades do editor, não a camada de autenticação. A prioridade mais alta é transformar o projeto de uma única sala em um projeto multiárea com autosalvamento e histórico completo. Em seguida, trazer as ferramentas avançadas de seleção/manipulação e, por último, revisar os critérios de segurança e a interface. Cada etapa deve ter branch, testes e revisão visual próprios.
