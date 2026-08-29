import fs from 'node:fs';
const code = fs.readFileSync(new URL('../gas/Code.gs', import.meta.url), 'utf8');
for (const name of ['verifyIdToken','authLogin','ensureAuthenticated','createSession','listUserRooms','createRoom','joinRoom','saveProject','endRoom','sendSignal','getSignals','saveProjectToDrive','getProjectFromDrive']) {
  if (!new RegExp(`function\\s+${name}\\s*\\(`).test(code)) throw new Error(`Função ausente: ${name}`);
}
for (const text of ["case 'authLogin'", "case 'usuarioSalas'", "case 'criar'", "case 'entrar'", "case 'salvar'", "case 'encerrar'"]) {
  if (!code.includes(text)) throw new Error(`Rota ausente: ${text}`);
}
if (code.includes("case 'setup'")) throw new Error('Setup não deve ficar exposto como endpoint público.');
console.log('Auth/GAS smoke: OK');
