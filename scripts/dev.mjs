#!/usr/bin/env node
// Runs the API and the web app together: `npm run dev`.
// Output is prefixed so it is obvious which side logged what.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const apiPort = process.env.QAREEB_API_PORT ?? process.env.PORT ?? '4000';
const childEnv = {
  ...process.env,
  PORT: apiPort,
  VITE_API_PROXY: process.env.VITE_API_PROXY ?? `http://localhost:${apiPort}`,
};

const children = [
  { name: 'api', color: '\u001b[32m', args: ['run', 'dev', '--workspace', 'server'] },
  { name: 'web', color: '\u001b[36m', args: ['run', 'dev', '--workspace', 'client'] },
].map(({ name, color, args }) => {
  const child = spawn(npm, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv });
  const write = (stream) => (chunk) => {
    String(chunk)
      .split('\n')
      .filter((line) => line.trim())
      .forEach((line) => stream.write(`${color}${name}\u001b[0m ${line}\n`));
  };
  child.stdout.on('data', write(process.stdout));
  child.stderr.on('data', write(process.stderr));
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) process.exitCode = code;
  });
  return child;
});

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM');
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`\n  Qareeb — API http://localhost:${apiPort}  ·  web http://localhost:5173\n`);
