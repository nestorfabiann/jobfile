import Link from 'next/link';
import { redirect } from 'next/navigation';
import { myOwnedCompany, SERVICES, LANGUAGES, PAYMENTS, INSURANCE_KINDS, signedUrls, fmtDate, isCurrent, type InsuranceKind } from '@/lib/companyProfile';
import { supabaseAdmin } from '@/lib/supabase/server';
import { WorkPhotoUploader, InsuranceUploader } from '@/components/BusinessUploaders';
import { saveBusinessProfile, deleteBusinessPhoto, removeInsurance, linkGoogleRating, unlinkGoogleRating } from './actions';
import { googleConfigured } from '@/lib/googleRatings';
import BusinessTabs from '@/components/BusinessTabs';
import ProfileMeter from '@/components/ProfileMeter';
import { profileMeter } from '@/lib/profileMeter';
import AvailabilityForm from '@/components/AvailabilityForm';
import { JOB_TYPES, marketplaceEnabled } from '@/lib/marketplace';
import { CRED_KINDS, credIcon, credShort, type Credential } from '@/lib/credentials';
import { addCredential, removeCredential } from './credActions';
import IdCheckUploader from '@/components/IdCheckUploader';
import { cancelIdCheck } from './idActions';

export const dynamic = 'force-dynamic';

