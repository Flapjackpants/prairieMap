import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const isWin = process.platform === 'win32';
const venvPython = join(
  backend,
  isWin ? '.venv/Scripts/python.exe' : '.venv/bin/python',
);

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: isWin });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

if (!existsSync(venvPython)) {
  const py = isWin ? 'py' : 'python3';
  console.log('[setup:api] Creating backend/.venv …');
  await run(py, ['-m', 'venv', '.venv'], backend);
}

console.log('[setup:api] Installing backend/requirements.txt …');
await run(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt'], backend);

const check = spawnSync(venvPython, ['-c', 'import shapely; print("shapely", shapely.__version__)'], {
  cwd: backend,
  encoding: 'utf8',
});
if (check.status !== 0) {
  console.error(check.stderr || check.stdout);
  process.exit(1);
}
console.log('[setup:api] Backend ready:', check.stdout.trim());
