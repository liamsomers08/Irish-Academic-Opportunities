import fs from 'node:fs';
import path from 'node:path';

const [remotePath='remote-content.json', managedDir='apps-script', outputPath='merged-content.json'] = process.argv.slice(2);
const remote = JSON.parse(fs.readFileSync(remotePath, 'utf8'));
if (!Array.isArray(remote.files) || !remote.files.length) throw new Error('Remote Apps Script project has no files. Refusing destructive update.');
if (!remote.files.some(f => f && f.name === 'appsscript' && f.type === 'JSON')) throw new Error('Remote Apps Script manifest appsscript.json is missing. Refusing update.');

const managed = fs.readdirSync(managedDir)
  .filter(name => name.endsWith('.gs'))
  .sort();
if (!managed.length) throw new Error('No managed .gs files found.');

const byName = new Map();
for (const f of remote.files) {
  if (!f || !f.name || !f.type) continue;
  if (byName.has(f.name)) throw new Error(`Duplicate remote Apps Script file name: ${f.name}`);
  // updateContent accepts name/type/source; strip read-only metadata such as functionSet.
  byName.set(f.name, { name: f.name, type: f.type, source: String(f.source ?? '') });
}

for (const filename of managed) {
  const name = path.basename(filename, '.gs');
  const source = fs.readFileSync(path.join(managedDir, filename), 'utf8');
  if (!source.trim()) throw new Error(`Managed Apps Script file is empty: ${filename}`);
  byName.set(name, { name, type: 'SERVER_JS', source });
}

const files = [...byName.values()].sort((a,b) => {
  if (a.name === 'appsscript') return -1;
  if (b.name === 'appsscript') return 1;
  return a.name.localeCompare(b.name);
});

if (files.length < remote.files.length) throw new Error('Merged project unexpectedly lost remote files. Refusing update.');
const result = { files };
fs.writeFileSync(outputPath, JSON.stringify(result));
console.log(`Prepared ${files.length} Apps Script files; overlaid ${managed.length} GitHub-managed files while preserving ${files.length-managed.length} remote files.`);
