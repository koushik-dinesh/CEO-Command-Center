import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ExecutiveLayout from './layouts/ExecutiveLayout';
import CommandCenterPage from './pages/CommandCenterPage';
import DashboardPage from './pages/DashboardPage';
import DriveExplorerPage from './pages/DriveExplorerPage';
import LoginPage from './pages/LoginPage';
import RevenueDrilldownPage from './pages/revenue-drilldown';
import RevenueIntelligencePage from './pages/intelligence/RevenueIntelligencePage';
import ProfitabilityIntelligencePage from './pages/intelligence/ProfitabilityIntelligencePage';
import InventoryIntelligencePage from './pages/intelligence/InventoryIntelligencePage';
import InventoryDaysIntelligencePage from './pages/intelligence/InventoryDaysIntelligencePage';
import DeadStockIntelligencePage from './pages/intelligence/DeadStockIntelligencePage';
import PbtIntelligencePage from './pages/intelligence/PbtIntelligencePage';
import CopqIntelligencePage from './pages/intelligence/CopqIntelligencePage';
import ProductivityIntelligencePage from './pages/intelligence/ProductivityIntelligencePage';
import PbtMaintenancePage from './pages/finance/PbtMaintenancePage';

function ProtectedLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="terminal-page flex min-h-screen items-center justify-center text-secondary-theme">Loading command center...</div>;
  }
  return user ? <ExecutiveLayout /> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<CommandCenterPage />} />
        <Route path="/intelligence/revenue" element={<RevenueIntelligencePage />} />
        <Route path="/intelligence/profitability" element={<ProfitabilityIntelligencePage />} />
        <Route path="/intelligence/inventory" element={<InventoryIntelligencePage />} />
        <Route path="/intelligence/inventory-days" element={<InventoryDaysIntelligencePage />} />
        <Route path="/intelligence/dead-stock" element={<DeadStockIntelligencePage />} />
        <Route path="/intelligence/profit-before-tax" element={<PbtIntelligencePage />} />
        <Route path="/intelligence/copq" element={<CopqIntelligencePage />} />
        <Route path="/intelligence/productivity" element={<ProductivityIntelligencePage />} />
        <Route path="/finance/profit-before-tax" element={<PbtMaintenancePage />} />
        <Route path="/legacy-dashboard" element={<DashboardPage />} />
        <Route path="/drive-explorer" element={<DriveExplorerPage />} />
        <Route path="/revenue-drilldown" element={<RevenueDrilldownPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
