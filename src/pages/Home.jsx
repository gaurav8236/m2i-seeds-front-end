import { useState, useEffect } from 'react';
import { FileText, Package, BarChart2, Users, AlertTriangle, ChevronRight, ArrowUpRight } from 'lucide-react';
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
        .from('past_bills')
        .select('total_amount, is_credit')
        .eq('user_id', userId)
        .gte('created_at', firstDay);

      if (error) throw error;

      let totalCredit = 0;
      let totalPaid = 0;
      
      if (data) {
        data.forEach(bill => {
          const amount = parseFloat(bill.total_amount) || 0;
          if (bill.is_credit) {
            totalCredit += amount;
          } else {
            totalPaid += amount;
          }
        });
      }

      setStats({
        credit: totalCredit,
        paid: totalPaid,
        balance: totalCredit // Outstanding balance is total credit
      });
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    }
  };

  const fetchLowStockCount = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_stock')
        .select('current_stock, low_stock_limit')
        .eq('user_id', userId);

      if (error) throw error;

      if (data) {
        const lowItems = data.filter(item => item.current_stock <= item.low_stock_limit);
        setLowStockCount(lowItems.length);
      }
    } catch (e) {
      console.error('Error fetching low stock count:', e);
    }
  };

  const fetchRecentBills = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('past_bills')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentBills(data || []);
    } catch (e) {
      console.error('Error fetching recent bills:', e);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('demoUserId');
      if (!userId) {
        // Fallback: fetch the first user from the DB
        const { data: users } = await supabase.from('users').select('id').limit(1);
        if (users && users.length > 0) {
          const id = users[0].id;
          localStorage.setItem('demoUserId', id);
          await loadAllStats(id);
        }
      } else {
        await loadAllStats(userId);
      }
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllStats = async (userId) => {
    await Promise.all([
      fetchMonthStats(userId),
      fetchLowStockCount(userId),
      fetchRecentBills(userId)
    ]);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', paddingBottom: '100px' }}>
      
      {/* Header */}
      <div style={{ 
        backgroundColor: 'var(--primary-blue)', 
        padding: '1.8rem 1rem', 
        borderBottomLeftRadius: '20px', 
        borderBottomRightRadius: '20px', 
        color: 'white',
        boxShadow: 'var(--shadow-md)'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', color: 'white' }}>दुकानदार सहायक</h1>
        <p style={{ margin: 0, opacity: 0.85, fontSize: '0.9rem', marginTop: '4px' }}>डैशबोर्ड (Dashboard)</p>
      </div>

      <div style={{ padding: '1rem' }}>
        
        {/* Low Stock Warning Banner */}
        {!loading && lowStockCount > 0 && (
          <div 
            className="warning-banner"
            onClick={() => navigate('/inventory')}
          >
            <AlertTriangle size={18} />
            <div style={{ flexGrow: 1 }}>
              आपके <strong>{lowStockCount} सामान</strong> का स्टॉक कम है!
            </div>
            <ChevronRight size={16} />
          </div>
        )}

        {/* Top Summary Tiles (Gradient Style) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <div className="dashboard-gradient-card credit">
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.9 }}>कुल उधार</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', marginTop: '4px' }}>₹{stats.credit.toFixed(0)}</div>
          </div>
          <div className="dashboard-gradient-card paid">
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.9 }}>कुल जमा</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', marginTop: '4px' }}>₹{stats.paid.toFixed(0)}</div>
          </div>
          <div className="dashboard-gradient-card balance">
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.9 }}>बकाया</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 'bold', marginTop: '4px' }}>₹{stats.balance.toFixed(0)}</div>
          </div>
        </div>

        {/* Action Tiles Grid */}
        <h2 style={{ fontSize: '1rem', color: 'var(--text-dark)', marginBottom: '0.8rem', fontWeight: '700' }}>क्विक एक्शन (Quick Actions)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.8rem' }}>
          
          <div 
            onClick={() => navigate('/voice-billing')}
            style={{ 
              backgroundColor: 'white', 
              padding: '1.2rem', 
              borderRadius: '16px', 
              boxShadow: 'var(--shadow-sm)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer', 
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s'
            }}
            className="action-card"
          >
            <div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '50%' }}>
              <FileText size={24} color="var(--primary-blue)" />
            </div>
            <span style={{ fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}>नया बिल</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(New Bill)</span>
          </div>

          <div 
            onClick={() => navigate('/inventory')}
            style={{ 
              backgroundColor: 'white', 
              padding: '1.2rem', 
              borderRadius: '16px', 
              boxShadow: 'var(--shadow-sm)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer', 
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s'
            }}
            className="action-card"
          >
            <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '50%' }}>
              <Package size={24} color="#16a34a" />
            </div>
            <span style={{ fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}>स्टॉक प्रबंधन</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Stock)</span>
          </div>

          <div 
            onClick={() => navigate('/past-bills')}
            style={{ 
              backgroundColor: 'white', 
              padding: '1.2rem', 
              borderRadius: '16px', 
              boxShadow: 'var(--shadow-sm)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer', 
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s'
            }}
            className="action-card"
          >
            <div style={{ backgroundColor: '#fef2f2', padding: '10px', borderRadius: '50%' }}>
              <BarChart2 size={24} color="#dc2626" />
            </div>
            <span style={{ fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}>सेल्स इतिहास</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Sales History)</span>
          </div>

          <div 
            onClick={() => navigate('/reports')}
            style={{ 
              backgroundColor: 'white', 
              padding: '1.2rem', 
              borderRadius: '16px', 
              boxShadow: 'var(--shadow-sm)', 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '0.5rem', 
              cursor: 'pointer', 
              border: '1px solid #e5e7eb',
              transition: 'all 0.2s'
            }}
            className="action-card"
          >
            <div style={{ backgroundColor: '#fdf4ff', padding: '10px', borderRadius: '50%' }}>
              <Users size={24} color="#c026d3" />
            </div>
            <span style={{ fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}>ग्राहक खाता</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Ledger)</span>
          </div>

        </div>

        {/* Recent Activity stream */}
        <h2 style={{ fontSize: '1rem', color: 'var(--text-dark)', marginBottom: '0.8rem', fontWeight: '700' }}>हाल के बिल (Recent Bills)</h2>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>लोड हो रहा है...</div>
          ) : recentBills.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
              <FileText size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem' }}>कोई हालिया बिल नहीं मिला।</p>
            </div>
          ) : (
            <div>
              {recentBills.map(bill => (
                <div 
                  key={bill.id} 
                  className="activity-item"
                  onClick={() => navigate('/past-bills')}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-dark)' }}>
                      {bill.customer_name || 'नकद ग्राहक (Cash Sales)'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatDate(bill.created_at)} • {bill.bill_details?.length || 0} आइटम
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ 
                      fontWeight: 'bold', 
                      fontSize: '0.95rem',
                      color: bill.is_credit ? 'var(--danger)' : 'var(--success)'
                    }}>
                      ₹{parseFloat(bill.total_amount).toFixed(2)}
                    </span>
                    <ArrowUpRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
