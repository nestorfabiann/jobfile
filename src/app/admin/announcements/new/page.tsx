import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import AnnouncementForm from '@/components/AnnouncementForm';

export const dynamic = 'force-dynamic';

export default async function NewAnnouncement({ searchParams }: { searchParams: { error?: string } }) {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/announcements" className="small">‹ Announcements</Link>
      <h1>New announcement</h1>
      {searchParams.error ? <div className="box bad" role="alert">{searchParams.error}</div> : null}
      <AnnouncementForm />
    </>
  );
}
