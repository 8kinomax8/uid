import test from 'node:test';
import assert from 'node:assert/strict';
import {createWordPressClient, zurichDate, localDay, safeURL} from '../src/lib/wordpress.ts';
const config = {base:'https://cms.example/wordpress/wp-json/wp/v2',lutinsId:'11',aventuriersId:'12',calendarId:'13'};
const event = (id:number, date='2026-11-21 10:30:00') => ({id,title:{rendered:'Concert &amp; musique'},acf:{description:'Description',date_heure:date,lieu:'Delémont',lien_externe:''},featured_media:1,meta:{uid_gallery_ids:[1,2,2]}});
const media = (id:number) => ({id,source_url:`https://cms.example/${id}.jpg`,alt_text:'Affiche',media_details:{width:900,height:1200}});
function mock(handler:(url:URL)=>Response|Promise<Response>) { return ((input:any) => handler(new URL(String(input)))) as typeof fetch; }
const reply = (data:unknown, pages?:number) => new Response(JSON.stringify(data),{headers:pages === undefined ? {} : {'X-WP-TotalPages':String(pages)}});
test('Swiss timezone, summer/winter, invalid and ambiguous dates', () => {
 assert.equal(zurichDate('2026-01-01 10:00:00').toISOString(),'2026-01-01T09:00:00.000Z');
 assert.equal(zurichDate('2026-07-01 10:00:00').toISOString(),'2026-07-01T08:00:00.000Z');
 assert.throws(()=>zurichDate('2026-03-29 02:30:00'));
 assert.throws(()=>zurichDate('2026-02-30 10:00:00'));
 assert.equal(zurichDate('2026-10-25 02:30:00').toISOString(),'2026-10-25T00:30:00.000Z');
 assert.equal(localDay(new Date('2026-11-20T23:01:00Z')),'2026-11-21');
});
test('pagination beyond 100, sorting, end-of-day expiry, galleries and media deduplication', async () => {
 const calls:string[]=[];
 const client=createWordPressClient(config,mock(url=>{
  calls.push(url.pathname+url.search);
  if(url.pathname.includes('/media/')) return reply(media(Number(url.pathname.split('/').at(-1))));
  return reply(url.searchParams.get('page')==='1' ? Array.from({length:100},(_,i)=>event(i+1)) : [event(101,'2026-11-20 23:00:00'),event(102,'2026-11-21 09:00:00')],2);
 }),()=>new Date('2026-11-21T20:00:00Z'));
 const result=await client.getEvents();
 assert.equal(result.length,101); assert.equal(result[0].id,102);
 assert.equal(result[0].title,'Concert & musique'); assert.equal(result[0].href,undefined);
 assert.deepEqual(result[0].photos.map(m=>m.id),[1,2]);
 assert.equal(calls.filter(c=>c.includes('/media/')).length,2);
});
test('empty content stays empty; permanent errors and malformed responses fail',async()=>{
 assert.deepEqual(await createWordPressClient(config,mock(()=>reply([],0))).getEvents(),[]);
 await assert.rejects(()=>createWordPressClient(config,mock(()=>new Response('',{status:404}))).getEvents(),/404/);
 await assert.rejects(()=>createWordPressClient(config,mock(()=>reply({}))).getEvents(),/Liste/);
 await assert.rejects(()=>createWordPressClient(config,mock(()=>reply([]))).getEvents(),/Pagination/);
 assert.throws(()=>safeURL('javascript:alert(1)'));
 assert.throws(()=>createWordPressClient({...config,base:''}));
});
test('transient failures retry, persistent failure blocks publication',async()=>{
 let attempts=0;
 const client=createWordPressClient(config,mock(()=> ++attempts<3 ? new Response('',{status:503}):reply([],0)));
 assert.deepEqual(await client.getEvents(),[]); assert.equal(attempts,3);
 await assert.rejects(()=>createWordPressClient(config,mock(()=>{throw new TypeError('Network down');})).getEvents(),/indisponible/);
});
test('independent disabled/active discovery sessions with ACF raw Ymd dates',async()=>{
 const acf={session_active:true,session_date:'20261121',session_heure_debut:'09:00:00',session_heure_fin:'10:00:00',session_affiche:1,session_inscription_url:'https://forms.example/signup',session_description:'Bienvenue'};
 const client=createWordPressClient(config,mock(url=>reply(url.pathname.endsWith('/11') ? {acf:{session_active:false}} : url.pathname.includes('/media/')?media(1):{acf})));
 assert.equal(await client.getDiscoverySession('lutins'),null);
 assert.equal((await client.getDiscoverySession('aventuriers'))?.startsAt,'2026-11-21T08:00:00.000Z');
 const invalid=createWordPressClient(config,mock(()=>reply({acf:{...acf,session_heure_fin:'08:00:00'}})));
 await assert.rejects(()=>invalid.getDiscoverySession('lutins'),/fin/);
});
test('calendar: legacy ID, multiple IDs, deduplication, empty and invalid contracts',async()=>{
 const get = (value:unknown) => createWordPressClient(config,mock(()=>reply({acf:{google_calendar_id:value}}))).getCalendarConfig();
 for (const value of ['',false,null,' \r\n ']) assert.equal(await get(value),null);
 const single=await get('uid@group.calendar.google.com');
 assert.equal(single!.calendars.length,1);
 const calendar=await get(' uid@group.calendar.google.com\r\n\r\nen.ch#holiday@group.v.calendar.google.com\nuid@group.calendar.google.com ');
 const params=new URL(calendar!.embedUrl).searchParams;
 assert.equal(params.get('ctz'),'Europe/Zurich'); assert.equal(params.get('hl'),'fr');
 assert.deepEqual(params.getAll('src'),['uid@group.calendar.google.com','en.ch#holiday@group.v.calendar.google.com']);
 assert.deepEqual(calendar!.calendars.map(c=>new URL(c.externalUrl).searchParams.get('cid')),params.getAll('src'));
 for (const value of ['<iframe>','https://example.com/a@b','uid@group.calendar.google.com&src=evil@b','a@b c@d','a@b@c',['a@b'],true]) await assert.rejects(()=>get(value));
});

test('DEV refuses production API, redirects and production media',async()=>{
 assert.throws(()=>createWordPressClient({...config,development:true}),/DEV/);
 const dev={...config,base:'https://dev.fanfareuid.ch/wordpress/wp-json/wp/v2',development:true};
 let strictRedirect=false;
 const fetcher = (async (input:any,init:any)=>{
  strictRedirect=init.redirect==='error';
  return String(input).includes('/media/') ? reply(media(1)):reply([event(1)],1);
 }) as typeof fetch;
 await assert.rejects(()=>createWordPressClient(dev,fetcher,()=>new Date('2026-01-01')).getEvents(),/Média hors/);
 assert.ok(strictRedirect);
});
