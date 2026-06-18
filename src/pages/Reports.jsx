import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

export default function Reports() {
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedCustomer, setExpandedCustomer] = useState(null);

  useEffect(() => {
    fetchCustomerLedger();
  }, []);

  const fetchCustomerLedger = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('demoUserId');
      if (!userId) return;

      // Fetch all credit bills that have a customer name attached
      const { data, error } = await supabase
        .from('past_bills')
        .select('*')
        .eq('user_id', userId)
        .eq('is_credit', true)
        .not('customer_name', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group bills by customer name
      const grouped = {};
      if (data) {
        data.forEach(bill => {
          const name = bill.customer_name.trim();
          if (!name) return;
          
          if (!grouped[name]) {
            grouped[name] = {
              total_due: 0,
              bills: []
            };
          }
          grouped[name].total_due += parseFloat(bill.total_amount) || 0;
          grouped[name].bills.push(bill);
        });
      }

      setCustomers(grouped);
    } catch (e) {
      console.error('Error fetching ledger:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const customerNames = Object.keys(customers);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', paddingBottom: '100px' }}>
      
      {/* Header */}
      <div style={{ backgroundColor: 'var(--primary-blue)', padding: '1.5rem 1rem', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Users size={24} color="white" />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>ग्राहक खाता</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem', marginTop: '2px' }}>Customer Ledger</p>
        </div>
      </div>

      <div style={{ padding: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>लोड हो रहा है...</div>
        ) : customerNames.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', backgroundColor: 'white', borderRadius: '8px' }}>
            <p>कोई उधार खाता नहीं मिला।</p>
            <p style={{ fontSize: '0.85rem' }}>(No credit customers found)</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {customerNames.map(name => {
              const customerData = customers[name];
              const isExpanded = expandedCustomer === name;

              return (
                <div key={name} style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  
                  {/* Customer Card Header */}
                  <div 
                    onClick={() => setExpandedCustomer(isExpanded ? null : name)}
                    style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : 'white' }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-dark)' }}>{name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {customerData.bills.length} उधार बिल (Credit Bills)
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#b91c1c' }}>
                        ₹{customerData.total_due.toFixed(2)}
                      </div>
                      {isExpanded ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {/* Expanded Bill Details */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#fafafa', padding: '1rem' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-blue)', fontSize: '0.9rem' }}>लेन-देन विवरण (Transaction Details)</h4>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {customerData.bills.map((bill) => (
                          <div key={bill.id} style={{ border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: 'white', padding: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {formatDate(bill.created_at)}</span>
                              <span style={{ fontWeight: 'bold', color: '#b91c1c' }}>बकाया: ₹{parseFloat(bill.total_amount).toFixed(2)}</span>
                            </div>
                            
                            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                              <tbody>
                                {bill.bill_details.map((item, idx) => (
                                  <tr key={idx}>
                                    <td style={{ padding: '2px 0', color: 'var(--text-dark)' }}>{item.item_name}</td>
                                    <td style={{ padding: '2px 0', textAlign: 'center', color: 'var(--text-muted)' }}>x {item.quantity_billed}</td>
                                    <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: '500' }}>₹{item.item_total}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