export default async function Business({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  const me = await myOwnedCompany();
  if (!me) {
    redirect('/settings?error=Only+a+company+owner+can+edit+the+business+profile.');
    return null;
  }
  const db = supabaseAdmin();
  const [{ data: c }, { data: photos }, { data: ins }] = await Promise.all([
    db.from('companies').select('*').eq('id', me.companyId).single<any>(),
    db.from('company_photos').select('id,path,caption').eq('company_id', me.companyId).order('created_at'),
    db.from('company_insurance').select('*').eq('company_id', me.companyId),
  ]);
  const urls = await signedUrls('company-photos', [...(photos ?? []).map((p) => p.path as string), ...(c?.logo_path ? [c.logo_path as string] : [])]);
  let creds: Credential[] = [];
  try { creds = ((await db.from('company_credentials').select('*').eq('company_id', me.companyId).order('created_at')).data ?? []) as Credential[]; } catch { /* table not created yet */ }
  let idc: any = null;
  try { idc = (await db.from('company_id_checks').select('status,verified_at,review_note,created_at').eq('company_id', me.companyId).maybeSingle()).data; } catch { /* table not created yet */ }
  const insBy = new Map((ins ?? []).map((i: any) => [i.kind as string, i]));
  const has = (arr: string[] | null | undefined, v: string) => (arr ?? []).includes(v);

  const pm = await profileMeter(me.companyId);
  let gr: any = null;
  if (googleConfigured()) {
    try { gr = (await db.from('company_ratings').select('*').eq('company_id', me.companyId).eq('source', 'google').maybeSingle()).data; } catch { gr = null; }
  }

  return (
    <>
      <div className="stack">
        <Link href="/settings" className="small">‹ Settings</Link>
        <h1>Business profile</h1>
        {marketplaceEnabled() && <BusinessTabs active="profile" />}
        <p className="muted">Homeowners see this on your public page. Do not put phone numbers or emails in it. Your contact details are shared only after a homeowner works with you.</p>
      </div>
      {searchParams.saved ? <div className="box ok">Saved.</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      <ProfileMeter pct={pm.pct} items={pm.items} always />
      <Link className="btn ghost" href={`/contractors/${me.companyId}`}>Preview public page</Link>

      {marketplaceEnabled() && (
        <section className="card" aria-label="Availability">
          <h2 id="bp-availability" style={{ scrollMarginTop: 80 }}>Availability</h2>
          <AvailabilityForm company={c ?? {}} back="/settings/business" />
        </section>
      )}

      {googleConfigured() && (
        <section className="card" aria-label="Your ratings elsewhere">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <h2 id="bp-ratings" style={{ scrollMarginTop: 80, margin: 0 }}>Bring your Google reviews with you</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rt2-logo" src="/brand/google-maps.png" alt="Google Maps" width={64} height={57} style={{ width: 64, flex: 'none', margin: 0 }} />
          </div>
          <p className="muted">Homeowners see your Google rating right beside your Jobfile score, on your profile and on your bids. It is never mixed into the Jobfile score.</p>
          {gr ? (
            <div className="stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span><b>{gr.place_name}</b><br /><span className="muted small">{gr.place_address}</span></span>
                <span className={`pill ${gr.status === 'approved' ? 'ok' : 'warn'}`}>{gr.status === 'approved' ? 'Showing' : 'Waiting for review'}</span>
              </div>
              {gr.status === 'approved' && gr.rating != null && <p className="muted small">Google shows {Number(gr.rating).toFixed(1)} from {gr.review_count} reviews. Updated daily.</p>}
              {gr.status === 'approved' && gr.rating != null && <p className="muted small" style={{ margin: 0 }}>Rating and reviews from Google Maps</p>}
              {gr.status === 'pending' && <p className="muted small">The name or ZIP did not match your business, so an admin will look at it. It will show once approved.</p>}
              <form action={unlinkGoogleRating}><button type="submit" className="btn ghost">Remove link</button></form>
            </div>
          ) : (
            <form action={linkGoogleRating} className="stack">
              <label className="fld">Google Maps link, or your business name and city<input name="google_link" maxLength={400} placeholder="https://maps.app.goo.gl/..." /></label>
              <p className="muted small">In Google Maps, open your business, tap Share, and paste the link here.</p>
              <button type="submit" className="btn">Link Google page</button>
            </form>
          )}
        </section>
      )}

      <form action={saveBusinessProfile} className="card">
        <h2 id="bp-about" style={{ scrollMarginTop: 80 }}>About your business</h2>
        <label className="fld">Business name<input name="name" defaultValue={c?.name ?? ''} maxLength={120} required /></label>
        <label className="fld">Description (up to 800 characters)<textarea name="about" rows={5} maxLength={800} defaultValue={c?.about ?? ''} /></label>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted">Services</legend>
          <div className="chips">
            {SERVICES.map((s) => (
              <label className="chip" key={s}><input type="checkbox" name="services" value={s} defaultChecked={has(c?.services, s)} /><span>{s}</span></label>
            ))}
          </div>
        </fieldset>
        <div className="grid2">
          <label className="fld">{marketplaceEnabled() ? 'How far you travel (miles from your ZIP)' : 'Service area (miles)'}<input name="service_radius_mi" inputMode="numeric" defaultValue={c?.service_radius_mi ?? ''} /></label>
          <label className="fld">Year started<input name="year_started" inputMode="numeric" defaultValue={c?.year_started ?? ''} placeholder="2016" /></label>
          <label className="fld">Crew size<input name="crew_size" inputMode="numeric" defaultValue={c?.crew_size ?? ''} /></label>
          <label className="fld">Workmanship warranty<input name="warranty" maxLength={120} defaultValue={c?.warranty ?? ''} placeholder="2 years" /></label>
          <label className="fld">Hours<input name="hours" maxLength={120} defaultValue={c?.hours ?? ''} placeholder="Mon–Sat 7am–6pm" /></label>
          <label className="fld">License or registration (your own words)<input name="license_note" maxLength={160} defaultValue={c?.license_note ?? ''} placeholder="Texas business registration, EPA lead-safe certified" /></label>
        </div>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted">Languages spoken</legend>
          <div className="chips">{LANGUAGES.map((s) => <label className="chip" key={s}><input type="checkbox" name="languages" value={s} defaultChecked={has(c?.languages, s)} /><span>{s}</span></label>)}</div>
        </fieldset>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small muted">Payment methods you accept</legend>
          <div className="chips">{PAYMENTS.map((s) => <label className="chip" key={s}><input type="checkbox" name="payments" value={s} defaultChecked={has(c?.payments, s)} /><span>{s}</span></label>)}</div>
        </fieldset>
        {marketplaceEnabled() && (
          <>
            <h2 id="bp-where" style={{ scrollMarginTop: 80 }}>Where you work</h2>
            <input type="hidden" name="matching" value="1" />
            <label className="fld">Business ZIP code<input name="business_zip" inputMode="numeric" maxLength={5} defaultValue={c?.business_zip ?? ''} placeholder="75074" /></label>
            <p className="muted small">Marketplace jobs show how far away they are, and you only get alerts for jobs inside your travel distance (25 miles if you leave it blank). Distances are straight-line estimates.</p>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="small muted">Jobs you want (leave all unchecked to see every type)</legend>
              <div className="chips">{Object.keys(JOB_TYPES).map((s) => <label className="chip" key={s}><input type="checkbox" name="trades" value={s} defaultChecked={has(c?.trades, s)} /><span>{s}</span></label>)}</div>
            </fieldset>
            <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <input type="checkbox" name="job_alerts" defaultChecked={c?.job_alerts ?? true} />
              <span>Alert me about new jobs<span className="muted small" style={{ display: 'block' }}>In the app and by email when a matching job is posted. At most 10 a day.</span></span>
            </label>
          </>
        )}
        <h2>Find you online</h2>
        <div className="grid2">
          <label className="fld">Website<input name="website" defaultValue={c?.website ?? ''} placeholder="yourcompany.com" /></label>
          <label className="fld">Facebook page<input name="facebook" defaultValue={c?.facebook ?? ''} placeholder="facebook.com/yourpage" /></label>
          <label className="fld">Instagram<input name="instagram" defaultValue={c?.instagram ?? ''} placeholder="@yourhandle" /></label>
          <label className="fld">Google, Yelp or other link<input name="other_link" defaultValue={c?.other_link ?? ''} /></label>
        </div>
        <div className="row"><button className="btn" type="submit">Save profile</button></div>
      </form>

      <div className="card">
        <h2 id="bp-logo" style={{ scrollMarginTop: 80 }}>Logo</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c?.logo_path && urls.get(c.logo_path) ? <img src={urls.get(c.logo_path)} alt="" width={72} height={72} style={{ borderRadius: 16, objectFit: 'cover' }} /> : <p className="muted small">No logo yet.</p>}
        <WorkPhotoUploader kind="logo" label="Choose a logo image" />
      </div>

      <div className="card">
        <h2 id="bp-photos" style={{ scrollMarginTop: 80 }}>Photos of your work ({(photos ?? []).length}/24)</h2>
        <p className="muted small">Only upload photos of your own work. Avoid showing house numbers, faces or license plates.</p>
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
          {(photos ?? []).map((p) => (
            <form key={p.id} action={deleteBusinessPhoto} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input type="hidden" name="id" value={p.id} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {urls.get(p.path as string) ? <img src={urls.get(p.path as string)} alt={(p.caption as string) || 'Work photo'} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12 }} /> : null}
              <span className="small muted">{p.caption}</span>
              <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px' }}>Remove</button>
            </form>
          ))}
        </div>
        <WorkPhotoUploader kind="work" label="Choose photos (up to 8 at a time)" />
      </div>

      <div className="card">
        <h2 id="bp-ins" style={{ scrollMarginTop: 80 }}>Proof of insurance</h2>
        <p className="muted small">Your certificate is private. Only you and Jobfile admins can open the file. Homeowners see only an &ldquo;Insurance verified&rdquo; badge and the expiry date, after an admin approves it. The badge is not a guarantee, so homeowners should still confirm coverage themselves.</p>
      </div>
      {(Object.keys(INSURANCE_KINDS) as InsuranceKind[]).map((k) => {
        const i: any = insBy.get(k);
        return (
          <div className="card" key={k}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{INSURANCE_KINDS[k]}{k === 'workers_comp' ? ' (optional)' : ''}</b>
              {i && (i.status === 'approved' ? (isCurrent(i) ? <span className="pill ok">Verified until {fmtDate(i.expires_on)}</span> : <span className="pill bad">Expired {fmtDate(i.expires_on)}</span>) : i.status === 'pending' ? <span className="pill warn">Pending review</span> : <span className="pill bad">Rejected</span>)}
            </div>
            {i?.status === 'rejected' && i.review_note ? <div className="box bad">Reviewer note: {i.review_note}</div> : null}
            {i && <p className="muted small">{[i.carrier, i.coverage && `Coverage ${i.coverage}`, `Expires ${fmtDate(i.expires_on)}`].filter(Boolean).join(' · ')}</p>}
            <InsuranceUploader kind={k} defaults={i ? { carrier: i.carrier, coverage: i.coverage, expires_on: i.expires_on } : undefined} />
            {i && (
              <form action={removeInsurance}><input type="hidden" name="kind" value={k} /><button className="btn ghost">Delete this certificate</button></form>
            )}
          </div>
        );
      })}

      <div className="card">
        <h2 id="bp-cred" style={{ scrollMarginTop: 80 }}>Credentials</h2>
        <p className="muted small">Homeowners trust businesses they can check. Add your BBB page, chamber or trade group, manufacturer certifications, EPA lead-safe, or a license. A link to your own listing is the best proof. Names show as text with a link, so please do not upload logos.</p>
        {creds.map((x) => (
          <div className="row" key={x.id} style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <b>{x.name}</b>
              <div className="muted small">{credShort(x.kind)}{x.expires_on ? ` · expires ${fmtDate(x.expires_on)}` : ''}{x.link ? ' · link added' : ''}{x.proof_path ? ' · proof uploaded' : ''}</div>
              {x.status === 'rejected' && <div className="box bad">Jobfile could not check this{x.review_note ? `: ${x.review_note}` : '.'} It is hidden from your profile.</div>}
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              {x.status === 'checked' ? <span className="pill ok">✓ Checked</span> : x.status === 'rejected' ? <span className="pill bad">Hidden</span> : <span className="pill warn">Stated by you</span>}
              <form action={removeCredential}><input type="hidden" name="id" value={x.id} /><button className="small" style={{ background: 'none', border: 0, color: 'var(--ink-2)', textDecoration: 'underline', cursor: 'pointer' }}>Remove</button></form>
            </div>
          </div>
        ))}
        <form action={addCredential} className="stack" style={{ gap: 10 }}>
          <b className="small">Add a credential</b>
          <label className="fld">Kind
            <select name="kind" defaultValue="bbb">{CRED_KINDS.map(([k, , long]) => <option key={k} value={k}>{long}</option>)}</select>
          </label>
          <label className="fld">Name
            <input name="name" required maxLength={100} placeholder="e.g. BBB Accredited Business, Sherwin-Williams Pro" />
          </label>
          <label className="fld">Link to your listing (best)
            <input name="link" inputMode="url" placeholder="https://" />
          </label>
          <label className="fld">Or upload proof (PDF or photo)
            <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            <span className="muted small">Proof files are private. Only you and Jobfile admins can open them.</span>
          </label>
          <label className="fld">Expires (if it does)
            <input name="expires_on" type="date" />
          </label>
          <button className="btn" type="submit">Add credential</button>
          <p className="muted small" style={{ margin: 0 }}>It shows right away as &ldquo;Stated by contractor.&rdquo; After a Jobfile admin checks your link or proof, it shows &ldquo;Checked by Jobfile.&rdquo;</p>
        </form>
      </div>

      <div className="card">
        <h2 id="bp-id" style={{ scrollMarginTop: 80 }}>Verify your identity</h2>
        <p className="muted small">Optional. Homeowners see an &ldquo;ID verified&rdquo; badge, never your ID. It confirms a real person owns this business. It does not show a license or insurance.</p>
        {idc?.status === 'verified' ? (
          <div className="box ok">✓ ID verified{idc.verified_at ? ` · ${new Date(idc.verified_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''}. We do not keep your photo.</div>
        ) : idc?.status === 'pending' ? (
          <>
            <div className="box">Waiting for a Jobfile admin to check it. We will tell you when it is done.</div>
            <form action={cancelIdCheck}><button className="btn ghost">Withdraw and delete my photo</button></form>
          </>
        ) : (
          <>
            {idc?.status === 'rejected' && <div className="box bad">Jobfile could not verify it{idc.review_note ? `: ${idc.review_note}` : '.'} Your photo was deleted. You can try again.</div>}
            <IdCheckUploader />
          </>
        )}
      </div>
    </>
  );
}
