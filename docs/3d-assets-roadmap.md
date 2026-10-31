# Biblioteca 3D — pesquisa e plano de reaproveitamento

**Status:** fontes identificadas; nenhum modelo externo foi incorporado ao aplicativo nesta etapa.

O objetivo é reaproveitar modelos existentes sempre que a licença permitir, mantendo Blender como ambiente de inspeção/ajuste e GLB/glTF como formato de entrega para Babylon.js.

## Fonte prioritária: UMB Advisors

Repositório: https://github.com/UMB-Advisors/open-cannabis-models

O catálogo contém 373 modelos em GLB, com versões de alta e baixa complexidade, imagens de pré-visualização e metadados por item. Embora parte da biblioteca seja direcionada a instalações de cannabis, há mobiliário e equipamentos genéricos que podem ser úteis em laboratórios de ensino e pesquisa.

**Licença dos modelos:** CC BY 4.0. Atribuir crédito a UMB Advisors, vincular à licença e registrar alterações. A licença MIT do repositório cobre o código gerador, não substitui a licença dos modelos. Alguns arquivos de terceiros mantêm licenças próprias; consultar CREDITS.md, LICENSE-MODELS.txt e o model.json de cada item antes de copiar.

### Primeiros candidatos

| Elemento | Caminho no repositório | Observação |
|---|---|---|
| Bancada com tampo epóxi | models/extraction-lab/qa-lab-bench-epoxy | Montagem com armários inferiores e prateleira; metadados em pés |
| Pia laboratorial | models/extraction-lab/epoxy-lab-sink-cabinet | Cuba, torneira e armário |
| Capela de exaustão | models/cannabis-lab/safety-fume-hood-labconco-xstream | Modelo de 6 pés; armário inferior |
| Armário para inflamáveis | models/cannabis-lab/safety-flammables-cabinet-justrite-45 | Armário de segurança |
| Chuveiro + lava-olhos | models/extraction-lab/eyewash-drench-combo | Metadados incluem afastamentos e referências técnicas |
| Lava-olhos de parede | models/extraction-lab/eyewash-wall-g1760 | Montagem em parede; confirmar orientação e altura de instalação |
| Extintor ABC | models/extraction-lab/extinguisher-abc-10lb | Inclui suporte e placa |
| Pia de três cubas | models/extraction-lab/three-compartment-sink | Estrutura em aço inoxidável |
| Microscópio | models/cannabis-lab/qa-microscope-stereo-trichome | Equipamento óptico |
| Balança analítica | models/cannabis-lab/qa-balance-analytical-mettler-ms205du | Equipamento de bancada |
| Porta metálica | models/extraction-lab/hm-door-single | Folha com pivô articulado no modelo USD |
| Janela de alumínio | models/extraction-lab/exterior-window-aluminium | Modelo genérico de correr |

Cada pasta normalmente disponibiliza fs-high.glb, fs-low.glb, poster-1200.webp e model.json. O catálogo registra as dimensões e a origem dos modelos. A UMB documenta unidades em pés em parte dos modelos e a orientação glTF Y-up, frente +Z; validar por modelo antes de posicionar.

## Fonte complementar: Innerscene

Biblioteca: https://www.innerscene.com/tools/library

A biblioteca consultada declara licença CC0 para os itens indicados. Exemplos de candidatos:

- Bancada de laboratório com pia: https://www.innerscene.com/tools/library/3d-parts/lab-bench-with-sink-education-furniture-8f5ca23b
- Capela de exaustão: https://www.innerscene.com/tools/library/3d-parts/fume-hood-d4a0e6a9
- Chuveiro de emergência: https://www.innerscene.com/tools/library/3d-parts/safety-shower-14de06e0
- Refrigerador laboratorial: https://www.innerscene.com/tools/library/3d-parts/lab-fridge-b1cc2532
- Microscópio: https://www.innerscene.com/tools/library/3d-parts/compound-microscope-d5e4eabc
- Centrífuga: https://www.innerscene.com/tools/library/3d-parts/centrifuge-99807ab5

Conferir novamente a licença e os termos de redistribuição diretamente no item no momento da aquisição/integração.

## Fontes para uso condicionado

### MBZUAI — ChemLab-Assets

Repositório: https://github.com/mbzuai-nlp/ChemLab-Assets

Possui 203 instrumentos de laboratório, modelos com peças separadas, articulações, pontos de interação, geometrias OBJ, URDF e arquivos Blender. É referência técnica valiosa para articulação e organização de assets.

**Restrição:** os modelos e dados são CC BY-NC 4.0. Não incorporar em uma distribuição comercial ou de uso comercial sem autorização adicional. O código do repositório tem licença MIT, mas os assets são licenciados separadamente. O arquivo NOTICE.md lista dados e modelos de terceiros com condições próprias.

### LabwareModels

Repositório: https://github.com/stefangolas/LabwareModels

Contém modelos de consumíveis científicos, incluindo tubos Eppendorf, placas de microtitulação e outros itens. Não foi localizada uma licença explícita no repositório. Manter apenas como referência; não redistribuir até obter autorização ou licença clara.

## Padrão de integração do Mapa de Riscos

Antes de um modelo entrar na biblioteca do aplicativo, registrar:

- Identificador, nome, categoria, autor, origem e licença;
- arquivo GLB original, versão otimizada e miniatura;
- unidade de origem e dimensões convertidas para metros;
- eixo frontal, orientação vertical e ponto de origem;
- envelope de ocupação e volume de colisão;
- folgas de manutenção/acesso, com status verificado, assumido ou desconhecido;
- pontos de conexão (água, esgoto, energia, exaustão e dados), quando aplicável;
- nível de detalhe para desktop e dispositivos modestos.

### Conversões e referências espaciais

A unidade interna do editor 3D será o metro. Converter modelos fornecidos em pés usando:

1 ft = 0,3048 m

Não inferir escala somente pela aparência. Comparar o envelope exportado com o metadado e, quando disponível, com desenho/catálogo técnico do fabricante. Padronizar origem, orientação e colisores em uma cena de inspeção no Blender antes da publicação do GLB final.

## Primeiro lote de protótipo

Começar por oito famílias: bancada, capela, pia, armário de inflamáveis, estante, chuveiro/lava-olhos, extintor e porta/janela. O objetivo é validar importação, escala, posicionamento, colisão e seleção no Babylon antes de ampliar o catálogo.

**Nota de segurança:** dimensões, folgas e metadados de modelos ajudam na análise espacial, mas não demonstram conformidade normativa. A verificação de NR-23, NR-26, NR-17, NR-6, ABNT e demais requisitos deverá permanecer em uma camada de regras verificáveis, com fontes e versões identificadas.
