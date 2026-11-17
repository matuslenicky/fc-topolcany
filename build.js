// Statický generátor webu FC Topoľčany: data/ + src/ -> dist/   (node build.js; TODAY=2026-11-16 prepíše dnešný dátum)
// Obsah: zápasy, tabuľky a súpisky zo Sportnetu (data/sportnet.json, scripts/sportnet.mjs), údaje o klube z data/klub.json
// (len zo zverejnených zdrojov), erby súperov zo Sportnetu (scripts/logos.py), fotky z webu klubu fcto.sk (scripts/photos.py -> data/foto-out.json, src/img/foto).
// Podpis vzhľadu: zlatý lem štítu (rám fotiek a zápasovej dosky), červeno-biele pruhy zo steny štadióna „My sme tu doma“,
// vitrína mládežníckych titulov na bordovom podklade; pätkové písmo Bitter ako monogram TFC v erbe.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const rd = (f, def) => { const p = path.join(ROOT, 'data', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : def; };
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const club = rd('klub.json');
const sn = rd('sportnet.json');
const foto = rd('foto-out.json', { fotky: {} }); // fotky z webu klubu (scripts/photos.py)
const SPACE = config.sportnet.appSpace;

// ---- pomocné -------------------------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const todayISO = () => local.format(new Date()).slice(0, 10);
const TODAY = process.env.TODAY || todayISO();
const DAYS = ['nedeľa', 'pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota'];
const DAYS_S = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
const MONTHS = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december'];
const MONTHS_G = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
const dObj = (iso) => new Date(iso + 'T12:00:00Z');
const dShort = (iso) => { const d = dObj(iso); return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}.`; };
const dDay = (iso) => DAYS_S[dObj(iso).getUTCDay()];
const DAYS_ACC = ['v nedeľu', 'v pondelok', 'v utorok', 'v stredu', 'vo štvrtok', 'v piatok', 'v sobotu'];
const dWhen = (iso) => { const d = dObj(iso); return `${DAYS_ACC[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS_G[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dLong = (iso) => { const d = dObj(iso); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}. ${MONTHS_G[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dDate = (iso) => { const d = dObj(iso); return `${d.getUTCDate()}. ${MONTHS_G[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const dFull = (iso) => { const d = dObj(iso); return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`; };
const monthKey = (iso) => iso.slice(0, 7);
const monthName = (key) => { const [y, m] = key.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
// okamih výkopu s posunom časového pásma (letný čas) pre odpočet v prehliadači
function isoLocal(date, time = '12:00') {
  const [y, mo, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const [ld, lt] = local.format(new Date(guess)).split(' ');
  const shown = Date.UTC(...ld.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)), ...lt.split(':').map(Number));
  const off = (shown - guess) / 6e4;
  return `${date}T${time}:00+${String(Math.floor(off / 60)).padStart(2, '0')}:${String(off % 60).padStart(2, '0')}`;
}
const acc = (league) => league.replace(/\bliga\b/, 'ligu'); // 4. pád: hrajú IV. ligu
const tel = (n) => 'tel:' + n.replace(/\s+/g, '');
const SEASON = sn.season.replace(/^(\d{4})\/\d\d(\d\d)$/, '$1/$2');
const plural = (n, a, b, c) => `${n} ${n === 1 ? a : n >= 2 && n <= 4 ? b : c}`;
const zo = (n) => `${/^(4|6|7|1[467]|[467]\d)$/.test(String(n)) ? 'zo' : 'z'} ${n}`; // „zo 16“, „z 11“ (podľa výslovnosti čísla)
const num = (n) => Number(n).toLocaleString('sk-SK');

// ---- súťaže, tímy, zápasy ------------------------------------------------------------------------
const compName = (name) => club.sutaze[name] || club.sutaze[name.replace(/\s+/g, ' ').trim()] || name.replace(/\s+/g, ' ').replace(/-ObFZ TT/, ' ObFZ Trnava').replace(/\s*Macron \| yoursport\s*/, ' ').replace(/-/g, ' ').trim();
const ROUND = (r) => (/^\d+$/.test(r) ? `${r}. kolo` : String(r || '').replace(/\.\s*kolo/i, '. kolo').replace(/Kolo/, 'kolo'));
const teams = sn.teams.map((t) => {
  const league = t.competitions.find((c) => !c.cup);
  // tabuľka prípraviek bez zapísaných výsledkov (všetci 0:0, body len za účasť) by klamala, preto sa neukazuje
  const raw = league ? sn.tables[league.key] : null;
  const table = raw && raw.rows.some((r) => r.gf || r.ga) ? raw : null;
  const pos = table?.rows.find((r) => r.our);
  return {
    ...t, url: `timy/${t.slug}/`, code: t.adult ? t.slug[0] : norm(t.short).replace(/-/g, ''),
    full: t.adult ? t.short : `${t.short} ${t.sub}`,
    leagueName: league ? compName(league.name) : '', leagueKey: league?.key || '', table, pos: pos?.pos || null, of: table?.rows.length || 0,
  };
});
// tímy bez zápasu v sezóne (napr. prihlásený B-tím bez súťaže) sa na webe neukazujú
for (let i = teams.length - 1; i >= 0; i--) if (!sn.matches.some((m) => m.team === teams[i].slug)) teams.splice(i, 1);
const bySlug = Object.fromEntries(teams.map((t) => [t.slug, t]));
// kolo bez súpera (voľno) vedie Sportnet ako zápas s prázdnym súperom: na webe by z neho bol riadok bez mena a stránka „FC Topoľčany –“
const matches = sn.matches.filter((m) => String(m.opponent || '').trim()).map((m) => {
  const t = bySlug[m.team];
  const past = m.played || m.date < TODAY;
  let gf = null, ga = null, res = null;
  // prípravky (U11 a mladší) výsledok nezapisujú, Sportnet pri nich dáva 0:0 bez gólov
  if (m.score === '0:0' && !(m.goals || []).length && /^U(\d|1[01])\b/.test(t.short)) m = { ...m, score: null };
  if (m.score) { const [h, a] = m.score.split(':').map(Number); [gf, ga] = m.home ? [h, a] : [a, h]; res = gf > ga ? 'w' : gf < ga ? 'l' : 'd'; }
  const slug = `${m.date}-${t.code}-${norm(m.opponent)}`;
  return { ...m, past, gf, ga, res, slug, url: `zapasy/${slug}/`, comp: compName(m.competition), roundName: ROUND(m.round), teamObj: t, cup: /cup|pohár/i.test(m.competition) };
});
const teamMatches = (slug) => matches.filter((m) => m.team === slug);
const upcoming = matches.filter((m) => !m.past);
const results = matches.filter((m) => m.past).reverse();
const RES = { w: 'Výhra', d: 'Remíza', l: 'Prehra' };
const RES_S = { w: 'V', d: 'R', l: 'P' };
const noScore = (m) => (m.teamObj.adult ? 'Sportnet výsledok neuvádza' : 'Výsledky prípraviek sa nezapisujú');

// strelci tímu v sezóne (vlastné góly sa nerátajú)
function scorers(slug) {
  const c = new Map();
  for (const m of teamMatches(slug)) for (const g of m.goals || []) if (g.side === 'our' && g.kind !== 'own' && g.player) c.set(g.player, (c.get(g.player) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sk'));
}
function record(slug, filter = () => true) {
  const r = { w: 0, d: 0, l: 0, gf: 0, ga: 0, n: 0 };
  for (const m of teamMatches(slug)) if (m.res && filter(m)) { r[m.res]++; r.gf += m.gf; r.ga += m.ga; r.n++; }
  return r;
}

// ---- obrázky -----------------------------------------------------------------------------------
const CREST_R = 480 / 526; // erb je štít, o niečo vyšší než široký
const logoFile = (space) => space && fs.existsSync(path.join(SRC, 'img', 'kluby', `${space}.webp`));
const initials = (name) => String(name).replace(/^(TJ|OŠK|OFK|ŠK|FK|FC|MFK|MŠK|PFK|TFK|PŠK|ZFC|OTJ|AFC|Telovýchovná jednota)\s+/i, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
function logo(space, name, R, size = 40, eager = false) {
  if (space === SPACE) return `<img class="logo" src="${R}img/erb-128.webp" alt="" width="${Math.round(size * CREST_R)}" height="${size}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
  if (logoFile(space)) return `<img class="logo" src="${R}img/kluby/${space}.webp" alt="" width="${size}" height="${size}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
  return `<span class="logo logo--txt" aria-hidden="true">${esc(initials(name))}</span>`;
}
// ---- fotky z webu klubu (fcto.sk) -----------------------------------------------------------------
// pic(R, 'hero', { sizes }) – responzívny <img> zo src/img/foto/<meno>-<šírka>.webp; chýbajúca fotka = prázdny reťazec
function pic(R, name, { sizes = '100vw', cls = '', eager = false, alt } = {}) {
  const f = foto.fotky[name];
  if (!f) return '';
  const set = f.widths.map((x) => `${R}img/foto/${name}-${x}.webp ${x}w`).join(', ');
  const def = f.widths.length > 1 ? f.widths.at(-2) : f.widths[0];
  return `<img${cls ? ` class="${cls}"` : ''} src="${R}img/foto/${name}-${def}.webp" srcset="${set}" sizes="${sizes}" alt="${esc(alt ?? f.alt)}" width="${f.w}" height="${f.h}"${eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"'}>`;
}
const FOTO_SRC = `Foto: <a href="${foto.url || 'https://www.fcto.sk/'}" rel="noopener">web FC Topoľčany</a>`;
const galleryNames = Object.keys(foto.fotky).filter((k) => foto.fotky[k].skupina === 'galeria');
function gallery(R, n = galleryNames.length) {
  return `<ul class="gal">${galleryNames.slice(0, n).map((k) => `<li><a class="gal-a" href="${R}img/foto/${k}-${foto.fotky[k].widths.at(-1)}.webp">${pic(R, k, { sizes: '(min-width: 1100px) 360px, (min-width: 700px) 33vw, 50vw' })}</a></li>`).join('')}</ul>`;
}

// ---- ikony (Lucide, ISC; sociálne siete jednoduché tvary) ------------------------------------------
const ico = (p, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  phone: ico('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  mail: ico('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
  pin: ico('<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
  route: ico('<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>'),
  cal: ico('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  ext: ico('<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'),
  arrow: ico('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  menu: ico('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: ico('<path d="M18 6 6 18M6 6l12 12"/>'),
  ball: ico('<circle cx="12" cy="12" r="10"/><path d="m12 7 4.2 3-1.6 5H9.4L7.8 10z"/><path d="M12 2v5M21.5 9.5 16.2 10M18 20l-3.4-5M6 20l3.4-5M2.5 9.5l5.3.5"/>'),
  up: ico('<path d="M7 17 17 7M8 7h9v9"/>'),
  trophy: ico('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.8 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.2.6 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0z"/>'),
  shirt: ico('<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z"/>'),
  play: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
  fb: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H8v3h2.5V21z"/></svg>',
  ig: ico('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
  yt: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>',
};
const SOC = [['facebook', 'Facebook', I.fb], ['instagram', 'Instagram', I.ig], ['youtube', 'YouTube', I.yt]].filter(([k]) => club.socialne?.[k]);
const socLinks = (cls = 'soc') => `<ul class="${cls}">${SOC.map(([k, t, i]) => `<li><a href="${club.socialne[k]}" rel="noopener">${i}<span>${t}</span></a></li>`).join('')}</ul>`;

// ---- CSP a rozloženie ----------------------------------------------------------------------------
// GitHub Pages nedovolí hlavičky, preto <meta>: skripty len z webu, jediný inline skript HEAD_JS povolený hashom.
// .flt: zoznam zápasov s filtrom v adrese (?tim=, ?kde=) je neviditeľný, kým ho site.mjs nevyfiltruje (inak skáče, CLS až 0,3);
// pri zlyhaní site.mjs ho odkryje udalosť load
const HEAD_JS = `var d=document.documentElement;d.classList.add('js');if(/[?&](tim|kde)=/.test(location.search)){d.classList.add('flt');addEventListener('load',function(){d.classList.remove('flt')})}`;
const sha256 = (s) => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const CONNECT = ["'self'", ...(config.supabase?.url ? [new URL(config.supabase.url).origin] : [])];
const CSP = [
  "default-src 'none'", `script-src 'self' ${sha256(HEAD_JS)}`, "style-src 'self'", "img-src 'self' data:", "font-src 'self'",
  `connect-src ${CONNECT.join(' ')}`, "base-uri 'none'", "form-action 'none'", "object-src 'none'", "manifest-src 'self'",
].join('; ');

// menu: na počítači v riadku vpravo od erbu, na telefóne celoobrazovkový bordový panel (<dialog>) s veľkými odkazmi
const NAV = [['zapasy/', 'Zápasy'], ['tabulky/', 'Tabuľky'], ['timy/', 'Tímy'], ['mladez/', 'Mládež'], ['klub/', 'Klub'], ['stadion/', 'Štadión'], ['kontakt/', 'Kontakt']];
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${club.stadion.geo.join(',')}`;
const mapyUrl = `https://mapy.com/s/?q=${club.stadion.geo.join(',')}`;
const DESC = `${club.nazov} – futbal v Topoľčanoch od roku ${club.futbalOd}. Zápasy, výsledky, tabuľky a súpisky áčka aj ${teams.length - 1} mládežníckych tímov, nábor do mládeže a Štadión Vojtecha Schotterta.`;

function layout({ route, title, desc, body, active, bodyClass = '' }) {
  const depth = route.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const cur = (u) => (active && active === u ? ' aria-current="page"' : '');
  const fullTitle = (config.ukazka ? 'Návrh webu – ' : '') + (route ? `${title} | ${club.nazov}` : `${club.nazov} – ${title}`);
  const canon = config.siteUrl ? `${config.siteUrl}${route}` : '';
  const ld = route ? '' : `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'SportsClub', name: club.nazov, legalName: club.pravnyNazov, sport: 'Futbal', foundingDate: String(club.zalozenie),
    email: club.kontakt.email, telephone: club.kontakt.telefon.replace(/\s+/g, ''),
    address: { '@type': 'PostalAddress', streetAddress: club.adresa[0], postalCode: club.adresa[1].slice(0, 6), addressLocality: club.mesto, addressCountry: 'SK' },
    location: { '@type': 'StadiumOrArena', name: club.stadion.nazov, maximumAttendeeCapacity: club.stadion.kapacita, geo: { '@type': 'GeoCoordinates', latitude: club.stadion.geo[0], longitude: club.stadion.geo[1] } },
    sameAs: [club.facebook, club.sportnetUrl, club.staryWeb],
  }).replace(/</g, '\\u003c')}</script>`;
  const li = ([u, t], i) => `<li><a href="${R}${u}"${cur(u)}><span class="nav-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>${t}</a></li>`;
  return `<!doctype html>
<html lang="sk" data-root="${R}"${config.ukazka ? ' class="has-demo"' : ''}>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc || DESC)}">
${config.noindex ? '<meta name="robots" content="noindex">\n' : ''}${canon ? `<link rel="canonical" href="${canon}">\n` : ''}<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="sk_SK">
<meta name="theme-color" content="#5a1610">
<link rel="icon" type="image/png" href="${R}img/favicon.png">
<link rel="apple-touch-icon" href="${R}img/apple-touch-icon.png">
<link rel="preload" href="${R}fonts/bitter-800.woff" as="font" type="font/woff" crossorigin>
<link rel="preload" href="${R}fonts/hanken-grotesk-400.woff" as="font" type="font/woff" crossorigin>
${route || !foto.fotky.hero ? '' : `<link rel="preload" as="image" imagesrcset="${foto.fotky.hero.widths.map((x) => `${R}img/foto/hero-${x}.webp ${x}w`).join(', ')}" imagesizes="100vw" fetchpriority="high">`}
<link rel="stylesheet" href="${R}css/site.css">
<script>${HEAD_JS}</script>
<script type="module" src="${R}js/site.mjs"></script>
${ld}</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#obsah">Preskočiť na obsah</a>
${config.ukazka ? '<p class="demo">Návrh webu · nie je to oficiálna stránka klubu</p>' : ''}
<header class="hdr">
  <div class="wrap hdr-in">
    <a class="brand" href="${R}"${route ? '' : ' aria-current="page"'}><img src="${R}img/erb-128.webp" alt="" width="40" height="44"><span class="brand-t"><span class="brand-n">${esc(club.nazov)}</span><span class="brand-s">futbal od ${club.futbalOd}</span></span><span class="sr">, úvod</span></a>
    <nav class="nav" aria-label="Hlavné menu"><ul>${NAV.map(li).join('')}</ul></nav>
    <button class="menu-btn" type="button" aria-haspopup="dialog" aria-controls="menu">${I.menu}<span>Menu</span></button>
  </div>
</header>
<dialog class="menu" id="menu" aria-label="Menu">
  <div class="menu-top"><img src="${R}img/erb-128.webp" alt="" width="40" height="44" loading="lazy"><span class="menu-name">${esc(club.nazov)}</span><button class="menu-x" type="button" data-close>${I.close}<span>Zavrieť</span></button></div>
  <nav aria-label="Menu na telefóne"><ul class="menu-list"><li><a href="${R}"${route ? '' : ' aria-current="page"'}><span class="nav-n" aria-hidden="true">00</span>Úvod</a></li>${NAV.map(li).join('')}</ul></nav>
  <p class="menu-foot"><a href="${tel(club.kontakt.telefon)}">${I.phone}${esc(club.kontakt.telefon)}</a><a href="${club.facebook}" rel="noopener">${I.fb}Facebook</a></p>
</dialog>
<main id="obsah">
${body}
</main>
<footer class="ftr">
  <div class="wrap ftr-grid">
    <div class="ftr-club">
      <img src="${R}img/erb-240.webp" alt="" width="88" height="96" loading="lazy">
      <p class="ftr-name">${esc(club.nazov)}</p><p class="ftr-motto">My sme tu doma.</p>
    </div>
    <div><h2 class="ftr-h">Štadión</h2><p>${esc(club.stadion.nazov)}<br>${club.stadion.adresa.map(esc).join(', ')}</p><p><a href="${mapsUrl}" rel="noopener">Navigovať na štadión</a></p></div>
    <div><h2 class="ftr-h">Kontakt</h2><p>${esc(club.kontakt.osoba)}, ${esc(club.kontakt.funkcia)}<br><a href="${tel(club.kontakt.telefon)}">${esc(club.kontakt.telefon)}</a><br><a href="mailto:${club.kontakt.email}">${esc(club.kontakt.email)}</a></p><p>Mládež: <a href="mailto:${club.mladez.email}">${esc(club.mladez.email)}</a></p></div>
    <div><h2 class="ftr-h">Sledujte nás</h2><p><a href="${club.facebook}" rel="noopener">Facebook FC Topoľčany</a></p><p class="ftr-src">Výsledky zo Sportnetu (Futbalnet), aktualizované ${dFull(sn.updated.slice(0, 10))}. Fotky z webu klubu.</p></div>
  </div>
  <div class="ftr-bar"><div class="wrap ftr-bar-in"><span>© ${new Date().getFullYear()} ${esc(club.pravnyNazov)}</span><a href="${R}ochrana-sukromia/">Ochrana súkromia</a>${config.adminDemo ? `<a href="${R}admin/">Administrácia (ukážka)</a>` : ''}</div></div>
</footer>
</body>
</html>
`;
}

// ---- spoločné bloky ------------------------------------------------------------------------------
// hlavička podstránky: bordový pás so zlatou linkou (lem štítu) a jemnými pruhmi zo steny štadióna vpravo
const pageHead = ({ title, sub = '', crumbs = [], R, aside = '' }) => `<section class="phead"><div class="wrap phead-in">
  <div>${crumbs.length ? `<nav class="crumbs" aria-label="Omrvinky"><a href="${R}">Úvod</a>${crumbs.map(([u, t]) => u ? `<a href="${R}${u}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join('')}</nav>` : ''}
  <h1 class="h1">${esc(title)}</h1>${sub ? `<p class="phead-sub">${sub}</p>` : ''}</div>${aside}
</div></section>`;
const secHead = (h, id, moreLink = '') => `<div class="sec-head"><h2 class="h2" id="${id}">${h}</h2>${moreLink}</div>`;
const more = (href, t) => `<a class="more" href="${href}">${t}${I.arrow}</a>`;
const venueName = (v) => v.replace(/\s+/g, ' ').trim();

// zápasová doska: bordové pole štítu so zlatým lemom, erby na bielych kruhoch, výsledok pätkovými číslicami
function card(m, R, { big = false, label = '', self = false } = {}) {
  const ourName = m.teamObj.adult ? club.nazov : `${club.nazov} ${m.teamObj.short}`;
  const us = { name: ourName, space: SPACE }, them = { name: m.opponent, space: m.oppSpace };
  const [h, a] = m.home ? [us, them] : [them, us];
  const lbl = label || (m.score || m.past ? 'Posledný zápas' : 'Najbližší zápas');
  const side = (t, role) => `<div class="mp-side${t.space === SPACE ? ' is-us' : ''}"><span class="mp-crest">${logo(t.space, t.name, R, big ? 56 : 44, big)}</span><span class="mp-name">${esc(t.name)}</span><span class="mp-role">${role}</span></div>`;
  let mid, note = '';
  if (m.score) { mid = `<span class="sr">Výsledok </span>${esc(m.score).replace(':', '<span class="mp-colon">:</span>')}`; note = `<span class="mp-res mp-res--${m.res}">${RES[m.res]}</span>${m.half ? `<span>polčas ${esc(m.half)}</span>` : ''}`; }
  else if (m.past) { mid = '<span aria-hidden="true">–</span>'; note = `<span>${noScore(m)}</span>`; }
  else { mid = `<span class="mp-time"><span class="sr">Výkop o </span>${esc(m.time || '–')}</span>`; note = `<span class="cd" data-kickoff="${isoLocal(m.date, m.time)}" hidden></span>`; }
  const links = [];
  if (m.score && m.detail && !self) links.push(`<a class="mp-a" href="${R}${m.url}">Priebeh a zostavy${I.arrow}</a>`);
  if (!m.past) links.push(`<a class="mp-a" href="${R}kalendar/zapas-${m.id}.ics" download>${I.cal}Do kalendára</a>`);
  const meta = [esc(m.comp) + (m.roundName ? `, ${esc(m.roundName)}` : ''), m.venue ? esc(venueName(m.venue)) : '', m.audience ? plural(m.audience, 'divák', 'diváci', 'divákov') : ''].filter(Boolean);
  return `<article class="mp${big ? ' mp--big' : ''}">
  <p class="mp-top"><span class="mp-label">${esc(lbl)}</span><span>${esc(m.teamObj.full)}</span></p>
  <p class="mp-when"><time datetime="${m.date}">${dLong(m.date)}</time></p>
  <div class="mp-row">${side(h, 'domáci')}<p class="mp-score">${mid}</p>${side(a, 'hostia')}</div>
  <p class="mp-note">${note}</p>
  <p class="mp-meta">${meta.join('<span aria-hidden="true"> · </span>')}</p>
  ${links.length ? `<p class="mp-links">${links.join('')}</p>` : ''}
</article>`;
}

// zoznam zápasov: výsledky ako malé štíty so zlatým lemom (tvar erbu), program ako bordová tabuľa so zlatými linkami
function matchRow(m, R, { showTeam = true } = {}) {
  const href = m.detail || !m.past ? ` href="${R}${m.url}"` : '';
  const tag = href ? 'a' : 'div';
  const team = showTeam ? `<b class="mr-team">${esc(m.teamObj.short)}</b>` : '';
  const comp = esc(m.cup ? m.comp : m.roundName || m.comp);
  if (!m.past) {
    return `<li class="mrow" data-team="${m.team}" data-where="${m.home ? 'doma' : 'vonku'}"><${tag} class="fx"${href}>
  <span class="fx-d"><time datetime="${m.date}">${dShort(m.date)}</time><span>${dDay(m.date)}</span></span>
  <span class="fx-o">${logo(m.oppSpace, m.opponent, R, 28)}<span class="fx-n">${esc(m.opponent)}</span></span>
  <span class="fx-k">${team}${m.home ? 'doma' : 'vonku'}, ${comp}</span>
  <span class="fx-t"><span class="sr">výkop </span>${esc(m.time || '–')}</span>
</${tag}></li>`;
  }
  const res = m.res || 'n';
  return `<li class="mrow" data-team="${m.team}" data-where="${m.home ? 'doma' : 'vonku'}"><${tag} class="sh sh--${res}"${href}>
  <span class="sh-k"><time datetime="${m.date}">${dShort(m.date)}</time>${showTeam ? ` · ${esc(m.teamObj.short)}` : ''}</span>
  <span class="sh-s">${m.score ? `<span class="sr">${RES[m.res]}, </span>${esc(m.score)}` : '–'}</span>
  <span class="sh-o">${esc(m.opponent)}</span>
  <span class="sh-r">${m.score ? `<span aria-hidden="true">${RES[m.res]} · </span>` : 'bez zápisu · '}${m.home ? 'doma' : 'vonku'}</span>
</${tag}></li>`;
}
const matchList = (list, R, opts) => `<ol class="mlist ${list.length && list.every((m) => m.past) ? 'mlist--shields' : 'mlist--fix'}">${list.map((m) => matchRow(m, R, opts)).join('')}</ol>`;

function tableHtml(tb, R, { compact = false, caption = '' } = {}) {
  let rows = tb.rows;
  if (compact) { const i = rows.findIndex((r) => r.our); const from = Math.max(0, Math.min(i - 2, rows.length - 5)); rows = rows.slice(from, from + 5); }
  return `<div class="tbl-wrap"><table class="tbl">${caption ? `<caption>${caption}</caption>` : ''}
  <thead><tr><th scope="col"><abbr title="Poradie">#</abbr></th><th scope="col" class="tl">Tím</th><th scope="col"><abbr title="Zápasy">Z</abbr></th><th scope="col" class="hm"><abbr title="Výhry">V</abbr></th><th scope="col" class="hm"><abbr title="Remízy">R</abbr></th><th scope="col" class="hm"><abbr title="Prehry">P</abbr></th><th scope="col">Skóre</th><th scope="col"><abbr title="Body">B</abbr></th></tr></thead>
  <tbody>${rows.map((r) => `<tr${r.our ? ' class="our"' : ''}><td class="pos">${r.pos}</td><th scope="row" class="tl"><span class="tteam">${logo(r.space, r.name, R, 24)}<span>${esc(r.name)}</span></span></th><td>${r.played}</td><td class="hm">${r.won}</td><td class="hm">${r.draw}</td><td class="hm">${r.lost}</td><td class="nw">${r.gf}:${r.ga}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody>
</table></div>`;
}
const formHtml = (slug, n = 5) => {
  const last = teamMatches(slug).filter((m) => m.res).slice(-n);
  return last.length ? `<ol class="form" aria-label="Forma: ${last.length === 1 ? 'posledný zápas' : last.length <= 4 ? `posledné ${last.length} zápasy` : `posledných ${last.length} zápasov`}">${last.map((m) => `<li class="res-bg--${m.res}" title="${dShort(m.date)} ${esc(m.opponent)} ${m.score}"><span aria-hidden="true">${RES_S[m.res]}</span><span class="sr">${RES[m.res]} ${esc(m.opponent)} ${m.score}</span></li>`).join('')}</ol>` : '';
};

// kalendár zápasov (.ics): odber cez webcal/Google doplní site.mjs, inak stiahnutie
const calBox = (file, R, id) => `<details class="cal" data-cal id="${id}">
  <summary class="btn btn--line">${I.cal}<span>Zápasy do kalendára</span></summary>
  <div class="cal-pop">
    <a class="cal-o" data-webcal href="${R}kalendar/${file}" hidden><b>Odoberať v telefóne</b><span>iPhone, Mac, Outlook – rozpis sa sám aktualizuje</span></a>
    <a class="cal-o" data-gcal href="${R}kalendar/${file}" rel="noopener" hidden><b>Pridať do Google Kalendára</b><span>aj pre Android</span></a>
    <a class="cal-o" data-ics href="${R}kalendar/${file}" download><b>Stiahnuť súbor .ics</b><span>jednorazovo, bez aktualizácií</span></a>
  </div>
</details>`;

// výber zápasu na kartu: zápas v najbližších 7 dňoch, inak posledný odohraný (zimná prestávka), inak najbližší
function cardPick(slug) {
  const list = teamMatches(slug);
  const next = list.find((m) => !m.past);
  const last = [...list].reverse().find((m) => m.past && (m.score || !m.teamObj.adult));
  const soon = next && (dObj(next.date) - dObj(TODAY)) / 864e5 <= 7;
  return soon ? next : last || next;
}

// tímy podľa vekových skupín
const GROUPS = [['Muži', (t) => t.adult], ['Dorast', (t) => /dorast/i.test(t.sub)], ['Žiaci', (t) => /žiaci/i.test(t.sub)], ['Prípravka', (t) => /prípravka/i.test(t.sub)]];
function teamGrid(R, only = () => true) {
  return GROUPS.map(([g, f]) => [g, teams.filter((t) => f(t) && only(t))]).filter(([, l]) => l.length).map(([g, l]) => `<section class="tgroup" aria-label="${g}"><h3 class="tgroup-h">${g}</h3><ul class="tgrid">${l.map((t) => `<li class="tcard${t.adult ? ' tcard--adult' : ''}"><a href="${R}${t.url}">
  <span class="tcard-n">${esc(t.short)}</span>
  <span class="tcard-l">${esc(t.leagueName)}</span>
  ${t.pos ? `<span class="tcard-p"><b>${t.pos}.</b> ${zo(t.of)}</span>` : '<span class="tcard-p">bez tabuľky</span>'}
</a></li>`).join('')}</ul></section>`).join('');
}


// ---- stránky -----------------------------------------------------------------------------------
const pages = [];
const add = (route, opts) => pages.push({ route, ...opts });
const A = teams[0];
const crewRole = { coach: 'Tréner', assist_coach: 'Asistent trénera', coach_goalkeepers: 'Tréner brankárov', manager: 'Vedúci mužstva', doctor: 'Lekár', physiotherapist: 'Fyzioterapeut', masseur: 'Masér', club_representative: 'Zástupca klubu', other: 'Člen realizačného tímu' };
const POS = [['goalkeeper', 'Brankári'], ['defender', 'Obrancovia'], ['midfielder', 'Stredopoliari'], ['forward', 'Útočníci'], ['', 'Hráči']];

// stena štadióna: červeno-biele šikmé pruhy, erb a nápis „My sme tu doma“ (podľa maľby na štadióne)
function wall(R, { text = '', photo = true } = {}) {
  return `<section class="wall" aria-labelledby="wall-h"><div class="wrap wall-in">
  <div class="wall-card">
    <img class="wall-crest" src="${R}img/erb-240.webp" alt="" width="96" height="105" loading="lazy">
    <h2 class="wall-h" id="wall-h">My sme tu doma.</h2>
    <p>${text || `Nápis zo steny na ${esc(club.stadion.nazov.replace('Štadión', 'Štadióne'))}. V areáli je hlavné ihrisko s tribúnou, vedľajšia plocha a umelá tráva s novou tribúnou.`}</p>
    <p class="btns"><a class="btn btn--red" href="${R}stadion/">Štadión a cesta</a><a class="btn btn--line" href="${R}zapasy/?kde=doma">Zápasy doma</a></p>
  </div>
  ${photo ? `<figure class="wall-photo rim">${pic(R, 'stena', { sizes: '(min-width: 960px) 460px, 100vw' })}</figure>` : ''}
</div></section>`;
}

// vitrína: mládežnícke tituly ZsFZ ako zlaté plakety na bordovom podklade
function vitrina(R, full = false) {
  const t = club.vitrina.tituly;
  const seasons = [...new Set(t.map((x) => x.sezona))];
  return `<section class="vit" aria-labelledby="vit-h"><div class="wrap">
  <div class="vit-head">
    <div>
      <p class="eyebrow eyebrow--gold">Vitrína mládeže</p>
      <h2 class="h2" id="vit-h">${plural(t.length, 'titul', 'tituly', 'titulov')} za ${plural(seasons.length, 'sezónu', 'sezóny', 'sezón')}</h2>
      <p class="lead">Po vzniku v roku 2020 sa klub zameral na výchovu mládeže. Od sezóny ${seasons[0]} vyhrali mládežnícke tímy FC Topoľčany ${plural(t.length, 'súťaž', 'súťaže', 'súťaží')} Západoslovenského futbalového zväzu.</p>
    </div>
    <figure class="vit-photo rim">${pic(R, 'pohare', { sizes: '(min-width: 960px) 380px, 100vw' })}</figure>
  </div>
  ${seasons.map((s) => `<div class="vit-season"><h3 class="vit-s">${esc(s)}</h3><ul class="plaques">${t.filter((x) => x.sezona === s).map((x) => `<li class="plaque">
    <span class="plaque-ico">${I.trophy}</span>
    <span class="plaque-c">${esc(x.sutaz)}</span>
    <span class="plaque-t">${esc(x.tim)}${x.skore ? ` · skóre <b>${esc(x.skore)}</b>` : ''}</span>
    <span class="plaque-m">Tréner: ${esc(x.trener)}</span>
    ${x.pozn && full ? `<span class="plaque-n">${esc(x.pozn)}</span>` : ''}
  </li>`).join('')}</ul></div>`).join('')}
  <p class="src src--inv">Zdroj: články na webe klubu (sezóny 2021/22 až 2023/24).${full ? '' : ` <a href="${R}mladez/">Mládež a nábor</a>`}</p>
</div></section>`;
}

// tabuľa partnerov (logá z webu klubu prepísané do textu, bez načítania cudzích obrázkov)
const partnersBoard = () => `<section class="sec partners" aria-labelledby="partneri-h"><div class="wrap">
  ${secHead('Partneri klubu', 'partneri-h')}
  <ul class="pboard">${club.partneri.zoznam.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  <p class="src">Zoznam podľa webu klubu. ${esc(club.nsk)}</p>
</div></section>`;

// nábor do mládeže
function joinBox(R, full = false) {
  return `<div class="join">
  <p class="eyebrow">Nábor</p>
  <h3 class="h3">Chce vaše dieťa hrať futbal?</h3>
  <p>Predprípravka je pre deti od 4 do 6 rokov. ${full ? 'Začínate s futbalom alebo sa chcete posunúť ďalej? ' : ''}Zavolajte alebo napíšte a dohodnite si tréning či skúšku.</p>
  <p class="btns"><a class="btn btn--red" href="${tel(club.mladez.telefon)}">${I.phone}${esc(club.mladez.telefon)}</a><a class="btn btn--line" href="mailto:${club.mladez.email}">${I.mail}${esc(club.mladez.email)}</a></p>
</div>`;
}

// úvod
add('', {
  title: `futbal v Topoľčanoch od roku ${club.futbalOd}`, active: '', bodyClass: 'home',
  body: (R) => {
    const tabs = teams.map((t) => ({ t, m: cardPick(t.slug) })).filter((x) => x.m);
    const nextAll = upcoming.slice(0, 6);
    const lastAll = results.filter((m) => m.score).slice(0, 6);
    const lg = record(A.slug, (m) => !m.cup);
    const top = scorers(A.slug);
    const winterNext = upcoming[0];
    const aNext = upcoming.find((m) => m.team === A.slug);
    const winterText = !winterNext ? '' : aNext && aNext.date === winterNext.date
      ? `Jar sa začína ${dWhen(winterNext.date)}, áčko v ten deň hrá ${aNext.home ? 'doma proti' : 'vonku na ihrisku'} ${esc(aNext.opponent)}.`
      : `Mládež začína jar ${dWhen(winterNext.date)}${aNext ? `, áčko ${dWhen(aNext.date)} ${aNext.home ? 'doma proti' : 'vonku na ihrisku'} ${esc(aNext.opponent)}` : ''}.`;
    const first = teams.filter((t) => /^I\. liga/.test(t.leagueName));
    return `<section class="hero" aria-labelledby="hero-h">
  <div class="hero-bg">${pic(R, 'hero', { sizes: '100vw', eager: true, alt: '' })}</div>
  <div class="wrap hero-in">
    <div class="hero-copy">
      <p class="eyebrow eyebrow--gold">Topoľčany · futbal od roku ${club.futbalOd}</p>
      <h1 class="hero-h" id="hero-h">My sme tu doma.</h1>
      <p class="hero-p">FC Topoľčany vznikol v roku ${club.zalozenie}, aby nadviazal na storočnú históriu futbalu v meste. Áčko hrá ${esc(acc(A.leagueName))}, ${first.length ? `žiaci ${first.map((t) => t.short.split(' ')[0]).filter((v, i, a) => a.indexOf(v) === i).join(', ')} hrajú I. ligu proti Slovanu, Trnave či DAC` : 'mládež hrá krajské súťaže'}.</p>
      <p class="hero-cta"><a class="btn btn--red" href="${R}zapasy/">Program a výsledky</a><a class="btn btn--ghost" href="${R}mladez/">Prihlásiť dieťa</a></p>
    </div>
  </div>
</section>
<section class="board" aria-label="Zápasy tímov"><div class="wrap board-in">
  <div class="tabs" role="tablist" aria-label="Zápas podľa tímu">${tabs.map(({ t }, i) => `<button type="button" role="tab" id="tab-${t.slug}" aria-controls="tp-${t.slug}" aria-selected="${i ? 'false' : 'true'}"${i ? ' tabindex="-1"' : ''}>${esc(t.short)}</button>`).join('')}</div>
  ${tabs.map(({ t, m }, i) => `<div class="tabp" role="tabpanel" id="tp-${t.slug}" aria-labelledby="tab-${t.slug}" tabindex="0"${i ? ' hidden' : ''}>${card(m, R, { big: true })}</div>`).join('\n  ')}
</div></section>
${winterText && (dObj(winterNext.date) - dObj(TODAY)) / 864e5 > 14 ? `<section class="pause"><div class="wrap"><p><b>Zimná prestávka.</b> ${winterText}</p></div></section>` : ''}
<section class="sec" aria-labelledby="prog-h"><div class="wrap">
  ${secHead('Program a výsledky', 'prog-h', more(`${R}zapasy/`, 'Všetky zápasy'))}
  <div class="cols2">
    <div><h3 class="h3">Najbližšie</h3>${matchList(nextAll, R)}</div>
    <div><h3 class="h3">Posledné výsledky</h3>${matchList(lastAll, R)}</div>
  </div>
</div></section>
${A.table ? `<section class="sec sec--mist" aria-labelledby="liga-h"><div class="wrap">
  ${secHead(`Áčko, ${esc(A.leagueName)}`, 'liga-h', more(`${R}tabulky/#${A.slug}`, 'Celá tabuľka'))}
  <div class="liga">
    <div>${tableHtml(A.table, R, { compact: true, caption: `<span class="sr">Výrez tabuľky okolo FC Topoľčany</span>` })}</div>
    <div class="liga-side">
      <p class="big-pos"><span class="bp-n">${A.pos}.</span><span class="bp-l">miesto ${zo(A.of)} po ${lg.n} ${lg.n === 1 ? 'zápase' : 'zápasoch'}, ${plural(lg.w, 'výhra', 'výhry', 'výhier')}, ${plural(lg.d, 'remíza', 'remízy', 'remíz')}, ${plural(lg.l, 'prehra', 'prehry', 'prehier')}, skóre ${lg.gf}:${lg.ga}</span></p>
      <div class="liga-row"><h3 class="h4">Forma</h3>${formHtml(A.slug)}</div>
      ${top.length ? `<div class="liga-row liga-row--list"><h3 class="h4">Strelci áčka</h3><ol class="scorers">${top.slice(0, 4).map(([n, g]) => `<li><span>${esc(n)}</span><b>${g}</b></li>`).join('')}</ol></div>` : ''}
    </div>
  </div>
</div></section>` : ''}
${vitrina(R)}
<section class="sec" aria-labelledby="timy-h"><div class="wrap">
  ${secHead(`${teams.length} tímov, jeden klub`, 'timy-h', more(`${R}timy/`, 'Súpisky a zápasy'))}
  <div class="teams-intro">
    <p class="lead">Podľa klubu v ňom hrá ${esc(club.mladeznikov)} mládežníkov z Topoľčian a okolia. ${first.length ? `${plural(first.length, 'žiacky tím hrá', 'žiacke tímy hrajú', 'žiackych tímov hrá')} I. ligu v skupine Západ, ` : ''}prípravky sa stretávajú s akadémiami Trnavy či Trenčína.</p>
    ${joinBox(R)}
  </div>
  ${teamGrid(R)}
</div></section>
${wall(R)}
<section class="sec" aria-labelledby="hist-h"><div class="wrap story">
  <figure class="story-photo rim">${pic(R, 'majstri', { sizes: '(min-width: 960px) 520px, 100vw' })}</figure>
  <div>
    <p class="eyebrow">Od roku ${club.futbalOd}</p>
    <h2 class="h2" id="hist-h">Nový klub so storočnou históriou</h2>
    <p>Topoľčiansky futbal má za sebou viac ako sto rokov. Po rokoch problémov predošlých klubov vznikol v roku ${club.zalozenie} FC Topoľčany s cieľom byť ekonomicky stabilný, transparentný a férový voči partnerom a stavať na vlastnej mládeži.</p>
    <ol class="years">${club.historia.filter((h) => ['1912', '2018', '2021/22', '2023/24'].includes(h.rok)).map((h) => `<li><b>${esc(h.rok)}</b><span>${esc(h.text.split('. ')[0].replace(/\.$/, ''))}.</span></li>`).join('')}</ol>
    ${more(`${R}klub/`, 'História a klub')}
  </div>
</div></section>
${partnersBoard()}`;
  },
});

// zápasy
add('zapasy/', {
  title: 'Zápasy a výsledky', active: 'zapasy/', desc: `Program a výsledky všetkých tímov ${club.nazov} v sezóne ${SEASON}.`,
  body: (R) => {
    const grp = (list) => {
      const months = new Map();
      for (const m of list) { const k = monthKey(m.date); if (!months.has(k)) months.set(k, []); months.get(k).push(m); }
      return [...months].map(([k, l]) => `<section class="month" data-month><h3 class="month-h">${monthName(k)}</h3>${matchList(l, R)}</section>`).join('');
    };
    return `${pageHead({ title: 'Zápasy a výsledky', sub: `Sezóna ${SEASON}, všetky tímy. Výsledky, góly a karty preberáme zo Sportnetu.`, R, crumbs: [[null, 'Zápasy']] })}
<section class="sec sec--first"><div class="wrap">
  <div class="filters" data-filters>
    <div class="chips" role="group" aria-label="Tím"><button type="button" class="chip" data-f-team="" aria-pressed="true">Všetky</button>${teams.map((t) => `<button type="button" class="chip" data-f-team="${t.slug}" aria-pressed="false">${esc(t.short)}</button>`).join('')}</div>
    <div class="chips" role="group" aria-label="Miesto"><button type="button" class="chip" data-f-where="" aria-pressed="true">Doma aj vonku</button><button type="button" class="chip" data-f-where="doma" aria-pressed="false">Doma</button><button type="button" class="chip" data-f-where="vonku" aria-pressed="false">Vonku</button></div>
  </div>
  <div class="cols2 cols2--list">
    <section aria-labelledby="z-prog"><h2 class="h2" id="z-prog">Program</h2>${upcoming.length ? grp(upcoming) : '<p>Ďalšie zápasy zatiaľ nie sú vyžrebované.</p>'}<p class="empty" data-empty hidden>Pre tento výber nie je naplánovaný žiadny zápas.</p></section>
    <section aria-labelledby="z-vys"><h2 class="h2" id="z-vys">Výsledky</h2>${grp(results)}<p class="empty" data-empty hidden>Pre tento výber zatiaľ nie je žiadny výsledok.</p></section>
  </div>
  <div class="cal-row">${calBox('vsetky.ics', R, 'cal-vsetky')}</div>
</div></section>`;
  },
});

// detail zápasu
function lineupHtml(l, title) {
  if (!l || (!l.start.length && !l.subs.length)) return '';
  const li = (p) => `<li><span class="ln-nr">${esc(p.nr)}</span><span>${esc(p.name)}${p.c ? ' <abbr class="cap" title="kapitán">C</abbr>' : ''}</span></li>`;
  return `<div class="lineup"><h3 class="h4">${esc(title)}</h3><ol class="ln">${l.start.map(li).join('')}</ol>${l.subs.length ? `<p class="ln-h">Náhradníci</p><ol class="ln ln--subs">${l.subs.map(li).join('')}</ol>` : ''}${l.coach ? `<p class="ln-coach">Tréner: ${esc(l.coach)}</p>` : ''}</div>`;
}
for (const m of matches) {
  if (m.past && !m.detail) continue;
  const name = m.home ? `${club.nazov} – ${m.opponent}` : `${m.opponent} – ${club.nazov}`;
  add(m.url, {
    title: `${name}${m.score ? ` ${m.score}` : ''}`, active: 'zapasy/',
    desc: `${m.teamObj.full}, ${m.comp}, ${dLong(m.date)}.`,
    body: (R) => {
      const ev = [...(m.goals || []).map((g) => ({ ...g, t: 'goal' })), ...(m.cards || []).map((c) => ({ ...c, t: 'card' })), ...((m.lineups?.subs) || []).map((s) => ({ ...s, t: 'sub' }))]
        .sort((a, b) => (parseInt(a.min, 10) || 0) - (parseInt(b.min, 10) || 0));
      const evIcon = (e) => e.t === 'goal' ? `<span class="ev-i ev-goal" aria-hidden="true">${I.ball}</span>` : e.t === 'card' ? `<span class="ev-i ev-card ev-card--${e.kind}" aria-hidden="true"></span>` : '<span class="ev-i ev-sub" aria-hidden="true">⇄</span>';
      const evText = (e) => e.t === 'goal' ? `Gól: ${esc(e.player)}${e.kind === 'penalty' ? ' (z penalty)' : e.kind === 'own' ? ' (vlastný)' : ''}` : e.t === 'card' ? `${e.kind === 'yellow' ? 'Žltá karta' : e.kind === 'red' ? 'Červená karta' : 'Druhá žltá a červená'}: ${esc(e.player)}` : `Striedanie: ${esc(e.in)} za ${esc(e.out)}`;
      const evSide = (e) => ((e.side === 'our') === m.home ? 'h' : 'a');
      const evTeam = (e) => (e.side === 'our' ? club.nazov : m.opponent);
      const prevMeet = matches.filter((x) => x.oppSpace === m.oppSpace && x.id !== m.id && x.team === m.team && x.score);
      const snUrl = sn.matches.find((x) => x.id === m.id)?.url;
      return `${pageHead({ title: name, sub: `${esc(m.teamObj.full)}, ${esc(m.comp)}${m.roundName ? `, ${esc(m.roundName)}` : ''}`, R, crumbs: [['zapasy/', 'Zápasy'], [null, dShort(m.date) + ' ' + m.opponent]] })}
<section class="sec sec--first"><div class="wrap match">
  <div class="match-card">${card(m, R, { big: true, self: true, label: m.score ? 'Konečný výsledok' : 'Zápas' })}</div>
  <div class="match-info">
    ${ev.length ? `<h2 class="h3">Priebeh zápasu</h2><ol class="evs">${ev.map((e) => `<li class="ev ev--${evSide(e)}"><span class="ev-min">${esc(e.min)}′</span>${evIcon(e)}<span>${evText(e)}<small>${esc(evTeam(e))}</small></span></li>`).join('')}</ol>` : m.score ? '<p>Zápis o stretnutí neobsahuje góly ani karty.</p>' : ''}
    <dl class="facts">
      <div><dt>Dátum</dt><dd>${dLong(m.date)}${m.time ? `, ${esc(m.time)}` : ''}</dd></div>
      ${m.venue ? `<div><dt>Ihrisko</dt><dd>${esc(venueName(m.venue))}</dd></div>` : ''}
      ${m.audience ? `<div><dt>Diváci</dt><dd>${num(m.audience)}</dd></div>` : ''}
      ${m.referee ? `<div><dt>Rozhodca</dt><dd>${esc(m.referee)}</dd></div>` : ''}
    </dl>
    <p class="btns">${m.score && snUrl ? `<a class="btn btn--line" href="${snUrl}" rel="noopener">${I.ext}Zápis na Sportnete</a>` : ''}${!m.past ? `<a class="btn btn--red" href="${R}kalendar/zapas-${m.id}.ics" download>${I.cal}Pridať do kalendára</a>${m.home ? `<a class="btn btn--line" href="${mapsUrl}" rel="noopener">${I.route}Navigovať na štadión</a>` : ''}` : ''}</p>
  </div>
  ${m.lineups ? `<div class="lineups"><h2 class="h3 lineups-h">Zostavy</h2>${lineupHtml(m.home ? m.lineups.our : m.lineups.opp, m.home ? club.nazov : m.opponent)}${lineupHtml(m.home ? m.lineups.opp : m.lineups.our, m.home ? m.opponent : club.nazov)}</div>` : ''}
  ${prevMeet.length ? `<div class="meet"><h2 class="h3">Ďalšie zápasy s týmto súperom v sezóne</h2>${matchList(prevMeet, R, { showTeam: false })}</div>` : ''}
</div></section>`;
    },
  });
}

// tabuľky
add('tabulky/', {
  title: 'Tabuľky', active: 'tabulky/', desc: `Tabuľky súťaží, v ktorých hrajú tímy ${club.nazov} v sezóne ${SEASON}.`,
  body: (R) => `${pageHead({ title: 'Tabuľky', sub: `Sezóna ${SEASON}. Poradie podľa Sportnetu, náš tím je zvýraznený.`, R, crumbs: [[null, 'Tabuľky']] })}
<section class="sec sec--first"><div class="wrap">
  <nav class="toc" aria-label="Tabuľky tímov">${teams.filter((t) => t.table).map((t) => `<a href="#${t.slug}">${esc(t.short)}</a>`).join('')}</nav>
  ${teams.filter((t) => t.table).map((t) => `<section class="tsec" id="${t.slug}" aria-labelledby="h-${t.slug}">
    <div class="sec-head"><h2 class="h2" id="h-${t.slug}">${esc(t.full)}</h2>${more(`${R}${t.url}`, 'Stránka tímu')}</div>
    <p class="tsec-l">${esc(t.leagueName)}</p>
    ${tableHtml(t.table, R)}
  </section>`).join('')}
  ${teams.some((t) => !t.table) ? `<p class="note">${teams.filter((t) => !t.table).map((t) => esc(t.short)).join(', ')}: prípravky hrajú bez tabuľky.</p>` : ''}
</div></section>`,
});

// tímy
add('timy/', {
  title: 'Tímy', active: 'timy/', desc: `Všetky tímy ${club.nazov}: muži, dorast, žiaci a prípravka v sezóne ${SEASON}.`,
  body: (R) => `${pageHead({ title: 'Tímy', sub: `${teams.length} tímov v sezóne ${SEASON}, od prípravky U9 po A-mužstvo.`, R, crumbs: [[null, 'Tímy']] })}
<section class="sec sec--first"><div class="wrap">${teamGrid(R)}
</div></section>`,
});

for (const t of teams) {
  add(t.url, {
    title: t.full, active: 'timy/', desc: `${club.nazov} – ${t.full}: ${t.leagueName}, zápasy, tabuľka a súpiska v sezóne ${SEASON}.`,
    body: (R) => {
      const list = teamMatches(t.slug);
      const nx = list.filter((m) => !m.past), rs = list.filter((m) => m.past).reverse();
      const pick = cardPick(t.slug);
      const rec = record(t.slug);
      const sc = scorers(t.slug);
      const groups = POS.map(([k, h]) => [h, t.squad.athletes.filter((a) => (k ? a.pos === k : !POS.some(([x]) => x && x === a.pos)))]).filter(([, l]) => l.length);
      const nrCount = new Map(); for (const a of t.squad.athletes) nrCount.set(a.nr, (nrCount.get(a.nr) || 0) + 1);
      const nr = (a) => (a.nr !== '' && nrCount.get(a.nr) === 1 ? a.nr : '');
      return `${pageHead({ title: t.full, sub: `${esc(t.leagueName)}${t.pos ? `, <b>${t.pos}. miesto</b> ${zo(t.of)}` : ''}`, R, crumbs: [['timy/', 'Tímy'], [null, t.short]] })}
${t.adult && foto.fotky.muzstvo ? `<figure class="team-photo"><div class="rim">${pic(R, 'muzstvo', { sizes: '(min-width: 1240px) 1180px, 100vw' })}</div><figcaption>Mužstvo FC Topoľčany na domácom štadióne. ${FOTO_SRC}</figcaption></figure>` : ''}
<section class="sec sec--first"><div class="wrap team-top">
  ${pick ? `<div>${card(pick, R, { big: true })}</div>` : ''}
  <div class="team-side">
    ${rec.n ? `<p class="stat"><span class="stat-n">${rec.w}–${rec.d}–${rec.l}</span><span class="stat-l">výhry, remízy a prehry vo všetkých súťažiach, skóre ${rec.gf}:${rec.ga}</span></p><div class="liga-row"><h2 class="h4">Forma</h2>${formHtml(t.slug)}</div>` : '<p>Výsledky prípraviek sa nezapisujú, rozpis zápasov je nižšie.</p>'}
    ${sc.length && t.adult ? `<div class="liga-row liga-row--list"><h2 class="h4">Strelci v sezóne</h2><ol class="scorers">${sc.slice(0, 5).map(([n, g]) => `<li><span>${esc(n)}</span><b>${g}</b></li>`).join('')}</ol></div>` : ''}
    ${calBox(`${t.slug}.ics`, R, `cal-${t.slug}`)}
  </div>
</div></section>
<section class="sec" aria-labelledby="tz-h"><div class="wrap">
  ${secHead('Zápasy', 'tz-h')}
  <div class="cols2">
    <div><h3 class="h3">Program</h3>${nx.length ? matchList(nx, R, { showTeam: false }) : '<p>Ďalšie zápasy zatiaľ nie sú vyžrebované.</p>'}</div>
    <div><h3 class="h3">Výsledky</h3>${rs.length ? matchList(rs, R, { showTeam: false }) : '<p>Tím v tejto sezóne ešte nehral.</p>'}</div>
  </div>
</div></section>
${t.table ? `<section class="sec sec--mist" aria-labelledby="tt-h"><div class="wrap">${secHead('Tabuľka', 'tt-h')}<p class="tsec-l">${esc(t.leagueName)}</p>${tableHtml(t.table, R)}</div></section>` : ''}
${t.squad.athletes.length || t.squad.crew.length ? `<section class="sec" aria-labelledby="ts-h"><div class="wrap">
  ${secHead('Súpiska', 'ts-h')}
  <p class="note">Hráči, ktorí v kalendárnom roku ${sn.updated.slice(0, 4)} nastúpili alebo boli v nominácii na zápas (podľa Sportnetu).${t.adult ? '' : ' Pri mládeži uvádzame len mená.'}</p>
  ${groups.map(([h, l]) => `<h3 class="h4 sq-h">${h}</h3><ul class="squad">${l.sort((a, b) => a.name.split(' ').at(-1).localeCompare(b.name.split(' ').at(-1), 'sk')).map((a) => `<li class="pl"><span class="pl-nr" aria-hidden="true">${esc(nr(a)) || '<span class="pl-dot"></span>'}</span><span class="pl-name">${esc(a.name)}${a.captain && t.adult ? ' <abbr class="cap" title="kapitán">C</abbr>' : ''}</span>${nr(a) ? `<span class="sr">, číslo ${nr(a)}</span>` : ''}</li>`).join('')}</ul>`).join('')}
  ${t.squad.crew.length ? `<h3 class="h4 sq-h">Realizačný tím</h3><ul class="crew">${t.squad.crew.map((c) => `<li><span class="crew-r">${esc(crewRole[c.role] || crewRole.other)}</span><span>${esc(c.name)}</span></li>`).join('')}</ul>` : ''}
</div></section>` : ''}`;
    },
  });
}

// mládež a nábor
add('mladez/', {
  title: 'Mládež a nábor', active: 'mladez/', desc: `Mládež FC Topoľčany: predprípravka od 4 rokov, prípravka, žiaci a dorast, nábor, členské príspevky a mládežnícke tituly.`,
  body: (R) => {
    const youth = teams.filter((t) => !t.adult);
    const first = youth.filter((t) => /^I\. liga/.test(t.leagueName));
    return `${pageHead({ title: 'Mládež a nábor', sub: `${plural(youth.length, 'mládežnícky tím', 'mládežnícke tímy', 'mládežníckych tímov')} v sezóne ${SEASON}, podľa klubu ${esc(club.mladeznikov)} detí a mladých hráčov.`, R, crumbs: [[null, 'Mládež']] })}
<section class="sec sec--first"><div class="wrap youth-top">
  <figure class="youth-photo rim">${pic(R, 'deti', { sizes: '(min-width: 960px) 560px, 100vw', eager: true })}</figure>
  <div>
    <p class="lead">Cieľom klubu je rozvíjať v deťoch lásku k športu a vychovávať hráčov, ktorí si vzťah k pohybu ponesú celý život. ${first.length ? `${first.map((t) => esc(t.short)).join(', ')} hrajú I. ligu žiakov v skupine Západ so Slovanom Bratislava, Spartakom Trnava, DAC či AS Trenčín.` : ''}</p>
    ${joinBox(R, true)}
  </div>
</div></section>
<section class="sec sec--mist" aria-labelledby="kat-h"><div class="wrap">
  ${secHead('Kategórie', 'kat-h')}
  <ol class="steps">${club.kategorie.map((k, i) => `<li class="step"><span class="step-n" aria-hidden="true">${i + 1}</span><h3 class="h3">${esc(k.nazov)}</h3><p class="step-v">${esc(k.vek)}</p><p>${esc(k.text)}</p></li>`).join('')}</ol>
  <p class="src">Texty podľa webu klubu, skrátené.</p>
</div></section>
<section class="sec" aria-labelledby="clen-h"><div class="wrap fees">
  <div>
    ${secHead('Členské príspevky', 'clen-h')}
    <p>Príspevky pomáhajú zabezpečiť tréningový proces a chod klubu a vyžaduje ich aj licenčný systém SFZ.</p>
    <table class="tbl tbl--fees"><caption class="sr">Mesačný členský príspevok podľa kategórie</caption><thead><tr><th scope="col" class="tl">Kategória</th><th scope="col">Mesačne</th></tr></thead>
    <tbody>${club.clenske.mesacne.map(([k, v]) => `<tr><th scope="row" class="tl">${esc(k)}</th><td><b>${v} €</b></td></tr>`).join('')}</tbody></table>
    <p class="note">${esc(club.clenske.pozn)} Výška podľa webu klubu, aktuálnu sumu potvrdí klub pri zápise.</p>
  </div>
  <figure class="fees-photo rim">${pic(R, 'trening', { sizes: '(min-width: 960px) 480px, 100vw' })}</figure>
</div></section>
<section class="sec" aria-labelledby="ymt-h"><div class="wrap">
  ${secHead('Mládežnícke tímy', 'ymt-h', more(`${R}tabulky/`, 'Tabuľky'))}
  ${teamGrid(R, (t) => !t.adult)}
</div></section>
${vitrina(R, true)}
<section class="sec" aria-labelledby="g2-h"><div class="wrap">
  ${secHead('Podpora mládeže', 'g2-h')}
  <div class="cols2">
    <div class="offer"><h3 class="h3">Darujte 2 % z dane</h3><p>Klub každý rok žiada fanúšikov a rodičov o 2 % z dane na rozvoj mládeže, vybavenie a lepšie podmienky na tréning. Tlačivo je na webe klubu.</p><p class="btns"><a class="btn btn--line" href="${club.dvePercenta}" rel="noopener">${I.ext}Vyhlásenie 2 %</a></p></div>
    <div class="offer"><h3 class="h3">Nitriansky kraj</h3><p>${esc(club.nsk)}</p></div>
  </div>
</div></section>`;
  },
});

// klub a história
add('klub/', {
  title: 'Klub a história', active: 'klub/', desc: `${club.nazov}: futbal v Topoľčanoch od roku ${club.futbalOd}, klub od roku ${club.zalozenie}, osobnosti, fan zóna, partneri a fotky.`,
  body: (R) => `${pageHead({ title: 'Klub a história', sub: `${esc(club.pravnyNazov)}, prezývka ${esc(club.prezyvka)}. Športový riaditeľ ${esc(club.kontakt.osoba)}.`, R, crumbs: [[null, 'Klub']] })}
<section class="sec sec--first"><div class="wrap klub-grid">
  <div class="prose">
    <h2 class="h2">Od NLTE po FC</h2>
    <ol class="timeline">${club.historia.map((h) => `<li><span class="tl-y">${esc(h.rok)}</span><p>${esc(h.text)}</p><small>${esc(h.zdroj)}</small></li>`).join('')}<li class="tl-now"><span class="tl-y">${SEASON}</span><p>Áčko hrá ${esc(acc(A.leagueName))}${A.pos ? ` a po jeseni je na ${A.pos}. mieste` : ''}. V klube hrá ${plural(teams.length, 'tím', 'tímy', 'tímov')} od prípravky U9 po mužov.</p><small>Sportnet</small></li></ol>
  </div>
  <aside class="klub-aside">
    <img src="${R}img/erb-480.webp" alt="Erb FC Topoľčany: zlatý štít s nápisom Topoľčany, v červenom poli biely monogram TFC a lopta" width="200" height="219" loading="lazy">
    <h2 class="h4">Osobnosti topoľčianskeho futbalu</h2>
    <ul class="people">${club.osobnosti.zoznam.map((o) => `<li><b>${esc(o.meno)}</b>${o.text ? `<span>${esc(o.text)}</span>` : ''}</li>`).join('')}</ul>
    <p class="src">Zoznam slávnych hráčov podľa Wikipédie (heslo MFK Topvar Topoľčany).</p>
  </aside>
</div></section>
${vitrina(R)}
<section class="sec" aria-labelledby="gal-h" id="fotky"><div class="wrap">
  ${secHead('Fotky zo zápasov', 'gal-h')}
  ${gallery(R)}
  <p class="src">${FOTO_SRC}.</p>
</div></section>
<section class="sec sec--mist" aria-labelledby="fan-h" id="fan-zona"><div class="wrap fan">
  <div>
    ${secHead('Fan zóna', 'fan-h')}
    <p class="lead">Klubové predmety pre fanúšikov:</p>
    <ul class="fan-list">${club.fanzona.predmety.map((p) => `<li>${I.shirt}<span>${esc(p)}</span></li>`).join('')}</ul>
    <p>Objednať sa dajú e-mailom alebo telefonicky.</p>
    <p class="btns"><a class="btn btn--red" href="mailto:${club.fanzona.email}">${I.mail}${esc(club.fanzona.email)}</a><a class="btn btn--line" href="${tel(club.fanzona.telefon)}">${I.phone}${esc(club.fanzona.telefon)}</a></p>
  </div>
  <figure class="fan-photo rim">${pic(R, 'g11', { sizes: '(min-width: 960px) 460px, 100vw' })}</figure>
</div></section>
${partnersBoard()}`,
});

// štadión
add('stadion/', {
  title: 'Štadión Vojtecha Schotterta', active: 'stadion/', desc: `${club.stadion.nazov}, ${club.stadion.adresa.join(', ')}: kapacita ${num(club.stadion.kapacita)} divákov, ihrisko ${club.stadion.rozmery}, umelá tráva a vedľajšia plocha.`,
  body: (R) => {
    const home = upcoming.filter((m) => m.home).slice(0, 6);
    const s = club.stadion;
    return `${pageHead({ title: s.nazov, sub: `${s.adresa.map(esc).join(', ')}. Domov FC Topoľčany.`, R, crumbs: [[null, 'Štadión']] })}
<figure class="stad-photo"><div class="rim">${pic(R, 'stadion', { sizes: '100vw', eager: true })}</div></figure>
<section class="sec sec--first"><div class="wrap stad">
  <dl class="facts facts--big">
    <div><dt>Kapacita</dt><dd>${num(s.kapacita)} divákov</dd></div>
    <div><dt>Na sedenie</dt><dd>${num(s.sedadla)} miest, z toho ${s.vip} VIP</dd></div>
    <div><dt>Hracia plocha</dt><dd>${esc(s.rozmery)}</dd></div>
    <div><dt>Adresa</dt><dd>${s.adresa.map(esc).join(', ')}</dd></div>
  </dl>
  <p class="btns"><a class="btn btn--red" href="${mapsUrl}" rel="noopener">${I.route}Navigovať (Google Mapy)</a><a class="btn btn--line" href="${mapyUrl}" rel="noopener">${I.pin}Mapy.com</a></p>
  <ul class="pitches">${s.plochy.map((p, i) => `<li class="pitch"><span class="pitch-n" aria-hidden="true">${i + 1}</span><h2 class="h3">${esc(p.nazov)}</h2><p>${esc(p.text)}</p></li>`).join('')}</ul>
  <p class="src">Kapacita, rozmery a poloha: Sportnet. Plochy: zmluva o využívaní štadióna (Centrálny register zmlúv), nová tribúna: web klubu. Štadión patrí mestu, prevádzkujú ho ${esc(s.spravca.replace(/.$/, ''))}.</p>
  ${home.length ? `<h2 class="h3">Najbližšie zápasy doma</h2>${matchList(home, R)}` : ''}
</div></section>
${wall(R, { text: 'Červeno-biele pruhy, erb a tri slová. Maľba na štadióne hovorí za fanúšikov aj hráčov – tu je domov topoľčianskeho futbalu.' })}`;
  },
});

// kontakt
add('kontakt/', {
  title: 'Kontakt', active: 'kontakt/', desc: `Kontakt na ${club.nazov}: ${club.kontakt.osoba}, ${club.kontakt.funkcia}, nábor do mládeže, fan zóna a štadión.`,
  body: (R) => `${pageHead({ title: 'Kontakt', sub: 'Zápasy, nábor do mládeže, fan zóna a spolupráca.', R, crumbs: [[null, 'Kontakt']] })}
<section class="sec sec--first"><div class="wrap contact">
  <div class="ccard">
    <h2 class="h4">${esc(club.kontakt.funkcia[0].toUpperCase() + club.kontakt.funkcia.slice(1))}</h2>
    <p class="ccard-n">${esc(club.kontakt.osoba)}</p>
    <p class="btns"><a class="btn btn--gold" href="${tel(club.kontakt.telefon)}">${I.phone}${esc(club.kontakt.telefon)}</a><a class="btn btn--ghost" href="mailto:${club.kontakt.email}">${I.mail}<span>${esc(club.kontakt.email).replace('@', '<wbr>@')}</span></a></p>
  </div>
  <div class="ccard ccard--light">
    <h2 class="h4">Nábor do mládeže</h2>
    <p class="ccard-n">Tréning alebo skúška</p>
    <p class="btns"><a class="btn btn--red" href="${tel(club.mladez.telefon)}">${I.phone}${esc(club.mladez.telefon)}</a><a class="btn btn--line" href="mailto:${club.mladez.email}">${I.mail}${esc(club.mladez.email)}</a></p>
  </div>
  <dl class="facts">
    <div><dt>Názov</dt><dd>${esc(club.pravnyNazov)}</dd></div>
    <div><dt>Štadión</dt><dd>${esc(club.stadion.nazov)}, ${club.stadion.adresa.map(esc).join(', ')}</dd></div>
    <div><dt>Fan zóna</dt><dd><a href="mailto:${club.fanzona.email}">${esc(club.fanzona.email).replace('@', '<wbr>@')}</a></dd></div>
  </dl>
  <div>
    <h2 class="h3">Klub na webe</h2>
    <ul class="docs">
      <li><a href="${club.facebook}" rel="noopener">${I.fb}<span>Facebook FC Topoľčany</span><small>novinky a pozvánky na zápasy</small></a></li>
      <li><a href="${club.sportnetUrl}" rel="noopener">${I.ext}<span>Profil klubu na Sportnete</span><small>zápisy o stretnutí, súpisky, prestupy</small></a></li>
      <li><a href="${club.staryWeb}" rel="noopener">${I.ext}<span>Doterajší web klubu</span><small>fcto.sk</small></a></li>
    </ul>
    <p class="src">Kontakty: web klubu (Kontakt, Mládež, Fan zóna). Tréneri tímov sú na stránkach <a href="${R}timy/">tímov</a>.</p>
  </div>
</div></section>`,
});

add('ochrana-sukromia/', {
  title: 'Ochrana súkromia', desc: 'Ako web FC Topoľčany pracuje s údajmi.',
  body: (R) => `${pageHead({ title: 'Ochrana súkromia', R, crumbs: [[null, 'Ochrana súkromia']] })}
<section class="sec sec--first"><div class="wrap prose">
  <p>Web nepoužíva cookies, analytiku ani reklamné nástroje a nenačítava nič z iných serverov. Všetky súbory vrátane písma, fotiek a erbov sú uložené priamo na webe. Odkazy na Facebook, Sportnet a doterajší web klubu sú obyčajné odkazy.</p>
  <p>Mená hráčov, trénerov a rozhodcov, výsledky, strelcov, karty a počty divákov preberáme z verejného systému Sportnet (Futbalnet), kam ich zapisujú kluby a zväzy pri zápasoch. Vek hráčov nezverejňujeme, pri mládeži uvádzame len mená a zostavy zápasov len pri dospelých. Fotky pochádzajú z webu klubu.</p>
  <p>Ak chcete niečo opraviť alebo odstrániť, napíšte na <a href="mailto:${club.kontakt.email}">${esc(club.kontakt.email)}</a>.</p>
</div></section>`,
});

add('404/', {
  title: 'Stránka sa nenašla',
  body: (R) => `${pageHead({ title: 'Stránka sa nenašla', sub: 'Adresa je chybná alebo sa stránka presunula.', R })}
<section class="sec sec--first"><div class="wrap"><p class="btns"><a class="btn btn--red" href="${R}">Na úvod</a><a class="btn btn--line" href="${R}zapasy/">Zápasy a výsledky</a></p></div></section>`,
});


// ---- kalendár (.ics, RFC 5545) ----------------------------------------------------------------
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = (line) => {
  const out = []; let cur = '';
  for (const ch of line) { if (Buffer.byteLength(cur + ch) > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch; }
  out.push(cur);
  return out.join('\r\n');
};
const VTZ = ['BEGIN:VTIMEZONE', 'TZID:Europe/Bratislava',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE'];
function ics(list, calName) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const events = list.map((m) => {
    const us = m.teamObj.adult ? club.nazov : `${club.nazov} ${m.teamObj.short}`;
    const [h, a] = m.home ? [us, m.opponent] : [m.opponent, us];
    const d = m.date.replace(/-/g, '');
    const t = (m.time || '').slice(0, 5);
    const when = t ? [`DTSTART;TZID=Europe/Bratislava:${d}T${t.replace(':', '')}00`, 'DURATION:PT2H'] : [`DTSTART;VALUE=DATE:${d}`];
    const desc = [m.comp + (m.roundName ? `, ${m.roundName}` : ''), m.home ? 'Domáci zápas' : 'Zápas vonku'].join('\n');
    return ['BEGIN:VEVENT', `UID:zapas-${m.id}@${config.sportnet.club}.sportnet`, `DTSTAMP:${stamp}`, ...when,
      `SUMMARY:${icsEsc(`${m.teamObj.short}: ${h} – ${a}${m.score ? ` ${m.score}` : ''}`)}`,
      `DESCRIPTION:${icsEsc(desc)}`, m.venue && `LOCATION:${icsEsc(m.venue.replace(/\s+/g, ' '))}`, 'END:VEVENT'].filter(Boolean);
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${club.nazov}//Zapasy//SK`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEsc(calName)}`, 'X-WR-TIMEZONE:Europe/Bratislava', ...VTZ, ...events.flat(), 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n';
}

// ---- ukážka administrácie (dist/admin/demo.json pre src/admin/admin.js) ------------------------------
function writeAdminDemo() {
  // rovnaký tvar dát ako administrácia OK Častkovce (src/admin/admin.js je spoločný základ)
  const R = '../';
  const snById = Object.fromEntries(sn.matches.map((m) => [m.id, m]));
  const people = (t) => t.squad.athletes.map((a) => ({ name: a.name, number: a.nr === '' ? '' : String(a.nr), role: '', photo: null }));
  const demo = {
    club: { nazov: club.nazov, crest: `${R}img/erb-128.webp` },
    updated: sn.updated, season: sn.season,
    teams: teams.map((t) => ({ slug: t.slug, short: t.short, sub: t.adult ? 'Muži' : t.sub })),
    matches: matches.map((m) => ({
      id: m.id, team: m.team, date: m.date, time: m.time, home: m.home, opponent: m.opponent, competition: m.comp, part: '',
      round: (/\d+/.exec(m.round) || [''])[0], played: m.past, score: m.score, goals: m.goals || [], cards: m.cards || [],
      venue: (m.venue || '').replace(/\s+/g, ' '), url: snById[m.id]?.url || null, gallery: null, video: null,
    })),
    rosters: Object.fromEntries(teams.map((t) => [t.slug, people(t).map(({ name, number, photo }) => ({ name, number, photo }))])),
    news: [],
    info: {
      nazov: club.nazov, pravnyNazov: club.pravnyNazov, adresa: club.adresa, osoba: club.kontakt.osoba, telefon: club.kontakt.telefon, email: club.kontakt.email,
      facebook: club.facebook, ico: '', ucet: '', stadion: { nazov: club.stadion.nazov, kapacita: String(club.stadion.kapacita), rozmery: club.stadion.rozmery, vip: String(club.stadion.vip) },
    },
    allTeams: teams.map((t) => ({
      slug: t.slug, short: t.short, sub: t.adult ? 'Muži' : t.sub, league: t.leagueName, url: t.url, photo: null,
      groups: [{ title: 'Hráči', people: people(t) }, { title: 'Realizačný tím', people: t.squad.crew.map((c) => ({ name: c.name, number: '', role: crewRole[c.role] || crewRole.other, photo: null })) }],
    })),
    coaches: [],
    pages: {
      historia: { title: 'História', url: 'klub/', html: `<ul>${club.historia.map((h) => `<li><b>${esc(h.rok)}</b> – ${esc(h.text)}</li>`).join('')}</ul>` },
      mladez: { title: 'Mládež a nábor', url: 'mladez/', html: club.kategorie.map((k) => `<p><b>${esc(k.nazov)}</b> (${esc(k.vek)}) – ${esc(k.text)}</p>`).join('') },
      'ochrana-sukromia': { title: 'Ochrana súkromia', url: 'ochrana-sukromia/', html: '<p>Web nepoužíva cookies, analytiku ani reklamné nástroje.</p>' },
    },
    home: {
      heroTitle: 'My sme tu doma.', heroText: `FC Topoľčany vznikol v roku ${club.zalozenie}, aby nadviazal na storočnú históriu futbalu v meste. Áčko hrá ${acc(A.leagueName)}.`, hero: null,
      stadion: { title: club.stadion.nazov, text: club.stadion.plochy.map((p) => p.nazov).join(', ') },
    },
    galleries: [], videos: [], fanshop: { pozn: '', email: club.fanzona.email, produkty: club.fanzona.predmety.map((p) => ({ name: p, price: '', photo: null })) }, partners: club.partneri.zoznam.map((p) => ({ name: p, url: '', logo: null })),
  };
  fs.writeFileSync(path.join(OUT, 'admin', 'demo.json'), JSON.stringify(demo));
}

// ---- zápis -------------------------------------------------------------------------------------
// obsah dist/ sa maže po súboroch: koreň môže držať náhľadový server (fs.watch) alebo otvorený terminál
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
const copy = (from, to) => { if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true }); };
copy(path.join(SRC, 'img'), path.join(OUT, 'img'));
copy(path.join(SRC, 'fonts'), path.join(OUT, 'fonts'));
copy(path.join(SRC, 'js'), path.join(OUT, 'js'));
copy(path.join(ROOT, 'media', 'foto-web'), path.join(OUT, 'foto'));
if (config.adminDemo !== false && fs.existsSync(path.join(SRC, 'admin', 'index.html'))) { copy(path.join(SRC, 'admin'), path.join(OUT, 'admin')); writeAdminDemo(); }
fs.rmSync(path.join(OUT, 'fonts', 'fonts.css'), { force: true });
fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
const fontsCss = fs.readFileSync(path.join(SRC, 'fonts', 'fonts.css'), 'utf8').replace(/url\(([^)]+)\)/g, 'url(../fonts/$1)');
fs.writeFileSync(path.join(OUT, 'css', 'site.css'), fontsCss + fs.readFileSync(path.join(SRC, 'css', 'site.css'), 'utf8'));

for (const p of pages) {
  const depth = p.route.split('/').filter(Boolean).length;
  const R = depth ? '../'.repeat(depth) : './';
  const html = layout({ ...p, body: p.body(R) });
  const file = path.join(OUT, p.route, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
// GitHub Pages: 404 v koreni (absolútne cesty, lebo sa zobrazuje na ľubovoľnej adrese)
const BASE = process.env.BASE_PATH || config.basePath || '/';
const notFound = fs.readFileSync(path.join(OUT, '404', 'index.html'), 'utf8').replace(/(href|src|data-root)="(\.\.\/)+/g, `$1="${BASE}`);
fs.writeFileSync(path.join(OUT, '404.html'), notFound);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, '.gitattributes'), '*.ics -text\n'); // RFC 5545 chce CRLF, git na Windowse by ho zmenil

// kalendáre .ics: každý tím, všetky zápasy a jednotlivé budúce zápasy
fs.mkdirSync(path.join(OUT, 'kalendar'), { recursive: true });
for (const t of teams) fs.writeFileSync(path.join(OUT, 'kalendar', `${t.slug}.ics`), ics(teamMatches(t.slug), `${club.nazov} – ${t.full}`));
fs.writeFileSync(path.join(OUT, 'kalendar', 'vsetky.ics'), ics(matches, `${club.nazov} – všetky zápasy`));
for (const m of upcoming) fs.writeFileSync(path.join(OUT, 'kalendar', `zapas-${m.id}.ics`), ics([m], `${club.nazov} – ${m.teamObj.full}`));
console.log(`Hotovo: ${pages.length} stránok -> dist/ (dnes = ${TODAY})`);
