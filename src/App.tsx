import { AppLayout } from './components/layout/AppLayout';
import { ProjectProvider } from './context/ProjectContext';

export default function App() {
  return (
    <ProjectProvider>
      <AppLayout />
    </ProjectProvider>
  );
}
