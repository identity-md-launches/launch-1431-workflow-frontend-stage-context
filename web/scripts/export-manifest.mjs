import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { keccak256, toBytes } from 'viem';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = path.join(root, 'dist');
const read = async p => JSON.parse(await readFile(path.join(root, p), 'utf8'));
const handoff = await read('docs/frontend/deployment-handoff.json');
const network = await read('docs/frontend/network-handoff.json');
const check = process.argv.includes('--check');
const canonical = value => JSON.stringify(sort(value));
function sort(v) {
  if (Array.isArray(v)) return v.map(sort);
  return v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
}
// On the worker, also compare preserved build inputs to the independently pinned reads.
for (const [name, preserved] of [['deployment', handoff], ['network', network]]) {
  let pinned;
  try { pinned = await read(`.imd/reads/${name}.json`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (pinned && canonical(pinned) !== canonical(preserved)) throw Error(`Preserved ${name} differs from pinned worker input`);
}
const contracts = [];
for (const c of handoff.contracts) {
  const source = execFileSync('git', ['show', `${handoff.sourceCommit}:docs/abi/${c.name}.json`], { cwd: root });
  const abi = JSON.parse(source);
  const hash = keccak256(toBytes(canonical(abi))).slice(2);
  if (hash !== c.abiHash) throw Error(`${c.name}: pinned ABI hash mismatch: ${hash}`);
  if (!Array.isArray(abi)) throw Error('ABI must be a raw JSON array');
  const abiPath = `abi/${c.name}.json`;
  if (!check) {
    await mkdir(path.join(dist, 'abi'), { recursive: true });
    await writeFile(path.join(dist, abiPath), source);
  } else if (!source.equals(await readFile(path.join(dist, abiPath)))) throw Error(`ABI bytes differ: ${c.name}`);
  contracts.push({ name: c.name, address: c.address, abiHash: c.abiHash, abiPath });
}
async function files(dir, prefix = '') {
  const result = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + e.name;
    if (e.isSymbolicLink()) throw Error(`Symlink in export: ${name}`);
    if (e.isDirectory()) result.push(...await files(path.join(dir, e.name), name + '/'));
    else if (name !== 'imd-deployment.json') result.push(name);
  }
  return result.sort();
}
const assets = [];
let total = 0;
for (const p of await files(dist)) {
  const bytes = await readFile(path.join(dist, p));
  if (bytes.length > 8388608) throw Error(`Oversized asset ${p}`);
  total += bytes.length;
  assets.push({ path: p, sha256: createHash('sha256').update(bytes).digest('hex') });
}
if (assets.length > 128 || total > 8 * 1024 * 1024) throw Error('Export exceeds conservative worker budget');
const manifest = {
  version: 1, launchId: handoff.launchId, chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit, attestationHash: handoff.attestationHash,
  contracts, assets,
  ...(handoff.poolKey ? { poolKey: handoff.poolKey } : {}),
  network: network.network, ...(network.walletAddChain ? { walletAddChain: network.walletAddChain } : {}),
};
if (manifest.chainId !== manifest.network.chainId) throw Error('Network chain mismatch');
if (check) {
  const actual = await read('dist/imd-deployment.json');
  if (canonical(actual) !== canonical(manifest)) throw Error('Manifest differs from handoff or final assets');
} else await writeFile(path.join(dist, 'imd-deployment.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${check ? 'Verified' : 'Exported'} ${assets.length} assets, ${total.toLocaleString()} bytes; all 3 pinned ABI hashes match.`);
