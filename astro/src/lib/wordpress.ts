import { decodeHTML } from 'entities';
export type Media = { id: number; src: string; alt: string; width: number; height: number };
export type EventItem = {
 id: number; title: string; date: string; startsAt: string; location: string; summary: string;
 image: string; imageAlt: string; imageOrientation: 'portrait' | 'landscape'; href?: string; photos: Media[];
};
export type DiscoverySession = { date: string; startsAt: string; endsAt: string; description: string; href: string; poster: Media };
export type CalendarConfig = { embedUrl: string; externalUrl: string };
export type CMSConfig = { base: string; lutinsId: string; aventuriersId: string; calendarId: string };
type RecordValue = Record<string, any>;
const zone = 'Europe/Zurich';
const object = (value: unknown): RecordValue => {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Réponse WordPress invalide');
 return value as RecordValue;
};
const text = (value: unknown, required = false): string => {
 if (typeof value !== 'string' || (required && !value.trim())) throw new Error('Champ WordPress manquant ou invalide');
 return value.trim();
};
export const safeURL = (value: unknown): string => {
 const url = new URL(text(value, true));
 if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('URL WordPress interdite');
 return url.href;
};
const plainText = (value: unknown) => decodeHTML(text(value, true).replace(/<[^>]*>/g, '')).trim();
const parts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'}).formatToParts(date).map(p => [p.type,p.value]));
export const localDay = (date: Date) => { const p = parts(date); return `${p.year}-${p.month}-${p.day}`; };
export function zurichDate(value: string): Date {
 if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) throw new Error(`Date invalide: ${value}`);
 const nominal = Date.parse(value.replace(' ', 'T') + 'Z');
 for (const offset of [2, 1]) {
  const candidate = new Date(nominal - offset * 3600000);
  if (!Number.isFinite(candidate.getTime())) continue;
  const p = parts(candidate);
  if (`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}` === value) return candidate;
 }
 throw new Error(`Date suisse inexistante: ${value}`);
}
const dateLabel = (date: Date) => new Intl.DateTimeFormat('fr-CH', {timeZone:zone, dateStyle:'long', timeStyle:'short'}).format(date);
export function createWordPressClient(config: CMSConfig, fetcher: typeof fetch = fetch, now = () => new Date()) {
 const base = safeURL(config.base).replace(/\/$/, '') + '/';
 if (!new URL(base).pathname.endsWith('/wp-json/wp/v2/')) throw new Error('WORDPRESS_API_BASE doit se terminer par /wp-json/wp/v2');
 const mediaCache = new Map<number, Promise<Media>>();
 async function request(path: string) {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
   try {
    const response = await fetcher(new URL(path, base), {signal: AbortSignal.timeout(15000), headers: {Accept:'application/json'}, cache:'no-store'});
    if (!response.ok) {
     if (response.status < 500 && response.status !== 429) throw Object.assign(new Error(`WordPress HTTP ${response.status}`), {permanent:true});
     throw new Error(`WordPress HTTP ${response.status}`);
    }
    return {data: await response.json(), headers: response.headers};
   } catch (error) {
    last = error;
    if ((error as {permanent?:boolean}).permanent) throw error;
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
   }
  }
  throw new Error('WordPress indisponible : publication annulée', {cause:last});
 }
 function media(id: unknown): Promise<Media> {
  if (!Number.isInteger(id) || Number(id) <= 0) throw new Error('Identifiant de média invalide');
  const key = Number(id);
  if (!mediaCache.has(key)) mediaCache.set(key, request(`media/${key}`).then(({data}) => {
   const m = object(data), detail = object(m.media_details);
   if (!(detail.width > 0 && detail.height > 0)) throw new Error('Dimensions de média invalides');
   return {id:key, src:safeURL(m.source_url), alt:typeof m.alt_text === 'string' ? m.alt_text : '', width:detail.width, height:detail.height};
  }));
  return mediaCache.get(key)!;
 }
 async function page(id: string) {
  if (!/^[1-9]\d*$/.test(id)) throw new Error('Identifiant de page WordPress non configuré');
  return object((await request(`pages/${id}`)).data);
 }
 return {
  async getEvents(): Promise<EventItem[]> {
   const posts: RecordValue[] = [];
   let total = 1;
   for (let number = 1; number <= total; number++) {
    const {data, headers} = await request(`evenements?status=publish&per_page=100&page=${number}&orderby=id&order=asc`);
    if (!Array.isArray(data)) throw new Error('Liste des événements invalide');
    const count = Number(headers.get('X-WP-TotalPages'));
    if (!Number.isInteger(count) || count < 0 || (!headers.has('X-WP-TotalPages'))) throw new Error('Pagination WordPress manquante');
    total = count;
    posts.push(...data.map(object));
   }
   const upcoming = posts.map(post => ({post, acf:object(post.acf), start:zurichDate(text(object(post.acf).date_heure, true))})).filter(item => localDay(item.start) >= localDay(now())).sort((a,b) => a.start.getTime()-b.start.getTime() || a.post.id-b.post.id);
   const result: EventItem[] = [];
   // Sequential mapping bounds pressure on shared hosting; media requests are deduplicated.
   for (const {post,acf,start} of upcoming) {
    const main = await media(post.featured_media);
    const ids = object(post.meta ?? {}).uid_gallery_ids ?? [];
    if (!Array.isArray(ids)) throw new Error('Galerie invalide');
    const photos = [main];
    for (const id of [...new Set(ids)]) if (id !== main.id) photos.push(await media(id));
    result.push({id:post.id, title:plainText(object(post.title).rendered), date:dateLabel(start), startsAt:start.toISOString(), location:text(acf.lieu,true), summary:text(acf.description,true), image:main.src, imageAlt:main.alt, imageOrientation:main.height>main.width?'portrait':'landscape', href:acf.lien_externe ? safeURL(acf.lien_externe):undefined, photos});
   }
   return result;
  },
  async getDiscoverySession(group: 'lutins' | 'aventuriers'): Promise<DiscoverySession | null> {
   const acf = object((await page(group === 'lutins' ? config.lutinsId : config.aventuriersId)).acf);
   if (acf.session_active === false || acf.session_active === 0) return null;
   if (acf.session_active !== true && acf.session_active !== 1) throw new Error('Activation de session invalide');
   const rawDay = text(acf.session_date,true);
   const day = /^\d{8}$/.test(rawDay) ? `${rawDay.slice(0,4)}-${rawDay.slice(4,6)}-${rawDay.slice(6,8)}` : rawDay;
   const start = zurichDate(`${day} ${text(acf.session_heure_debut,true)}`);
   const end = zurichDate(`${day} ${text(acf.session_heure_fin,true)}`);
   if (end <= start) throw new Error('La fin de session doit suivre le début');
   const time = new Intl.DateTimeFormat('fr-CH', {timeZone:zone,timeStyle:'short'});
   return {date:`${dateLabel(start)} – ${time.format(end)}`, startsAt:start.toISOString(), endsAt:end.toISOString(), description:acf.session_description ? text(acf.session_description) : '', href:safeURL(acf.session_inscription_url), poster:await media(acf.session_affiche)};
  },
  async getCalendarConfig(): Promise<CalendarConfig | null> {
   const acf = object((await page(config.calendarId)).acf);
   if (!acf.google_calendar_id) return null;
   const id = text(acf.google_calendar_id,true);
   if (!/^[^\s<>]+@[^\s<>]+$/.test(id)) throw new Error('Identifiant Google Calendar invalide');
   const params = new URLSearchParams({src:id,ctz:zone,hl:'fr'});
   return {embedUrl:`https://calendar.google.com/calendar/embed?${params}`, externalUrl:`https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(id)}`};
  }
 };
}
let client: ReturnType<typeof createWordPressClient>;
function configuredClient() {
 return client ??= createWordPressClient({base:import.meta.env.WORDPRESS_API_BASE ?? '',lutinsId:import.meta.env.WORDPRESS_LUTINS_PAGE_ID ?? '',aventuriersId:import.meta.env.WORDPRESS_AVENTURIERS_PAGE_ID ?? '',calendarId:import.meta.env.WORDPRESS_CALENDAR_PAGE_ID ?? ''});
}
export const getEvents = () => configuredClient().getEvents();
export const getDiscoverySession = (group: 'lutins'|'aventuriers') => configuredClient().getDiscoverySession(group);
export const getCalendarConfig = () => configuredClient().getCalendarConfig();
