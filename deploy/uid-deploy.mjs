#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, JSON.stringify(value, null, 2), {mode:0o600}); fs.renameSync(temp, file); };
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const exists = file => { try { fs.lstatSync(file); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };
export function safeRelative(relative) {
 if (!relative || relative.includes('\\') || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '..' || part === '.' || part.startsWith('.'))) throw new Error(`Chemin interdit: ${relative}`);
 if (relative.split('/').some(part => /^(wordpress|node_modules|deploy|src)$/i.test(part)) || /\.(php\d*|phtml|phar|env|map|sh|mjs|ts)$/i.test(relative)) throw new Error(`Fichier interdit: ${relative}`);
 return relative;
}
function safeTarget(root, relative) {
 safeRelative(relative);
 let current = root;
 for (const part of relative.split('/')) {
  current = path.join(current, part);
  if (exists(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`Lien symbolique interdit: ${current}`);
 }
 return current;
}
export function inventory(root, prefix = '') {
 const result = {};
 for (const entry of fs.readdirSync(path.join(root, prefix), {withFileTypes:true})) {
  const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
  safeRelative(relative);
  if (entry.isSymbolicLink()) throw new Error('Lien symbolique dans dist');
  if (entry.isDirectory()) Object.assign(result, inventory(root, relative));
  else if (entry.isFile()) result[relative] = sha(path.join(root, relative));
  else throw new Error('Type de fichier inattendu');
 }
 return result;
}
function atomicCopy(source, target) {
 fs.mkdirSync(path.dirname(target), {recursive:true});
 const temporary = path.join(path.dirname(target), `.uid-${crypto.randomUUID()}.tmp`);
 try { fs.copyFileSync(source, temporary); fs.chmodSync(temporary, 0o644); fs.renameSync(temporary, target); }
 finally { if (exists(temporary)) fs.unlinkSync(temporary); }
}
export function loadConfig(file) {
 const config = json(file);
 for (const name of ['repository','documentRoot','stateDir','releasesDir']) {
  if (!path.isAbsolute(config[name] ?? '')) throw new Error(`Chemin absolu requis: ${name}`);
  config[name] = fs.realpathSync(config[name]);
 }
 if (config.documentRoot === path.parse(config.documentRoot).root) throw new Error('Racine publique invalide');
 for (const name of ['repository','stateDir','releasesDir']) {
  if (inside(config[name], config.documentRoot) || inside(config.documentRoot, config[name])) throw new Error(`${name} doit être séparé de la racine publique`);
 }
 if (inside(config.stateDir, config.releasesDir) || inside(config.releasesDir, config.stateDir)) throw new Error('stateDir et releasesDir doivent être séparés');
 if (inside(fs.realpathSync(file), config.documentRoot)) throw new Error('Configuration exposée sur le web');
 if (!config.wordpress?.WORDPRESS_API_BASE || !config.gitRef) throw new Error('Configuration WordPress ou Git manquante');
 return config;
}
function readCurrent(config) {
 const file = path.join(config.stateDir, 'current.json');
 return exists(file) ? json(file) : null;
}
export function recover(config) {
 const transaction = path.join(config.stateDir, 'transaction');
 if (!exists(path.join(transaction, 'journal.json'))) return;
 const journal = json(path.join(transaction, 'journal.json'));
 for (const [relative, hadFile] of Object.entries(journal.files)) {
  const target = safeTarget(config.documentRoot, relative);
  if (hadFile) atomicCopy(path.join(transaction, 'backup', relative), target);
  else if (exists(target)) fs.unlinkSync(target);
 }
 const current = path.join(config.stateDir, 'current.json');
 if (journal.previous) writeJSON(current, journal.previous);
 else if (exists(current)) fs.unlinkSync(current);
 fs.rmSync(transaction, {recursive:true});
}
export function publish(config, release, previous = readCurrent(config)) {
 const dist = path.join(config.releasesDir, release.id, 'dist');
 const actual = inventory(dist);
 if (JSON.stringify(actual) !== JSON.stringify(release.files)) throw new Error('Intégrité de la version invalide');
 if (!actual['index.html'] || !actual['agenda/index.html']) throw new Error('Pages requises absentes');
 const files = {...actual};
 // Retain assets of the preceding successful versions, so open pages still work.
 for (const id of (previous?.history ?? []).slice(0,2)) {
  const meta = json(path.join(config.releasesDir,id,'release.json'));
  for (const [relative, hash] of Object.entries(meta.files)) if (relative.startsWith('_astro/') && !files[relative]) files[relative] = hash;
 }
 const oldFiles = previous?.files ?? {};
 const changed = [...new Set([...Object.keys(files), ...Object.keys(oldFiles)])];
 const transaction = path.join(config.stateDir, 'transaction');
 if (exists(transaction)) throw new Error('Transaction précédente à récupérer');
 fs.mkdirSync(path.join(transaction,'backup'), {recursive:true});
 const journal = {previous, files:{}};
 try {
  // Validate every destination and back up every owned file before the first mutation.
  for (const relative of changed) {
   const target = safeTarget(config.documentRoot,relative);
   if (exists(target)) {
    if (!fs.lstatSync(target).isFile()) throw new Error(`Destination non régulière: ${relative}`);
    if (!oldFiles[relative]) throw new Error(`Fichier existant non géré: ${relative}`);
    if (sha(target) !== oldFiles[relative]) throw new Error(`Fichier modifié hors déploiement: ${relative}`);
    const backup = path.join(transaction,'backup',relative);
    fs.mkdirSync(path.dirname(backup),{recursive:true}); fs.copyFileSync(target,backup);
    journal.files[relative] = true;
   } else journal.files[relative] = false;
  }
  writeJSON(path.join(transaction,'journal.json'),journal);
  const ordered = Object.keys(actual).sort((a,b) => Number(a.endsWith('.html'))-Number(b.endsWith('.html')) || a.localeCompare(b));
  for (const relative of ordered) atomicCopy(path.join(dist,relative),safeTarget(config.documentRoot,relative));
  // Restore retained assets if manually missing; validate source hashes as well.
  for (const relative of Object.keys(files).filter(name => !actual[name])) {
   const target = safeTarget(config.documentRoot,relative);
   if (exists(target)) continue;
   const sourceId = previous.history.find(id => exists(path.join(config.releasesDir,id,'dist',relative)) && sha(path.join(config.releasesDir,id,'dist',relative)) === files[relative]);
   if (!sourceId) throw new Error('Asset conservé introuvable');
   atomicCopy(path.join(config.releasesDir,sourceId,'dist',relative),target);
  }
  for (const relative of Object.keys(oldFiles)) if (!files[relative]) {
   const target = safeTarget(config.documentRoot,relative);
   if (exists(target)) fs.unlinkSync(target);
  }
  const history = [release.id, ...(previous?.history ?? []).filter(id => id !== release.id)].slice(0,3);
  writeJSON(path.join(config.stateDir,'current.json'),{...release, files, history});
  fs.rmSync(transaction,{recursive:true});
  return history;
 } catch (error) {
  if (exists(path.join(transaction,'journal.json'))) recover(config);
  else fs.rmSync(transaction,{recursive:true});
  throw error;
 }
}
function run(command,args,options={}) { return execFileSync(command,args,{stdio:'inherit',timeout:15*60*1000,...options}); }
function git(config,args) { return execFileSync('git',['-C',config.repository,...args],{encoding:'utf8'}).trim(); }
function build(config,commit) {
 const id = `${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
 const dir = path.join(config.releasesDir,id);
 fs.mkdirSync(dir,{mode:0o700});
 try {
 const archive = path.join(dir,'source.tar');
 run('git',['-C',config.repository,'archive','--format=tar',`--output=${archive}`,commit]);
 const source = path.join(dir,'source'); fs.mkdirSync(source);
 run('tar',['-xf',archive,'-C',source]); fs.unlinkSync(archive);
 const env = {...process.env,...config.wordpress,ASTRO_TELEMETRY_DISABLED:'1'};
 const cwd = path.join(source,'astro');
 run(config.npm ?? 'npm',['ci'],{cwd,env});
 run(config.npm ?? 'npm',['run','build'],{cwd,env});
 fs.renameSync(path.join(cwd,'dist'),path.join(dir,'dist'));
 const release = {id,commit,created:new Date().toISOString(),files:inventory(path.join(dir,'dist'))};
 writeJSON(path.join(dir,'release.json'),release);
 fs.rmSync(source,{recursive:true});
 return release;
 } catch (error) {
  fs.rmSync(dir,{recursive:true,force:true});
  throw error;
 }
}
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function acknowledge(config, markers) { for (const name of markers) { if (!/^pending-[a-zA-Z0-9-]+\.json$/.test(name)) throw new Error('Marqueur invalide'); fs.rmSync(path.join(config.stateDir,name),{force:true}); } }
export function main(argv = process.argv.slice(2)) {
 const [mode, configFile, rollbackId] = argv;
 if (!['check','git','worker','rollback'].includes(mode) || !configFile) throw new Error('Usage: node uid-deploy.mjs check|git|worker|rollback /chemin/config.json [version]');
 const config = loadConfig(configFile);
 if (mode === 'check') {
  if (process.platform !== 'linux') throw new Error('Le déploiement cible Linux/Plesk');
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && (minor < 23 || (minor === 23 && patch < 4)))) throw new Error('Node >=22.23.4 requis par Astro');
  run('git',['--version']); run('tar',['--version']); run(config.npm ?? 'npm',['--version']);
  git(config,['rev-parse','--verify',`${config.gitRef}^{commit}`]);
  for (const directory of [config.documentRoot,config.stateDir,config.releasesDir]) fs.accessSync(directory, fs.constants.W_OK);
  console.log('Contrôles locaux OK. Vérifier encore PHP, Git Plesk, cron, API, sauvegardes et redirection selon le guide.');
  return;
 }
 if (mode === 'git') {
  const commit = git(config,['rev-parse','--verify',`${config.gitRef}^{commit}`]);
  writeJSON(path.join(config.stateDir, `git-${Date.now()}-${crypto.randomUUID()}.json`), {commit});
 }
 const lock = path.join(config.stateDir,'deploy.lock');
 try { fs.mkdirSync(lock); } catch (error) {
  if (error.code === 'EEXIST' && ['worker','git'].includes(mode)) { console.log('Reconstruction en attente du verrou.'); return; }
  if (error.code === 'EEXIST') throw new Error('Déploiement en cours. Relancer cette commande après sa fin.');
  throw error;
 }
 writeJSON(path.join(lock,'owner.json'),{pid:process.pid,started:new Date().toISOString()});
 let priorStatus = {};
 try {
  recover(config);
  if (exists(path.join(config.stateDir,'status.json'))) priorStatus = json(path.join(config.stateDir,'status.json'));
  const previous = readCurrent(config);
  const generationDay = today();
  const markers = fs.readdirSync(config.stateDir).filter(name => /^pending-[a-zA-Z0-9-]+\.json$/.test(name));
  const gitMarkers = fs.readdirSync(config.stateDir).filter(name => /^git-\d+-[a-f0-9-]+\.json$/.test(name)).sort();
  if (mode === 'worker' && !previous) return; // Never publish a first release implicitly.
  if (mode === 'worker' && !markers.length && !gitMarkers.length && priorStatus.lastDay === generationDay) return;
  writeJSON(path.join(config.stateDir,'status.json'),{...priorStatus,state:'reconstruction',error:null});
  let release;
  if (mode === 'rollback') {
   if (!previous?.history.includes(rollbackId)) throw new Error('Version absente des trois versions publiées conservées');
   release = json(path.join(config.releasesDir,rollbackId,'release.json'));
  } else {
   const commit = gitMarkers.length ? json(path.join(config.stateDir,gitMarkers.at(-1))).commit : previous.commit;
   if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error('Commit invalide dans la file Git');
   release = build(config,commit);
  }
  const history = publish(config,release,previous);
  // Rollback uses an old snapshot; it must not acknowledge edits that it did not render.
  if (mode !== 'rollback') {
   acknowledge(config,markers);
   for (const name of gitMarkers) fs.unlinkSync(path.join(config.stateDir,name));
  }
  writeJSON(path.join(config.stateDir,'status.json'),{state:'publié',lastSuccess:new Date().toISOString(),lastDay:generationDay,commit:release.commit,release:release.id,error:null});
  for (const entry of fs.readdirSync(config.releasesDir)) {
   if (!/^\d+-[a-f0-9-]+$/.test(entry) || history.includes(entry)) continue;
   const target = path.join(config.releasesDir,entry);
   if (fs.lstatSync(target).isDirectory() && !fs.lstatSync(target).isSymbolicLink()) fs.rmSync(target,{recursive:true});
  }
  console.log(`Version publiée : ${release.id}`);
 } catch (error) {
  writeJSON(path.join(config.stateDir,'status.json'),{...priorStatus,state:'erreur',error:String(error.message).slice(0,500)});
  throw error;
 } finally { fs.rmSync(lock,{recursive:true,force:true}); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
 try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
