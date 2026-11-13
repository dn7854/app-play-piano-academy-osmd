/**
 * The score page shipped in the app is assets/academy-embed/index.html.
 * It is the app's own OSMD snapshot. Do not replace it with the website embed:
 * the public studio page uses a different fit, and this app patches portrait
 * fit and diagonal dragging on top of the snapshot (src/score/embedPatch.ts).
 */
import fs from "node:fs";
import path from "node:path";

const outFile = path.join(process.cwd(), "assets", "academy-embed", "index.html");
if (!fs.existsSync(outFile)) {
  console.error("assets/academy-embed/index.html is missing.");
  process.exit(1);
}
console.log(`App score page is ${outFile}`);
