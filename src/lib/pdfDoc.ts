// A small PDF writer with no dependencies: Letter pages, Helvetica text with word wrap, rules, and JPEG photos.
// Text is limited to Latin-1 plus common punctuation. Anything else prints as "?".

const W = 612;
const H = 792;
const M = 54;
const BOTTOM = 60;

const REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const WIN: Record<number, number> = { 0x20ac: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2212: 0x2d, 0x2122: 0x99 };

/** Maps text to WinAnsi byte codes. */
function enc(s: string): number[] {
  const out: number[] = [];
  for (const ch of s.replace(/\r/g, '')) {
    const c = ch.codePointAt(0)!;
    if (c === 9) out.push(32, 32, 32, 32);
    else if (c >= 32 && c <= 126) out.push(c);
    else if (c >= 160 && c <= 255) out.push(c);
    else if (WIN[c]) out.push(WIN[c]);
    else if (c === 10) out.push(10);
    else out.push(63);
  }
  return out;
}

const widthOf = (codes: number[], size: number, bold: boolean) => {
  const t = bold ? BOLD : REG;
  let w = 0;
  for (const c of codes) w += c >= 32 && c <= 126 ? t[c - 32] : c === 0x95 ? 350 : 556;
  return (w * size) / 1000;
};

const hex = (codes: number[]) => '<' + codes.map((c) => c.toString(16).padStart(2, '0')).join('') + '>';
const num = (n: number) => (Math.round(n * 100) / 100).toString();

export type Rgb = [number, number, number];
const INK: Rgb = [0.11, 0.1, 0.09];
const MUTED: Rgb = [0.42, 0.4, 0.37];
const LINE: Rgb = [0.85, 0.83, 0.79];
const col = (c: Rgb) => `${num(c[0])} ${num(c[1])} ${num(c[2])}`;

/** Reads width, height and component count from a JPEG. Returns null if it is not a baseline or progressive JPEG. */
export function jpegInfo(b: Buffer): { w: number; h: number; comps: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), comps: b[i + 9] };
    }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

type Img = { name: string; data: Buffer; w: number; h: number; comps: number };

export class Pdf {
  private pages: string[] = [];
  private cur = '';
  private y = H - M;
  private imgs: Img[] = [];
  private pageImgs: Set<string>[] = [];
  private curImgs = new Set<string>();
  footer = '';

  constructor() {
    this.newPage();
  }

  get left() { return M; }
  get width() { return W - 2 * M; }

  private newPage() {
    if (this.cur) { this.pages.push(this.cur); this.pageImgs.push(this.curImgs); }
    this.cur = '';
    this.curImgs = new Set();
    this.y = H - M;
  }

  /** Starts a new page unless there is room for `h` points. */
  need(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }

  breakPage() {
    if (this.y < H - M) this.newPage();
  }

  space(n: number) {
    this.y -= n;
  }

  private put(codes: number[], x: number, y: number, size: number, bold: boolean, color: Rgb) {
    this.cur += `BT ${col(color)} rg /${bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(x)} ${num(y)} Td ${hex(codes)} Tj ET\n`;
  }

  /** Wraps text to a width and returns lines of byte codes. */
  private wrap(s: string, size: number, bold: boolean, maxW: number): number[][] {
    const lines: number[][] = [];
    for (const para of s.split('\n')) {
      const words = para.split(/ +/);
      let line: number[] = [];
      for (const w of words) {
        let wc = enc(w);
        // break a very long word
        while (widthOf(wc, size, bold) > maxW && wc.length > 1) {
          let n = wc.length - 1;
          while (n > 1 && widthOf(wc.slice(0, n), size, bold) > maxW) n--;
          if (line.length) { lines.push(line); line = []; }
          lines.push(wc.slice(0, n));
          wc = wc.slice(n);
        }
        const trial = line.length ? [...line, 32, ...wc] : wc;
        if (line.length && widthOf(trial, size, bold) > maxW) { lines.push(line); line = wc; } else line = trial;
      }
      lines.push(line);
    }
    return lines;
  }

  text(s: string, o: { size?: number; bold?: boolean; color?: Rgb; indent?: number; gap?: number } = {}) {
    const size = o.size ?? 10.5;
    const lead = size * 1.4;
    const x = M + (o.indent ?? 0);
    for (const ln of this.wrap(s, size, !!o.bold, W - M - x)) {
      this.need(lead);
      this.y -= lead;
      if (ln.length) this.put(ln, x, this.y, size, !!o.bold, o.color ?? INK);
    }
    this.y -= o.gap ?? 0;
  }

  muted(s: string, o: { size?: number; indent?: number; gap?: number } = {}) {
    this.text(s, { size: o.size ?? 9.5, color: MUTED, indent: o.indent, gap: o.gap });
  }

  heading(s: string) {
    this.need(60);
    this.space(14);
    this.text(s, { size: 15, bold: true });
    this.rule();
    this.space(4);
  }

  sub(s: string) {
    this.need(40);
    this.space(6);
    this.text(s, { size: 11, bold: true, gap: 1 });
  }

  rule() {
    this.cur += `${col(LINE)} RG 0.7 w ${M} ${num(this.y - 3)} m ${W - M} ${num(this.y - 3)} l S\n`;
    this.y -= 6;
  }

  /** A label on the left and a value on the right, on one line. */
  pair(label: string, value: string, o: { bold?: boolean } = {}) {
    const size = 10.5;
    const lead = size * 1.5;
    this.need(lead);
    this.y -= lead;
    this.put(enc(label), M, this.y, size, false, MUTED);
    const v = enc(value);
    this.put(v, W - M - widthOf(v, size, !!o.bold), this.y, size, !!o.bold, INK);
  }

