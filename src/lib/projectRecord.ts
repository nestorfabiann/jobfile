import { Pdf } from './pdfDoc';
import { agreementText, totals, type AgreementRow, type ChangeOrder, type Item, type Milestone, type Signature } from './agreement';
import { dollars, signedDollars, daysText } from './money';

const TZ = 'America/Chicago';
const d = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }) : '';
const dt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type RecordInput = {
  projectName: string;
  address: string;
  homeowner: string;
  contractor: string;
  createdAt: string;
  completedAt: string | null;
  agreement: AgreementRow | null;
  items: Item[];
  milestones: Milestone[];
  signatures: Signature[];
  changes: ChangeOrder[];
  payments: { paid_on: string; amount_cents: number; method: string; status: string; note: string; recorded_role: string }[];
  messages: { created_at: string; sender_role: string; tag: string | null; body: string }[];
  photos: { created_at: string; kind: string; status: string; caption: string; uploader_role: string; data: Buffer | null }[];
  photosOmitted: number;
  reviews: { reviewer_role: string; overall: number; comment: string; reply: string | null; created_at: string }[];
  include: { messages: boolean; photos: boolean; payments: boolean };
};

export function buildProjectRecord(r: RecordInput): Buffer {
  const pdf = new Pdf();
  pdf.footer = `Jobfile project record · ${r.projectName} · made ${d(new Date().toISOString())}`;
  const who = (role: string) => (role === 'homeowner' ? r.homeowner : r.contractor);
  const t = totals(r.items, r.changes);
  const paid = r.payments.filter((p) => p.status !== 'disputed').reduce((s, p) => s + p.amount_cents, 0);

  // Cover
  pdf.space(30);
  pdf.text('JOBFILE PROJECT RECORD', { size: 9.5, bold: true, color: [0.8, 0.49, 0.18], gap: 4 });
  pdf.text(r.projectName, { size: 26, bold: true, gap: 4 });
  if (r.address) pdf.muted(r.address, { size: 11, gap: 10 });
  pdf.rule();
  pdf.pair('Homeowner', r.homeowner);
  pdf.pair('Contractor', r.contractor);
  pdf.pair('Project opened', d(r.createdAt));
  if (r.agreement?.executed_at) pdf.pair('Agreement signed by both', d(r.agreement.executed_at));
  if (r.agreement?.start_date) pdf.pair('Planned start', d(r.agreement.start_date));
  if (r.agreement?.end_date) pdf.pair('Planned finish', d(r.agreement.end_date));
  if (r.completedAt) pdf.pair('Marked complete', d(r.completedAt));
  if (r.items.length) {
    pdf.space(8);
    pdf.rule();
    pdf.pair('Agreed price', dollars(t.base));
    if (r.changes.some((c) => c.status === 'approved')) {
      pdf.pair('Approved change orders', signedDollars(t.chg));
      pdf.pair('Current contract total', dollars(t.total), { bold: true });
    }
    if (r.include.payments) {
      pdf.pair('Payments recorded', dollars(paid));
      pdf.pair('Remaining', dollars(t.total - paid), { bold: true });
    }
  }
  pdf.space(14);
  pdf.muted('This record was made from what both sides entered in Jobfile. Jobfile does not hold or move money. Payments are shown as the people on the project recorded them.', { gap: 4 });
  const parts = ['Agreement'];
  if (r.changes.length) parts.push('change orders');
  if (r.include.payments) parts.push('payment log');
  if (r.include.photos) parts.push('photos');
  if (r.include.messages) parts.push('messages');
  if (r.reviews.length) parts.push('ratings');
  pdf.muted(`Includes: ${parts.join(', ')}.`);

  // Agreement
  if (r.agreement) {
    pdf.breakPage();
    pdf.heading('Agreement');
    const text = agreementText({
      projectName: r.projectName, address: r.address, homeowner: r.homeowner, contractor: r.contractor,
      agreement: r.agreement, items: r.items, milestones: r.milestones, signatures: r.signatures, changes: r.changes,
    });
    for (const ln of text.split("\n").slice(3)) {
      if (!ln.trim()) pdf.space(5);
      else if (/^[A-Z][A-Z ,&\-]{3,}$/.test(ln.trim())) { pdf.need(46); pdf.space(4); pdf.text(ln.trim(), { size: 9.5, bold: true, color: [0.42, 0.4, 0.37] }); }
      else if (ln.startsWith('    ')) pdf.text(ln.trim(), { size: 9.5, indent: 16, color: [0.42, 0.4, 0.37] });
      else pdf.text(ln, { size: 10 });
    }
  }

  // Change orders
  if (r.changes.length) {
    pdf.heading('Change orders');
    const cols = [0, 0.1, 0.5, 0.64, 0.8];
    pdf.row(['No.', 'Change', 'Cost', 'Schedule', 'Status'], cols, { bold: true, muted: true });
    r.changes.forEach((c) => {
      pdf.row([`CO-${c.number}`, c.title + (c.description ? `\n${c.description}` : ''), signedDollars(c.cost_cents), daysText(c.days), `${cap(c.status)}${c.decided_at ? ` ${d(c.decided_at)}` : ''}\nAsked by ${c.requested_role}`], cols);
    });
  }

  // Payments
  if (r.include.payments) {
    pdf.heading('Payment log');
    if (!r.payments.length) pdf.muted('No payments have been recorded.');
    else {
      const cols = [0, 0.18, 0.36, 0.5, 0.7];
      pdf.row(['Date', 'Amount', 'Method', 'Status', 'Note'], cols, { bold: true, muted: true });
      r.payments.forEach((p) => pdf.row([d(p.paid_on), dollars(p.amount_cents), cap(p.method), `${cap(p.status)}\nRecorded by ${p.recorded_role}`, p.note], cols));
      pdf.space(4);
      pdf.pair('Total recorded (not counting disputed)', dollars(paid), { bold: true });
    }
  }

  // Photos
  if (r.include.photos) {
    pdf.heading('Photos');
    if (!r.photos.length) pdf.muted('No photos were added.');
    else {
      const label = (p: RecordInput['photos'][number]) =>
        `${d(p.created_at)} · ${p.kind === 'fix' ? `Fix request (${p.status})` : 'Progress'} · by ${p.uploader_role}${p.caption ? `. ${p.caption}` : ''}`;
      const shown = r.photos.filter((p) => p.data);
      for (let i = 0; i < shown.length; i += 2) pdf.photoPair(shown.slice(i, i + 2).map((p) => ({ data: p.data as Buffer, caption: label(p) })));
      const unreadable = r.photos.filter((p) => !p.data);
      const more = r.photosOmitted + unreadable.length;
      if (more) pdf.muted(`${more} more photo${more === 1 ? '' : 's'} not shown here (limit for one PDF, or a format that cannot be placed). They are still on the project.`);
    }
  }

  // Messages
  if (r.include.messages) {
    pdf.heading('Messages');
    if (!r.messages.length) pdf.muted('No messages.');
    r.messages.forEach((m) => {
      pdf.need(40);
      pdf.text(`${dt(m.created_at)} · ${who(m.sender_role)}${m.tag ? ` · ${cap(m.tag)}` : ''}`, { size: 8.5, bold: true, color: [0.42, 0.4, 0.37] });
      pdf.text(m.body, { size: 10, indent: 10, gap: 5 });
    });
  }

  // Ratings
  if (r.reviews.length) {
    pdf.heading('Ratings');
    r.reviews.forEach((v) => {
      pdf.text(`${cap(v.reviewer_role)}'s rating of ${who(v.reviewer_role === 'homeowner' ? 'contractor' : 'homeowner')}: ${v.overall} of 5`, { bold: true, size: 10.5 });
      if (v.comment) pdf.text(v.comment, { size: 10, indent: 10 });
      if (v.reply) pdf.text(`Reply: ${v.reply}`, { size: 10, indent: 10, color: [0.42, 0.4, 0.37] });
      pdf.space(6);
    });
  }

  return pdf.build();
}
