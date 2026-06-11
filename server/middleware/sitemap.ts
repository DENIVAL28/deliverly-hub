import { defineEventHandler, setHeader, setResponseStatus } from "h3";

export default defineEventHandler((event) => {
  if (event.path !== "/sitemap.xml") return;

  setResponseStatus(event, 200);
  setHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setHeader(event, "Cache-Control", "public, max-age=86400");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://deliverly-hub.vercel.app/</loc>
    <lastmod>2026-06-11</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://deliverly-hub.vercel.app/lojas</loc>
    <lastmod>2026-06-11</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://deliverly-hub.vercel.app/auth</loc>
    <lastmod>2026-06-11</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>
</urlset>`;
});
