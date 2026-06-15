import { AppLayout } from './components/layout/AppLayout';
import { LocalDisplaySettingsProvider } from './context/LocalDisplaySettingsContext';
import { ProjectProvider } from './context/ProjectContext';

export default function App() {
  return (
    <LocalDisplaySettingsProvider>
      <ProjectProvider>
        <AppLayout />
      </ProjectProvider>
    </LocalDisplaySettingsProvider>
  );
}
