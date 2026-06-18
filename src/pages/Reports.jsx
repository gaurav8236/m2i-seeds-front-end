import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Users, Calendar, ChevronDown, ChevronUp, Search, X, IndianRupee, AlertTriangle } from 'lucide-react';

// Threshold above which customer balance shows a high-balance warning
const HIGH_BALANCE_THRESHOLD = 5000;

export default function Reports() {
  const [customers, setCustomers] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Modal
  const [paymentModal, setPaymentModal] = useState(null); // { name, total_due }
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const fetchCustomerLedger = async () => {
    try {
      setLoading(true);
      const userId = localStorage.getItem('demoUserId');
      if (!userId) return;

      const { data, error } = await supabase
        .from('past_bills')
        .select('*')
        .eq('user_id', userId)
        .not('customer_name', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group all bills (credit and payments) by customer name
      const grouped = {};
      if (data) {
        data.forEach(bill => {
          const name = bill.customer_name?.trim();
          if (!name) return;
          
          if (!grouped[name]) {
            grouped[name] = { total_due: 0, bills: [] };
          }
          // is_credit=true → money owed by customer
          // is_credit=false (from payment recording) → money paid back by customer
          const amount = parseFloat(bill.total_amount) || 0;
          if (bill.is_credit) {
            grouped[name].total_due += amount;
          } else {
            grouped[name].total_due -= amount; // payment reduces balance
          }
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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomerLedger();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Record a payment — writes a non-credit bill entry for the customer
  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      alert('कृपया एक वैध राशि दर्ज करें।');
      return;
    }

    try {
      setPaymentLoading(true);
      const userId = localStorage.getItem('demoUserId');
      if (!userId) return;

      const RAILWAY_CHECKOUT_URL = 'https://web-production-55116.up.railway.app/voice-checkout/';

      const payload = {
        user_id: userId,
        total_bill_amount: amount,
        discount_amount: 0,
        customer_name: paymentModal.name,
        is_credit: false, // False = cash payment / settlement
        items: [{
          stock_id: null,
          new_stock: null,
          item_name: 'भुगतान (Payment Received)',
          quantity_billed: 1,
          price_per_unit: amount,
          item_total: amount,
          error: false
        }]
      };

      const response = await fetch(RAILWAY_CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errText}`);
      }

      alert(`₹${amount} का भुगतान ${paymentModal.name} के खाते में दर्ज हो गया!`);
      setPaymentModal(null);
      setPaymentAmount('');
      fetchCustomerLedger(); // Refresh
    } catch (e) {
      alert('भुगतान दर्ज करने में त्रुटि: ' + e.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const filteredCustomers = Object.entries(customers).filter(([name]) =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', paddingBottom: '100px' }}>
      
      {/* Header */}
      <div style={{ 
        backgroundColor: 'var(--primary-blue)', 
        padding: '1.5rem 1rem', 
        borderBottomLeftRadius: '16px', 
        borderBottomRightRadius: '16px', 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        <Users size={26} color="white" />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', color: 'white' }}>ग्राहक खाता</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem', marginTop: '2px' }}>Customer Ledger</p>
        </div>
      </div>

      <div style={{ padding: '1rem' }}>

        {/* Search Bar */}
        <div className="search-filter-section">
          <div className="search-input-container" style={{ marginBottom: 0 }}>
            <Search className="search-icon-left" size={18} />
            <input 
              type="text" 
              className="search-field"
              placeholder="ग्राहक का नाम खोजें..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>लोड हो रहा है...</div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', backgroundColor: 'white', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <Users size={42} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p style={{ fontWeight: 600 }}>कोई उधार खाता नहीं मिला।</p>
            <p style={{ fontSize: '0.85rem' }}>(No credit customers found)</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredCustomers.map(([name, customerData]) => {
              const isExpanded = expandedCustomer === name;
              const isHighBalance = customerData.total_due >= HIGH_BALANCE_THRESHOLD;
              const balance = Math.max(0, customerData.total_due);

              return (
                <div key={name} className={`product-card ${isHighBalance ? 'low-stock' : 'in-stock'} animate-fade-in`}>
                  
                  {/* Customer Card Header */}
                  <div 
                    onClick={() => setExpandedCustomer(isExpanded ? null : name)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {name}
                        {isHighBalance && (
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '3px',
                            backgroundColor: '#fef3c7', 
                            color: '#92400e', 
                            fontSize: '0.65rem', 
                            fontWeight: 700,
                            padding: '2px 7px', 
                            borderRadius: '12px',
                            border: '1px solid #fde68a'
                          }}>
                            <AlertTriangle size={10} /> HIGH
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {customerData.bills.length} लेनदेन (transactions)
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: balance > 0 ? '#b91c1c' : 'var(--success)' }}>
                          ₹{balance.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {balance > 0 ? 'बकाया (Due)' : 'क्लियर (Cleared)'}
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp size={20} color="var(--text-muted)" /> : <ChevronDown size={20} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {/* Action buttons when expanded */}
                  {isExpanded && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                      
                      {/* Record Payment Button */}
                      {balance > 0 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setPaymentModal({ name, total_due: balance }); setPaymentAmount(''); }}
                          style={{
                            width: '100%',
                            padding: '10px',
                            marginBottom: '1rem',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            color: '#166534',
                            fontWeight: 'bold',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          <IndianRupee size={16} /> जमा करें (Record Payment)
                        </button>
                      )}

                      <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--primary-blue)', fontSize: '0.85rem', fontWeight: '700' }}>लेन-देन विवरण (Transactions)</h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {customerData.bills.map((bill) => (
                          <div key={bill.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', padding: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={13} /> {formatDate(bill.created_at)}
                              </span>
                              <span style={{ 
                                fontWeight: 'bold', 
                                color: bill.is_credit ? '#b91c1c' : '#166534',
                                backgroundColor: bill.is_credit ? '#fee2e2' : '#dcfce7',
                                padding: '1px 8px',
                                borderRadius: '12px'
                              }}>
                                {bill.is_credit ? '+' : '-'}₹{parseFloat(bill.total_amount).toFixed(2)}
                                <span style={{ fontWeight: 400, marginLeft: '4px', fontSize: '0.7rem' }}>
                                  {bill.is_credit ? '(उधार)' : '(जमा)'}
                                </span>
                              </span>
                            </div>
                            
                            <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                              <tbody>
                                {bill.bill_details.map((item, idx) => (
                                  <tr key={idx}>
                                    <td style={{ padding: '2px 0', color: 'var(--text-dark)' }}>{item.item_name}</td>
                                    <td style={{ padding: '2px 0', textAlign: 'center', color: 'var(--text-muted)' }}>x{item.quantity_billed}</td>
                                    <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: '600' }}>₹{item.item_total}</td>
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

      {/* Payment Modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-dark)' }}>भुगतान दर्ज करें</h2>
              <button 
                onClick={() => setPaymentModal(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2px' }}>ग्राहक (Customer)</div>
              <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{paymentModal.name}</div>
              <div style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '4px' }}>
                कुल बकाया: ₹{paymentModal.total_due.toFixed(2)}
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '6px', display: 'block' }}>
                राशि दर्ज करें (Enter Payment Amount)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--primary-blue)', borderRadius: '8px', overflow: 'hidden' }}>
                <span style={{ padding: '0.75rem', backgroundColor: '#eff6ff', color: 'var(--primary-blue)', fontWeight: 'bold', fontSize: '1.1rem' }}>₹</span>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  style={{ flex: 1, padding: '0.75rem', border: 'none', fontSize: '1.1rem', outline: 'none', fontWeight: '600' }}
                  autoFocus
                />
              </div>
              {/* Quick amounts */}
              <div className="preset-discounts" style={{ marginTop: '10px' }}>
                {[100, 200, 500, 1000].map(amt => (
                  <button key={amt} className="preset-discount-btn" onClick={() => setPaymentAmount(String(amt))}>
                    ₹{amt}
                  </button>
                ))}
                <button 
                  className="preset-discount-btn" 
                  style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}
                  onClick={() => setPaymentAmount(String(paymentModal.total_due.toFixed(2)))}
                >
                  पूरा (Full)
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', backgroundColor: 'var(--success)', border: 'none' }}
              onClick={handleRecordPayment}
              disabled={paymentLoading}
            >
              {paymentLoading ? 'सहेज रहे हैं...' : '✓ भुगतान दर्ज करें (Confirm Payment)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
