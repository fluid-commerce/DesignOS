const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname);
const files = fs.readdirSync(dir).filter(f => f.endsWith(".liquid"));
for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), "utf8");
  const m = content.match(/\{% schema %\}\s*([\s\S]*?)\s*\{% endschema %\}/);
  if (!m) { console.log(f + " | NO SCHEMA"); continue; }
  try {
    const s = JSON.parse(m[1]);
    const flat = [];
    if (s.settings) flat.push(...s.settings);
    if (s.blocks) for (const b of s.blocks) if (b.settings) flat.push(...b.settings);
    const sel = flat.filter(x => x.type && x.type !== "header");
    const blocks = s.blocks ? s.blocks.map(b => b.type).join(", ") : "none";
    const textEls = sel.filter(x => (x.id||"").endsWith("_font_family")).map(x => x.id.replace("_font_family",""));
    console.log(f + " | " + s.name + " | " + sel.length + " settings | blocks: " + blocks + " | text: " + textEls.join(", "));
  } catch(e) { console.log(f + " | ERROR: " + e.message); }
}
