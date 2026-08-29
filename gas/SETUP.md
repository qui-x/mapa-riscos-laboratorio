# Configuração do Google Apps Script

1. Abra Apps Script e crie um projeto.
2. Cole o conteúdo de `Code.gs`.
3. Execute a função `setupMasterSpreadsheet()` uma vez.
4. Autorize o acesso solicitado pelo Google.
5. A função criará automaticamente a planilha **Mapa de Riscos - Planilha Mestra** e as abas necessárias, salvando o ID em `Script Properties`.
6. Se você já possui uma planilha, preencha `SPREADSHEET_ID` com o ID dela; `setupMasterSpreadsheet()` irá registrá-la e configurar as abas.
6. Publique como Web App:
   - Executar como: sua conta;
   - Quem tem acesso: qualquer pessoa que precise acessar a sala.
7. Copie a URL `/exec` para `js/config.js`.
8. A planilha mestra é inicializada por `setupMasterSpreadsheet()`; chamadas posteriores reutilizam o mesmo ID salvo em `Script Properties`.

## Teste rápido

No navegador, use a interface do projeto. Em caso de erro de configuração, a tela de login informa que a URL do Web App precisa ser definida.

## Segurança

O JSON do projeto é cifrado no navegador com AES-GCM antes do POST de salvamento. O GAS recebe e armazena o texto cifrado. O código da sala é a base da derivação da chave nesta versão; isso protege contra leitura direta na planilha, mas não é equivalente a uma senha forte.

## Autenticação Google (FRENTE 34)

1. Crie um OAuth 2.0 Client ID para aplicativo Web no Google Cloud.
2. Cadastre a origem do frontend, por exemplo `http://localhost:5500`.
3. Copie o Client ID para `js/config.js` em `GOOGLE_CLIENT_ID`.
4. Publique o Apps Script como Web App com acesso adequado para os usuários do projeto.
5. Coloque a URL `/exec` do Web App em `js/config.js` em `GAS_URL`.
6. Execute `setupSheets()` uma vez no editor do Apps Script para criar `usuarios`, `salas`, `sinalizacao` e `projetos`.
7. Para tornar uma conta professor, altere a coluna `papel` dessa conta em `usuarios` para `professor`. Novos usuários entram como `estudante` por padrão.

O frontend envia o ID token do Google somente para `authLogin`. O GAS valida o emissor, a audiência (quando `GOOGLE_CLIENT_ID` está configurado) e a expiração antes de criar um `sessionToken` temporário no `CacheService`.

## Função de inicialização da planilha mestra

A função `setupMasterSpreadsheet()` é o ponto de entrada recomendado para o primeiro setup. Ela: cria ou localiza a planilha mestra; cria `usuarios`, `salas`, `sinalizacao` e `projetos`; aplica cabeçalhos, congelamento e formatação básica; e salva o ID em `Script Properties`.
