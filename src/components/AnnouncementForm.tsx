'use client';

import { useState, useTransition } from 'react';
import { previewReach, saveAnnouncement } from '@/app/admin/announcements/actions';

const COLORS: [string, string][] = [['green', '#1f4d3a'], ['orange', '#c4813f'], ['blue', '#1b56e0'], ['violet', '#5b4bb0']];
const PAGES: [string, string][] = [
  ['/marketplace/new', 'Post a project'], ['/design', 'Design ideas'], ['/projects', 'Projects'], ['/marketplace', 'Marketplace'],
  ['/community', 'Community'], ['/collaborate', 'Collaborate'], ['/settings/business', 'Business profile'], ['/app', 'Get the app'],
];

export default function AnnouncementForm() {
  const [style, setStyle] = useState('banner');
  const [role, setRole] = useState('homeowners');
  const [activity, setActivity] = useState('any');
  const [zips, setZips] = useState('');
  const [color, setColor] = useState('green');
  const [mode, setMode] = useState('top');
  const [href, setHref] = useState('/marketplace/new');
  const [reach, setReach] = useState<string>('');
  const [pending, start] = useTransition();
  const count = () => start(async () => {
    const r = await previewReach({ role, zips, activity });
    setReach(r.ok ? `${r.count} ${r.count === 1 ? 'person' : 'people'} would see this` : r.error);
  });
  return (
    <form action={saveAnnouncement} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} encType="multipart/form-data">
      <div className="card">
        <h2>Message</h2>
        <label className="fld">Title<input name="title" maxLength={80} required placeholder="Painting season is open in Plano" /></label>
        <label className="fld">Message (optional)<textarea name="body" rows={3} maxLength={300} placeholder="Post your project and get bids from insured local pros. Free for homeowners." /></label>
        <label className="fld">Button text (optional)<input name="button_text" maxLength={30} placeholder="Post a project" /></label>
        <label className="fld">Button goes to
          <select value={PAGES.some(([p]) => p === href) ? href : 'custom'} onChange={(e) => setHref(e.target.value === 'custom' ? 'https://' : e.target.value)}>
            {PAGES.map(([p, l]) => <option key={p} value={p}>{l}</option>)}
            <option value="custom">A web address…</option>
          </select>
        </label>
        <label className="fld">Link<input name="button_href" value={href} onChange={(e) => setHref(e.target.value)} maxLength={300} /><span className="small muted">A Jobfile page that starts with / or a web address that starts with https://. Check it before you publish.</span></label>
      </div>

      <div className="card">
        <h2>Look</h2>
        <div className="chips" role="radiogroup" aria-label="Style">
          {([['banner', 'Hero banner'], ['sheet', 'Slide-up sheet'], ['picture', 'Your design']] as const).map(([k, l]) => (
            <label className="chip" key={k}><input type="radio" name="style" value={k} checked={style === k} onChange={() => setStyle(k)} /><span>{l}</span></label>
          ))}
        </div>
        {style === 'banner' ? (
          <div className="chips" role="radiogroup" aria-label="Color">
            {COLORS.map(([k, c]) => (
              <label className="chip" key={k}><input type="radio" name="color" value={k} checked={color === k} onChange={() => setColor(k)} /><span><i style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: c, marginRight: 6, verticalAlign: -2 }} />{k}</span></label>
            ))}
          </div>
        ) : <input type="hidden" name="color" value={color} />}
        {style !== 'banner' ? (
          <>
            <label className="fld">Picture{style === 'picture' ? '' : ' (optional)'}<input type="file" name="image" accept="image/jpeg,image/png,image/webp" /><span className="small muted">JPG, PNG or WebP, under 2 MB. About 1080 pixels wide works well.</span></label>
            <label className="fld">Describe the picture<input name="image_alt" maxLength={160} placeholder="Painting season promo: post your project in Plano" /><span className="small muted">Read aloud for people who cannot see it. Needed when you add a picture.</span></label>
            {style === 'picture' ? (
              <div className="chips" role="radiogroup" aria-label="How the picture shows">
                <label className="chip"><input type="radio" name="image_mode" value="full" checked={mode === 'full'} onChange={() => setMode('full')} /><span>Full picture</span></label>
                <label className="chip"><input type="radio" name="image_mode" value="top" checked={mode === 'top'} onChange={() => setMode('top')} /><span>Picture on top</span></label>
              </div>
            ) : <input type="hidden" name="image_mode" value="top" />}
          </>
        ) : <input type="hidden" name="image_mode" value="top" />}
        <label className="fld">Ends on (optional)<input type="date" name="ends_at" /><span className="small muted">It stops showing at the end of that day.</span></label>
      </div>

      <div className="card">
        <h2>Who sees it</h2>
        <div className="chips" role="radiogroup" aria-label="Role">
          {([['homeowners', 'Homeowners'], ['contractors', 'Contractors'], ['everyone', 'Everyone']] as const).map(([k, l]) => (
            <label className="chip" key={k}><input type="radio" name="role" value={k} checked={role === k} onChange={() => { setRole(k); setReach(''); }} /><span>{l}</span></label>
          ))}
        </div>
        <label className="fld">ZIP codes (optional)<input name="zips" value={zips} onChange={(e) => { setZips(e.target.value); setReach(''); }} placeholder="75074, 75075, 75023" /><span className="small muted">Leave empty for everywhere. Homeowners use the ZIP on their profile or their latest project. Contractors use their business ZIP.</span></label>
        <label className="fld">Activity (homeowners only)
          <select name="activity" value={activity} onChange={(e) => { setActivity(e.target.value); setReach(''); }}>
            <option value="any">Anyone</option><option value="posted">Posted 1+ project</option><option value="noproject">No project yet</option><option value="nobids">Has a project with no bids yet</option>
          </select>
        </label>
        <div className="row" style={{ alignItems: 'center', gap: 10 }}>
          <button type="button" className="btn ghost" onClick={count} disabled={pending}>{pending ? 'Counting…' : 'Count who would see it'}</button>
          {reach ? <b role="status">{reach}</b> : null}
        </div>
        <span className="small muted">The count never shows names. Each person sees it once and can close it. A new announcement waits a week after someone last saw one.</span>
      </div>

      <div className="row">
        <button className="btn accent" type="submit" name="intent" value="publish">Publish</button>
        <button className="btn ghost" type="submit" name="intent" value="draft">Save as draft</button>
      </div>
    </form>
  );
}
