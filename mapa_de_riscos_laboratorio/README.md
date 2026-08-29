# Mapa de Riscos do Laboratório — Google Apps Script + Sheets + WebRTC

Esta versão substitui o backend Node.js de salas por **Google Apps Script (GAS) + Google Sheets** e usa **WebRTC DataChannel** para sincronização direta entre o professor e os estudantes. A sinalização WebRTC é feita por polling em uma planilha, conforme o plano de migração.

## Estrutura

```text
mapa de riscos do laboratorio/
├── index.html
├── css/
│   └── mapa.css
├── js/
│   ├── config.js
│   ├── types.js
│   ├── geometry.js
│   ├── validation.js
│   ├── crypto.js
│   ├── room-gas.js
│   └── mapa.js
├── gas/
│   ├── Code.gs
│   └── appsscript.json
└── tests/
```

## Configuração do Google Apps Script

1. Crie uma planilha Google Sheets.
2. Copie o ID da planilha da URL.
3. Crie um projeto no Google Apps Script vinculado à planilha.
4. Cole `gas/Code.gs` no projeto e ajuste `SPREADSHEET_ID`.
5. Publique como **Web App**, executando como o usuário que publica e com acesso anônimo conforme a necessidade do projeto.
6. Copie a URL `/exec` publicada.
7. Em `js/config.js`, substitua:

```js
GAS_URL: 'COLE_AQUI_A_URL_DO_WEB_APP_GAS'
```

pela URL real.

O GAS cria automaticamente as abas `salas`, `sinalizacao` e `projetos` com os cabeçalhos necessários.

## Executar o frontend

Use um servidor HTTP estático para evitar restrições do navegador com recursos locais. Por exemplo:

```bash
python3 -m http.server 5500
```

Depois abra `http://localhost:5500`.

## Fluxos suportados

### Professor
- criar sala;
- retomar sala com token de professor;
- salvar projeto criptografado;
- iniciar sincronização WebRTC com participantes;
- encerrar sala.

### Estudante
- entrar com código de 6 caracteres;
- receber token de participante;
- receber o projeto inicial criptografado;
- acompanhar atualizações por WebRTC em modo visualização.

## Segurança

O projeto usa Web Crypto API no navegador para criptografar o JSON do projeto com AES-GCM antes do envio ao GAS. O GAS armazena apenas o texto cifrado. O código da sala é usado como segredo de derivação nesta implementação, portanto ele protege os dados contra leitura direta na planilha, mas **não deve ser tratado como uma senha de alta entropia**.

O professor é autenticado por token UUID mantido em `sessionStorage` e validado pelo GAS. Estudantes recebem tokens UUID próprios.

## Limitações conhecidas

- GAS + Sheets + polling é adequado para grupos pequenos e exige cuidado com cotas.
- WebRTC em malha (mesh) não escala para centenas de participantes.
- Redes restritas podem exigir um servidor TURN para completar conexões.
- Para uso em produção, recomenda-se substituir o segredo derivado apenas do código por uma credencial compartilhada adicional e usar TURN autenticado.


## Documentação do HTML e CSS

O `index.html` contém comentários nas regiões estruturais para explicar a responsabilidade de cada tela, painel, modal e módulo carregado. O `css/mapa.css` contém comentários junto aos blocos de seletores para identificar o componente e a finalidade das regras visuais.

## Planilha mestra

No Google Apps Script, execute `setupMasterSpreadsheet()` uma vez. A função cria ou registra a planilha mestra e configura automaticamente as abas `usuarios`, `salas`, `sinalizacao` e `projetos`. O ID fica salvo em `Script Properties`, evitando manter o identificador da planilha como configuração obrigatória no restante do backend.
