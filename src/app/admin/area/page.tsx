import { requireAdmin } from '@/lib/admin';
import AreaMessage from '@/components/AreaMessage';

export const dynamic = 'force-dynamic';

export default async function Area() {
  await requireAdmin();
  return (
    <>
      <h1>Message by area</h1>
      <p className="muted small">
        Pick a ZIP code and a radius, then message the contractors (by business ZIP) or homeowners (by the ZIP on their profile or on a project they posted) inside it. Suspended accounts are skipped, each send is limited to 200 people and recorded in the audit log.
      </p>
      <AreaMessage />
    </>
  );
}
