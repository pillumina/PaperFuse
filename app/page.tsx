import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { HomeContent } from '@/components/home-content';
import { getTopics } from '@/lib/topics';

export default function HomePage() {
  // Fetch topics on server side
  const topics = getTopics();

  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </main>
    }>
      <HomeContent serverTopics={topics} />
    </Suspense>
  );
}
