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

function pythonForVenv() {
  const candidates = isWin ? ['py', 'python'] : ['python3', 'python'];
  for (const cmd of candidates) {
    const probe = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) return cmd;
  }
  return null;
}

async function ensureBackendEnv() {
  if (!existsSync(venvPython)) {
    const py = pythonForVenv();
    if (!py) {
      console.error(
        '[api] Python not found. Install Python 3.11+ and run: npm run setup:api',
      );
      process.exit(1);
    }
    console.log('[api] Creating backend/.venv …');
    await run(py, ['-m', 'venv', '.venv'], backend);
  }

  const depsOk = spawnSync(venvPython, ['-c', 'import shapely, fastapi, uvicorn'], {
    cwd: backend,
    stdio: 'ignore',
  });
  if (depsOk.status !== 0) {
    console.log('[api] Installing backend dependencies …');
    await run(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt'], backend);
  }
}

await ensureBackendEnv();

const child = spawn(
  venvPython,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'],
  { cwd: backend, stdio: 'inherit', shell: isWin },
);

child.on('exit', (code) => process.exit(code ?? 1));
