import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2, Plus } from 'lucide-react';

export default function InventoryForm() {
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('अनाज');
  const [unit, setUnit] = useState('किलोग्राम');
  const [price, setPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [lowStockLimit, setLowStockLimit] = useState(40);
  const [aliases, setAliases] = useState(['चावल', 'बासमती', 'सवाल']);
  const [newAlias, setNewAlias] = useState('');

  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [stockList, setStockList] = useState([]);
  const [previewItems, setPreviewItems] = useState([]);

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
        alert(`Could not load stock table: ${error.message || JSON.stringify(error)}`);
        return;
      }

      if (data && data.length > 0) {
        setStockList(data);
      } else if (data && data.length === 0) {
        console.log("No stock items found for this user.");
      }
    } catch (e) {
      console.error('Error fetching stock:', e);
      alert(`Exception fetching stock: ${e.message}`);
    }
  };

  useEffect(() => {
    fetchCurrentStock();
  }, []);

  // Search Master Inventory
  const searchMasterInventory = async (query) => {
    setItemName(query);
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // NOTE: Replace with actual query when DB is connected
      const { data, error } = await supabase
        .from('master_inventory')
        .select('item_name, category, unit')
        .ilike('item_name', `%${query}%`)
        .limit(5);

      if (data) setSuggestions(data);
    } catch (e) {
      console.error(e);
    }
    setIsSearching(false);
  };

  const handleSelectSuggestion = (item) => {
    setItemName(item.item_name);
    setCategory(item.category);
    setUnit(item.unit);
    setSuggestions([]);
  };

  const handleAddAlias = (e) => {
    if (e.key === 'Enter' && newAlias.trim()) {
      e.preventDefault();
      setAliases([...aliases, newAlias.trim()]);
      setNewAlias('');
    }
  };

  const handleRemoveAlias = (indexToRemove) => {
    setAliases(aliases.filter((_, i) => i !== indexToRemove));
  };

  const handleAddToPreview = () => {
    if (!itemName.trim() || !price || !currentStock) {
      alert("कृपया पूर्वावलोकन में जोड़ने से पहले आइटम का नाम, कीमत और स्टॉक भरें।");
      return;
    }
    const newItem = {
      item_name: itemName.trim(),
      category,
      unit,
      cost_price: 0.0,
      selling_price: parseFloat(price) || 0,
      current_stock: parseFloat(currentStock) || 0,
      low_stock_limit: parseFloat(lowStockLimit) || 0,
      aliases: aliases,
      image_url: null
    };
    setPreviewItems([...previewItems, newItem]);
    
    // Clear form for next item
    setItemName('');
    setPrice('');
    setCurrentStock('');
    setAliases([]); 
  };

  const handleRemoveFromPreview = (index) => {
    setPreviewItems(previewItems.filter((_, i) => i !== index));
  };

  const handleSubmitAll = async () => {
    if (previewItems.length === 0) {
      alert("कृपया सबमिट करने से पहले पूर्वावलोकन में कम से कम एक आइटम जोड़ें।");
      return;
    }
    try {
      let userId = localStorage.getItem('demoUserId');
      
      if (!userId) {
        const { data: users } = await supabase.from('users').select('id').limit(1);
        if (users && users.length > 0) {
          userId = users[0].id;
        } else {
          userId = window.prompt("Demo Mode: No logged-in user found.\nPlease paste a valid User UUID:");
        }
        if (userId) localStorage.setItem('demoUserId', userId);
      }

      if (!userId) {
        alert("स्टॉक सहेजने के लिए एक वैध उपयोगकर्ता आईडी आवश्यक है।");
        return;
      }

      // Submit the entire JSON array to our new bulk function
      // NOTE: Parameter is p_items which perfectly matches what Flutter will use!
      const { data, error } = await supabase.rpc('upsert_inventory_item', {
        p_user_id: userId,
        p_items: previewItems
      });

      if (error) throw error;

      alert("सभी आइटम सफलतापूर्वक स्टॉक में जोड़ दिए गए!");
      setPreviewItems([]); // Clear preview
      fetchCurrentStock(); // Refresh main table
    } catch (error) {
      console.error(error);
      alert(`आइटम सहेजने में त्रुटि: ${error.message || JSON.stringify(error)}`);
    }
  };

  return (
    <div>
      <h1>सामान जोड़े</h1>
      
      <form onSubmit={(e) => { e.preventDefault(); handleAddToPreview(); }}>
        <div className="form-group" style={{ position: 'relative' }}>
          <label>आइटम का नाम</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input-field" 
              value={itemName}
              onChange={(e) => searchMasterInventory(e.target.value)}
              placeholder="Basmati Chawal (Rice)"
              required
            />
            <button type="button" className="btn btn-outline" style={{ padding: '0.75rem' }}>
              <Trash2 size={20} />
            </button>
          </div>
          
          {suggestions.length > 0 && (
            <ul style={{
              position: 'absolute', width: '100%', background: 'white', 
              border: '1px solid #e5e7eb', borderRadius: '8px', zIndex: 10,
              listStyle: 'none', padding: 0, marginTop: '4px', boxShadow: 'var(--shadow-md)'
            }}>
              {suggestions.map((item, i) => (
                <li 
                  key={i} 
                  style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #e5e7eb' }}
                  onClick={() => handleSelectSuggestion(item)}
                >
                  {item.item_name} <small style={{color: 'gray'}}>({item.category})</small>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="form-group grid-2">
          <div>
            <label>श्रेणी</label>
            <select className="input-field" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="अनाज">अनाज (Grain)</option>
              <option value="दाल">दाल (Pulses)</option>
              <option value="मसाले">मसाले (Spices)</option>
            </select>
          </div>
          <div>
            <label>इकाई</label>
            <select className="input-field" value={unit} onChange={e => setUnit(e.target.value)}>
              <option value="किलोग्राम">किलोग्राम</option>
              <option value="ग्राम">ग्राम</option>
              <option value="लीटर">लीटर</option>
              <option value="पीस">पीस</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>कीमत (रु/किलोग्राम)</label>
          <input 
            type="number" 
            className="input-field" 
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>उपनाम</label>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Type alias and press Enter"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={handleAddAlias}
          />
          <div className="chip-container">
            {aliases.map((alias, index) => (
              <span key={index} className="chip">
                {alias}
                <button type="button" onClick={() => handleRemoveAlias(index)}>×</button>
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>स्टॉक</label>
          <input 
            type="number" 
            className="input-field" 
            value={currentStock}
            onChange={(e) => setCurrentStock(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ margin: 0 }}>कम आइटम लिमिट</label>
          <span style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>{lowStockLimit} {unit === 'किलोग्राम' ? 'kg' : unit}</span>
        </div>
        <div className="form-group">
          <input 
            type="range" 
            min="0" max="100" 
            value={lowStockLimit}
            onChange={(e) => setLowStockLimit(e.target.value)}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>

        <div className="grid-2" style={{ marginTop: '2rem' }}>
          <button type="button" className="btn btn-outline" onClick={() => {
            setItemName(''); setPrice(''); setCurrentStock(''); setAliases([]);
          }}>हटाएं (Clear Form)</button>
          <button type="button" className="btn btn-primary" onClick={handleAddToPreview}>
            <Plus size={18} style={{ marginRight: '8px' }} />
            नया सामान (Add to Preview)
          </button>
        </div>
      </form>

      {/* PREVIEW TABLE */}
      {previewItems.length > 0 && (
        <div style={{ marginTop: '2rem', padding: '1rem', border: '2px dashed var(--primary-blue)', borderRadius: '12px' }}>
          <h3 style={{ marginTop: 0, color: 'var(--primary-blue)' }}>समीक्षा (Preview)</h3>
          <table className="stock-table" style={{ marginBottom: '1rem' }}>
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
              {previewItems.map((item, idx) => (
                <tr key={idx} style={{ backgroundColor: '#f0f9ff' }}>
                  <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                  <td>{item.category}</td>
                  <td>₹{item.selling_price}</td>
                  <td>{item.current_stock} {item.unit}</td>
                  <td>
                    <button type="button" onClick={() => handleRemoveFromPreview(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={handleSubmitAll} className="btn btn-primary" style={{ width: '100%', backgroundColor: 'var(--success)' }}>
            समीक्षा करे (Submit {previewItems.length} Items to Database)
          </button>
        </div>
      )}

      {stockList.length > 0 && (
        <div className="stock-table-container">
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
