import { spawn } from 'node:child_process';

const { process } = globalThis;
const children = [];

function start(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
    } else if (code && code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

function shutdown(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('vite', 'npm', ['run', 'dev:web']);
start('smtp', 'npm', ['run', 'dev:server']);
