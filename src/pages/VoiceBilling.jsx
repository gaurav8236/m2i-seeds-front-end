import { useState, useRef, useEffect } from 'react';
import { Mic, FileText, CheckCircle, ArrowLeft, Printer, History, Trash2, Plus, Package } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import LogRocket from 'logrocket';

export default function VoiceBilling() {
  const [viewState, setViewState] = useState('input'); // input, settlement, success
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billDetails, setBillDetails] = useState(null);
  const [billPreview, setBillPreview] = useState(null);
  const [realtimeText, setRealtimeText] = useState("");
  const [stockList, setStockList] = useState([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  
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
  const sessionIdRef = useRef(null);
  const webSpeechTextRef = useRef('');
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
        webSpeechTextRef.current = currentTranscript; // keep ref in sync for logging
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
      
      sessionIdRef.current = crypto.randomUUID();
      webSpeechTextRef.current = '';
      setRealtimeText("");
      if (recognitionRef.current) recognitionRef.current.start();

      LogRocket.track('voice_session_started', { session_id: sessionIdRef.current });
      setIsRecording(true);
      setViewState('input');
      setBillPreview(null);
      setBillDetails(null);
    } catch (err) {
      console.error("Error accessing microphone", err);
      LogRocket.track('L1_mic_error', { error: err.message });
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
      formData.append('language', 'hi');                              // tell Whisper the language is Hindi
      formData.append('web_speech_text', webSpeechTextRef.current);  // browser transcript as fallback

      const RAILWAY_API_URL = 'https://web-production-55116.up.railway.app/voice-search/';
      
      const response = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        LogRocket.track('L7_api_error', { session_id: sessionIdRef.current, status: response.status });
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const results = data.results || [];
      const webSpeechText = webSpeechTextRef.current;

      // L2 — Whisper returned nothing
      if (!data.spoken_text) {
        LogRocket.track('L2_empty_transcript', { session_id: sessionIdRef.current, web_speech_text: webSpeechText });
      }

      // L3 — LLaMA extracted no items
      if (data.spoken_text && (!data.parsed_items || data.parsed_items.length === 0)) {
        LogRocket.track('L3_no_items_extracted', { session_id: sessionIdRef.current, whisper_text: data.spoken_text });
      }

      // L4 — items not matched
      const notFound = results.filter(r => r.error);
      if (notFound.length > 0) {
        LogRocket.track('L4_items_not_found', {
          session_id: sessionIdRef.current,
          not_found: notFound.map(r => r.item_name),
        });
      }

      // Write full session to voice_logs (frontend-only, no backend change needed)
      supabase.from('voice_logs').insert({
        session_id: sessionIdRef.current,
        user_id: localStorage.getItem('demoUserId'),
        web_speech_text: webSpeechText,
        whisper_text: data.spoken_text,
        llm_extracted_items: data.parsed_items || [],
        match_results: results,
        checkout_completed: false,
      }).then(({ error: logErr }) => {
        if (logErr) console.error('[voice_logs] insert failed:', logErr.message, logErr.code);
      });

      // Auto-resolve closest matches; skip items with no match
      const processedResults = results.reduce((acc, item) => {
        if (!item.error) {
          acc.push(item);
        } else if (typeof item.error === 'string') {
          const closestMatch = item.error.match(/Closest:\s*(.+?)\s*\(\d+%\)/);
          if (closestMatch) {
            const closestName = closestMatch[1].trim();
            const stockItem = stockList.find(s => s.master_inventory?.item_name === closestName);
            if (stockItem) {
              const qty = parseFloat(item.quantity_billed) || 1;
              const price = parseFloat(stockItem.selling_price) || 0;
              acc.push({
                item_name: closestName,
                quantity_billed: qty,
                price_per_unit: price,
                item_total: qty * price,
                stock_remaining: stockItem.current_stock - qty,
                stock_id: stockItem.id,
                current_stock: stockItem.current_stock,
                unit: stockItem.master_inventory?.unit || '',
                error: false
              });
            }
          }
          // no Closest: or not in local stock → skip
        }
        // error === true (no match at all) → skip
        return acc;
      }, []);

      setBillPreview(processedResults);
      setBillDetails({ spoken_text: data.spoken_text });

    } catch (error) {
      console.error('Error uploading audio:', error);
      LogRocket.track('L7_voice_search_failed', { session_id: sessionIdRef.current, error: error.message });
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
      updated[index].unit = stockItem.master_inventory?.unit || '';
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
      current_stock: 0,
      unit: ''
    });
    setBillPreview(newItems);
  };

  const getUnit = (item) => {
    if (item.unit) return item.unit;
    const stock = stockList.find(s => s.master_inventory?.item_name === item.item_name);
    return stock?.master_inventory?.unit || '-';
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
        unit: item.unit || getUnit(item),
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
        LogRocket.track('L7_checkout_failed', { session_id: sessionIdRef.current, status: response.status });
        throw new Error(`Server returned ${response.status}: ${errText}`);
      }

      // Mark session as completed in voice_logs
      if (sessionIdRef.current) {
        supabase.from('voice_logs')
          .update({ checkout_completed: true })
          .eq('session_id', sessionIdRef.current)
          .then(({ error: logErr }) => {
            if (logErr) console.warn('[voice_logs] update:', logErr.message);
          });
      }

      LogRocket.track('checkout_completed', {
        session_id: sessionIdRef.current,
        total: finalTotal,
        is_credit: isCredit,
        item_count: sanitizedItems.length,
      });

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
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>

      {/* ═══════════════════════════════════════
          VIEW 1 — BILLING INPUT
      ═══════════════════════════════════════ */}
      {viewState === 'input' && (
        <>
          {/* Header */}
          <div style={{ background: 'var(--primary-gradient)', padding: '1rem 1rem 1.25rem', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', boxShadow: '0 4px 16px rgba(13,71,161,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <Mic size={17} color="white" />
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em' }}>SmartDukan</div>
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.65rem' }}>Voice Billing</div>
                </div>
              </div>
              <button onClick={() => navigate('/past-bills')} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '20px', padding: '5px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <History size={14} /> इतिहास
              </button>
            </div>

            {/* Total pill */}
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', fontWeight: 600 }}>कुल राशि</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {discountAmount > 0 && <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)', textDecoration: 'line-through' }}>₹{calculateSubTotal().toFixed(0)}</span>}
                <span style={{ color: 'white', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>₹{calculateGrandTotal().toFixed(0)}</span>
                {discountAmount > 0 && <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px' }}>-₹{discountAmount} छूट</span>}
              </div>
            </div>
          </div>

          <div style={{ padding: '1.25rem 1rem', paddingBottom: '160px' }}>

            {/* Mic Zone */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem', background: 'white', borderRadius: '20px', padding: '1.5rem 1rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
              {/* Mic button */}
              <div
                className={`mic-btn ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                style={{ cursor: 'pointer', marginBottom: '1rem' }}
              >
                <Mic size={34} />
              </div>

              {/* Waveform (only while recording) */}
              {isRecording && (
                <div className="waveform-container" style={{ marginBottom: '0.75rem' }}>
                  {[...Array(8)].map((_, i) => <div key={i} className="waveform-bar" />)}
                </div>
              )}

              {/* Action label */}
              <div style={{ textAlign: 'center' }}>
                {isProcessing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 600 }}>
                    <div style={{ width: 18, height: 18, border: '2.5px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                    AI आइटम पहचान रहा है...
                  </div>
                ) : isRecording ? (
                  <div>
                    <div style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>सुन रहा है... बोलते रहें</div>
                    <button onClick={stopRecording} style={{ background: 'var(--danger-light)', border: '1.5px solid var(--danger)', color: 'var(--danger)', borderRadius: '20px', padding: '5px 16px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', marginTop: '6px' }}>
                      रोकें — Stop
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '3px' }}>माइक दबाएं और बोलें</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>हिंदी या English — "aloo do kilo, maggi ek"</div>
                  </div>
                )}
              </div>

              {/* Transcript box */}
              {(realtimeText || (billDetails && billDetails.spoken_text)) && (
                <div style={{ marginTop: '1rem', width: '100%', padding: '0.75rem 1rem', background: 'var(--success-light)', border: '1px solid #bbf7d0', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>AI ने सुना</div>
                  <p style={{ fontSize: '0.9rem', color: '#14532d', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{(billDetails && billDetails.spoken_text) ? billDetails.spoken_text : realtimeText}"
                  </p>
                </div>
              )}
            </div>

            {/* Bill Preview Table */}
            {billPreview && (
              <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>बिल आइटम</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>{billPreview.length} item{billPreview.length !== 1 ? 's' : ''}</span>
                </div>

                <table className="mobile-list-table">
                  <thead>
                    <tr>
                      <th className="item-col">आइटम</th>
                      <th>दर (₹)</th>
                      <th>मात्रा</th>
                      <th>इकाई</th>
                      <th>कुल (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billPreview.map((res, i) => (
                      <tr key={i} style={{ backgroundColor: res.error ? '#fef2f2' : 'transparent' }}>
                        <td className="item-col">
                          {editingItemIndex === i ? (
                            <input
                              autoFocus
                              type="text"
                              list={`stock-options-${i}`}
                              value={res.item_name || ''}
                              onChange={(e) => handleItemSelect(i, e.target.value)}
                              onBlur={() => setEditingItemIndex(null)}
                              style={{ display: 'block', width: '100%', border: '1.5px solid var(--primary)', borderRadius: '6px', background: 'white', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.83rem', fontFamily: 'inherit', padding: '3px 6px' }}
                              placeholder="आइटम का नाम"
                            />
                          ) : (
                            <div
                              onClick={() => setEditingItemIndex(i)}
                              style={{ fontWeight: 700, color: res.item_name ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.83rem', wordBreak: 'break-word', lineHeight: 1.35, cursor: 'text' }}
                            >
                              {res.item_name || 'आइटम का नाम'}
                            </div>
                          )}
                          {res.item_name && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
                              ₹/{getUnit(res) !== '-' ? getUnit(res) : 'unit'}
                            </div>
                          )}
                          <datalist id={`stock-options-${i}`}>
                            {stockList.map(stock => (
                              <option key={stock.id} value={stock.master_inventory?.item_name} />
                            ))}
                          </datalist>
                          {res.error && <div style={{ color: 'var(--danger)', fontSize: '0.68rem', marginTop: '2px', fontWeight: 600 }}>{res.error === true ? '⚠ नहीं मिला' : res.error}</div>}
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
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '6px', display: 'inline-block' }}>
                            {getUnit(res)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '6px' }}>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem' }}>₹{res.item_total || 0}</span>
                            <Trash2 size={15} color="var(--danger)" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => handleRemoveItem(i)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Add item */}
                <div style={{ padding: '0.6rem', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  <button onClick={handleAddBlankItem} style={{ color: 'var(--primary)', fontWeight: 700, border: 'none', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', width: '100%', padding: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <Plus size={16} /> आइटम जोड़ें
                  </button>
                </div>

                {/* Discount */}
                <div style={{ padding: '0.875rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>छूट (Discount)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>₹</span>
                      <input
                        type="number"
                        value={discountAmount || ''}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        style={{ width: '72px', padding: '5px 8px', borderRadius: '6px', border: '1.5px solid var(--border)', textAlign: 'right', fontWeight: 700, fontFamily: 'inherit', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>
                  <div className="preset-discounts">
                    {[10, 20, 50, 100].map(amt => (
                      <button key={amt} type="button" className="preset-discount-btn" onClick={() => setDiscountAmount(amt)}>-₹{amt}</button>
                    ))}
                    <button type="button" className="preset-discount-btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setDiscountAmount(0)}>Clear</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Bottom CTA */}
          {billPreview && billPreview.length > 0 && (
            <div style={{ position: 'fixed', bottom: '64px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: 'white', padding: '0.875rem 1rem', borderTop: '1px solid var(--border)', zIndex: 90, boxShadow: '0 -6px 20px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{billPreview.length} आइटम</span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>कुल: ₹{calculateGrandTotal().toFixed(0)}</span>
              </div>
              {(() => {
                const hasErrors = billPreview.some(item => item.error);
                return (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', borderRadius: '12px', opacity: hasErrors ? 0.5 : 1, cursor: hasErrors ? 'not-allowed' : 'pointer' }}
                    onClick={() => setViewState('settlement')}
                    disabled={hasErrors}
                  >
                    <FileText size={18} style={{ marginRight: '8px' }} />
                    {hasErrors ? 'पहले त्रुटियाँ ठीक करें' : 'बिल सेटल करें →'}
                  </button>
                );
              })()}
            </div>
          )}

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
      )}

      {/* ═══════════════════════════════════════
          VIEW 2 — SETTLEMENT
      ═══════════════════════════════════════ */}
      {viewState === 'settlement' && (
        <div style={{ background: 'white', minHeight: '100vh' }}>
          {/* Header */}
          <div style={{ background: 'var(--primary-gradient)', padding: '1rem', paddingBottom: '1.25rem', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.875rem' }}>
              <button onClick={() => setViewState('input')} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'white' }}>
                <ArrowLeft size={18} />
              </button>
              <div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>बिल सेटलमेंट</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' }}>Settlement</div>
              </div>
            </div>

            {/* Grand total hero */}
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>कुल राशि</div>
              <div style={{ color: 'white', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' }}>₹{calculateGrandTotal().toFixed(0)}</div>
              {discountAmount > 0 && <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.75rem', marginTop: '3px' }}>₹{discountAmount} छूट लागू</div>}
            </div>
          </div>

          <div style={{ padding: '1rem', paddingBottom: '100px' }}>
            {/* Bill line items */}
            <div style={{ background: 'var(--surface-2)', borderRadius: '14px', border: '1px solid var(--border)', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>बिल विवरण</span>
              </div>
              <div style={{ padding: '0.5rem 1rem' }}>
                {billPreview.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: i < billPreview.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.item_name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>× {item.quantity_billed}</span></span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{item.item_total}</span>
                  </div>
                ))}
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '1px dashed var(--border)', marginTop: '4px', fontSize: '0.88rem' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>छूट</span>
                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>-₹{discountAmount.toFixed(0)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment type + customer */}
            <div style={{ background: 'var(--surface-2)', borderRadius: '14px', border: '1px solid var(--border)', padding: '1rem', marginBottom: '1.25rem' }}>
              {/* Credit toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>उधार पर?</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>On Credit</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', flexShrink: 0 }}>
                  <input type="checkbox" checked={isCredit} onChange={e => setIsCredit(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: isCredit ? 'var(--primary)' : '#d1d5db', borderRadius: '24px', transition: '0.25s' }}>
                    <span style={{ position: 'absolute', height: '18px', width: '18px', left: isCredit ? '23px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.25s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </span>
                </label>
              </div>

              {/* Customer name */}
              <div style={{ position: 'relative' }} ref={customerAutocompleteRef}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', display: 'block' }}>ग्राहक का नाम</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="खोजें या नया नाम लिखें..."
                  value={customerName}
                  onChange={handleCustomerNameChange}
                  style={{ background: 'white' }}
                />
                {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 && (
                  <div className="autocomplete-dropdown">
                    {filteredCustomerSuggestions.map((name, index) => (
                      <div key={index} className="autocomplete-item" onClick={() => selectCustomer(name)}>
                        <span style={{ fontWeight: 600 }}>{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Finalize button */}
            <button
              className="btn"
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '14px', background: 'var(--success)', color: 'white', boxShadow: '0 4px 14px rgba(22,163,74,0.3)', border: 'none' }}
              onClick={handleFinalizeBill}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  प्रोसेस हो रहा है...
                </span>
              ) : (
                <><CheckCircle size={20} style={{ marginRight: '8px' }} /> बिल पक्का करें</>
              )}
            </button>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ═══════════════════════════════════════
          VIEW 3 — SUCCESS
      ═══════════════════════════════════════ */}
      {viewState === 'success' && billDetails && (
        <div style={{ background: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Success Hero */}
          <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)', padding: '2.5rem 1rem 2rem', textAlign: 'center', borderBottomLeftRadius: '28px', borderBottomRightRadius: '28px' }}>
            <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', border: '2px solid rgba(255,255,255,0.4)' }}>
              <CheckCircle size={38} color="white" />
            </div>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.4rem', margin: '0 0 4px', letterSpacing: '-0.02em' }}>बिल पक्का हो गया!</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', margin: 0 }}>Bill saved successfully</p>

            {/* Amount */}
            <div style={{ marginTop: '1.25rem', background: 'rgba(255,255,255,0.12)', borderRadius: '14px', padding: '0.875rem', border: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.72rem', fontWeight: 600 }}>कुल राशि</div>
              <div style={{ color: 'white', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>₹{billDetails.total_bill_amount?.toFixed(0)}</div>
              {billDetails.customer_name && (
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', marginTop: '4px', fontWeight: 500 }}>
                  {billDetails.is_credit ? '🔴 उधार' : '🟢 नकद'} — {billDetails.customer_name}
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '1.25rem 1rem', flex: 1 }}>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button
                className="btn btn-outline"
                onClick={handleDownloadPDF}
                style={{ flex: 1, borderRadius: '12px', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 600, borderColor: 'var(--border-strong)', fontSize: '0.88rem' }}
              >
                <FileText size={18} /> PDF डाउनलोड
              </button>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', borderRadius: '14px', fontSize: '1rem' }}
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
              <Mic size={18} style={{ marginRight: '8px' }} /> नया बिल बनाएं
            </button>
          </div>
        </div>
      )}

      {/* Hidden PDF receipt template */}
      {billDetails && viewState === 'success' && (
        <div id="receipt-download-container" style={{ display: 'none', width: '300px', padding: '20px', backgroundColor: 'white', color: 'black', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #ccc', paddingBottom: '10px', marginBottom: '10px' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>SmartDukan</h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#555' }}>दुकानदार सहायक</p>
          </div>
          <div style={{ fontSize: '12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><strong>दिनांक:</strong> {new Date().toLocaleDateString('en-IN')}</div>
            {billDetails.customer_name && <div><strong>ग्राहक:</strong> {billDetails.customer_name}</div>}
            {billDetails.is_credit && <div style={{ color: '#b91c1c', fontWeight: 'bold' }}>⚠ उधार बिल (CREDIT BILL)</div>}
          </div>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '5px 0' }}>आइटम</th>
                <th style={{ textAlign: 'center', padding: '5px 0' }}>इकाई</th>
                <th style={{ textAlign: 'center', padding: '5px 0' }}>दर</th>
                <th style={{ textAlign: 'center', padding: '5px 0' }}>मात्रा</th>
                <th style={{ textAlign: 'right', padding: '5px 0' }}>कुल</th>
              </tr>
            </thead>
            <tbody>
              {billDetails.results.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #eee' }}>
                  <td style={{ padding: '5px 0' }}>{item.item_name}</td>
                  <td style={{ padding: '5px 0', textAlign: 'center' }}>{item.unit || '-'}</td>
                  <td style={{ padding: '5px 0', textAlign: 'center' }}>₹{item.price_per_unit}</td>
                  <td style={{ padding: '5px 0', textAlign: 'center' }}>{item.quantity_billed}</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 'bold' }}>₹{item.item_total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {billDetails.discount_amount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', borderTop: '1px dashed #ccc', paddingTop: '8px' }}>
                <span>उप-कुल</span><span>₹{billDetails.sub_total?.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#b91c1c' }}>
                <span>छूट</span><span>-₹{billDetails.discount_amount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '2px dashed #ccc', paddingTop: '8px', marginTop: '4px' }}>
            <span>कुल राशि</span><span>₹{billDetails.total_bill_amount?.toFixed(2)}</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '10px', color: '#777' }}>
            धन्यवाद! फिर पधारें।<br />(Thank you for shopping)
          </div>
        </div>
      )}

    </div>
  );
}
