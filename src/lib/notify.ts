import { supabaseAdmin } from './supabase/server';
import { alertHref } from '@/lib/alertPath';

import { unsubLink } from '@/lib/unsub';
const APP_URL = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

type SendResult = { ok: boolean; skipped?: string; error?: string };

/** Send one email through Resend. Skips quietly when no API key is set. */
export async function sendEmail(opts: { to: string; subject: string; text: string; link?: string; cta?: string; unsubscribe?: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, skipped: 'Email is not configured' };

  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0E1A2E">` +
    `<div style="font-weight:800;letter-spacing:.02em;color:#1B56E0;margin-bottom:16px">JOBFILE</div>` +
    `<p style="font-size:16px;line-height:1.5;white-space:pre-wrap">${esc(opts.text)}</p>` +
    (opts.link
      ? `<p style="margin-top:24px"><a href="${esc(opts.link)}" style="background:#1B56E0;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;display:inline-block">${esc(opts.cta ?? 'Open the project')}</a></p>`
      : '') +
    `<p style="color:#55657C;font-size:12px;margin-top:32px">You can change how you get alerts in Settings.` +
    (opts.unsubscribe ? ` <a href="${esc(opts.unsubscribe)}" style="color:#55657C">Unsubscribe from tips and local news</a>.` : '') +
    `</p></div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html, text: `${opts.text}\n\n${opts.link ?? ''}${opts.unsubscribe ? `\n\nUnsubscribe from tips and local news: ${opts.unsubscribe}` : ''}`, ...(opts.unsubscribe ? { headers: { 'List-Unsubscribe': `<${opts.unsubscribe}>` } } : {}) }),
    });
    if (!r.ok) return { ok: false, error: `Email failed (${r.status}): ${(await r.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Email failed: ${(e as Error).message}` };
  }
}

/** Send one text through Twilio. Skips quietly when Twilio is not configured. */
export async function sendSms(opts: { to: string; text: string }): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return { ok: false, skipped: 'Text messages are not configured' };

  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: opts.to, From: from, Body: opts.text }).toString(),
    });
    if (!r.ok) return { ok: false, error: `Text failed (${r.status}): ${(await r.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Text failed: ${(e as Error).message}` };
  }
}

type Alert = {
  userIds: string[];
  /** Null for messages that are not about one project (admin broadcasts). */
  projectId: string | null;
  kind: string;
  title: string;
  body: string;
  /** Page to open instead of the project, for example /marketplace/bids. */
  path?: string;
  /** Email button text. Defaults to "Open the project". */
  cta?: string;
  /** Send email even if the person turned alerts off (admin notices). */
  force?: boolean;
  /** Skip email and text if this person already got one for this project in the last few minutes. */
  throttle?: boolean;
  /** Admin tips and local news: in-app only, no email or text. */
  inAppOnly?: boolean;
};

/**
 * Record an in-app notification for each person, then email and/or text them
 * according to their settings. Failures are stored on the notification, never thrown.
 */
export async function notifyUsers(a: Alert) {
  if (!a.userIds.length) return;
  const admin = supabaseAdmin();
  const link = a.path ? `${APP_URL()}${a.path}` : `${APP_URL()}${alertHref(a.projectId, a.kind)}`;

  const { data: profiles } = await admin
    .from('profiles')
    .select('id,email,phone,notify_email,notify_sms,sms_consent_at,banned_at')
    .in('id', a.userIds);

  await Promise.allSettled(
    (profiles ?? []).filter((p) => !p.banned_at).map(async (p) => {
      const { data: row } = await admin
        .from('notifications')
        .insert({ user_id: p.id, project_id: a.projectId, kind: a.kind, title: a.title, body: a.body })
        .select('id')
        .single();
      if (!row) return;

      let quiet = false;
      if (a.throttle && a.projectId) {
        const since = new Date(Date.now() - 5 * 60_000).toISOString();
        const { count } = await admin
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', p.id)
          .eq('project_id', a.projectId)
          .gt('created_at', since)
          .or('email_sent_at.not.is.null,sms_sent_at.not.is.null');
        quiet = (count ?? 0) > 0;
      }

      const update: Record<string, string> = {};
      const errors: string[] = [];

      if (!quiet && !a.inAppOnly && (p.notify_email || a.force) && p.email) {
        const r = await sendEmail({ to: p.email, subject: a.title, text: a.body, link, cta: a.cta, unsubscribe: a.kind === 'admin' ? unsubLink(APP_URL(), p.id as string) : undefined });
        if (r.ok) update.email_sent_at = new Date().toISOString();
        else if (r.error) errors.push(r.error);
      }
      if (!quiet && !a.inAppOnly && p.notify_sms && p.phone && p.sms_consent_at) {
        // Texts carry no message content. The details stay behind the login.
        const r = await sendSms({ to: p.phone, text: `${a.title}\n${link}\nReply STOP to opt out.` });
        if (r.ok) update.sms_sent_at = new Date().toISOString();
        else if (r.error) errors.push(r.error);
      }
      if (errors.length) update.error = errors.join(' | ');
      if (Object.keys(update).length) await admin.from('notifications').update(update).eq('id', row.id);
    }),
  );
}

/** Tell the other side of a project about something the sender just did. */
export async function notifyOtherSide(opts: {
  projectId: string;
  senderId: string;
  senderRole: 'contractor' | 'homeowner';
  kind: string;
  title: (projectName: string) => string;
  body: string;
  throttle?: boolean;
}) {
  const admin = supabaseAdmin();
  const { data: project } = await admin
    .from('projects')
    .select('id,name,company_id,homeowner_email')
    .eq('id', opts.projectId)
    .single();
  if (!project) return;

  const { data: members } = await admin.from('project_members').select('user_id,role').eq('project_id', project.id);
  const { data: staff } = await admin.from('company_members').select('user_id').eq('company_id', project.company_id);

  const homeowners = (members ?? []).filter((m) => m.role === 'homeowner').map((m) => m.user_id as string);
  const contractors = [
    ...(members ?? []).filter((m) => m.role === 'contractor').map((m) => m.user_id as string),
    ...(staff ?? []).map((s) => s.user_id as string),
  ];

  const ids = Array.from(new Set(opts.senderRole === 'contractor' ? homeowners : contractors)).filter(
    (id) => id !== opts.senderId,
  );
  const title = opts.title(project.name);

  await notifyUsers({ userIds: ids, projectId: project.id, kind: opts.kind, title, body: opts.body, throttle: opts.throttle });

  // The homeowner has not signed in yet. Send the invite again so the alert is not lost.
  if (opts.senderRole === 'contractor' && homeowners.length === 0 && project.homeowner_email) {
    await sendEmail({
      to: project.homeowner_email,
      subject: title,
      text: `${opts.body}\n\nSign in with this email address (${project.homeowner_email}) to see the project and reply.`,
      link: `${APP_URL()}/login?email=${encodeURIComponent(project.homeowner_email)}`,
    });
  }
}

export { APP_URL };
