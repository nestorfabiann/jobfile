import { setAvailability } from '@/app/settings/business/availabilityActions';
import { availabilityOf } from '@/lib/availability';

/** Three choices and a date. Plain form, no script needed. */
export default function AvailabilityForm({ company, back }: { company: { availability?: string | null; booked_until?: string | null }; back: '/projects' | '/settings/business' }) {
  const a = availabilityOf(company);
  const opts: [string, string, string][] = [
    ['open', 'Taking new jobs', 'You show up in Find contractors and get alerts for jobs that match.'],
    ['booked', 'Booked until a date', 'You stay visible with a "Booked until" tag and get no new-job alerts. It switches back on its own.'],
    ['paused', 'Paused', 'Hidden from Find contractors, no alerts. Current projects keep working.'],
  ];
  const min = new Date(Date.now() + 86400_000).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  return (
    <form action={setAvailability} className="stack">
      <input type="hidden" name="back" value={back} />
      <div className="chips">
        {opts.map(([v, l]) => (
          <label className={`chip av-${v}`} key={v}><input type="radio" name="mode" value={v} defaultChecked={a.mode === v} /><span>{l}</span></label>
        ))}
      </div>
      <label className="fld">Booked until<input type="date" name="until" min={min} defaultValue={a.until ?? ''} /></label>
      <p className="muted small" style={{ margin: 0 }}>You can still bid on a job and run your current projects whichever you pick. Homeowners can still open your profile unless you are Paused.</p>
      <button className="btn" type="submit">Save availability</button>
    </form>
  );
}
