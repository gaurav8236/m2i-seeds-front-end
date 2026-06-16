import { useState, useRef, useEffect } from 'react';
import { Mic, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function VoiceBilling() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billGenerated, setBillGenerated] = useState(false);
  const [billDetails, setBillDetails] = useState(null);
  const [stockList, setStockList] = useState([]);
  const mediaRecorderRef = useRef(null);

  const fetchCurrentStock = async () => {
    try {
      // HACK: Use localStorage to persist the demo user ID across the app
      let userId = localStorage.getItem('demoUserId');
      if (!userId) {
        // Fallback: fetch the first user from the DB
        const { data: users } = await supabase.from('users').select('id').limit(1);
        if (users && users.length > 0) {
          userId = users[0].id;
          localStorage.setItem('demoUserId', userId);
        }
      }

      if (!userId) {
        console.warn("No user ID found to fetch stock. Table will remain empty until you add an item.");
        return;
      }

      console.log("Fetching stock for user:", userId);
      const { data, error } = await supabase
        .from('user_stock')
        .select(`
          id,
          current_stock,
          selling_price,
          low_stock_limit,
          master_inventory (
            item_name,
            category,
            unit
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error("Supabase Select Error:", error);
        return;
      }

      if (data) setStockList(data);
    } catch (e) {
      console.error('Error fetching stock:', e);
    }
  };

  useEffect(() => {
    fetchCurrentStock();
  }, []);
  const audioChunksRef = useRef([]);

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
      setIsRecording(true);
      setBillGenerated(false);
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
    }
  };

  const handleAudioStop = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    setIsProcessing(true);

    try {
      // Create FormData to send to the FastAPI backend
      const formData = new FormData();
      // The FastAPI backend specifically expects a parameter named "file" (not "audio")
      formData.append('file', audioBlob, 'recording.webm');
      
      // Also send the user_id so the backend knows whose stock to deduct
      const demoUserId = localStorage.getItem('demoUserId');
      if (demoUserId) {
        formData.append('user_id', demoUserId);
      } else {
        throw new Error("No user ID found. Please add an item to stock first to set your user ID.");
      }

      const RAILWAY_API_URL = 'https://web-production-55116.up.railway.app/voice-search/';
      console.log(`Sending audio and user_id to: ${RAILWAY_API_URL}...`);
      
      const response = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = response.statusText;
        try {
          const errData = await response.json();
          errorMsg = JSON.stringify(errData);
        } catch (e) {}
        throw new Error(`Server returned ${response.status}: ${errorMsg}`);
      }

      const data = await response.json();
      console.log('Success! API Response:', data);

      setBillDetails(data);
      setBillGenerated(true);
      
      // Wait a moment for DB replication if any, then fetch fresh stock
      setTimeout(() => {
        fetchCurrentStock();
      }, 500);

    } catch (error) {
      console.error('Error uploading audio:', error);
      alert(`Failed to process voice billing: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <h1>Voice Billing System</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        Tap the microphone and speak the items you want to bill. Our AI will automatically transcribe and deduct them from your inventory.
      </p>

      <div className="mic-btn-wrapper">
        <button 
          className={`mic-btn ${isRecording ? 'recording' : ''}`}
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          title="Hold to speak"
        >
          <Mic size={40} />
        </button>
        
        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: isRecording ? 'var(--danger)' : 'var(--text-dark)' }}>
          {isRecording ? 'Recording... Release to process' : 'Hold to record'}
        </p>
      </div>

      {isProcessing && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}>
            <span className="loader" style={{ fontSize: '1.5rem' }}>⏳</span>
            <p>Processing AI Transcription...</p>
          </div>
        </div>
      )}

      {billGenerated && billDetails && (
        <div className="printable-bill" style={{ 
          marginTop: '2rem', 
          padding: '2rem', 
          backgroundColor: 'white', 
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'left'
        }}>
          <div className="bill-success-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ margin: 0 }}>Bill Generated</h2>
            <p style={{ color: 'var(--text-muted)' }}>Inventory has been successfully verified.</p>
          </div>

          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'gray' }}><strong>Voice Recognized:</strong> "{billDetails.spoken_text}"</p>
          </div>

          <table className="stock-table" style={{ marginBottom: '1.5rem' }}>
            <thead>
              <tr>
                <th>आइटम (Item)</th>
                <th>मात्रा (Qty)</th>
                <th>कुल मूल्य (Total)</th>
                <th>बचा हुआ स्टॉक</th>
              </tr>
            </thead>
            <tbody>
              {billDetails.results?.map((res, i) => (
                <tr key={i} style={{ backgroundColor: res.error ? '#fee2e2' : 'transparent' }}>
                  <td style={{ fontWeight: 600 }}>
                    {res.item_name}
                    {res.error && <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '4px' }}>{res.error}</div>}
                  </td>
                  <td>{res.quantity_billed}</td>
                  <td>{res.error ? '-' : `₹${res.item_total}`}</td>
                  <td style={{ fontWeight: 'bold', color: res.error ? 'red' : 'var(--primary-blue)' }}>
                    {res.error ? 'Failed' : res.stock_remaining}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #e5e7eb', paddingTop: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Total Amount: ₹{billDetails.total_bill_amount || 0}</h3>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <FileText size={20} style={{ marginRight: '0.5rem' }} />
              Download PDF Bill
            </button>
          </div>
        </div>
      )}

      {stockList.length > 0 && (
        <div className="stock-table-container" style={{ marginTop: '3rem' }}>
          <h2 style={{ textAlign: 'left', marginBottom: '1rem', fontSize: '1.25rem', paddingLeft: '1rem' }}>Current Stock</h2>
          <table className="stock-table">
            <thead>
              <tr>
                <th>आइटम</th>
                <th>श्रेणी</th>
                <th>कीमत</th>
                <th>स्टॉक</th>
                <th>स्थिति</th>
              </tr>
            </thead>
            <tbody>
              {stockList.map(stock => {
                const isLow = stock.current_stock <= stock.low_stock_limit;
                return (
                  <tr key={stock.id}>
                    <td style={{ fontWeight: 600 }}>{stock.master_inventory?.item_name}</td>
                    <td>{stock.master_inventory?.category}</td>
                    <td>₹{stock.selling_price}</td>
                    <td>{stock.current_stock} {stock.master_inventory?.unit}</td>
                    <td>
                      <span className={`status-badge ${isLow ? 'status-low' : 'status-ok'}`}>
                        {isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
