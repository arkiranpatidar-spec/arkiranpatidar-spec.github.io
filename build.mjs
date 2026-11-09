// Builds the site.
//   dist/                static site, one pre-rendered HTML file per room
//   dist-preview/page.html  single self-contained page for private previews
import * as esbuild from "esbuild";
import { mkdir, rm, writeFile, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { site } from "./src/content/site.js";

const FONTS = "https://fonts.googleapis.com/css2?family=Eczar:wght@700&family=Instrument+Sans:wght@400;500&display=swap";
const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  loader: { ".webp": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
  jsx: "transform",
  logLevel: "warning",
  legalComments: "none",
};

async function client(hash) {
  const r = await esbuild.build({
    ...shared,
    entryPoints: ["src/main.jsx"],
    write: false,
    minify: true,
    format: "iife",
    target: "es2020",
    outdir: "out",
    define: { __HASH_ROUTES__: hash ? "true" : "false", "process.env.NODE_ENV": '"production"' },
  });
  return { js: r.outputFiles.find((f) => f.path.endsWith(".js")).text, css: r.outputFiles.find((f) => f.path.endsWith(".css")).text };
}

async function loadServer() {
  await esbuild.build({ ...shared, entryPoints: ["src/server.jsx"], outfile: ".cache/server.mjs", platform: "node", format: "esm", external: ["react", "react-dom", "react-dom/server"], define: { __HASH_ROUTES__: "false", "process.env.NODE_ENV": '"production"' } });
  await writeFile(".cache/package.json", '{"type":"module"}');
  return import(`${pathToFileURL(path.resolve(".cache/server.mjs")).href}?t=${Date.now()}`);
}

const PRE_PAINT = `<script>(function(){var d=document.documentElement;d.classList.add('js');try{var t=JSON.parse(localStorage.getItem('kp-theme'));if(t)d.dataset.theme=t}catch(e){}if(!matchMedia('(prefers-reduced-motion: reduce)').matches){d.classList.add('intro');setTimeout(function(){d.classList.remove('intro')},4000)}})()</script>`;

function page({ route, title, description, html, css, jsHref }) {
  const url = `${site.url}/${route ? `${route}/` : ""}`;
  const ld = JSON.stringify({ "@context": "https://schema.org", "@type": "Person", name: site.name, url: site.url, alumniOf: ["NIT Hamirpur", "IIM Kozhikode"] });
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f1e9d8">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141a16">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${css}">
<script type="application/ld+json">${ld}</script>
${PRE_PAINT}
</head>
<body>
<div id="root" data-route="${route}">${html}</div>
<script src="${jsHref}" defer></script>
</body>
</html>
`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function build() {
  await rm("dist", { recursive: true, force: true });
  await mkdir("dist/assets", { recursive: true });
  await mkdir("dist-preview", { recursive: true });
  await mkdir(".cache", { recursive: true });

  const prod = await client(false);
  await writeFile("dist/assets/site.js", prod.js);
  await writeFile("dist/assets/site.css", prod.css);
  const server = await loadServer();

  const routes = ["", ...server.allRoutes()];
  for (const route of routes) {
    const meta = route ? server.routeMeta(route) : { title: site.title, intro: site.description };
    const html = server.render(route);
    const out = route ? `dist/${route}/index.html` : "dist/index.html";
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, page({
      route,
      title: esc(route ? `${meta.title}. ${site.name}` : site.title),
      description: esc(meta.intro || site.description),
      html,
      css: "/assets/site.css",
      jsHref: "/assets/site.js",
    }));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  await writeFile("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `  <url><loc>${site.url}/${r ? `${r}/` : ""}</loc><lastmod>${stamp}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  await writeFile("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
  if (existsSync("public")) await cp("public", "dist", { recursive: true });

  // Single file used for private previews. Routes live in the hash here.
  const preview = await client(true);
  const js = preview.js.replace(/<\/script/gi, "<\\/script");
  await writeFile(
    "dist-preview/page.html",
    `<title>Kiran Patidar</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${preview.css}</style>
${PRE_PAINT}
<div id="root" data-route=""></div>
<script>${js}</script>
`,
  );
  console.log(`Built ${routes.length} pages. JS ${(prod.js.length / 1024).toFixed(0)} KB, CSS ${(prod.css.length / 1024).toFixed(0)} KB.`);
}

await build();

if (watch) {
  const { watch: fsWatch } = await import("node:fs");
  let t;
  fsWatch("src", { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => build().catch(console.error), 120);
  });
  console.log("Watching src/ for changes.");
}
