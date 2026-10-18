import { GameShell } from './game-shell.js';

const errorBox=document.querySelector('#error');
try {
  new GameShell();
} catch(error) {
  errorBox.hidden=false;
  errorBox.textContent=`The original XP map could not start.\n${error.stack||error.message}`;
  console.error(error);
}
