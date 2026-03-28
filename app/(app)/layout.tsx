import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NavBar from '@/components/ui/NavBar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />
      {/* Desktop: offset for top nav. Mobile: offset for bottom nav */}
      <main className="md:pt-16 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
