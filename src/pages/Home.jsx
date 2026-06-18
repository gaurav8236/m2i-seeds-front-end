import { useState, useEffect } from 'react';
import { FileText, Package, BarChart2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ credit: 0, paid: 0, balance: 0 });

  useEffect(() => {
    fetchMonthStats();
  }, []);

  const fetchMonthStats = async () => {
    try {
      const userId = localStorage.getItem('demoUserId');
      if (!userId) return;

      // Get first day of current month
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
      
      // Calculate total credit and total paid given this month
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

      // Balance remains the total credit outstanding.
      const currentBalance = totalCredit;

      setStats({
        credit: totalCredit,
        paid: totalPaid,
        balance: currentBalance
      });
    } catch (e) {
      console.error('Error fetching dashboard stats:', e);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', paddingBottom: '100px' }}>
      
      {/* Header */}
      <div style={{ backgroundColor: 'var(--primary-blue)', padding: '1.5rem 1rem', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>दुकानदार सहायक</h1>
        <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem', marginTop: '4px' }}>डैशबोर्ड (Dashboard)</p>
      </div>

      <div style={{ padding: '1rem' }}>
        
        {/* Top Summary Tiles (Matching Screen 3 stats style) */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          <div style={{ flex: 1, backgroundColor: '#e0f2fe', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 'bold' }}>कुल उधार (Credit)</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0c4a6e', marginTop: '4px' }}>₹{stats.credit.toFixed(2)}</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#f3f4f6', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '0.75rem', color: '#4b5563', fontWeight: 'bold' }}>कुल जमा (Paid)</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1f2937', marginTop: '4px' }}>₹{stats.paid.toFixed(2)}</div>
          </div>
          <div style={{ flex: 1, backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '8px', textAlign: 'center', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 'bold' }}>बकाया (Balance)</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#7f1d1d', marginTop: '4px' }}>₹{stats.balance.toFixed(2)}</div>
          </div>
        </div>

        {/* Action Tiles Grid */}
        <h2 style={{ fontSize: '1rem', color: 'var(--text-dark)', marginBottom: '1rem' }}>क्विक एक्शन (Quick Actions)</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          
          <div 
            onClick={() => navigate('/voice-billing')}
            style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid #e5e7eb' }}
          >
            <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '50%' }}>
              <FileText size={28} color="var(--primary-blue)" />
            </div>
            <span style={{ fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}>नया बिल</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(New Bill)</span>
          </div>

          <div 
            onClick={() => navigate('/inventory')}
            style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid #e5e7eb' }}
          >
            <div style={{ backgroundColor: '#f0fdf4', padding: '12px', borderRadius: '50%' }}>
              <Package size={28} color="#16a34a" />
            </div>
            <span style={{ fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}>स्टॉक</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Inventory)</span>
          </div>

          <div 
            onClick={() => navigate('/past-bills')}
            style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid #e5e7eb' }}
          >
            <div style={{ backgroundColor: '#fef2f2', padding: '12px', borderRadius: '50%' }}>
              <BarChart2 size={28} color="#dc2626" />
            </div>
            <span style={{ fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}>सेल्स रिपोर्ट</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Sales Report)</span>
          </div>

          <div 
            onClick={() => navigate('/reports')}
            style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid #e5e7eb' }}
          >
            <div style={{ backgroundColor: '#fdf4ff', padding: '12px', borderRadius: '50%' }}>
              <Users size={28} color="#c026d3" />
            </div>
            <span style={{ fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}>ग्राहक खाता</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Customer Ledger)</span>
          </div>

        </div>
      </div>
    </div>
  );
}
