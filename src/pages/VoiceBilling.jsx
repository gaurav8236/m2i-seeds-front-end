import { useState, useRef, useEffect } from 'react';
import { Mic, FileText, CheckCircle, ArrowLeft, Printer, History, Trash2, Plus, Package } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function VoiceBilling() {
  const [viewState, setViewState] = useState('input'); // input, settlement, success
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billDetails, setBillDetails] = useState(null);
  const [billPreview, setBillPreview] = useState(null);
  const [realtimeText, setRealtimeText] = useState("");
  const [stockList, setStockList] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  
  // Settlement fields
  const [isCredit, setIsCredit] = useState(false);
  const [customerName, setCustomerName] = useState('');

  // Autocomplete customer names states
  const [customerNamesList, setCustomerNamesList] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [filteredCustomerSuggestions, setFilteredCustomerSuggestions] = useState([]);
  const customerAutocompleteRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const audioChunksRef = useRef([]);

  const fetchCurrentStock = async () => {
    try {
      let userId = localStorage.getItem('demoUserId');
      if (!userId) {
        const { data: users } = await supabase.from('users').select('id').limit(1);
        if (users && users.length > 0) {
          userId = users[0].id;
          localStorage.setItem('demoUserId', userId);
        }
      }
      if (!userId) return;

      const { data } = await supabase
        .from('user_stock')
        .select(`id, current_stock, selling_price, low_stock_limit, master_inventory (item_name, category, unit)`)
        .eq('user_id', userId);

      if (data) setStockList(data);
    } catch (e) {
      console.error('Error fetching stock:', e);
    }
  };

  const fetchCustomerNames = async () => {
    try {
      const userId = localStorage.getItem('demoUserId');
      if (!userId) return;

      const { data, error } = await supabase
        .from('past_bills')
        .select('customer_name')
        .eq('user_id', userId)
        .not('customer_name', 'is', null);

      if (error) throw error;
      if (data) {
        // Find unique customer names
        const names = [...new Set(data.map(b => b.customer_name?.trim()).filter(Boolean))];
        setCustomerNamesList(names);
      }
    } catch (e) {
      console.error('Error fetching customer names:', e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCurrentStock();
      fetchCustomerNames();
    }, 0);
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setRealtimeText(currentTranscript);
      };
      
      recognitionRef.current = recognition;
    }

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Listen to clicking outside customer suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerAutocompleteRef.current && !customerAutocompleteRef.current.contains(event.target)) {
        setShowCustomerSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCustomerNameChange = (e) => {
    const val = e.target.value;
    setCustomerName(val);
    if (val.trim() === '') {
      setFilteredCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
    } else {
      const matches = customerNamesList.filter(name => 
        name.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredCustomerSuggestions(matches);
      setShowCustomerSuggestions(true);
    }
  };

  const selectCustomer = (name) => {
    setCustomerName(name);
    setShowCustomerSuggestions(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = handleAudioStop;
      mediaRecorderRef.current.start();
      
      setRealtimeText("");
      if (recognitionRef.current) recognitionRef.current.start();

      setIsRecording(true);
      setViewState('input');
      setBillPreview(null);
      setBillDetails(null);
    } catch (err) {
      console.error("Error accessing microphone", err);
      alert("Microphone access is required to use this feature.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (recognitionRef.current) recognitionRef.current.stop();
    }
  };

  const handleAudioStop = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      
      const demoUserId = localStorage.getItem('demoUserId');
      if (demoUserId) {
        formData.append('user_id', demoUserId);
      } else {
        throw new Error("No user ID found.");
      }

      formData.append('preview_only', 'true');

      const RAILWAY_API_URL = 'https://web-production-55116.up.railway.app/voice-search/';
      
      const response = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const data = await response.json();
      setBillPreview(data.results || []);
      setBillDetails({ spoken_text: data.spoken_text }); 

    } catch (error) {
      console.error('Error uploading audio:', error);
      alert(`Failed to process voice billing: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreviewEdit = (index, field, value) => {
    const updatedPreview = [...billPreview];
    updatedPreview[index][field] = value;
    
    if (field === 'quantity_billed' || field === 'price_per_unit') {
      const qty = parseFloat(updatedPreview[index].quantity_billed) || 0;
      const price = parseFloat(updatedPreview[index].price_per_unit) || 0;
      updatedPreview[index].item_total = qty * price;
      
      const currentStock = updatedPreview[index].current_stock || 0;
      updatedPreview[index].stock_remaining = currentStock - qty;
    }
    
    setBillPreview(updatedPreview);
  };

  const handleItemSelect = (index, selectedItemName) => {
    const updated = [...billPreview];
    updated[index].item_name = selectedItemName;
    
    const stockItem = stockList.find(s => s.master_inventory?.item_name === selectedItemName);
    if (stockItem) {
      updated[index].price_per_unit = parseFloat(stockItem.selling_price) || 0;
      updated[index].stock_id = stockItem.id;
      updated[index].current_stock = stockItem.current_stock;
      updated[index].error = false;
      
      const qty = parseFloat(updated[index].quantity_billed) || 0;
      updated[index].item_total = qty * updated[index].price_per_unit;
      updated[index].stock_remaining = updated[index].current_stock - qty;
    }
    
    setBillPreview(updated);
  };

  const handleRemoveItem = (index) => {
    const updated = [...billPreview];
    updated.splice(index, 1);
    setBillPreview(updated);
  };

  const handleAddBlankItem = () => {
    const newItems = billPreview ? [...billPreview] : [];
    newItems.push({
      item_name: '',
      quantity_billed: 1,
      price_per_unit: 0,
      item_total: 0,
      stock_remaining: 0,
      stock_id: null,
      current_stock: 0
    });
    setBillPreview(newItems);
  };

  const calculateSubTotal = () => {
    if (!billPreview) return 0;
    return billPreview.reduce((sum, item) => sum + (item.item_total || 0), 0);
  };

  const calculateGrandTotal = () => {
    return Math.max(0, calculateSubTotal() - discountAmount);
  };

  const handleFinalizeBill = async () => {
    try {
      setIsProcessing(true);
      
      const validItems = billPreview.filter(item => item.item_name && item.item_name.trim() !== '');
      
      const sanitizedItems = validItems.map(item => ({
        stock_id: item.stock_id || null,
        new_stock: item.stock_remaining !== undefined ? Math.max(0, item.stock_remaining) : null,
        item_name: item.item_name || 'Unknown Item',
        quantity_billed: parseFloat(item.quantity_billed) || 0,
        price_per_unit: parseFloat(item.price_per_unit) || 0,
        item_total: parseFloat(item.item_total) || 0,
        error: !!item.error
      }));

      const subTotal = validItems.reduce((sum, item) => sum + (item.item_total || 0), 0);
      const finalTotal = Math.max(0, subTotal - discountAmount);
      const RAILWAY_CHECKOUT_URL = 'https://web-production-55116.up.railway.app/voice-checkout/';

      const payload = {
        user_id: localStorage.getItem('demoUserId'),
        total_bill_amount: finalTotal,
        discount_amount: discountAmount,
        customer_name: customerName || null,
        is_credit: isCredit,
        items: sanitizedItems
      };

      const response = await fetch(RAILWAY_CHECKOUT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errText}`);
      }

      setBillDetails({
        ...billDetails,
        results: sanitizedItems,
        sub_total: subTotal,
        discount_amount: discountAmount,
        total_bill_amount: finalTotal,
        customer_name: customerName,
        is_credit: isCredit
      });
      
      // Refresh names list for next runs
      fetchCustomerNames();
      setViewState('success');
      fetchCurrentStock();
      
    } catch (e) {
      alert("Error confirming bill: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = async () => {
    const input = document.getElementById('receipt-download-container');
    if (!input) return;

    input.style.display = 'block';

    try {
      const canvas = await html2canvas(input, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, Math.max(100, (canvas.height * 80) / canvas.width)]
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Bill_${new Date().getTime()}.pdf`);
    } catch (e) {
      console.error('Error generating PDF:', e);
      alert('Failed to generate PDF');
    } finally {
      input.style.display = 'none';
    }
  };

  const Stepper = ({ value, onChange }) => (
    <div className="stepper-container">
      <button className="stepper-btn" onClick={() => onChange(Math.max(0, parseFloat(value) - 1))}>-</button>
      <input className="stepper-input" type="number" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
      <button className="stepper-btn" onClick={() => onChange(parseFloat(value) + 1)}>+</button>
    </div>
  );

  return (
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: '#f0f4f8' }}>
      
      {/* ---------------- VIEW STATE 1: NEW BILL (Input & Preview) ---------------- */}
      {viewState === 'input' && (
        <>
          <div style={{ backgroundColor: '#fff', padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={22} color="var(--primary-blue)" />
                <span style={{ fontWeight: 'bold', color: 'var(--primary-blue)' }}>दुकानदार सहायक</span>
              </div>
              <button onClick={() => navigate('/past-bills')} className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <History size={16} /> इतिहास (History)
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e6f4ea', padding: '0.75rem 1rem', borderRadius: '8px' }}>
              <span style={{ fontWeight: '600', color: '#1e8e3e' }}>कुल राशि (Total):</span>
              <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#1e8e3e' }}>
                ₹{calculateGrandTotal().toFixed(2)} 
                {discountAmount > 0 && <span style={{ fontSize: '0.8rem', color: '#14532d', marginLeft: '8px' }}>(₹{discountAmount} छूट)</span>}
              </span>
            </div>
          </div>

          <div style={{ padding: '1rem', paddingBottom: '160px' }}>
            
            {/* Recording Controls & Waveform */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
               <div style={{ width: '100%', marginBottom: '1rem' }}>
                 <div className={`mic-btn ${isRecording ? 'recording' : ''}`} style={{ margin: '0 auto', cursor: 'pointer', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }} onClick={isRecording ? stopRecording : startRecording}>
                   <Mic size={28} />
                 </div>
               </div>

               {isRecording && (
                 <div className="waveform-container">
                   <div className="waveform-bar" />
                   <div className="waveform-bar" />
                   <div className="waveform-bar" />
                   <div className="waveform-bar" />
                   <div className="waveform-bar" />
                   <div className="waveform-bar" />
                   <div className="waveform-bar" />
                   <div className="waveform-bar" />
                 </div>
               )}
               
               <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
                 {!isRecording ? (
                   <button className="btn btn-primary" onClick={startRecording} style={{ borderRadius: '50px', padding: '0.75rem 2rem' }}>
                     <Mic size={20} style={{ marginRight: '8px' }} /> माइक से बोलें (Voice Add)
                   </button>
                 ) : (
                   <button className="btn btn-primary" onClick={stopRecording} style={{ borderRadius: '50px', padding: '0.75rem 2rem', backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}>
                     रोकें (Stop Recording)
                   </button>
                 )}
               </div>

               {(isRecording || realtimeText || (billDetails && billDetails.spoken_text)) && (
                 <div style={{ marginTop: '1rem', width: '100%', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                   <p style={{ fontSize: '1rem', color: '#14532d', margin: 0, fontStyle: 'italic' }}>
                     {(billDetails && billDetails.spoken_text) ? billDetails.spoken_text : (realtimeText || "बोलना शुरू करें...")}
                   </p>
                 </div>
               )}

               {isProcessing && (
                  <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="loader" style={{ fontSize: '1rem' }}>⏳</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>आइटम प्रोसेस हो रहे हैं...</span>
                  </div>
               )}
            </div>

            {/* Bill Preview List */}
            {billPreview && (
              <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <table className="mobile-list-table">
                  <thead>
                    <tr>
                      <th className="item-col">आइटम (ITEM)</th>
                      <th>दर (RATE)</th>
                      <th>मात्रा (QTY)</th>
                      <th>कुल (TOTAL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billPreview.map((res, i) => (
                      <tr key={i} style={{ backgroundColor: res.error ? '#fee2e2' : 'transparent' }}>
                        <td className="item-col">
                          <input 
                            type="text" 
                            list={`stock-options-${i}`}
                            value={res.item_name || ''} 
                            onChange={(e) => handleItemSelect(i, e.target.value)}
                            style={{ width: '100%', minWidth: '90px', border: 'none', backgroundColor: 'transparent', fontWeight: 'bold', color: 'var(--text-dark)', fontSize: '0.9rem' }}
                            placeholder="आइटम का नाम"
                          />
                          <datalist id={`stock-options-${i}`}>
                            {stockList.map(stock => (
                              <option key={stock.id} value={stock.master_inventory?.item_name} />
                            ))}
                          </datalist>
                          {res.error && <div style={{ color: 'red', fontSize: '0.7rem', marginTop: '2px' }}>{res.error === true ? 'नहीं मिला (Not Found)' : res.error}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Stepper value={res.price_per_unit || 0} onChange={(val) => handlePreviewEdit(i, 'price_per_unit', val)} />
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Stepper value={res.quantity_billed || 0} onChange={(val) => handlePreviewEdit(i, 'quantity_billed', val)} />
                          </div>
                        </td>
                        <td style={{ fontWeight: 'bold', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px' }}>
                          <span>₹{res.item_total || 0}</span>
                          <Trash2 size={16} color="var(--danger)" style={{ cursor: 'pointer', marginLeft: '6px' }} onClick={() => handleRemoveItem(i)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div style={{ padding: '0.5rem', borderTop: '1px solid #e5e7eb', textAlign: 'center', backgroundColor: '#f9fafb' }}>
                  <button onClick={handleAddBlankItem} style={{ color: 'var(--primary-blue)', fontWeight: 'bold', border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%', padding: '0.5rem' }}>
                    <Plus size={18} /> आइटम जोड़ें (Add Item)
                  </button>
                </div>

                {/* Discount and Preset Chips */}
                <div style={{ padding: '0.9rem 1rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-dark)' }}>छूट (Discount):</span>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ marginRight: '4px', fontWeight: 'bold', color: 'var(--text-dark)' }}>₹</span>
                      <input 
                        type="number" 
                        value={discountAmount || ''}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        style={{ width: '80px', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'right', fontWeight: 'bold' }}
                      />
                    </div>
                  </div>

                  <div className="preset-discounts">
                    {[10, 20, 50, 100].map(amt => (
                      <button 
                        key={amt}
                        type="button"
                        className="preset-discount-btn"
                        onClick={() => setDiscountAmount(amt)}
                      >
                        -₹{amt}
                      </button>
                    ))}
                    <button 
                      type="button" 
                      className="preset-discount-btn" 
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setDiscountAmount(0)}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          {billPreview && billPreview.length > 0 && (
            <div style={{ position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', backgroundColor: 'white', padding: '1rem', borderTop: '1px solid #e5e7eb', zIndex: 90, boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <span>{billPreview.length} आइटम ({billPreview.length} ITEMS)</span>
                <span>कुल: ₹{calculateGrandTotal().toFixed(2)}</span>
              </div>
              {(() => {
                const hasErrors = billPreview.some(item => item.error);
                return (
                  <button 
                    className="btn btn-primary" 
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.1rem', 
                      borderRadius: '8px',
                      opacity: hasErrors ? 0.5 : 1,
                      cursor: hasErrors ? 'not-allowed' : 'pointer'
                    }}
                    onClick={() => setViewState('settlement')}
                    disabled={hasErrors}
                  >
                    <FileText size={20} style={{ marginRight: '8px' }} /> 
                    {hasErrors ? "कृपया त्रुटियों को ठीक करें (Fix Errors First)" : "बिल सेटल करें (Settle Bill)"}
                  </button>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* ---------------- VIEW STATE 2: SETTLEMENT ---------------- */}
      {viewState === 'settlement' && (
        <div style={{ backgroundColor: '#fff', minHeight: '100vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <ArrowLeft size={24} color="var(--primary-blue)" onClick={() => setViewState('input')} style={{ cursor: 'pointer' }} />
              <span style={{ fontWeight: 'bold', color: 'var(--primary-blue)', fontSize: '1.2rem' }}>बिल सेटलमेंट (Settlement)</span>
            </div>
            <Printer size={24} color="var(--text-dark)" />
          </div>

          <div style={{ padding: '1rem', paddingBottom: '100px' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--primary-blue)', marginBottom: '1rem', marginTop: 0 }}>बिल विवरण (BILL DETAILS)</h3>
              
              {billPreview.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span>{item.item_name} x {item.quantity_billed}</span>
                  <span style={{ fontWeight: '600' }}>₹{item.item_total}</span>
                </div>
              ))}
              
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', fontSize: '1rem', color: 'var(--danger)' }}>
                  <span>छूट (Discount)</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: discountAmount > 0 ? '0.5rem' : '1rem', paddingTop: discountAmount > 0 ? '0.5rem' : '1rem', borderTop: discountAmount > 0 ? 'none' : '1px solid #e5e7eb', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary-blue)' }}>
                <span>कुल राशि (Grand Total)</span>
                <span>₹{calculateGrandTotal().toFixed(2)}</span>
              </div>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.2rem', backgroundColor: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-dark)' }}>उधार पर? (On Credit?)</span>
                <label style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                  <input type="checkbox" checked={isCredit} onChange={e => setIsCredit(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isCredit ? 'var(--primary-blue)' : '#ccc', borderRadius: '20px', transition: '.4s' }}>
                    <span style={{ position: 'absolute', height: '16px', width: '16px', left: isCredit ? '22px' : '2px', bottom: '2px', backgroundColor: 'white', borderRadius: '50%', transition: '.4s' }} />
                  </span>
                </label>
              </div>

              {/* Searchable customer dropdown overlay */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }} ref={customerAutocompleteRef}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>ग्राहक का नाम (Customer Name)</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="🔍 खोजें या नया नाम लिखें..." 
                  value={customerName}
                  onChange={handleCustomerNameChange}
                  style={{ backgroundColor: 'white' }}
                />
                {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 && (
                  <div className="autocomplete-dropdown" style={{ top: '100%', marginTop: '4px' }}>
                    {filteredCustomerSuggestions.map((name, index) => (
                      <div 
                        key={index} 
                        className="autocomplete-item"
                        onClick={() => selectCustomer(name)}
                      >
                        <span style={{ fontWeight: 600 }}>{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', borderRadius: '8px', backgroundColor: 'var(--success)', border: 'none' }}
                onClick={handleFinalizeBill}
                disabled={isProcessing}
              >
                {isProcessing ? 'प्रोसेस हो रहा है...' : <><CheckCircle size={20} style={{ marginRight: '8px' }} /> बिल पक्का करें (Finalize Bill)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- VIEW STATE 3: SUCCESS ---------------- */}
      {viewState === 'success' && billDetails && (
        <div style={{ padding: '2rem 1rem', backgroundColor: '#fff', minHeight: '100vh', textAlign: 'center' }}>
          <CheckCircle size={60} color="var(--success)" style={{ marginBottom: '1rem', margin: '0 auto' }} />
          <h2 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>बिल पक्का हो गया</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Bill Finalized Successfully</p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
            <button 
              className="btn btn-outline" 
              onClick={handleDownloadPDF}
              style={{ flex: 1, borderColor: 'var(--danger)', color: 'var(--danger)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <FileText size={20} /> डाउनलोड PDF
            </button>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '1rem', borderRadius: '8px', backgroundColor: '#f3f4f6', color: 'var(--primary-blue)', border: 'none' }}
            onClick={() => {
              setViewState('input');
              setBillPreview(null);
              setBillDetails(null);
              setCustomerName('');
              setIsCredit(false);
              setRealtimeText('');
              setDiscountAmount(0);
            }}
          >
            नया बिल शुरू करें (Start New Bill)
          </button>
        </div>
      )}

      {/* Hidden Receipt Template for PDF Generation */}
      {billDetails && viewState === 'success' && (
        <div id="receipt-download-container" style={{ display: 'none', width: '300px', padding: '20px', backgroundColor: 'white', color: 'black', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #ccc', paddingBottom: '10px', marginBottom: '10px' }}>
            <h2 style={{ margin: '0 0 5px 0' }}>दुकानदार सहायक</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Shopkeeper Assistant</p>
          </div>
          
          <div style={{ fontSize: '12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>दिनांक (Date):</strong> {new Date().toLocaleDateString('en-IN')}</div>
            {billDetails.customer_name && <div><strong>ग्राहक (Customer):</strong> {billDetails.customer_name}</div>}
            {billDetails.is_credit && <div style={{ color: '#b91c1c', fontWeight: 'bold' }}>उधार बिल (CREDIT BILL)</div>}
          </div>

          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '6px 0' }}>आइटम (Item)</th>
                <th style={{ textAlign: 'center', padding: '6px 0' }}>मात्रा (Qty)</th>
                <th style={{ textAlign: 'right', padding: '6px 0' }}>कुल (Total)</th>
              </tr>
            </thead>
            <tbody>
              {billDetails.results.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #eee' }}>
                  <td style={{ padding: '6px 0' }}>{item.item_name}</td>
                  <td style={{ padding: '6px 0', textAlign: 'center' }}>{item.quantity_billed}</td>
                  <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 'bold' }}>₹{item.item_total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {billDetails.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '2px dashed #ccc', paddingTop: '10px' }}>
              <span>उप-कुल (Subtotal)</span>
              <span>₹{billDetails.sub_total.toFixed(2)}</span>
            </div>
          )}
          {billDetails.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#b91c1c' }}>
              <span>छूट (Discount)</span>
              <span>-₹{billDetails.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: billDetails.discount_amount > 0 ? 'none' : '2px dashed #ccc', paddingTop: billDetails.discount_amount > 0 ? '5px' : '10px' }}>
            <span>कुल राशि (Grand Total)</span>
            <span>₹{billDetails.total_bill_amount.toFixed(2)}</span>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px', color: '#777' }}>
            धन्यवाद! फिर पधारें।<br />
            (Thank you for shopping)
          </div>
        </div>
      )}

    </div>
  );
}
