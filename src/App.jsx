import { Routes, Route, NavLink } from 'react-router-dom';
import { Home as HomeIcon, FileText, Package, BarChart2 } from 'lucide-react';
import InventoryForm from './pages/InventoryForm';
import VoiceBilling from './pages/VoiceBilling';
import PastBills from './pages/PastBills';
import Home from './pages/Home';
import Reports from './pages/Reports';

function App() {
  return (
    <>
      <main className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/voice-billing" element={<VoiceBilling />} />
          <Route path="/inventory" element={<InventoryForm />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/past-bills" element={<PastBills />} />
        </Routes>
        
        {/* Mobile Bottom Navigation Bar */}
        <nav className="bottom-nav">
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <HomeIcon size={22} />
            </div>
            <span>होम</span>
          </NavLink>

          <NavLink to="/voice-billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <FileText size={22} />
            </div>
            <span>बिक्री</span>
          </NavLink>

          <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <Package size={22} />
            </div>
            <span>स्टॉक</span>
          </NavLink>

          <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <BarChart2 size={22} />
            </div>
            <span>रिपोर्ट</span>
          </NavLink>
        </nav>
      </main>
    </>
  );
}

export default App;
