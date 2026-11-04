import { requireUser } from '@/lib/session';
import Link from 'next/link';
import { saveSettings } from './actions';
import { myOwnedCompany } from '@/lib/companyProfile';
import PushSettings from '@/components/PushAlerts';
import { asLang, translateEnabled } from '@/lib/translate';

export default async function Settings({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  const { sb, user } = await requireUser();
  const tOn = translateEnabled();
  const owned = await myOwnedCompany();
  const { data: p } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<any>();

  return (
    <>
      <div className="stack">
        <h1>Settings</h1>
        <p className="muted">{user.email}</p>
      </div>

      {searchParams.saved ? <div className="box ok">Saved.</div> : null}
      {searchParams.error ? <div className="box bad">{searchParams.error}</div> : null}

      {owned && (
        <div className="card">
          <h2>Business profile</h2>
          <p className="muted small">Add photos of your work, proof of insurance, your website and social links, and a description for homeowners.</p>
          <div className="row">
            <Link className="btn" href="/settings/business">Edit business profile</Link>
            <Link className="btn ghost" href={`/contractors/${owned.companyId}`}>View public page</Link>
          </div>
        </div>
      )}

      <PushSettings />

      <form action={saveSettings} className="card">
        <h2>You</h2>
        <div className="grid2">
          <label className="fld">
            Your name
            <input name="full_name" defaultValue={p?.full_name ?? ''} autoComplete="name" />
          </label>
          <label className="fld">
            Mobile phone (US)
            <input name="phone" defaultValue={p?.phone ?? ''} inputMode="tel" autoComplete="tel" placeholder="(512) 555-0100" />
          </label>
        </div>

        {p && 'zip' in p && (
          <label className="fld">
            Your ZIP code
            <input name="zip" defaultValue={p?.zip ?? ''} inputMode="numeric" maxLength={5} pattern="[0-9]{5}" placeholder="75074" autoComplete="postal-code" />
            <span className="muted small">Used to show contractors near you. Your street address is never shared.</span>
          </label>
        )}

        {tOn && (
          <>
            <h2>Language</h2>
            <p className="muted small">Pick the language you read best. Messages from the other person can be translated for you. Translations are made by AI and can be imperfect. The signed agreement stays in the language it was written in.</p>
            <label className="fld">
              I read
              <select name="language" defaultValue={asLang(p?.language)}>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
            <label className="row" style={{ flexWrap: 'nowrap' }}>
              <input type="checkbox" name="auto_translate" defaultChecked={p?.auto_translate ?? true} />
              <span>Translate new messages automatically</span>
            </label>
          </>
        )}

        {p && 'marketing_email' in p && (
          <>
            <h2>Tips and local news</h2>
            <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <input type="checkbox" name="marketing_email" defaultChecked={p?.marketing_email ?? true} />
              <span className="small">Email me when contractors join my area or a project could get bids. Messages about your own projects always still arrive.</span>
            </label>
          </>
        )}

        <h2>How to alert you</h2>
        <p className="muted small">
          You are alerted about new messages, questions and decisions. Quick back-and-forth messages are grouped so you get at most one
          email or text every 5 minutes per project.
        </p>
        <label className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="checkbox" name="notify_email" defaultChecked={p?.notify_email ?? true} />
          <span>Email me</span>
        </label>
        <label className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="checkbox" name="notify_sms" defaultChecked={p?.notify_sms ?? false} />
          <span>Text me</span>
        </label>
        <label className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <input type="checkbox" name="sms_consent" defaultChecked={!!p?.sms_consent_at} />
          <span className="small">
            I agree to receive text alerts from Jobfile about my projects at this number. Message and data rates may apply. Reply STOP to
            opt out.
          </span>
        </label>
        <p className="muted small">Texts never include message content. They link back here so the details stay behind your login.</p>

        <div className="row">
          <button className="btn" type="submit">Save settings</button>
        </div>
      </form>
    </>
  );
}
