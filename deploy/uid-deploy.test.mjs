import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inventory,publish,recover,safeRelative,acknowledge} from './uid-deploy.mjs';
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'uid-publish-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const config={documentRoot:path.join(root,'public'),stateDir:path.join(root,'state'),releasesDir:path.join(root,'releases')};
 Object.values(config).forEach(p=>fs.mkdirSync(p));
 fs.mkdirSync(path.join(config.documentRoot,'wordpress'));
 fs.writeFileSync(path.join(config.documentRoot,'wordpress','wp-config.php'),'do not touch');
 fs.writeFileSync(path.join(config.documentRoot,'.htaccess'),'existing rules');
 const release=(id,extra={})=>{
  const dist=path.join(config.releasesDir,id,'dist');fs.mkdirSync(dist,{recursive:true});
  for(const [file,value] of Object.entries({'index.html':id,'agenda/index.html':'agenda','_astro/shared.js':'js',...extra})) {
   fs.mkdirSync(path.dirname(path.join(dist,file)),{recursive:true});fs.writeFileSync(path.join(dist,file),value);
  }
  const meta={id,commit:'a'.repeat(40),files:inventory(dist)};
  fs.writeFileSync(path.join(config.releasesDir,id,'release.json'),JSON.stringify(meta));
  return meta;
 };
 return {config,release};
}
test('publish, remove only managed files, preserve WordPress/configuration and rollback',t=>{
 const {config,release}=fixture(t);
 const first=release('one',{'old/index.html':'old','_astro/old.js':'old asset'});publish(config,first);
 fs.writeFileSync(path.join(config.documentRoot,'unmanaged.txt'),'keep');
 publish(config,release('two',{'new/index.html':'new'}));
 assert.equal(fs.existsSync(path.join(config.documentRoot,'old/index.html')),false);
 assert.equal(fs.readFileSync(path.join(config.documentRoot,'wordpress/wp-config.php'),'utf8'),'do not touch');
 assert.equal(fs.readFileSync(path.join(config.documentRoot,'.htaccess'),'utf8'),'existing rules');
 assert.equal(fs.readFileSync(path.join(config.documentRoot,'unmanaged.txt'),'utf8'),'keep');
 assert.equal(fs.existsSync(path.join(config.documentRoot,'_astro/old.js')),true);
 publish(config,first);
 assert.equal(fs.readFileSync(path.join(config.documentRoot,'index.html'),'utf8'),'one');
 assert.equal(fs.existsSync(path.join(config.documentRoot,'new/index.html')),false);
});
test('reject traversal, protected files, symlinks, unowned collisions and corrupted releases before writes',t=>{
 for(const name of ['../wordpress/x','wordpress/a','WordPress/a','.git/config','x/.env','a.php','a\\b']) assert.throws(()=>safeRelative(name));
 const {config,release}=fixture(t);const first=release('one');
 fs.writeFileSync(path.join(config.documentRoot,'index.html'),'existing');
 assert.throws(()=>publish(config,first),/non géré/);
 assert.equal(fs.readFileSync(path.join(config.documentRoot,'index.html'),'utf8'),'existing');
 fs.unlinkSync(path.join(config.documentRoot,'index.html'));
 fs.symlinkSync(path.join(config.documentRoot,'wordpress'),path.join(config.documentRoot,'agenda'));
 assert.throws(()=>publish(config,first),/symbolique/);
 fs.unlinkSync(path.join(config.documentRoot,'agenda'));
 fs.writeFileSync(path.join(config.releasesDir,'one/dist/index.html'),'tampered');
 assert.throws(()=>publish(config,first),/Intégrité/);
 assert.equal(fs.existsSync(path.join(config.documentRoot,'index.html')),false);
});
test('failed/incomplete transaction restores previous files and manifest',t=>{
 const {config,release}=fixture(t);publish(config,release('one'));
 const previous=JSON.parse(fs.readFileSync(path.join(config.stateDir,'current.json')));
 const txn=path.join(config.stateDir,'transaction');fs.mkdirSync(path.join(txn,'backup'),{recursive:true});
 fs.copyFileSync(path.join(config.documentRoot,'index.html'),path.join(txn,'backup/index.html'));
 fs.writeFileSync(path.join(txn,'journal.json'),JSON.stringify({previous,files:{'index.html':true,'added.html':false}}));
 fs.writeFileSync(path.join(config.documentRoot,'index.html'),'broken');fs.writeFileSync(path.join(config.documentRoot,'added.html'),'new');
 recover(config);
 assert.equal(fs.readFileSync(path.join(config.documentRoot,'index.html'),'utf8'),'one');
 assert.equal(fs.existsSync(path.join(config.documentRoot,'added.html')),false);
});
test('acknowledgement preserves edits arriving during a build',t=>{
 const {config}=fixture(t);
 fs.writeFileSync(path.join(config.stateDir,'pending-before.json'),'{}');
 const snapshot=['pending-before.json'];
 fs.writeFileSync(path.join(config.stateDir,'pending-during.json'),'{}');
 acknowledge(config,snapshot);
 assert.deepEqual(fs.readdirSync(config.stateDir),['pending-during.json']);
});

