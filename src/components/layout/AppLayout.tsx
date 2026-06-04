import { Header } from './Header';
import { FrameSidebar } from '../sidebar/FrameSidebar';
import { MapCanvas } from '../canvas/MapCanvas';
import { InfoBoard } from '../infoboard/InfoBoard';

export function AppLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <Header />
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <div className="grid h-full min-h-[min(100%,640px)] min-w-[880px] grid-cols-[minmax(200px,248px)_minmax(320px,1fr)_minmax(240px,308px)] gap-px bg-metal-shadow">
          <FrameSidebar />
          <MapCanvas />
          <InfoBoard />
        </div>
      </div>
    </div>
  );
}
