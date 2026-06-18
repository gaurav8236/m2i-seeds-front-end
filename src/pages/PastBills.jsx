import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ArrowLeft, FileText, Calendar, Search, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Helper: get date boundary for each filter ---
function getStartDate(period) {
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  return null; // 'all' — no filter
}

export default function PastBills() {
  const [allBills, setAllBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState('month'); // 'today' | 'week' | 'month' | 'all'
  const navigate = useNavigate();

  const fetchPastBills = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('demoUserId');
      if (!userId) return;

      const { data, error } = await supabase
        .from('past_bills')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllBills(data || []);
    } catch (e) {
      console.error('Error fetching bills:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPastBills();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // --- Apply period filter ---
  const startDate = getStartDate(period);
  const periodFiltered = startDate
    ? allBills.filter(b => new Date(b.created_at) >= new Date(startDate))
    : allBills;

  // --- Apply search filter ---
  const displayedBills = periodFiltered.filter(bill => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchCustomer = bill.customer_name?.toLowerCase().includes(q);
    const matchItem = bill.bill_details?.some(item =>
      item.item_name?.toLowerCase().includes(q)
    );
    return matchCustomer || matchItem;
  });

  // --- Compute summary stats ---
  const summary = periodFiltered.reduce((acc, bill) => {
    const amt = parseFloat(bill.total_amount) || 0;
    acc.total += amt;
    if (bill.is_credit) acc.credit += amt;
    else acc.cash += amt;
    return acc;
  }, { total: 0, cash: 0, credit: 0 });

  const PERIOD_LABELS = { today: 'आज', week: 'इस सप्ताह', month: 'इस महीने', all: 'सभी' };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        background: 'var(--primary-gradient)',
        padding: '1.25rem 1rem 1.5rem',
        borderBottomLeftRadius: '20px',
        borderBottomRightRadius: '20px',
        boxShadow: '0 4px 20px rgba(13,71,161,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
      }}>
        <button onClick={() => navigate('/voice-billing')} style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'white', flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.01em' }}>पिछले बिल</div>
          <div style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.78rem', marginTop: '2px' }}>Sales History</div>
        </div>
      </div>

      <div style={{ padding: '1rem', paddingBottom: '80px' }}>

        {/* Period filter chips */}
        <div className="filter-chips-wrapper" style={{ marginBottom: '1rem' }}>
          {['today', 'week', 'month', 'all'].map(p => (
            <button
              key={p}
              className={`filter-chip-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Sales Summary Card */}
        {!loading && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e5e7eb',
            boxShadow: 'var(--shadow-sm)',
            padding: '1.2rem',
            marginBottom: '1rem'
          }} className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <TrendingUp size={18} color="var(--primary-blue)" />
              <span style={{ fontWeight: '700', color: 'var(--text-dark)', fontSize: '0.95rem' }}>
                {PERIOD_LABELS[period]} का सारांश ({displayedBills.length} बिल)
              </span>
            </div>
            <div className="card-metrics-grid">
              <div className="metric-cell">
                <div className="metric-label">कुल बिक्री (Total)</div>
                <div className="metric-value" style={{ color: 'var(--primary-blue)' }}>₹{summary.total.toFixed(0)}</div>
              </div>
              <div className="metric-cell">
                <div className="metric-label">नकद बिक्री (Cash)</div>
                <div className="metric-value" style={{ color: 'var(--success)' }}>₹{summary.cash.toFixed(0)}</div>
              </div>
              <div className="metric-cell" style={{ gridColumn: 'span 2' }}>
                <div className="metric-label">उधार बिक्री (Credit Given)</div>
                <div className="metric-value" style={{ color: 'var(--danger)' }}>₹{summary.credit.toFixed(0)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="search-filter-section" style={{ marginBottom: '1rem' }}>
          <div className="search-input-container" style={{ marginBottom: 0 }}>
            <Search className="search-icon-left" size={18} />
            <input
              type="text"
              className="search-field"
              placeholder="ग्राहक या आइटम नाम से खोजें..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Bills List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>लोड हो रहा है...</div>
        ) : displayedBills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <FileText size={42} style={{ margin: '0 auto', marginBottom: '1rem', opacity: 0.3 }} />
            <p style={{ fontWeight: 600 }}>कोई बिल नहीं मिला।</p>
            <p style={{ fontSize: '0.8rem' }}>इस अवधि में कोई लेनदेन नहीं हुआ।</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayedBills.map((bill) => (
              <div key={bill.id} className="product-card animate-fade-in" style={{ borderLeft: `4px solid ${bill.is_credit ? 'var(--danger)' : 'var(--success)'}` }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'var(--text-dark)' }}>
                      ₹{parseFloat(bill.total_amount).toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <Calendar size={13} /> {formatDate(bill.created_at)}
                    </div>
                    {bill.customer_name && (
                      <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        👤 {bill.customer_name}
                        {bill.is_credit && (
                          <span style={{ backgroundColor: '#fee2e2', color: 'var(--danger)', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '12px' }}>उधार</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`status-badge ${bill.is_credit ? 'status-low' : 'status-ok'}`} style={{ display: 'block', marginBottom: '6px' }}>
                      {bill.is_credit ? 'उधार' : 'नकद'}
                    </span>
                    <span style={{ color: 'var(--primary-blue)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {expandedBillId === bill.id ? 'छिपाएं ▲' : 'विवरण ▼'}
                    </span>
                  </div>
                </div>

                {expandedBillId === bill.id && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <tbody>
                        {bill.bill_details.map((item, i) => (
                          <tr key={i} style={{ borderBottom: '1px dotted #f3f4f6' }}>
                            <td style={{ padding: '5px 0', color: 'var(--text-dark)', fontWeight: 500 }}>{item.item_name}</td>
                            <td style={{ padding: '5px 0', textAlign: 'center', color: 'var(--text-muted)' }}>x{item.quantity_billed}</td>
                            <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-blue)' }}>₹{item.item_total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
