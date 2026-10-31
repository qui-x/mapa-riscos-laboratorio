# Mapa de Riscos do Laboratório — editor sem login

Editor 2D de planta física em escala métrica. Esta é a linha de desenvolvimento baseada na versão sem autenticação, que abre diretamente o editor.

## Funcionalidades preservadas

- definição de largura e comprimento da sala;
- atualização imediata e enquadramento automático da planta;
- grade, snap métrico, zoom e pan;
- estrutura física: parede, porta, janela, bancada, bancada L, pia, capela, armário, estante e equipamento;
- áreas de circulação;
- riscos químico, biológico, físico, incêndio, elétrico, ergonômico, radiação e queda;
- equipamentos de emergência;
- seleção, movimentação, rotação, redimensionamento, duplicação e exclusão;
- coordenadas métricas e cotas;
- resumo de riscos e verificação da planta;
- desfazer/refazer;
- salvar e abrir JSON.

## Executar localmente

Requer Node.js 20.19+ e npm.

```bash
npm install
npm run dev
```

Abra o endereço local informado pelo Vite (por padrão `http://127.0.0.1:5173`).

Para validar os módulos TypeScript e gerar a distribuição:

```bash
npm run typecheck
npm run build
npm run preview
```

A pasta `dist/` contém a distribuição estática. Os diretórios `js/` e `assets/` são copiados pelo Vite para que o runtime legado continue usando os mesmos caminhos e os mesmos scripts clássicos.

## Modernização visual

- Tailwind CSS 4 é introduzido como sistema de design e compilação de estilos.
- O CSS original é mantido como camada de compatibilidade.
- O Preflight do Tailwind não é carregado nesta etapa, evitando um reset global de botões, campos e Canvas.
- O Canvas 2D, o motor de desenho e as regras geométricas não são reescritos durante a primeira fase visual.
- Novos módulos TypeScript ficam isolados em `src/` para migração gradual.

## Próximas etapas técnicas

1. Refinar a hierarquia visual da barra superior, paleta, Canvas e painel de propriedades.
2. Criar testes de regressão para desenho, seleção, edição, undo/redo, importação/exportação e responsividade.
3. Evoluir a arquitetura de dados espacial para compartilhar o modelo entre 2D e futuro 3D.
4. Inspecionar e normalizar os modelos 3D no Blender antes da integração com Babylon.js.

## Biblioteca 3D

A pesquisa de modelos reutilizáveis, origens e licenças está documentada em [docs/3d-assets-roadmap.md](docs/3d-assets-roadmap.md). Nenhum modelo de terceiros é incluído automaticamente: cada arquivo precisa passar pela verificação individual de licença, escala, orientação, origem, envelope e colisão.

## Limites da verificação técnica

Os indicadores do editor ajudam a revisar a distribuição espacial. Eles não equivalem a laudo ou certificação de conformidade normativa. Requisitos NR, ABNT e instruções dos fabricantes precisam ser verificados por regras documentadas e fontes atualizadas.
