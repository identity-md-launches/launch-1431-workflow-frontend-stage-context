import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const sections = ['Hive Wars frontend — dependency notices\n\nProduction dependency notices are preserved below. Some dependencies may be removed from the JavaScript bundle by tree shaking.'];
for (const [directory, pkg] of Object.entries(lock.packages)) {
  if (!directory || pkg.dev) continue;
  const base = new URL(directory + '/', root);
  const names = await readdir(base);
  const file = names.find(name => /^licen[sc]e(?:\.|$)/i.test(name));
  if (!file) throw Error(`Missing license file for ${directory}`);
  const text = (await readFile(new URL(file, base), 'utf8')).replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd();
  sections.push(`${directory.replace(/^node_modules\//, '')} ${pkg.version} (${pkg.license})\n\n${text}`);
}
await mkdir(new URL('public/licenses/', root), { recursive: true });
await writeFile(new URL('public/licenses/dependencies.txt', root), sections.join('\n\n' + '='.repeat(72) + '\n\n') + '\n');
console.log(`Preserved ${sections.length - 1} dependency license notices.`);
