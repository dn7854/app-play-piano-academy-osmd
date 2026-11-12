/**
 * Builds assets/academy-embed/index.html.
 *
 * If the website repo is available, this copies the file produced by its
 * `npm run build:academy-embed` (public/academy-embed/index.html).
 * Otherwise it assembles the in-repo viewer with OpenSheetMusicDisplay.
 *
 *   node scripts/build-academy-embed.mjs
 *   node scripts/build-academy-embed.mjs --repo /path/to/app.danijelbrecelj.com
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "assets", "academy-embed");
const outFile = path.join(outDir, "index.html");
const repoFlag = process.argv.indexOf("--repo");
const repo = repoFlag >= 0 ? process.argv[repoFlag + 1] : process.env.WEBSITE_REPO || "";

function copyWebsiteBundle(repoPath) {
  const candidates = [
    path.join(repoPath, "public", "academy-embed", "index.html"),
    path.join(repoPath, "assets", "academy-embed", "index.html"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes("protocolVersion") && !html.includes("musicXmlUrl")) continue;
    fs.mkdirSync(outDir, { recursive: true });
    fs.copyFileSync(file, outFile);
    console.log(`Copied ${file}`);
    return true;
  }
  return false;
}

function findOsmd() {
  const candidates = [
    path.join(root, "node_modules", "opensheetmusicdisplay", "build", "opensheetmusicdisplay.min.js"),
    path.join(root, "node_modules", "opensheetmusicdisplay", "dist", "opensheetmusicdisplay.min.js"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function escapeScript(source) {
  return source.replace(/<\/script/gi, "<\\/script");
}

if (repo && copyWebsiteBundle(repo)) process.exit(0);

const osmdPath = findOsmd();
const viewerPath = path.join(root, "embed", "viewer.js");
if (!osmdPath) {
  console.error("opensheetmusicdisplay.min.js was not found. Run npm install.");
  process.exit(1);
}
if (!fs.existsSync(viewerPath)) {
  console.error("embed/viewer.js is missing.");
  process.exit(1);
}

const osmd = fs.readFileSync(osmdPath, "utf8");
const viewer = fs.readFileSync(viewerPath, "utf8");
const licenseCandidates = [
  path.join(path.dirname(osmdPath), "opensheetmusicdisplay.min.js.LICENSE.txt"),
  path.join(root, "node_modules", "opensheetmusicdisplay", "LICENSE"),
];
const license = licenseCandidates.find((file) => fs.existsSync(file));
if (license) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(license, path.join(outDir, "OSMD-LICENSE.txt"));
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>D8R score</title>
  <style>
    html, body { margin: 0; height: 100%; background: #e4dece; overflow: hidden; }
    #scroller { position: absolute; inset: 0; overflow: auto; -webkit-overflow-scrolling: touch; }
    #page { margin: 8px auto; background: #fffcf2; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18); }
    #stage { background: #fffcf2; }
    #status {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      padding: 24px; text-align: center; background: rgba(255, 252, 242, 0.9);
      color: #0f172a; font: 600 16px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #status.hidden { display: none; }
  </style>
</head>
<body>
  <div id="scroller"><div id="page"><div id="stage"></div></div></div>
  <div id="status">Opening the score…</div>
  <script>
    window.__d8rQueue = [];
    function __d8rPush(event) { window.__d8rQueue.push(event.data); }
    window.addEventListener("message", __d8rPush);
    document.addEventListener("message", __d8rPush);
    (function () {
      var msg = JSON.stringify({ source: "d8r-academy", type: "ready", protocolVersion: 1 });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    })();
  </script>
  <script>${escapeScript(osmd)}</script>
  <script>${escapeScript(viewer)}</script>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
console.log(`Wrote ${outFile} (${html.length} bytes)`);
