import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const project = fileURLToPath(new URL('..',import.meta.url));
const run=(args,env)=>new Promise(resolve=>{
 const child=spawn(process.execPath,['node_modules/astro/bin/astro.mjs',...args],{cwd:project,env:{...process.env,...env,DEPLOY_ENVIRONMENT:'test',ASTRO_TELEMETRY_DISABLED:'1'}});
 let output=''; child.stdout.on('data',chunk=>output+=chunk); child.stderr.on('data',chunk=>output+=chunk); child.on('close',code=>resolve({code,output}));
});
test('full static build: live contracts, safe text, empty/disabled state and CMS failure',async t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'uid-build-'));
 let mode='populated';
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(mode==='error') {res.writeHead(403);res.end('{}');return;}
  const url=new URL(req.url,'http://localhost');let data;
  if(url.pathname.endsWith('/evenements')) {
   res.setHeader('X-WP-TotalPages',mode==='empty'?'0':'1');
   data=mode==='empty'?[]:[{id:1,title:{rendered:'TEST concert'},featured_media:5,meta:{uid_gallery_ids:[6]},acf:{date_heure:'2099-11-21 10:30:00',description:'<script>unsafe()</script>',lieu:'TEST local',lien_externe:''}}];
  } else if(url.pathname.includes('/media/')) data={id:Number(url.pathname.split('/').at(-1)),source_url:'https://example.com/test.jpg',alt_text:'TEST affiche',media_details:{width:900,height:1200}};
  else if(url.pathname.endsWith('/13')) data={acf:{google_calendar_id:mode==='empty'?'':'test@group.calendar.google.com'}};
  else if(url.pathname.endsWith('/11')) data={acf:{session_active:false}};
  else data={acf:{session_active:mode!=='empty',session_affiche:5,session_date:'20991121',session_heure_debut:'10:30:00',session_heure_fin:'11:30:00',session_inscription_url:'https://example.com/inscription',session_description:'TEST découverte'}};
  res.end(JSON.stringify(data));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{server.close();fs.rmSync(temp,{recursive:true,force:true});});
 const env={WORDPRESS_API_BASE:`http://127.0.0.1:${server.address().port}/wordpress/wp-json/wp/v2`,WORDPRESS_LUTINS_PAGE_ID:'11',WORDPRESS_AVENTURIERS_PAGE_ID:'12',WORDPRESS_CALENDAR_PAGE_ID:'13'};
 const populated=await run(['build','--outDir',path.join(temp,'populated')],env);
 assert.equal(populated.code,0,populated.output);
 const home=fs.readFileSync(path.join(temp,'populated/index.html'),'utf8');
 assert.ok(home.indexOf('id="news"')<home.indexOf('class="formation-section"'));
 assert.ok(home.includes('TEST concert'));assert.ok(!home.includes('<script>unsafe()'));
 assert.ok(home.includes('data-photo-gallery='));assert.ok(!home.includes('En savoir plus'));
 const lutins=fs.readFileSync(path.join(temp,'populated/jeunesse/lutins-musiciens/index.html'),'utf8');
 const aventuriers=fs.readFileSync(path.join(temp,'populated/jeunesse/aventuriers/index.html'),'utf8');
 assert.ok(!lutins.includes('content-flow--poster'));assert.ok(aventuriers.includes('TEST découverte'));
 assert.ok(fs.readFileSync(path.join(temp,'populated/agenda/index.html'),'utf8').includes('calendar.google.com/calendar/embed'));
 mode='empty';const empty=await run(['build','--outDir',path.join(temp,'empty')],env);assert.equal(empty.code,0,empty.output);
 assert.ok(fs.readFileSync(path.join(temp,'empty/index.html'),'utf8').includes('Aucun événement'));
 const noSession=fs.readFileSync(path.join(temp,'empty/jeunesse/aventuriers/index.html'),'utf8');
 assert.ok(!noSession.includes('content-flow--poster'));assert.ok(noSession.includes('Florence Harris'));
 assert.ok(fs.readFileSync(path.join(temp,'empty/agenda/index.html'),'utf8').includes('L’agenda sera disponible'));
 mode='error';const failure=await run(['build','--outDir',path.join(temp,'failed')],env);assert.notEqual(failure.code,0);assert.ok(failure.output.includes('403'));
 const unconfigured=await run(['build','--outDir',path.join(temp,'unconfigured')],{...env,WORDPRESS_API_BASE:''});assert.notEqual(unconfigured.code,0);
});
