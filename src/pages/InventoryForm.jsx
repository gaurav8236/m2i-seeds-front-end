import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Trash2, Plus, Package, Search, FileText, Check } from 'lucide-react';

export default function InventoryForm() {
  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState('add'); // 'add' or 'list'

  // Form States
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [lowStockLimit, setLowStockLimit] = useState(10);
  const [aliases, setAliases] = useState([]);
  const [newAlias, setNewAlias] = useState('');

  // Autocomplete suggestions States
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const autocompleteRef = useRef(null);

  // Stock list and Previews
  const [stockList, setStockList] = useState([]);
  const [previewItems, setPreviewItems] = useState([]);

  // Search and Filter States for Stock List Tab
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' or 'low'

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

      if (data) {
        setStockList(data);
      }
    } catch (e) {
      console.error('Error fetching stock:', e);
      alert(`Exception fetching stock: ${e.message}`);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCurrentStock();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Handle clicking outside autocomplete to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueCategories = [...new Set(stockList.map(s => s.master_inventory?.category).filter(Boolean))];
  const uniqueUnits = [...new Set(stockList.map(s => s.master_inventory?.unit).filter(Boolean))];

  const handleItemNameChange = (e) => {
    const val = e.target.value;
    setItemName(val);
    
    if (val.trim() === '') {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    } else {
      // Filter list of inventory items matching characters typed
      const matches = stockList.filter(s => 
        s.master_inventory?.item_name?.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredSuggestions(matches);
      setShowSuggestions(true);
    }

    const existing = stockList.find(s => s.master_inventory?.item_name === val);
    if (existing) {
      selectExistingItem(existing);
    }
  };

  const selectExistingItem = (existing) => {
    setItemName(existing.master_inventory?.item_name || '');
    setCategory(existing.master_inventory?.category || '');
    setUnit(existing.master_inventory?.unit || '');
    setPrice(existing.selling_price || '');
    setCurrentStock(existing.current_stock || '');
    setLowStockLimit(existing.low_stock_limit || 10);
    setAliases(existing.aliases || []);
    setShowSuggestions(false);
  };

  const handleAddAlias = (e) => {
    if (e.key === 'Enter' && newAlias.trim()) {
      e.preventDefault();
      if (!aliases.includes(newAlias.trim())) {
        setAliases([...aliases, newAlias.trim()]);
      }
      setNewAlias('');
    }
  };

  const handleAddAliasManual = () => {
    if (newAlias.trim()) {
      if (!aliases.includes(newAlias.trim())) {
        setAliases([...aliases, newAlias.trim()]);
      }
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
      category: category.trim(),
      unit: unit.trim(),
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

      // Submit the entire JSON array to our bulk function
      const { error } = await supabase.rpc('upsert_inventory_item', {
        p_user_id: userId,
        p_items: previewItems
      });

      if (error) throw error;

      alert("सभी आइटम सफलतापूर्वक स्टॉक में जोड़ दिए गए!");
      setPreviewItems([]); // Clear preview
      fetchCurrentStock(); // Refresh main list
      setActiveTab('list'); // Switch back to see list after save
    } catch (error) {
      console.error(error);
      alert(`आइटम सहेजने में त्रुटि: ${error.message || JSON.stringify(error)}`);
    }
  };

  // Filter existing inventory list
  const filteredStockList = stockList.filter(stock => {
    const name = stock.master_inventory?.item_name || '';
    const cat = stock.master_inventory?.category || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cat.toLowerCase().includes(searchQuery.toLowerCase());
    
    const isLow = stock.current_stock <= stock.low_stock_limit;
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'low' && isLow);
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{
        background: 'var(--primary-gradient)',
        padding: '1.25rem 1rem 1.5rem',
        borderBottomLeftRadius: '20px',
        borderBottomRightRadius: '20px',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
        boxShadow: '0 4px 20px rgba(13,71,161,0.25)',
      }}>
        <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.18)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.3)', flexShrink: 0 }}>
          <Package size={22} color="white" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'white', fontWeight: 700, letterSpacing: '-0.01em' }}>इन्वेंट्री प्रबंधन</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.88)', fontSize: '0.78rem', marginTop: '2px' }}>Inventory Management</p>
        </div>
      </div>

      <div style={{ padding: '1rem' }}>
        
        {/* Segmented Control / Tabs */}
        <div className="segmented-control">
          <button 
            className={`segment-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            <Plus size={18} /> सामान जोड़ें
          </button>
          <button 
            className={`segment-btn ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            <Package size={18} /> स्टॉक सूची
          </button>
        </div>

        {/* ----------------- TAB 1: ADD / UPDATE STOCK ----------------- */}
        {activeTab === 'add' && (
          <div className="animate-fade-in">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleAddToPreview(); }} 
              style={{ 
                backgroundColor: 'white', 
                padding: '1.5rem', 
                borderRadius: '16px', 
                boxShadow: 'var(--shadow-sm)', 
                border: '1px solid #e2e8f0' 
              }}
            >
              
              {/* Custom Search-as-you-type autocomplete input */}
              <div className="form-group" ref={autocompleteRef}>
                <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>सामान का नाम</label>
                <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }} className="autocomplete-wrapper">
                  <input 
                    type="text" 
                    className="input-field" 
                    value={itemName}
                    onChange={handleItemNameChange}
                    placeholder="उदा. Basmati Rice"
                    required
                    style={{ flexGrow: 1 }}
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {filteredSuggestions.map((stock) => (
                        <div 
                          key={stock.id} 
                          className="autocomplete-item"
                          onClick={() => selectExistingItem(stock)}
                        >
                          <span style={{ fontWeight: 600 }}>{stock.master_inventory?.item_name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {stock.master_inventory?.category} | ₹{stock.selling_price}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    style={{ padding: '0.75rem', borderColor: '#e2e8f0', borderRadius: '8px' }} 
                    onClick={() => { 
                      setItemName(''); 
                      setCategory(''); 
                      setUnit(''); 
                      setPrice(''); 
                      setCurrentStock(''); 
                      setAliases([]); 
                      setLowStockLimit(10); 
                    }}
                    title="Form Reset"
                  >
                    <Trash2 size={20} color="var(--danger)" />
                  </button>
                </div>
              </div>

              {/* Grid for Category and Unit */}
              <div className="form-group grid-2">
                <div>
                  <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>श्रेणी</label>
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
                  <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>इकाई</label>
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

              {/* Grid for Price and Current Stock */}
              <div className="form-group grid-2">
                <div>
                  <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>बिक्री कीमत (₹)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="₹"
                    required
                    min="0"
                    step="any"
                  />
                </div>
                <div>
                  <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>वर्तमान स्टॉक</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    placeholder="0"
                    required
                    min="0"
                    step="any"
                  />
                </div>
              </div>

              {/* Alias input with a explicit Add '+' button */}
              <div className="form-group">
                <label style={{ color: 'var(--text-dark)', fontWeight: 'bold' }}>बोलने के नाम (Voice Aliases)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="उदा. चावल, बासमती"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    onKeyDown={handleAddAlias}
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline" 
                    onClick={handleAddAliasManual}
                    style={{ borderColor: 'var(--primary-blue)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
                  >
                    <Plus size={20} />
                  </button>
                </div>
                {aliases.length > 0 && (
                  <div className="chip-container">
                    {aliases.map((alias, index) => (
                      <span key={index} className="chip animate-fade-in">
                        {alias}
                        <button type="button" onClick={() => handleRemoveAlias(index)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Stock Limit visual selector */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ margin: 0, color: 'var(--text-dark)', fontWeight: 'bold' }}>कम स्टॉक चेतावनी</label>
                  <span style={{ 
                    color: 'var(--primary-blue)', 
                    fontWeight: 'bold', 
                    backgroundColor: '#eff6ff', 
                    padding: '2px 10px', 
                    borderRadius: '12px', 
                    fontSize: '0.85rem',
                    border: '1px solid #dbeafe'
                  }}>
                    {lowStockLimit} {unit || 'units'}
                  </span>
                </div>
                
                <div className="slider-container-fancy">
                  {/* Color slider progress track */}
                  <div style={{
                    height: '6px',
                    borderRadius: '3px',
                    width: '100%',
                    background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 40%, #10b981 100%)',
                    position: 'relative',
                    marginBottom: '8px'
                  }}>
                    {/* Visual Slider position mark */}
                    <div style={{
                      position: 'absolute',
                      left: `${Math.min(100, Math.max(0, lowStockLimit))}%`,
                      transform: 'translateX(-50%)',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary-blue)',
                      border: '2px solid white',
                      top: '-3px',
                      boxShadow: 'var(--shadow-sm)'
                    }} />
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={lowStockLimit}
                    onChange={(e) => setLowStockLimit(parseInt(e.target.value) || 0)}
                    style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary-blue)' }}
                  />
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleAddToPreview} 
                style={{ width: '100%', padding: '1rem', marginTop: '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={20} style={{ marginRight: '8px' }} />
                समीक्षा सूची में जोड़ें
              </button>
            </form>

            {/* MODERN CARD-BASED PREVIEW LIST */}
            {previewItems.length > 0 && (
              <div 
                style={{ 
                  marginTop: '2rem', 
                  padding: '1.2rem', 
                  border: '2px dashed var(--primary-blue)', 
                  borderRadius: '16px',
                  backgroundColor: '#f8fafc'
                }} 
                className="animate-fade-in"
              >
                <h3 style={{ 
                  marginTop: 0, 
                  color: 'var(--primary-blue)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '1.1rem',
                  marginBottom: '1rem'
                }}>
                  <FileText size={20} /> समीक्षा सूची ({previewItems.length})
                </h3>

                <div className="cards-list">
                  {previewItems.map((item, idx) => (
                    <div key={idx} className="product-card in-stock animate-fade-in" style={{ borderColor: 'var(--primary-blue)', borderWidth: '1px' }}>
                      <div className="card-header">
                        <div>
                          <div className="card-title">{item.item_name}</div>
                          <span className="card-category">{item.category || 'बिना श्रेणी'}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveFromPreview(idx)} 
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}
                          title="Draft Remove"
                        >
                          <Trash2 size={18} color="var(--danger)" />
                        </button>
                      </div>
                      
                      <div className="card-metrics-grid">
                        <div className="metric-cell">
                          <div className="metric-label">बेचने की कीमत</div>
                          <div className="metric-value">₹{item.selling_price}</div>
                        </div>
                        <div className="metric-cell">
                          <div className="metric-label">नया स्टॉक</div>
                          <div className="metric-value">{item.current_stock} {item.unit || 'units'}</div>
                        </div>
                      </div>

                      {item.aliases && item.aliases.length > 0 && (
                        <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>उपनाम (Aliases)</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {item.aliases.map((alias, aIdx) => (
                              <span key={aIdx} style={{ fontSize: '0.75rem', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-dark)' }}>
                                {alias}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button 
                  type="button" 
                  onClick={handleSubmitAll} 
                  className="btn btn-primary" 
                  style={{ width: '100%', backgroundColor: 'var(--success)', marginTop: '1.2rem', padding: '1rem', borderRadius: '10px' }}
                >
                  <Check size={20} style={{ marginRight: '8px' }} />
                  सभी को स्टॉक में जोड़ें 
                </button>
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB 2: SEARCHABLE STOCK LIST ----------------- */}
        {activeTab === 'list' && (
          <div className="animate-fade-in">
            {/* Search and Filter card */}
            <div className="search-filter-section">
              <div className="search-input-container">
                <Search className="search-icon-left" size={18} />
                <input 
                  type="text" 
                  className="search-field"
                  placeholder="आइटम का नाम या श्रेणी खोजें..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="filter-chips-wrapper">
                <button 
                  className={`filter-chip-btn ${filterStatus === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterStatus('all')}
                >
                  सभी सामान ({stockList.length})
                </button>
                <button 
                  className={`filter-chip-btn ${filterStatus === 'low' ? 'active' : ''}`}
                  onClick={() => setFilterStatus('low')}
                >
                  कम स्टॉक ({stockList.filter(s => s.current_stock <= s.low_stock_limit).length})
                </button>
              </div>
            </div>

            {/* List of Inventory Cards */}
            <div className="cards-list">
              {filteredStockList.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem 1.5rem', 
                  color: 'var(--text-muted)', 
                  backgroundColor: 'white', 
                  borderRadius: '16px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <Package size={42} style={{ opacity: 0.3, marginBottom: '0.75rem', margin: '0 auto' }} />
                  <p style={{ fontWeight: 600 }}>कोई स्टॉक आइटम नहीं मिला।</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>आइटम जोड़ने के लिए "स्टॉक जोड़ें" टैब का उपयोग करें</p>
                </div>
              ) : (
                filteredStockList.map(stock => {
                  const isLow = stock.current_stock <= stock.low_stock_limit;
                  return (
                    <div
                      key={stock.id}
                      style={{ background: 'white', borderRadius: '20px', border: `1px solid ${isLow ? '#fecaca' : '#f1f5f9'}`, padding: '1rem 1.125rem', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: '0.75rem' }}
                    >
                      {/* Top: name + category + low-stock flag */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', lineHeight: 1.2 }}>{stock.master_inventory?.item_name}</div>
                          <span style={{ fontSize: '0.68rem', color: '#64748b', background: '#f8fafc', padding: '2px 9px', borderRadius: '20px', display: 'inline-block', marginTop: '5px', fontWeight: 500, border: '1px solid #e2e8f0' }}>
                            {stock.master_inventory?.category || 'सामान्य'}
                          </span>
                        </div>
                        {isLow && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: '#fef2f2', color: '#dc2626', flexShrink: 0, border: '1px solid #fecaca' }}>
                            ⚠ कम स्टॉक
                          </span>
                        )}
                      </div>

                      {/* Price as hero number, stock inline */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>₹{stock.selling_price}</span>
                        <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>·</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: isLow ? '#dc2626' : '#475569' }}>
                          {stock.current_stock} {stock.master_inventory?.unit}
                        </span>
                      </div>

                      {/* Aliases as subtle pills */}
                      {stock.aliases && stock.aliases.length > 0 && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {stock.aliases.map((alias, aIdx) => (
                            <span key={aIdx} style={{ fontSize: '0.7rem', background: '#f8fafc', color: '#64748b', padding: '2px 9px', borderRadius: '20px', fontWeight: 500, border: '1px solid #e2e8f0' }}>
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
