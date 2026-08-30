/**
 * Generates valid XML sitemap string for root and enabled language routes.
 *
 * @param {string[]} supportedLanguages - List of enabled language codes.
 * @param {Array<{ name: string, srcEn: string, srcDe: string|null }>} [legalPages=[]] - Optional legal pages configuration.
 * @returns {string} XML sitemap content.
 */
function generateSitemapXml(supportedLanguages, legalPages = []) {
    const sitemapDate = new Date().toISOString().split('T')[0] + 'T00:00:00+00:00';
    let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
              http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
`;

    const alternateLinks = supportedLanguages.map(l =>
        `    <xhtml:link rel="alternate" hreflang="${l}" href="https://orecalc.tech/${l === 'en' ? '' : l + '/'}" />`
    ).concat(['    <xhtml:link rel="alternate" hreflang="x-default" href="https://orecalc.tech/" />']).join('\n');

    sitemapXml += `  <url>\n    <loc>https://orecalc.tech/</loc>\n${alternateLinks}\n    <lastmod>${sitemapDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n\n`;

    for (const lang of supportedLanguages) {
        if (lang === 'en') continue;
        sitemapXml += `  <url>\n    <loc>https://orecalc.tech/${lang}/</loc>\n${alternateLinks}\n    <lastmod>${sitemapDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n\n`;
    }

    const toolAlternateLinks = supportedLanguages.map(l =>
        `    <xhtml:link rel="alternate" hreflang="${l}" href="https://orecalc.tech/${l === 'en' ? '' : l + '/'}hero-journey/" />`
    ).concat(['    <xhtml:link rel="alternate" hreflang="x-default" href="https://orecalc.tech/hero-journey/" />']).join('\n');

    sitemapXml += `  <url>\n    <loc>https://orecalc.tech/hero-journey/</loc>\n${toolAlternateLinks}\n    <lastmod>${sitemapDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n\n`;

    for (const lang of supportedLanguages) {
        if (lang === 'en') continue;
        sitemapXml += `  <url>\n    <loc>https://orecalc.tech/${lang}/hero-journey/</loc>\n${toolAlternateLinks}\n    <lastmod>${sitemapDate}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n\n`;
    }

    if (Array.isArray(legalPages) && legalPages.length > 0) {
        for (const page of legalPages) {
            let altLinks = '';
            if (page.srcDe) {
                altLinks = `    <xhtml:link rel="alternate" hreflang="en" href="https://orecalc.tech/${page.name}/" />\n` +
                           `    <xhtml:link rel="alternate" hreflang="de" href="https://orecalc.tech/de/${page.name}/" />\n` +
                           `    <xhtml:link rel="alternate" hreflang="x-default" href="https://orecalc.tech/${page.name}/" />\n`;
            }
            sitemapXml += `  <url>\n    <loc>https://orecalc.tech/${page.name}/</loc>\n${altLinks}    <lastmod>${sitemapDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n\n`;
            if (page.srcDe && supportedLanguages.includes('de')) {
                sitemapXml += `  <url>\n    <loc>https://orecalc.tech/de/${page.name}/</loc>\n${altLinks}    <lastmod>${sitemapDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n\n`;
            }
        }
    }

    sitemapXml += `</urlset>\n`;
    return sitemapXml;
}

module.exports = {
    generateSitemapXml
};
