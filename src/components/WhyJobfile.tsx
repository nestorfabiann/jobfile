import Link from 'next/link';
import { setWhy } from '@/app/projects/actions';

type Item = [string, string, string];

/** Benefits card at the top of Projects. Open until the person hides it; the choice is remembered in a cookie. */
export default function WhyJobfile({ role, hidden, marketplace }: { role: 'homeowner' | 'contractor'; hidden: boolean; marketplace: boolean }) {
  const home = role === 'homeowner';
  const items: Item[] = home
    ? [
        ['📄', 'Price and scope agreed in writing', 'You and your contractor both approve the scope and price before work starts, so nobody argues about what was promised later.'],
        ['📷', 'Dated photos of the work', 'Progress photos pile up in one place, with the date on each one. Useful for you, and for any dispute.'],
        ['💵', 'Payments tracked, never in doubt', 'Every payment request and payment is recorded against the agreed milestones, so you always know what is paid and what is left. Jobfile does not move money.'],
        ['✏️', 'Changes in writing', 'Extra work becomes a change order you approve first, so the final bill has no surprises.'],
        ['💬', 'All messages in one place', 'No lost texts. The whole conversation stays with the job.'],
        ['⭐', 'Honest ratings', 'After the job, you both rate each other. Good contractors earn a public record.'],
      ]
    : [
        ['📄', 'Customers sign off before you start', 'Scope and price approved in writing, so you get paid for what was agreed.'],
        ['💵', 'Request payments by milestone', 'Ask for each payment when the work is done. Both sides see what is paid and what is next.'],
        ['✏️', 'Change orders you can bill', 'Extra work is approved before you do it, with the price attached.'],
        ['📷', 'Proof of the work', 'Dated photos show what you finished and when.'],
        ['🛡️', 'A profile that wins bids', 'Insurance badge, work photos and real ratings show up on every bid you send.'],
        ...(marketplace ? ([['📍', 'Jobs near you', 'Local jobs come to you, with an AI price reference to help you bid fairly.']] as Item[]) : []),
      ];
  const steps = home ? ['1 Pick a contractor', '2 Agree price and scope', '3 Track the work', '4 Close out and rate'] : ['1 Finish your profile', '2 Bid on local jobs', '3 Run the job here', '4 Get rated'];

  if (hidden) {
    return (
      <form action={setWhy}>
        <input type="hidden" name="show" value="1" />
        <button type="submit" className="why-mini"><span>Why run the job in Jobfile?</span><span>Show ›</span></button>
      </form>
    );
  }
  return (
    <section className="card why" aria-label="Why run the job in Jobfile">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="lbl">Why run the job in Jobfile</span>
        <form action={setWhy}><button type="submit" className="linkbtn" style={{ color: 'var(--ink-2)', fontSize: 13 }}>Hide</button></form>
      </div>
      <h2 style={{ fontSize: 23 }}>{home ? 'One shared record that protects you both' : 'Win the job, then run it without the paperwork'}</h2>
      <div className="stack" style={{ gap: 12 }}>
        {items.map(([icon, title, text]) => (
          <div key={title} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }}>
            <span className="why-ic" aria-hidden="true">{icon}</span>
            <p style={{ margin: 0 }}><b>{title}</b><span className="muted small" style={{ display: 'block' }}>{text}</span></p>
          </div>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }}>{steps.map((s) => <span className="pill" key={s}>{s}</span>)}</div>
      <Link className="btn" href={home ? '/invites/new' : '/settings/business'}>{home ? 'Start a project and invite a contractor' : 'Finish your business profile'}</Link>
    </section>
  );
}