test('worker serializes Git/content changes, retains failed signals and rolls back without swallowing edits',async t=>{
 const {execFileSync}=await import('node:child_process');
 const {main}=await import('./uid-deploy.mjs');
 const {config}=fixture(t);
 const root=path.dirname(config.stateDir);
 const repository=path.join(root,'repo');fs.mkdirSync(repository);
 execFileSync('git',['init','--initial-branch=main',repository],{stdio:'ignore'});
 const commit=content=>{
  fs.mkdirSync(path.join(repository,'astro'),{recursive:true});
  fs.writeFileSync(path.join(repository,'astro','source.txt'),content);
  execFileSync('git',['-C',repository,'add','.']);
  execFileSync('git',['-C',repository,'-c','user.name=Test','-c','user.email=test@example.test','commit','-m',content],{stdio:'ignore'});
  return execFileSync('git',['-C',repository,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
 };
 const firstCommit=commit('first');
 const npm=path.join(root,'fake-npm');
 fs.writeFileSync(npm,`#!${process.execPath}\nconst fs=require('fs');if(process.argv[2]==='run'){if(process.env.FAIL_BUILD==='1')process.exit(1);fs.mkdirSync('dist/agenda',{recursive:true});fs.writeFileSync('dist/index.html',fs.readFileSync('source.txt'));fs.writeFileSync('dist/agenda/index.html','agenda');if(process.env.MARKER)fs.writeFileSync(process.env.MARKER,'{}');}\n`,{mode:0o700});
 const configFile=path.join(root,'config.json');
 const full={...config,repository,gitRef:'refs/heads/main',npm,wordpress:{WORDPRESS_API_BASE:'https://example.test/wp-json/wp/v2'}};
 const save=()=>fs.writeFileSync(configFile,JSON.stringify(full));save();
 main(['git',configFile]);
 const first=JSON.parse(fs.readFileSync(path.join(config.stateDir,'current.json')));
 assert.equal(first.commit,firstCommit);
 const secondCommit=commit('second');
 fs.mkdirSync(path.join(config.stateDir,'deploy.lock'));
 main(['git',configFile]); // Push during another build is persisted, not lost.
 assert.ok(fs.readdirSync(config.stateDir).some(file=>file.startsWith('git-')));
 fs.rmdirSync(path.join(config.stateDir,'deploy.lock'));
 fs.writeFileSync(path.join(config.stateDir,'pending-before.json'),'{}');
 full.wordpress.FAIL_BUILD='1';save();
 assert.throws(()=>main(['worker',configFile]));
 assert.equal(fs.readdirSync(config.releasesDir).length,1,'failed builds leave no source/dependency directories');
 assert.equal(fs.readFileSync(path.join(config.documentRoot,'index.html'),'utf8'),'first');
 assert.ok(fs.existsSync(path.join(config.stateDir,'pending-before.json')));
 full.wordpress.FAIL_BUILD='0';full.wordpress.MARKER=path.join(config.stateDir,'pending-during.json');save();
 main(['worker',configFile]);
 assert.equal(JSON.parse(fs.readFileSync(path.join(config.stateDir,'current.json'))).commit,secondCommit);
 assert.ok(fs.existsSync(path.join(config.stateDir,'pending-during.json')));
 assert.ok(!fs.existsSync(path.join(config.stateDir,'pending-before.json')));
 main(['rollback',configFile,first.id]);
 assert.equal(fs.readFileSync(path.join(config.documentRoot,'index.html'),'utf8'),'first');
 assert.ok(fs.existsSync(path.join(config.stateDir,'pending-during.json')));
 delete full.wordpress.MARKER;save();main(['worker',configFile]);
 assert.equal(JSON.parse(fs.readFileSync(path.join(config.stateDir,'current.json'))).commit,firstCommit);
});
