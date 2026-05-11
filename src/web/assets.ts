// Static assets are imported as text so they're embedded into the
// `bun build --compile` single-file binary (no filesystem reads at runtime).
// The `with { type: "text" }` import attribute is honored by Bun;
// we cast to string because Bun's stock types model HTML imports as HTMLBundle.
import indexHtmlRaw from "./public/index.html" with { type: "text" };
// @ts-expect-error — js/css are loaded as text via the import attribute
import appJsRaw from "./public/app.js" with { type: "text" };
// @ts-expect-error — see above
import styleCssRaw from "./public/style.css" with { type: "text" };

const indexHtml = indexHtmlRaw as unknown as string;
const appJs = appJsRaw as unknown as string;
const styleCss = styleCssRaw as unknown as string;

export const ASSETS: Record<string, { body: string; type: string }> = {
  "/": { body: indexHtml, type: "text/html; charset=utf-8" },
  "/index.html": { body: indexHtml, type: "text/html; charset=utf-8" },
  "/app.js": { body: appJs, type: "text/javascript; charset=utf-8" },
  "/style.css": { body: styleCss, type: "text/css; charset=utf-8" },
};
