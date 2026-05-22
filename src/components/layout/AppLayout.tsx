import { Header } from './Header';
import { FrameSidebar } from '../sidebar/FrameSidebar';
import { MapCanvas } from '../canvas/MapCanvas';
import { InfoBoard } from '../infoboard/InfoBoard';

export function AppLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <Header />
      <div className="grid min-h-0 flex-1 grid-cols-[248px_1fr_308px] gap-px bg-metal-shadow">
        <FrameSidebar />
        <MapCanvas />
        <InfoBoard />
      </div>
    </div>
  );
}
