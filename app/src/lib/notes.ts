/** Release notes are Markdown; this reads the small part of it they use (headings, bullets, **bold**, `code`) without any HTML. */
export type Inline = { t: string; b?: boolean; c?: boolean };
export type Block = { kind: 'h' | 'li' | 'p'; parts: Inline[] };

function inline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`/g;
  let at = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > at) out.push({ t: s.slice(at, m.index) });
    out.push(m[1] !== undefined ? { t: m[1], b: true } : { t: m[2], c: true });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ t: s.slice(at) });
  return out;
}

export function parseNotes(md: string): Block[] {
  // the install instructions after the rule are for people who have not installed yet
  const body = md.split(/^\s*---+\s*$/m)[0];
  const blocks: Block[] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (h) {
      // the top "What's new" title only repeats the card's own heading
      if (!/^#{1,2}\s/.test(line)) blocks.push({ kind: 'h', parts: inline(h[1]) });
    } else if (li) blocks.push({ kind: 'li', parts: inline(li[1]) });
    else blocks.push({ kind: 'p', parts: inline(line) });
  }
  return blocks;
}
