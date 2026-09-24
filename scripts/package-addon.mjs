import {
  mkdirSync,
  existsSync,
  copyFileSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { zipSync } from 'fflate';

const output = resolve('public/downloads');
mkdirSync(output, { recursive: true });
const files = Object.fromEntries(
  readdirSync('addon/Rollkeeper')
    .sort()
    .map((name) => [
      `Rollkeeper/${name}`,
      [readFileSync(`addon/Rollkeeper/${name}`), { mtime: new Date('2026-01-01T00:00:00Z') }],
    ]),
);
files['Rollkeeper/LICENSE'] = [
  readFileSync('LICENSE'),
  { mtime: new Date('2026-01-01T00:00:00Z') },
];
writeFileSync(resolve(output, 'Rollkeeper.zip'), zipSync(files, { level: 9 }));
if (existsSync('dist')) {
  mkdirSync('dist/downloads', { recursive: true });
  copyFileSync('public/downloads/Rollkeeper.zip', 'dist/downloads/Rollkeeper.zip');
}
console.log('Packaged public/downloads/Rollkeeper.zip');
