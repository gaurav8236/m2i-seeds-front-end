import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2, Plus } from 'lucide-react';

export default function InventoryForm() {
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [lowStockLimit, setLowStockLimit] = useState(10);
  const [aliases, setAliases] = useState([]);
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
          aliases,
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

  const uniqueCategories = [...new Set(stockList.map(s => s.master_inventory?.category).filter(Boolean))];
  const uniqueUnits = [...new Set(stockList.map(s => s.master_inventory?.unit).filter(Boolean))];

  const handleItemNameChange = (e) => {
    const val = e.target.value;
    setItemName(val);
    
    const existing = stockList.find(s => s.master_inventory?.item_name === val);
    if (existing) {
      setCategory(existing.master_inventory?.category || '');
      setUnit(existing.master_inventory?.unit || '');
      setPrice(existing.selling_price || '');
      setCurrentStock(existing.current_stock || '');
      setLowStockLimit(existing.low_stock_limit || 10);
      setAliases(existing.aliases || []);
    }
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
    setCategory('');
    setUnit('');
    setPrice('');
    setCurrentStock('');
    setAliases([]); 
    setLowStockLimit(10);
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f4f8', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--primary-blue)', padding: '1.5rem 1rem', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Plus size={24} color="white" />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>स्टॉक जोड़ें / अपडेट करें</h1>
          <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem', marginTop: '2px' }}>Add or Update Inventory</p>
        </div>
      </div>

      <div style={{ padding: '1rem' }}>
        <form onSubmit={(e) => { e.preventDefault(); handleAddToPreview(); }} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e5e7eb' }}>
          
          <div className="form-group">
            <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>आइटम का नाम (Item Name)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                className="input-field" 
                value={itemName}
                onChange={handleItemNameChange}
                placeholder="उदा. Basmati Rice"
                list="inventory-list"
                required
              />
              <datalist id="inventory-list">
                {stockList.map(stock => (
                  <option key={stock.id} value={stock.master_inventory?.item_name} />
                ))}
              </datalist>
              <button type="button" className="btn btn-outline" style={{ padding: '0.75rem', borderColor: '#e5e7eb' }} onClick={() => { setItemName(''); setCategory(''); setUnit(''); setPrice(''); setCurrentStock(''); setAliases([]); setLowStockLimit(10); }}>
                <Trash2 size={20} color="var(--danger)" />
              </button>
            </div>
          </div>

          <div className="form-group grid-2">
            <div>
              <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>श्रेणी (Category)</label>
              <input 
                type="text"
                list="category-list"
                className="input-field" 
                value={category} 
                onChange={e => setCategory(e.target.value)}
                placeholder="उदा. अनाज"
                required
              />
              <datalist id="category-list">
                {uniqueCategories.map(cat => <option key={cat} value={cat} />)}
              </datalist>
            </div>
            <div>
              <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>इकाई (Unit)</label>
              <input 
                type="text"
                list="unit-list"
                className="input-field" 
                value={unit} 
                onChange={e => setUnit(e.target.value)}
                placeholder="उदा. किलोग्राम"
                required
              />
              <datalist id="unit-list">
                {uniqueUnits.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>

          <div className="form-group grid-2">
            <div>
              <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>कीमत (Price)</label>
              <input 
                type="number" 
                className="input-field" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="₹"
                required
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>स्टॉक (Current Stock)</label>
              <input 
                type="number" 
                className="input-field" 
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>उपनाम (Aliases)</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="बोलने के अन्य नाम (type and hit enter)"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              onKeyDown={handleAddAlias}
            />
            {aliases.length > 0 && (
              <div className="chip-container" style={{ marginTop: '0.5rem' }}>
                {aliases.map((alias, index) => (
                  <span key={index} className="chip" style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', color: 'var(--text-dark)' }}>
                    {alias}
                    <button type="button" onClick={() => handleRemoveAlias(index)} style={{ color: 'var(--text-muted)' }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ margin: 0, color: 'var(--text-dark)', fontWeight: 'bold' }}>कम स्टॉक अलर्ट (Low Stock Alert)</label>
            <span style={{ color: 'var(--primary-blue)', fontWeight: 'bold', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem' }}>
              {lowStockLimit} {unit}
            </span>
          </div>
          <div className="form-group">
            <input 
              type="range" 
              min="0" max="100" 
              value={lowStockLimit}
              onChange={(e) => setLowStockLimit(e.target.value)}
              style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary-blue)' }}
            />
          </div>

          <button type="button" className="btn btn-primary" onClick={handleAddToPreview} style={{ width: '100%', padding: '1rem', marginTop: '1rem', borderRadius: '8px' }}>
            <Plus size={20} style={{ marginRight: '8px' }} />
            समीक्षा में जोड़ें (Add to Preview)
          </button>
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
    </div>
  );
}
