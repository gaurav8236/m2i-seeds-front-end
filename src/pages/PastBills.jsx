import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { ArrowLeft, FileText, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PastBills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBillId, setExpandedBillId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPastBills();
  }, []);

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
      setBills(data || []);
    } catch (e) {
      console.error('Error fetching bills:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <ArrowLeft size={24} color="var(--primary-blue)" onClick={() => navigate('/voice-billing')} style={{ cursor: 'pointer' }} />
        <span style={{ fontWeight: 'bold', color: 'var(--primary-blue)', fontSize: '1.2rem' }}>पिछले बिल (Past Bills)</span>
      </div>

      <div style={{ padding: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>लोड हो रहा है...</div>
        ) : bills.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', backgroundColor: 'white', borderRadius: '8px' }}>
            <FileText size={48} style={{ margin: '0 auto', marginBottom: '1rem', opacity: 0.5 }} />
            <p>कोई पिछला बिल नहीं मिला। (No past bills found)</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {bills.map((bill) => (
              <div key={bill.id} style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1rem', border: '1px solid #e5e7eb', boxShadow: 'var(--shadow-sm)' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedBillId(expandedBillId === bill.id ? null : bill.id)}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-dark)' }}>
                      ₹{parseFloat(bill.total_amount).toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <Calendar size={14} /> {formatDate(bill.created_at)}
                    </div>
                    {bill.customer_name && (
                      <div style={{ marginTop: '4px', fontSize: '0.85rem', color: 'var(--primary-blue)' }}>
                        👤 {bill.customer_name} {bill.is_credit && <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>(उधार)</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ color: 'var(--primary-blue)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    {expandedBillId === bill.id ? 'छिपाएं' : 'विवरण देखें'}
                  </div>
                </div>

                {expandedBillId === bill.id && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                    <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                      <tbody>
                        {bill.bill_details.map((item, i) => (
                          <tr key={i}>
                            <td style={{ padding: '4px 0' }}>{item.item_name}</td>
                            <td style={{ padding: '4px 0', textAlign: 'center' }}>x {item.quantity_billed}</td>
                            <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 'bold' }}>₹{item.item_total}</td>
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
