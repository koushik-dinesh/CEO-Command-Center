import { Outlet } from 'react-router-dom';
import Breadcrumbs from '../components/navigation/Breadcrumbs';
import ExecutiveNav from '../components/navigation/ExecutiveNav';
import { CommandCenterProvider } from '../context/CommandCenterContext';

export default function ExecutiveLayout() {
  return (
    <CommandCenterProvider>
      <div className="terminal-page">
        <ExecutiveNav />
        <main className="exec-main mx-auto max-w-[1440px] px-5 py-5 lg:px-7">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </CommandCenterProvider>
  );
}
