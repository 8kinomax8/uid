import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const project = fileURLToPath(new URL('..',import.meta.url));
const run=(args,env)=>new Promise(resolve=>{
 const child=spawn(process.execPath,['node_modules/astro/bin/astro.mjs',...args],{cwd:project,env:{...process.env,...env,DEPLOY_ENVIRONMENT:'test',ASTRO_TELEMETRY_DISABLED:'1'}});
 let output=''; child.stdout.on('data',chunk=>output+=chunk); child.stderr.on('data',chunk=>output+=chunk); child.on('close',code=>resolve({code,output}));
});
test('full static build: live contracts, safe text, empty/disabled state and CMS failure',async t=>{
 // Astro renames assets from .astro/.prerender; keep outputs on that same device.
 const buildRoot=path.join(project,'.astro');
 fs.mkdirSync(buildRoot,{recursive:true});
 const temp=fs.mkdtempSync(path.join(buildRoot,'uid-build-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 let mode='populated';
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(mode==='error') {res.writeHead(403);res.end('{}');return;}
  const url=new URL(req.url,'http://localhost');let data;
  if(url.pathname.endsWith('/evenements')) {
   res.setHeader('X-WP-TotalPages',['empty','hidden','custom'].includes(mode)?'0':'1');
   data=['empty','hidden','custom'].includes(mode)?[]:[{id:1,title:{rendered:'TEST concert'},featured_media:5,meta:{uid_gallery_ids:[6]},acf:{date_heure:'2099-11-21 10:30:00',description:'<script>unsafe()</script>',lieu:'TEST local',lien_externe:''}},{id:2,title:{rendered:'TEST suivant'},featured_media:5,meta:{uid_gallery_ids:[]},acf:{date_heure:'2099-12-21 10:30:00',description:'Rendez-vous suivant',lieu:'TEST local',lien_externe:''}}];
   if(mode==='single') data=data.slice(0,1);
  } else if(url.pathname.includes('/media/')) data={id:Number(url.pathname.split('/').at(-1)),source_url:'https://example.com/test.jpg',alt_text:'TEST affiche',media_details:{width:900,height:1200}};
  else if(url.pathname.endsWith('/13')) data={acf:{google_calendar_id:mode==='empty'?'':'test@group.calendar.google.com\nsecond@group.calendar.google.com', ...(mode==='hidden'?{home_feature_mode:'hidden'}:mode==='custom'?{home_feature_mode:'custom',home_feature_title:'TEST actualité',home_feature_summary:'Actualité éditoriale',home_feature_link_label:'Participer',home_feature_url:'https://example.com/projet',home_feature_image:5}:{})}};
  else if(url.pathname.endsWith('/11')) data={acf:{session_active:false}};
  else data={acf:{session_active:mode!=='empty',session_affiche:5,session_date:'20991121',session_heure_debut:'10:30:00',session_heure_fin:'11:30:00',session_inscription_url:'https://example.com/inscription',session_description:'TEST découverte'}};
  res.end(JSON.stringify(data));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>server.close());
 const env={WORDPRESS_API_BASE:`http://127.0.0.1:${server.address().port}/wordpress/wp-json/wp/v2`,WORDPRESS_LUTINS_PAGE_ID:'11',WORDPRESS_AVENTURIERS_PAGE_ID:'12',WORDPRESS_CALENDAR_PAGE_ID:'13'};
 const populated=await run(['build','--outDir',path.join(temp,'populated')],env);
 assert.equal(populated.code,0,populated.output);
 const home=fs.readFileSync(path.join(temp,'populated/index.html'),'utf8');
 assert.ok(home.indexOf('id="news"')<home.indexOf('class="formation-section"'));
 assert.ok(home.includes('data-home-lead="event"'));
 assert.match(home, /<h1[^>]*>Union Instrumentale<br\s*\/?\s*>Delémont<\/h1>/);
 assert.match(home, /<h2[^>]*>TEST concert<\/h2>/);
 assert.ok(home.indexOf('Notre prochain événement') < home.indexOf('>TEST concert</h2>'));
 assert.ok(home.includes('<h3>TEST concert</h3>'));assert.ok(home.includes('<h3>TEST suivant</h3>'));
 assert.ok(!home.includes('Découvrir l’histoire'));assert.ok(!home.includes('Depuis 1878'));
 assert.ok(home.includes('home-feature-title'));
 assert.ok(home.includes('TEST concert'));assert.ok(!home.includes('<script>unsafe()'));
 assert.ok(home.includes('data-photo-gallery='));assert.ok(!home.includes('En savoir plus'));
 assert.match(home, /href="#news">Tous les événements<\/a>/);
 assert.ok(!home.includes('Calendrier Google'));assert.ok(!home.includes('Consulter le calendrier Google'));
 const grid=home.slice(home.indexOf('class="events-grid"'));
 assert.ok(grid.indexOf('<h3>TEST concert</h3>') < grid.indexOf('<h3>TEST suivant</h3>'));
 const lutins=fs.readFileSync(path.join(temp,'populated/jeunesse/lutins-musiciens/index.html'),'utf8');
 const aventuriers=fs.readFileSync(path.join(temp,'populated/jeunesse/aventuriers/index.html'),'utf8');
 assert.ok(!lutins.includes('content-flow--poster'));assert.ok(aventuriers.includes('TEST découverte'));
 const agenda=fs.readFileSync(path.join(temp,'populated/agenda/index.html'),'utf8');
 assert.ok(agenda.includes('calendar.google.com/calendar/embed'));
 assert.ok(!agenda.includes('TEST concert'));assert.ok(!agenda.includes('TEST suivant'));
 assert.ok(!agenda.includes('class="event-card'));
 assert.ok(agenda.includes('second%40group.calendar.google.com'));
 assert.ok(!agenda.includes('calendar-links'));
 assert.ok(!agenda.includes('Ouvrir le calendrier'));
 assert.ok(!agenda.includes('Ouvrir l’agenda'));
 assert.ok(agenda.includes('data-native-cursor'));
 for (const route of ['agenda','contact','mentions-legales']) {
  const html=fs.readFileSync(path.join(temp,`populated/${route}/index.html`),'utf8');
  assert.ok(!html.includes('class="page-hero'));
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
 }
 assert.ok(aventuriers.includes('Gratuit et sur inscription'));
 assert.ok(!aventuriers.includes('youth-contact'));
 const soutien=fs.readFileSync(path.join(temp,'populated/soutien/index.html'),'utf8');
 assert.ok(soutien.indexOf('Recherche de soutiens financiers')<soutien.indexOf('<h2>La Partition'));
 for (const content of ['2026 et 2028','Renaud Zbinden','caissier','mailto:uniformes@fanfareuid.ch','tel:+41798859265','bières artisanales','passeports gourmands','DossierPartenariat_UniformeUID2026_VF.pdf']) assert.ok(soutien.includes(content),content);
 assert.ok(!soutien.includes('nouveaux costumes'));

 const photos=fs.readFileSync(path.join(temp,'populated/photos/index.html'),'utf8');
 assert.equal((photos.match(/data-deferred-src=/g)||[]).length,5);
 for (const tag of photos.match(/<img[^>]*data-deferred-src[^>]*>/g)||[]) assert.ok(!/\ssrc=/.test(tag));
 assert.ok(photos.includes('<noscript>'));
 assert.ok(!/<img[^>]*\ssrc=[^>]*data-photo-lightbox-image/.test(photos));
 mode='single';const single=await run(['build','--outDir',path.join(temp,'single')],env);assert.equal(single.code,0,single.output);
 const singleHome=fs.readFileSync(path.join(temp,'single/index.html'),'utf8');
 assert.ok(singleHome.includes('<h3>TEST concert</h3>'));assert.ok(!singleHome.includes('href="#news"'));
 mode='empty';const empty=await run(['build','--outDir',path.join(temp,'empty')],env);assert.equal(empty.code,0,empty.output);
 const emptyHome=fs.readFileSync(path.join(temp,'empty/index.html'),'utf8');
 assert.ok(emptyHome.includes('Aucun événement'));assert.ok(emptyHome.includes('data-home-lead="feature"'));
 assert.ok(!emptyHome.includes('Notre prochain événement'));
 assert.ok(!emptyHome.includes('Consulter le calendrier Google'));assert.ok(!emptyHome.includes('href="#news"'));
 assert.ok(!emptyHome.includes('home-feature-title'));
 assert.ok(emptyHome.includes('De nouveaux uniformes'));
 const noSession=fs.readFileSync(path.join(temp,'empty/jeunesse/aventuriers/index.html'),'utf8');
 assert.ok(!noSession.includes('content-flow--poster'));assert.ok(!noSession.includes('youth-contact'));assert.ok(!noSession.includes('Responsable formation'));
 assert.ok(fs.readFileSync(path.join(temp,'empty/agenda/index.html'),'utf8').includes('L’agenda sera disponible'));
 for (const state of ['custom','hidden']) {
  mode=state;const build=await run(['build','--outDir',path.join(temp,state)],env);assert.equal(build.code,0,build.output);
  const html=fs.readFileSync(path.join(temp,state,'index.html'),'utf8');
  assert.ok(html.includes(`data-home-lead="${state==='custom'?'feature':'youth'}"`));
  assert.ok(!html.includes('home-feature-title')); // no duplicate feature when used as hero
  if(state==='custom') assert.ok(html.includes('TEST actualité'));
 }
 mode='error';const failure=await run(['build','--outDir',path.join(temp,'failed')],env);assert.notEqual(failure.code,0);assert.ok(failure.output.includes('403'));
 const unconfigured=await run(['build','--outDir',path.join(temp,'unconfigured')],{...env,WORDPRESS_API_BASE:''});assert.notEqual(unconfigured.code,0);
});