  /** A table row: cells are placed at fractional column starts, text wraps inside each cell. */
  row(cells: string[], cols: number[], o: { bold?: boolean; muted?: boolean; rightLast?: boolean } = {}) {
    const size = 9.5;
    const lead = size * 1.4;
    const xs = cols.map((c) => M + c * this.width);
    const wraps = cells.map((c, i) => {
      const w = (i + 1 < cols.length ? cols[i + 1] : 1) * this.width - cols[i] * this.width - 8;
      return this.wrap(c, size, !!o.bold, w);
    });
    const n = Math.max(...wraps.map((w) => w.length));
    this.need(lead * Math.min(n, 3) + 6);
    for (let k = 0; k < n; k++) {
      if (this.y - lead < BOTTOM) this.newPage();
      this.y -= lead;
      wraps.forEach((w, i) => {
        const ln = w[k];
        if (!ln || !ln.length) return;
        const right = o.rightLast && i === cells.length - 1;
        const x = right ? W - M - widthOf(ln, size, !!o.bold) : xs[i];
        this.put(ln, x, this.y, size, !!o.bold, o.muted ? MUTED : INK);
      });
    }
    this.cur += `${col(LINE)} RG 0.4 w ${M} ${num(this.y - 3.5)} m ${W - M} ${num(this.y - 3.5)} l S\n`;
    this.y -= 5;
  }

  /** Draws JPEG photos two to a row with a caption under each. Returns false if the data is not a usable JPEG. */
  photoPair(items: { data: Buffer; caption: string }[]) {
    const gap = 14;
    const cw = (this.width - gap) / 2;
    const maxH = 190;
    const infos = items.map((it) => ({ it, info: jpegInfo(it.data) }));
    const dims = infos.map(({ info }) => {
      if (!info || (info.comps !== 1 && info.comps !== 3)) return null;
      const s = Math.min(cw / info.w, maxH / info.h);
      return { w: info.w * s, h: info.h * s };
    });
    const capLines = items.map((it) => this.wrap(it.caption, 8.5, false, cw));
    const rowH = Math.max(...dims.map((d) => d?.h ?? 0)) + 12 * Math.max(1, ...capLines.map((c) => c.length)) + 10;
    this.need(rowH);
    const top = this.y;
    infos.forEach(({ it, info }, i) => {
      const d = dims[i];
      const x = M + i * (cw + gap);
      if (!d || !info) return;
      const name = `Im${this.imgs.length + 1}`;
      this.imgs.push({ name, data: it.data, w: info.w, h: info.h, comps: info.comps });
      this.curImgs.add(name);
      this.cur += `q ${num(d.w)} 0 0 ${num(d.h)} ${num(x)} ${num(top - d.h)} cm /${name} Do Q\n`;
      let yy = top - d.h - 11;
      for (const ln of capLines[i]) {
        if (ln.length) this.put(ln, x, yy, 8.5, false, MUTED);
        yy -= 11;
      }
    });
    this.y = top - rowH;
  }

  build(): Buffer {
    this.pages.push(this.cur);
    this.pageImgs.push(this.curImgs);
    const parts: Buffer[] = [];
    const offsets: number[] = [];
    let size = 0;
    const push = (b: Buffer | string) => {
      const buf = typeof b === 'string' ? Buffer.from(b, 'latin1') : b;
      parts.push(buf);
      size += buf.length;
    };
    const obj = (id: number, body: Buffer | string) => {
      offsets[id] = size;
      push(`${id} 0 obj\n`);
      push(body);
      push('\nendobj\n');
    };
    const stream = (dict: string, data: Buffer | string) => {
      const buf = typeof data === 'string' ? Buffer.from(data, 'latin1') : data;
      return Buffer.concat([Buffer.from(`<< ${dict} /Length ${buf.length} >>\nstream\n`, 'latin1'), buf, Buffer.from('\nendstream', 'latin1')]);
    };

    // ids: 1 catalog, 2 pages, 3 F1, 4 F2, then images, then page+content pairs
    const imgId = new Map<string, number>();
    let next = 5;
    this.imgs.forEach((im) => imgId.set(im.name, next++));
    const pageIds: number[] = [];
    const contentIds: number[] = [];
    this.pages.forEach(() => { pageIds.push(next++); contentIds.push(next++); });

    push('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.imgs.forEach((im) => {
      obj(imgId.get(im.name)!, stream(`/Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /${im.comps === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode`, im.data));
    });
    const total = this.pages.length;
    this.pages.forEach((content, i) => {
      let c = content;
      if (this.footer) {
        const f = enc(`${this.footer}   Page ${i + 1} of ${total}`);
        c += `BT ${col(MUTED)} rg /F1 8 Tf ${num(M)} 32 Td ${hex(f)} Tj ET\n`;
      }
      const xo = Array.from(this.pageImgs[i]).map((n) => `/${n} ${imgId.get(n)} 0 R`).join(' ');
      obj(pageIds[i], `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo ? ` /XObject << ${xo} >>` : ''} >> /Contents ${contentIds[i]} 0 R >>`);
      obj(contentIds[i], stream('', c));
    });
    const xref = size;
    const n = next;
    push(`xref\n0 ${n}\n0000000000 65535 f \n`);
    for (let i = 1; i < n; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return Buffer.concat(parts);
  }
}
