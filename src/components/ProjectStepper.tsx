import Link from 'next/link';

type Step = { label: string; href: string };

/** Progress for the project page: numbered steps joined by a line, plus where the job is right now. */
export default function ProjectStepper({ steps, stage, phase, days, paid, total, next, paidLabel, check }: {
  steps: Step[]; stage: number;
  phase?: string; days?: string; paid: string; total: string; next?: string; paidLabel: string;
  check?: { done: number; of: number };
}) {
  const pctPaid = total && Number(total) > 0 ? Math.min(100, Math.round((Number(paid) / Number(total)) * 100)) : 0;
  const cl = stage === 2 && check && check.of > 0;
  const pct = cl ? Math.round(((check as { done: number; of: number }).done / (check as { done: number; of: number }).of) * 100) : null;
  return (
    <section className="pstep" aria-label="Project progress">
      <ol className="pst">
        {steps.map((s, i) => (
          <li key={s.label} className={i < stage ? 'done' : i === stage ? 'now' : ''} aria-current={i === stage ? 'step' : undefined}>
            <Link href={s.href} aria-label={s.label}><i>{i < stage ? '✓' : i + 1}</i><span>{s.label}</span></Link>
          </li>
        ))}
      </ol>
      {stage < 3 && (phase || cl) ? (
        <div className="pwhere">
          <div className="p1"><b>{cl ? 'Final checks' : phase}</b><span>{cl ? `${(check as { done: number; of: number }).done} of ${(check as { done: number; of: number }).of} done` : days}</span></div>
          <div className="pbar"><i style={{ width: `${cl ? pct : pctPaid}%` }} /></div>
        </div>
      ) : null}
      {stage >= 1 ? (
        <div className="pmn"><span><b>{paidLabel}</b></span>{next ? <span>{next}</span> : null}</div>
      ) : null}
    </section>
  );
}
