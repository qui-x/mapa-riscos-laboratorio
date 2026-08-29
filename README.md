# Mapa de Riscos do Laboratório — FRENTE 39

Esta versão utiliza autenticação remota por email e senha via Google Apps Script.

## Criar conta
Na tela de acesso, selecione **Sou Professor** ou **Sou Estudante** e clique em **Criar conta**.
O formulário passa a exibir:
- Nome completo
- Email
- Senha

Ao enviar, o frontend chama `authRegister` no `Code.gs`, a conta é gravada na aba `usuarios` e uma sessão é criada.

## Login
O login usa `authLogin` no GAS e persiste `sessionToken` + usuário no `localStorage`.

## Backend
`js/config.js` deve conter a URL `/exec` do seu Web App GAS.

O `gas/Code.gs` fornece `authRegister`, `authLogin`, `authLogout`, sessões, salas e persistência na Planilha Mestra.

> O frontend não usa mais Google Identity Services.
