import { useState, useEffect } from 'react';
import { Mic, Package, BookOpen, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ credit: 0, paid: 0, balance: 0 });
  const [lowStockCount, setLowStockCount] = useState(0);
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMonthStats = async (userId) => {
    try {
      const date = new Date();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from('past_bills').select('total_amount, is_credit')
        .eq('user_id', userId).gte('created_at', firstDay);
      if (error) throw error;
      let totalCredit = 0, totalPaid = 0;
      (data || []).forEach(bill => {
        const amount = parseFloat(bill.total_amount) || 0;
        if (bill.is_credit) totalCredit += amount; else totalPaid += amount;
      });
      setStats({ credit: totalCredit, paid: totalPaid, balance: totalCredit });
    } catch (e) { console.error(e); }
  };

  const fetchLowStockCount = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_stock').select('current_stock, low_stock_limit').eq('user_id', userId);
      if (error) throw error;
      setLowStockCount((data || []).filter(i => i.current_stock <= i.low_stock_limit).length);
    } catch (e) { console.error(e); }
  };

  const fetchRecentBills = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('past_bills').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(4);
      if (error) throw error;
      setRecentBills(data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const userId = localStorage.getItem('demoUserId');
        if (userId) await Promise.all([fetchMonthStats(userId), fetchLowStockCount(userId), fetchRecentBills(userId)]);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const fmt = (n) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${Math.round(n)}`;
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', paddingBottom: '80px' }}>

      {/* ── Header ─────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(145deg, #0d47a1 0%, #1565c0 60%, #1976d2 100%)',
        padding: '1.25rem 1.25rem 1.5rem',
        borderBottomLeftRadius: '24px',
        borderBottomRightRadius: '24px',
        boxShadow: '0 8px 24px rgba(13,71,161,0.28)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.25)' }}>
              <Mic size={18} color="white" />
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>SmartDukan</div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.68rem' }}>दुकानदार सहायक</div>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.72rem' }}>
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </div>
        </div>

        {/* Stats — flat number row, no glass boxes */}
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.18)', paddingTop: '1rem', marginTop: '0.25rem' }}>
          {[
            { label: 'उधार दिया', value: stats.credit },
            { label: 'नकद जमा', value: stats.paid },
            { label: 'बकाया', value: Math.max(0, stats.balance) },
          ].map(({ label, value }, i) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.18)' : 'none', padding: '0 0.25rem' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {loading ? '—' : fmt(value)}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.82)', fontWeight: 500, marginTop: '5px' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.25rem 0' }}>

        {/* Low stock alert */}
        {!loading && lowStockCount > 0 && (
          <div className="warning-banner" onClick={() => navigate('/inventory')} style={{ marginBottom: '1.25rem' }}>
            <AlertTriangle size={15} color="#d97706" />
            <span style={{ flex: 1, fontSize: '0.82rem' }}><strong>{lowStockCount} सामान</strong> का स्टॉक कम है</span>
            <ChevronRight size={14} />
          </div>
        )}

        {/* Primary CTA */}
        <div
          onClick={() => navigate('/voice-billing')}
          style={{
            background: 'linear-gradient(135deg, #1a56db 0%, #1d4ed8 100%)',
            borderRadius: '16px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            cursor: 'pointer',
            marginBottom: '0.75rem',
            boxShadow: '0 4px 16px rgba(26,86,219,0.3)',
          }}
        >
          <div style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.18)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(255,255,255,0.25)' }}>
            <Mic size={22} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>नया बिल बनाएं</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: '2px' }}>बोलकर बिल — हिंदी या English</div>
          </div>
          <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
        </div>

        {/* Secondary actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.5rem' }}>
          {[
            { icon: <Package size={20} color="#1a56db" />, bg: '#eff6ff', label: 'स्टॉक', sub: 'Inventory', path: '/inventory' },
            { icon: <BookOpen size={20} color="#1a56db" />, bg: '#eff6ff', label: 'ग्राहक खाता', sub: 'Ledger', path: '/reports' },
          ].map(({ icon, bg, label, sub, path }) => (
            <div
              key={path}
              onClick={() => navigate(path)}
              style={{ background: 'white', borderRadius: '14px', padding: '1rem', border: '1px solid #e2e8f0', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <div style={{ width: 38, height: 38, background: bg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{label}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent bills */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>हाल के बिल</span>
          <button onClick={() => navigate('/past-bills')} style={{ background: 'none', border: 'none', color: '#1a56db', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
            सभी देखें <ChevronRight size={13} />
          </button>
        </div>

        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginBottom: '1.25rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>लोड हो रहा है...</div>
          ) : recentBills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8' }}>
              <TrendingUp size={28} style={{ opacity: 0.2, display: 'block', margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.82rem' }}>अभी तक कोई बिल नहीं</p>
            </div>
          ) : (
            recentBills.map((bill, idx) => (
              <div
                key={bill.id}
                onClick={() => navigate('/past-bills')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: idx < recentBills.length - 1 ? '1px solid #f8fafc' : 'none', cursor: 'pointer' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {bill.customer_name || 'नकद ग्राहक'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                    {fmtDate(bill.created_at)} · {bill.bill_details?.length || 0} आइटम
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em', color: bill.is_credit ? '#dc2626' : '#16a34a' }}>
                    {fmt(parseFloat(bill.total_amount))}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: bill.is_credit ? '#dc2626' : '#16a34a', marginTop: '1px', opacity: 0.8 }}>
                    {bill.is_credit ? 'उधार' : 'नकद'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
