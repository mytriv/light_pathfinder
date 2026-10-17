import { PathfinderEngine } from './engine.js';

const errorBox=document.querySelector('#error');
try {
  const engine=new PathfinderEngine(document.querySelector('#game'));
  await engine.start();
} catch(error) {
  errorBox.hidden=false;
  errorBox.textContent=`The original XP map could not start.\n${error.stack||error.message}`;
  console.error(error);
}
