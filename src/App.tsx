import { AppLayout } from './components/layout/AppLayout';
import { MinecraftRecordingProvider } from './context/MinecraftRecordingContext';
import { ProjectProvider } from './context/ProjectContext';

export default function App() {
  return (
    <ProjectProvider>
      <MinecraftRecordingProvider>
        <AppLayout />
      </MinecraftRecordingProvider>
    </ProjectProvider>
  );
}
