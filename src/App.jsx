import { Routes, Route, NavLink } from 'react-router-dom';
import InventoryForm from './pages/InventoryForm';
import VoiceBilling from './pages/VoiceBilling';

function App() {
  return (
    <>
      <nav className="navbar">
        <NavLink 
          to="/" 
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          Add Stock
        </NavLink>
        <NavLink 
          to="/voice-billing" 
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          Voice Billing
        </NavLink>
      </nav>

      <main className="app-container">
        <Routes>
          <Route path="/" element={<InventoryForm />} />
          <Route path="/voice-billing" element={<VoiceBilling />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
