import fs from "node:fs";
import path from "node:path";

async function inlineBuild() {
  const inputHtmlPath = path.resolve("dist/index.html");
  const outputHtmlPath = path.resolve("dist/index.html");
  const html = fs.readFileSync(inputHtmlPath, "utf-8");
  const inlined = await inlineAssetsInMemory(html, path.dirname(inputHtmlPath));
  fs.writeFileSync(outputHtmlPath, inlined, "utf-8");
  assertSingleFileHtml(inlined);
}

async function inlineAssetsInMemory(html, baseDir) {
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*>/g;
  let match;
  const linksToReplace = [];
  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    const hrefMatch = /href=["']([^"']+)["']/.exec(tag);
    if (hrefMatch) {
      linksToReplace.push({ tag, href: hrefMatch[1] });
    }
  }

  function resolveAsset(rel) {
    const clean = rel.startsWith("/") ? rel.slice(1) : rel;
    return path.resolve(baseDir, clean);
  }

  for (const { tag, href } of linksToReplace) {
    const cssPath = resolveAsset(href);
    const css = fs.readFileSync(cssPath, "utf-8");
    html = html.replace(tag, `<style>\n${css}\n</style>`);
  }

  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/g;
  const scriptsToReplace = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptsToReplace.push({ tag: match[0], src: match[1] });
  }

  for (const { tag, src } of scriptsToReplace) {
    const jsPath = resolveAsset(src);
    const js = fs.readFileSync(jsPath, "utf-8");
    html = html.replace(tag, `<script type="module">\n${js}\n</script>`);
  }

  return html;
}

function assertSingleFileHtml(html) {
  const remainingLinks = html.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/g);
  if (remainingLinks && remainingLinks.length > 0) {
    throw new Error(`Output HTML still references external stylesheets: ${remainingLinks.join(", ")}`);
  }
  const remainingScripts = html.match(/<script[^>]*src=["'][^"']+["'][^>]*>/g);
  if (remainingScripts && remainingScripts.length > 0) {
    throw new Error(`Output HTML still references external scripts: ${remainingScripts.join(", ")}`);
  }
}

inlineBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
