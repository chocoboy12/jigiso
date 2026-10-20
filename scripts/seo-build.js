/**
 * Après la construction du site, écrit dans frontend/dist :
 *   - robots.txt  : ce que Google peut visiter (pas les espaces privés)
 *   - sitemap.xml : la liste des pages publiques, dont chaque annonce en ligne
 *
 * Usage : SITE_URL=https://… API_URL=https://… node scripts/seo-build.js
 * Appelé par deploy-site.sh : à chaque mise en ligne, le plan du site reprend
 * les annonces du moment.
 */
const fs = require('fs');
const path = require('path');

const SITE = (process.env.SITE_URL || '').replace(/\/$/, '');
const API = (process.env.API_URL || '').replace(/\/$/, '').replace(/\/api$/, '');
if (!SITE || !API) { console.error('✖ SITE_URL et API_URL sont requis.'); process.exit(1); }
const DIST = path.join(__dirname, '..', 'frontend', 'dist');

// Pages privées ou personnelles : rien à faire dans les résultats de recherche
const PRIVEES = [
  '/admin', '/proprietaire', '/mes-annonces', '/publier', '/verification',
  '/tableau-de-bord', '/favoris', '/mes-demandes', '/messages', '/profil',
  '/alertes', '/verifier-email', '/login', '/inscription',
];

const echapper = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function annonces() {
  const liste = [];
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${API}/api/properties?limit=100&page=${page}`);
    if (!r.ok) throw new Error(`API ${r.status}`);
    const d = await r.json();
    liste.push(...(d.properties || []));
    if (page >= (d.totalPages || 1)) break;
  }
  return liste;
}

(async () => {
  let biens = [];
  try {
    biens = await annonces();
  } catch (e) {
    // Le site reste publiable : le plan contient alors seulement les pages fixes
    console.warn(`⚠ Annonces non lues (${e.message}) : plan du site sans les annonces.`);
  }

  const urls = [
    { loc: `${SITE}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE}/rechercher`, priority: '0.9', changefreq: 'daily' },
    { loc: `${SITE}/contact`, priority: '0.3', changefreq: 'monthly' },
    ...biens.map(b => ({
      loc: `${SITE}/logements/${b._id}`,
      lastmod: (b.updatedAt || b.createdAt || '').slice(0, 10),
      priority: '0.8',
      changefreq: 'weekly',
    })),
  ];

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => '  <url>'
      + `<loc>${echapper(u.loc)}</loc>`
      + (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '')
      + `<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')
    + '\n</urlset>\n';

  const robots = 'User-agent: *\nAllow: /\n'
    + PRIVEES.map(p => `Disallow: ${p}`).join('\n')
    + `\n\nSitemap: ${SITE}/sitemap.xml\n`;

  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), robots);
  console.log(`✓ sitemap.xml (${urls.length} pages dont ${biens.length} annonces) et robots.txt`);
})();
