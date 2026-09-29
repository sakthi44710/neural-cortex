import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Sidebar from '@/components/shared/Sidebar';
import Navbar from '@/components/shared/Navbar';
import CommandPalette from '@/components/shared/CommandPalette';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/signin');
  }

  // Check if Google OAuth user needs to set password (using session data, no extra DB call)
  const needsPassword = (session.user as any)?.needsPassword;
  if (needsPassword) {
    redirect('/set-password');
  }

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar user={session.user} />
        <main className="flex-1 overflow-y-auto p-6 neural-bg">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
