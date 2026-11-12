/**
 * Refreshes assets/academy-embed/index.html from the website repo.
 *
 * The website writes this file with `npm run build:academy-embed` at
 * public/academy-embed/index.html. Pass that checkout when you have it:
 *
 *   node scripts/build-academy-embed.mjs --repo /path/to/app.danijelbrecelj.com
 *
 * Without a checkout, the file already in this repo is the copy to ship.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outFile = path.join(root, "assets", "academy-embed", "index.html");
const repoFlag = process.argv.indexOf("--repo");
const repo = repoFlag >= 0 ? process.argv[repoFlag + 1] : process.env.WEBSITE_REPO || "";

if (!repo) {
  if (!fs.existsSync(outFile)) {
    console.error("assets/academy-embed/index.html is missing. Pass --repo pointing at the website checkout.");
    process.exit(1);
  }
  console.log(`Keeping ${outFile}`);
  process.exit(0);
}

const source = path.join(repo, "public", "academy-embed", "index.html");
if (!fs.existsSync(source)) {
  console.error(`No embed at ${source}. Run npm run build:academy-embed in the website repo first.`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.copyFileSync(source, outFile);
console.log(`Copied ${source}`);
