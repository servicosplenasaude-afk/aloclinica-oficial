import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = process.cwd();
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const strict = process.argv.includes("--strict");
const allowedShared = new Set([
  "src/assets/logo.png",
  "src/assets/logo.webp",
  "src/assets/logo-pingo.png",
  "src/assets/logo-receita.png",
  "public/logo-receita.png",
]);

function walk(directory, extensions) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute, extensions);
    return extensions.has(extname(entry.name).toLowerCase()) ? [absolute] : [];
  });
}

const images = [...walk(resolve(root, "src/assets"), imageExtensions), ...walk(resolve(root, "public"), imageExtensions)];
const sourceFiles = walk(resolve(root, "src"), sourceExtensions);
const byHash = new Map();

for (const image of images) {
  const hash = createHash("sha256").update(readFileSync(image)).digest("hex");
  const normalized = relative(root, image).replaceAll("\\", "/");
  const group = byHash.get(hash) ?? [];
  group.push(normalized);
  byHash.set(hash, group);
}

const physicalDuplicates = [...byHash.values()].filter(
  (group) => group.length > 1 && group.some((file) => !allowedShared.has(file)),
);

const usage = new Map();
const assetPattern = /@\/assets\/([A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|avif|svg))/g;
for (const sourceFile of sourceFiles.filter((file) => !/[\\/](?:test|__tests__)[\\/]|\.(?:test|spec)\.[jt]sx?$/.test(file))) {
  const content = readFileSync(sourceFile, "utf8");
  for (const match of content.matchAll(assetPattern)) {
    const asset = `src/assets/${match[1]}`;
    if (allowedShared.has(asset) || asset.startsWith("src/assets/specialties/")) continue;
    const consumers = usage.get(asset) ?? new Set();
    consumers.add(relative(root, sourceFile).replaceAll("\\", "/"));
    usage.set(asset, consumers);
  }
}

const repeatedUsage = [...usage.entries()]
  .filter(([, consumers]) => consumers.size > 1)
  .map(([asset, consumers]) => ({ asset, consumers: [...consumers].sort() }));

console.log(`Visual assets: ${images.length} files checked.`);
console.log(`Identical-file groups: ${physicalDuplicates.length}.`);
for (const group of physicalDuplicates) console.log(`  - ${group.join(" | ")}`);
console.log(`Repeated visual usages: ${repeatedUsage.length}.`);
for (const item of repeatedUsage) console.log(`  - ${item.asset}: ${item.consumers.join(" | ")}`);

if (strict && (physicalDuplicates.length || repeatedUsage.length)) process.exit(1);
