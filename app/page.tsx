import Sidebar from '@/components/Sidebar';
import Player from '@/components/Player';
import Lyrics from '@/components/Lyrics';
import Background from '@/components/Background';

export default function Home() {
  return (
    <div className="flex h-screen overflow-hidden bg-transparent font-sans relative">
      <Background />
      <Sidebar />
      <main className="flex-1 relative flex flex-col h-full z-10">
        {/* Header / Top Bar could go here if needed */}
        <div className="flex-1 overflow-hidden relative">
          <Lyrics />
        </div>
      </main>
      <Player />
    </div>
  );
}
