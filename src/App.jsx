import { Routes, Route, NavLink } from 'react-router-dom';
import { Home as HomeIcon, Mic, Package, BookOpen } from 'lucide-react';
import InventoryForm from './pages/InventoryForm';
import VoiceBilling from './pages/VoiceBilling';
import PastBills from './pages/PastBills';
import Home from './pages/Home';
import Reports from './pages/Reports';

function App() {
  return (
    <main className="app-container">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/voice-billing" element={<VoiceBilling />} />
        <Route path="/inventory" element={<InventoryForm />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/past-bills" element={<PastBills />} />
      </Routes>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="icon-wrapper"><HomeIcon size={20} /></div>
          <span>होम</span>
        </NavLink>

        <NavLink to="/voice-billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="icon-wrapper"><Mic size={20} /></div>
          <span>बिक्री</span>
        </NavLink>

        <NavLink to="/inventory" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="icon-wrapper"><Package size={20} /></div>
          <span>स्टॉक</span>
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="icon-wrapper"><BookOpen size={20} /></div>
          <span>खाता</span>
        </NavLink>
      </nav>
    </main>
  );
}

export default App;
