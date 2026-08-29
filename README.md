# Mapa de Riscos do Laboratório — Google Apps Script + Sheets + WebRTC

A versão atual usa **autenticação local demonstrativa** e gerenciamento local de salas. Os arquivos de Google Apps Script permanecem no pacote apenas como referência/infraestrutura opcional para uma futura autenticação e sincronização remotas.

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

## F37 — Correções de integração frontend

- Eventos DOM migrados para `addEventListener` com helper `on()` para evitar falhas por elementos ausentes.
- Path SVG de alerta corrigido para eliminar o erro `Expected number`.
- Assets SVG de riscos e equipamentos incluídos em `assets/svg/`.
- Auto-inicialização declarativa do Google Identity Services removida; o botão é renderizado somente após `google.accounts.id.initialize()` com callback definido.
- Adicionado `tests/frontend-integrity-smoke.mjs`.

Os valores reais de `GAS_URL` e `GOOGLE_CLIENT_ID` continuam a ser configurados pelo responsável pela publicação em `js/config.js`, pois dependem do projeto Google/GAS do ambiente.


## Configuração Google legada

Antes de publicar no GitHub Pages, edite `js/config.js` e informe os valores reais:

```js
window.APP_CONFIG = Object.freeze({
  GAS_URL: 'https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec',
  GOOGLE_CLIENT_ID: 'SEU_CLIENT_ID.apps.googleusercontent.com'
});
```

O `GOOGLE_CLIENT_ID` deve ser uma credencial OAuth 2.0 do tipo **Web application**. Para o GitHub Pages, registre a origem HTTPS do site em **Authorized JavaScript origins**. A origem deve ser o esquema + domínio; por exemplo, `https://seuusuario.github.io`. A documentação do Google exige que a origem JavaScript corresponda ao site que está iniciando o fluxo.

Não publique valores fictícios como `COLE_AQUI...`: isso provoca `401 invalid_client`.

## Autenticação local

Esta versão usa contas locais em `localStorage`, sem Google Identity Services. O cadastro armazena a senha como hash SHA-256 para o modo demonstrativo e a sessão atual fica em `mapa_riscos_local_current_user_v1`.

Professores podem criar salas locais de 6 caracteres e estudantes podem entrar nelas no mesmo navegador/dispositivo. Para salas compartilhadas entre dispositivos, é necessário conectar novamente um backend de salas.


## Autenticação remota por e-mail e senha

A autenticação atual usa Google Apps Script + Google Sheets, sem Google Identity Services. O frontend usa `js/auth.js` para cadastro, login, logout, recuperação e redefinição de senha; `js/room-gas.js` faz a comunicação com o Web App. Execute `setupMasterSpreadsheet()` no GAS antes de publicar.

A aba `usuarios` deve conter: `id`, `email`, `nome`, `foto`, `papel`, `senhaHash`, `senhaSalt`, `resetToken`, `resetExpira`, `criadoEm`, `ultimoAcesso`.
