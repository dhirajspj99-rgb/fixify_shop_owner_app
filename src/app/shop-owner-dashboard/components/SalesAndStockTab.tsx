"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SalesAndStockTab({ activeTab, orders, currentShop, products, fetchProducts, fetchOrders }: any) {
  const [salesTimeframe, setSalesTimeframe] = useState('month'); 
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  // Stock Room States
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [stockCategory, setStockCategory] = useState('All Categories');
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editImage, setEditImage] = useState(''); 
  const [editIsCodAvailable, setEditIsCodAvailable] = useState(true);

  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [deletePassword, setDeletePassword] = useState('');

  // 🔥 1. DYNAMIC ADMIN COMMISSION LINKED WITH SUPABASE DATABASE 🔥
  const [dynamicAdminCommission, setDynamicAdminCommission] = useState(0.05); // Default 5%

  useEffect(() => {
    const fetchDatabaseCommission = async () => {
      try {
        const { data, error } = await supabase.from('app_settings').select('commission_rate').eq('id', 1).maybeSingle();
        if (data && data.commission_rate !== undefined) {
          // Database se aayi value (jaise 5.00) ko fraction (0.05) mein convert kar rahe hain
          setDynamicAdminCommission(Number(data.commission_rate) / 100);
        }
      } catch (e) {
        console.warn("Commission load error:", e);
      }
    };
    fetchDatabaseCommission();
  }, []);

  const safeShopId = currentShop?.id ? String(currentShop.id) : null;
  const allShopOrders = (orders || []).filter((o: any) => safeShopId && String(o.shop_id) === safeShopId);
  const shopProducts = (products || []).filter((p: any) => safeShopId && String(p.shop_id) === safeShopId);

  // Sales mein sirf "Completed" ya "Delivered" order count honge
  const completedShopOrders = allShopOrders.filter((o: any) => {
    const s = String(o.status || '').toLowerCase().trim();
    return s === 'completed' || s === 'delivered';
  });

  const now = new Date();
  const todayDateString = now.toDateString();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentDay = now.getDay(); 
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - distanceToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  // 🔥 2. CALCULATE FINANCES USING DYNAMIC COMMISSION 🔥
  const calculateFinances = (order: any) => {
    const totalBill = Number(order.total_amount || 0);
    const deliveryCharge = Number(order.delivery_charge || order.delivery_fee || 0);
    const itemTotal = Math.max(0, totalBill - deliveryCharge); 
    const adminComm = itemTotal * dynamicAdminCommission; // Database connected commission
    const netEarning = itemTotal - adminComm; 
    return { totalBill, deliveryCharge, itemTotal, adminComm, netEarning };
  };

  let grossTodaysSales = 0, grossMonthlySales = 0, grossYearlySales = 0, grossLifetimeSales = 0;
  
  completedShopOrders.forEach((o: any) => {
    const calc = calculateFinances(o);
    const d = new Date(o.created_at);
    
    grossLifetimeSales += calc.itemTotal;
    if (d.getFullYear() === currentYear) {
      grossYearlySales += calc.itemTotal;
      if (d.getMonth() === currentMonth) grossMonthlySales += calc.itemTotal;
    }
    if (d.toDateString() === todayDateString) grossTodaysSales += calc.itemTotal;
  });

  // Ledger Filter logic
  const filteredSalesOrders = completedShopOrders.filter((o: any) => {
    const d = new Date(o.created_at);
    d.setHours(0,0,0,0);
    if (salesTimeframe === 'today') return d.toDateString() === todayDateString;
    if (salesTimeframe === 'week') return d >= startOfWeek;
    if (salesTimeframe === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    if (salesTimeframe === 'year') return d.getFullYear() === currentYear;
    if (salesTimeframe === 'custom') {
      if (!customStartDate || !customEndDate) return true;
      const start = new Date(customStartDate); start.setHours(0,0,0,0);
      const end = new Date(customEndDate); end.setHours(23,59,59,999);
      return d >= start && d <= end;
    }
    return true; 
  });

  const customerFilteredData: any = {};
  const itemsSoldFiltered: any = {};
  let filteredGrossItems = 0, filteredNet = 0, filteredFee = 0;

  const getProductDetailsArray = (order: any) => {
    let details = order.product_details || order.items || order.cart_items || [];
    if (Array.isArray(details)) return details;
    try { return JSON.parse(details); } catch (e) { return []; }
  };

  filteredSalesOrders.forEach((o: any) => {
    const calc = calculateFinances(o);
    filteredGrossItems += calc.itemTotal; 
    filteredFee += calc.adminComm; 
    filteredNet += calc.netEarning;

    const cName = o.customer_name || o.name || 'Unknown';
    const cPhone = o.user_phone || o.phone || 'N/A';
    const key = cName + '_' + cPhone;

    if (!customerFilteredData[key]) customerFilteredData[key] = { amount: 0, items: 0, name: cName, phone: cPhone };
    customerFilteredData[key].amount += calc.itemTotal;

    const items = getProductDetailsArray(o);
    const qtySum = items.reduce((sum: number, i: any) => sum + Number(i.quantity || i.qty || 1), 0);
    customerFilteredData[key].items += qtySum;

    items.forEach((item: any) => {
      const n = (item.name || '').toLowerCase();
      if (n.includes('labour') || item.type === 'labour') return; 
      const iUnit = item.unit || 'Pc';
      const qty = Number(item.quantity || item.qty || 1);
      const itemRevenue = Number(item.price || 0) * qty;

      if (!itemsSoldFiltered[item.name]) itemsSoldFiltered[item.name] = { quantity: 0, revenue: 0, unit: iUnit, name: item.name };
      itemsSoldFiltered[item.name].quantity += qty;
      itemsSoldFiltered[item.name].revenue += itemRevenue;
    });
  });

  const itemsSoldFilteredArray = Object.values(itemsSoldFiltered);

  const exportToExcel = () => {
    if (filteredSalesOrders.length === 0) return alert("Koi data nahi hai.");
    let csvContent = `data:text/csv;charset=utf-8,Date,Order ID,Customer Name,Phone,Total Bill,Delivery Charge,Item Total,Admin Comm (${dynamicAdminCommission * 100}%),Your Net Payout\n`;
    filteredSalesOrders.forEach((o: any) => {
      const calc = calculateFinances(o);
      const date = new Date(o.created_at).toLocaleDateString('en-IN');
      csvContent += `"${date}","${o.order_no || o.id}","${o.customer_name || 'N/A'}","${o.user_phone || 'N/A'}",${calc.totalBill},${calc.deliveryCharge},${calc.itemTotal},${calc.adminComm.toFixed(2)},${calc.netEarning.toFixed(2)}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Sales_Report.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (filteredSalesOrders.length === 0) return alert("Koi data nahi hai.");
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Popup blocker is active.");
    let html = `<html><head><title>Sales Report</title><style>body { font-family: sans-serif; padding: 20px; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #aaa; padding: 8px; text-align: left; }</style></head><body><h2>Sales Ledger Report</h2><p>Shop: <strong>${currentShop?.name || 'N/A'}</strong></p><p>Total Item Sales: Rs ${filteredGrossItems} | Net Earnings: Rs ${filteredNet}</p><table><thead><tr><th>Date</th><th>Order ID</th><th>Delivery</th><th>Item Total</th><th>Net Earning</th></tr></thead><tbody>`;
    filteredSalesOrders.forEach((o: any) => {
      const calc = calculateFinances(o);
      html += `<tr><td>${new Date(o.created_at).toLocaleDateString('en-IN')}</td><td>#${o.order_no || o.id}</td><td>Rs ${calc.deliveryCharge}</td><td>Rs ${calc.itemTotal}</td><td>Rs ${calc.netEarning.toFixed(2)}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  const updateStockProduct = async () => {
    if (!editPrice || !editStock) return alert("Price aur Stock khali nahi chhod sakte!");
    try {
      const { error } = await supabase.from('products').update({ 
        price: Number(editPrice), 
        total_stock: Number(editStock), 
        image_url: editImage,
        is_cod_available: editIsCodAvailable 
      }).eq('id', editingProduct.id);
      
      if (error) throw error;
      alert("✅ Product update ho gaya!");
      setEditingProduct(null);
      fetchProducts();
    } catch (e: any) { alert("Error: " + e.message); }
  };

  const confirmDeleteProduct = async () => {
    if (!deletePassword) return alert("Password dalna zaroori hai!");
    if (currentShop && currentShop.password && deletePassword !== currentShop.password) return alert("❌ Galat password! Product delete nahi hua.");
    try {
      await supabase.from('products').delete().eq('id', productToDelete.id);
      alert("✅ Product delete ho gaya!");
      setProductToDelete(null); setDeletePassword(''); fetchProducts();
    } catch (e: any) { alert("Error: " + e.message); }
  };

  const togglePaymentMode = async (productId: number, currentStatus: boolean) => {
    const newStatus = !currentStatus; 
    const { error } = await supabase.from('products').update({ is_cod_available: newStatus }).eq('id', productId);
    
    if (error) {
        alert("Update failed: " + error.message);
    } else {
        if (typeof fetchProducts === 'function') fetchProducts(); 
    }
  };

  const uniqueStockCategories = ['All Categories', ...Array.from(new Set(shopProducts.map((p: any) => p.category).filter(Boolean)))];

  const displayedStock = shopProducts.filter((p: any) => {
    const matchesName = !stockSearchTerm || (p?.name || '').toLowerCase().includes(stockSearchTerm.toLowerCase());
    const matchesCategory = stockCategory === 'All Categories' || p.category === stockCategory;
    return matchesName && matchesCategory;
  }).sort((a: any, b: any) => {
    const aIsLow = Number(a.total_stock) <= 5 ? 1 : 0;
    const bIsLow = Number(b.total_stock) <= 5 ? 1 : 0;
    if (aIsLow !== bIsLow) return bIsLow - aIsLow; 
    return 0; 
  });

  return (
    <div>
      {/* 🚀 SALES TAB - LEDGER & ANALYTICS */}
      {activeTab === 'sales' && (
        <div style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
          
          <h2 style={{color: '#38bdf8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px'}}>
            <span style={{ fontSize: '28px' }}>📈</span> Sales Ledger & Analytics
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <p style={{ margin: 0, color: '#a7f3d0', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Aaj ki Sales (Items)</p>
                <h2 style={{ margin: '10px 0 5px 0', color: '#fff', fontSize: '28px' }}>₹ {grossTodaysSales.toLocaleString()}</h2>
                <span style={{ fontSize: '12px', color: '#d1fae5' }}>Current Today</span>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <p style={{ margin: 0, color: '#bfdbfe', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Is Mahine (Month)</p>
                <h2 style={{ margin: '10px 0 5px 0', color: '#fff', fontSize: '28px' }}>₹ {grossMonthlySales.toLocaleString()}</h2>
                <span style={{ fontSize: '12px', color: '#dbeafe' }}>Total this month</span>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <p style={{ margin: 0, color: '#ddd6fe', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Is Saal (Year)</p>
                <h2 style={{ margin: '10px 0 5px 0', color: '#fff', fontSize: '28px' }}>₹ {grossYearlySales.toLocaleString()}</h2>
                <span style={{ fontSize: '12px', color: '#ede9fe' }}>Total this year</span>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #b91c1c)', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <p style={{ margin: 0, color: '#fecaca', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Lifetime</p>
                <h2 style={{ margin: '10px 0 5px 0', color: '#fff', fontSize: '28px' }}>₹ {grossLifetimeSales.toLocaleString()}</h2>
                <span style={{ fontSize: '12px', color: '#fee2e2' }}>All time gross</span>
              </div>
          </div>

          <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '25px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              <div>
                <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '15px', fontSize: '16px' }}>⏳ Filter Report By Date:</strong>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => setSalesTimeframe('today')} style={filterBtnStyle(salesTimeframe === 'today')}>Aaj</button>
                  <button onClick={() => setSalesTimeframe('week')} style={filterBtnStyle(salesTimeframe === 'week')}>Is Hafte</button>
                  <button onClick={() => setSalesTimeframe('month')} style={filterBtnStyle(salesTimeframe === 'month')}>Is Mahine</button>
                  <button onClick={() => setSalesTimeframe('custom')} style={filterBtnStyle(salesTimeframe === 'custom', true)}>📅 Custom Date</button>
                </div>

                {salesTimeframe === 'custom' && (
                  <div style={{ display: 'flex', gap: '15px', marginTop: '20px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px' }}>
                    <div style={{display: 'flex', flexDirection: 'column'}}><label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>Start Date</label><input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} style={inputStyle} /></div>
                    <div style={{display: 'flex', flexDirection: 'column'}}><label style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>End Date</label><input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} style={inputStyle} /></div>
                  </div>
                )}
              </div>
              <div style={{ borderLeft: '2px dashed #334155', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                <button onClick={exportToPDF} style={{ ...actionBtnStyle, backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>📄 Download PDF</button>
                <button onClick={exportToExcel} style={{ ...actionBtnStyle, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>📊 Download Excel</button>
              </div>
            </div>
          </div>

          <div style={{ background: 'linear-gradient(90deg, #022c22, #064e3b)', padding: '25px', borderRadius: '16px', border: '1px solid #10b981', marginBottom: '30px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#34d399', display: 'flex', alignItems: 'center', gap: '10px' }}>💰 Filtered Payout Summary (Excluding Delivery)</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '12px' }}><span style={{ color: '#cbd5e1', fontSize: '16px' }}>Total Item Sales (Minus Delivery):</span><strong style={{ color: '#f8fafc', fontSize: '20px' }}>₹ {filteredGrossItems.toLocaleString()}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '12px' }}><span style={{ color: '#fca5a5', fontSize: '16px' }}>Admin Commission Deducted ({dynamicAdminCommission * 100}%):</span><strong style={{ color: '#f87171', fontSize: '20px' }}>- ₹ {filteredFee.toLocaleString()}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: '#6ee7b7', fontWeight: 'bold', fontSize: '18px' }}>Your Net Bank Earning:</span><strong style={{ color: '#10b981', fontSize: '28px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>₹ {filteredNet.toLocaleString()}</strong></div>
          </div>

          <h3 style={{ borderBottom: '2px solid #334155', paddingBottom: '10px', marginTop: '30px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '10px' }}>
            🧾 Bill History (Click to View Details)
          </h3>
          <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', marginBottom: '30px' }}>
            {filteredSalesOrders.length === 0 ? (
              <p style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>Is time period mein koi sales nahi hui.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '15px' }}>Date</th>
                    <th style={{ padding: '15px' }}>Order ID</th>
                    <th style={{ padding: '15px' }}>Customer</th>
                    <th style={{ padding: '15px' }}>Total Bill</th>
                    <th style={{ padding: '15px' }}>Item Total</th>
                    <th style={{ padding: '15px' }}>Your Net</th>
                    <th style={{ padding: '15px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSalesOrders.map((o: any) => {
                    const calc = calculateFinances(o);
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #334155', cursor: 'pointer', transition: '0.2s' }} onClick={() => setSelectedOrder(o)} className="hover-row">
                        <td style={{ padding: '15px', color: '#cbd5e1' }}>{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '15px', color: '#38bdf8', fontWeight: 'bold' }}>#{o.order_no || o.id.toString().substring(0,6)}</td>
                        <td style={{ padding: '15px', color: '#f8fafc' }}>{o.customer_name || 'N/A'}</td>
                        <td style={{ padding: '15px', color: '#94a3b8' }}>₹{calc.totalBill.toFixed(2)}</td>
                        <td style={{ padding: '15px', color: '#f8fafc' }}>₹{calc.itemTotal.toFixed(2)}</td>
                        <td style={{ padding: '15px', color: '#10b981', fontWeight: 'bold' }}>₹{calc.netEarning.toFixed(2)}</td>
                        <td style={{ padding: '15px', textAlign: 'center' }}>
                          <button style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                            👁️ View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <h3 style={{ borderBottom: '2px solid #334155', paddingBottom: '10px', color: '#facc15' }}>📦 Bikey Hue Items Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
            {itemsSoldFilteredArray.map((item: any, idx) => (
              <div key={idx} style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)' }}>
                <strong style={{ color: '#e2e8f0', fontSize: '16px', display: 'block', marginBottom: '8px' }}>{item.name}</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>Sold:</span>
                  <strong style={{ color: '#4ade80', fontSize: '18px' }}>{item.quantity} {item.unit}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📦 STOCK TAB */}
      {activeTab === 'stock' && (
          <div style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
                  <h2 style={{color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <span style={{ fontSize: '28px' }}>📦</span> Stock Room Report
                  </h2>
                  <input type="text" placeholder="🔍 Search product..." value={stockSearchTerm} onChange={(e) => setStockSearchTerm(e.target.value)} style={{ ...inputStyle, width: '300px', margin: '0' }} />
              </div>

              <div className="hide-scrollbar" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '15px', marginBottom: '10px' }}>
                {uniqueStockCategories.map((cat) => (
                  <button key={cat as string} onClick={() => setStockCategory(cat as string)} style={{
                      padding: '8px 16px', borderRadius: '20px', border: '1px solid #38bdf8', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.2s',
                      backgroundColor: stockCategory === cat ? '#38bdf8' : 'transparent', color: stockCategory === cat ? '#0f172a' : '#38bdf8', fontWeight: 'bold'
                  }}>{cat as string}</button>
                ))}
              </div>

              {viewPhoto && (
                <div style={modalOverlayStyle} onClick={() => setViewPhoto(null)}>
                  <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                    <button onClick={() => setViewPhoto(null)} style={{ position: 'absolute', top: '-15px', right: '-15px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '35px', height: '35px', fontSize: '18px', cursor: 'pointer' }}>✖</button>
                    <img src={viewPhoto} alt="Product Zoom" style={{ width: '100%', height: 'auto', maxHeight: '80vh', borderRadius: '12px', border: '3px solid #38bdf8', objectFit: 'contain', backgroundColor: '#0f172a' }} />
                  </div>
                </div>
              )}

              {productToDelete && (
                <div style={modalOverlayStyle}>
                  <div style={{...modalContentStyle, maxWidth: '350px'}}>
                    <h3 style={{ color: '#ef4444', marginTop: 0 }}>⚠️ Confirm Deletion</h3>
                    <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '15px' }}>Kya aap sach mein <strong>{productToDelete.name}</strong> ko delete karna chahte hain? Confirm karne ke liye apna password dalein.</p>
                    <label style={{color: '#94a3b8', fontSize: '12px'}}>Shop Password</label>
                    <input type="password" placeholder="Enter password..." value={deletePassword} onChange={e => setDeletePassword(e.target.value)} style={inputStyle} />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                      <button onClick={() => {setProductToDelete(null); setDeletePassword('');}} style={{...editBtn, flex: 1, backgroundColor: '#475569', padding: '12px'}}>Cancel</button>
                      <button onClick={confirmDeleteProduct} style={{...editBtn, flex: 1, backgroundColor: '#ef4444', padding: '12px'}}>🗑️ Confirm Delete</button>
                    </div>
                  </div>
                </div>
              )}

              {editingProduct && (
                <div style={modalOverlayStyle}>
                  <div style={{...modalContentStyle, maxWidth: '350px'}}>
                    <h3 style={{ color: '#10b981', marginTop: 0 }}>✏️ Update Details</h3>
                    <p style={{ color: '#cbd5e1', fontSize: '14px', marginBottom: '15px' }}>{editingProduct.name}</p>
                    
                    <label style={{color: '#94a3b8', fontSize: '12px'}}>Naya Price (₹)</label>
                    <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={inputStyle} />
                    
                    <label style={{color: '#94a3b8', fontSize: '12px', marginTop: '10px', display: 'block'}}>Updated Stock Quantity</label>
                    <input type="number" value={editStock} onChange={e => setEditStock(e.target.value)} style={inputStyle} />
                    
                    <label style={{color: '#94a3b8', fontSize: '12px', marginTop: '10px', display: 'block'}}>Image URL (Photo Link)</label>
                    <input type="text" value={editImage} onChange={e => setEditImage(e.target.value)} style={inputStyle} placeholder="https://..." />
                    
                    <div style={{ marginTop: '15px' }}>
                      <label style={{color: '#94a3b8', fontSize: '12px', fontWeight: 'bold'}}>Payment Mode</label>
                      <div style={{ display: 'flex', gap: '15px', marginTop: '5px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
                        <label style={{ cursor: 'pointer', color: editIsCodAvailable ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                          <input type="radio" checked={editIsCodAvailable} onChange={() => setEditIsCodAvailable(true)} style={{accentColor: '#10b981'}} />
                          💵 COD Available
                        </label>
                        <label style={{ cursor: 'pointer', color: !editIsCodAvailable ? '#38bdf8' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                          <input type="radio" checked={!editIsCodAvailable} onChange={() => setEditIsCodAvailable(false)} style={{accentColor: '#38bdf8'}} />
                          💳 Online Only
                        </label>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                      <button onClick={() => setEditingProduct(null)} style={{...editBtn, flex: 1, backgroundColor: '#475569', padding: '12px'}}>Cancel</button>
                      <button onClick={updateStockProduct} style={{...editBtn, flex: 1, backgroundColor: '#10b981', padding: '12px'}}>💾 Save Updates</button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {displayedStock.length === 0 ? (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 20px', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px dashed #334155' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Is category mein koi product nahi hai.</h3>
                  </div>
                ) : (
                  displayedStock.map((p: any) => {
                      const isLowStock = Number(p.total_stock) <= 5;
                      return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: isLowStock ? 'rgba(239, 68, 68, 0.05)' : '#1e293b', border: `1px solid ${isLowStock ? '#ef4444' : '#334155'}`, borderRadius: '16px', flexWrap: 'wrap', gap: '15px', position: 'relative' }}>
                          {isLowStock && (
                            <div style={{ position: 'absolute', top: '-12px', left: '20px', backgroundColor: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', zIndex: 10 }}>
                              🚨 LOW STOCK ALERT {Number(p.total_stock) === 0 ? '(0 STOCK)' : ''}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: '1 1 250px' }}>
                            <div 
                              onClick={() => p.image_url ? setViewPhoto(p.image_url.split(',')[0]) : null}
                              style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', background: '#334155', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: p.image_url ? 'pointer' : 'default', border: '2px solid #38bdf8' }}
                            >
                              {p.image_url ? (
                                <>
                                  <img src={p.image_url.split(',')[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={p.name} />
                                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0, transition: '0.2s', zIndex: 5 }} className="image-overlay"><span style={{ fontSize: '24px' }}>🔍</span></div>
                                </>
                              ) : (<span style={{ fontSize: '24px' }}>📦</span>)}
                            </div>
                            <div>
                              <strong style={{fontSize: '18px', color: '#f8fafc', display: 'block'}}>{p.name} {p.is_heavy && <span style={{fontSize: '14px'}}>🚛</span>}</strong>
                              
                              <div style={{color: '#94a3b8', fontSize: '12px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap'}}>
                                <span style={{fontSize: '13px', color: '#94a3b8', background: '#0f172a', padding: '2px 8px', borderRadius: '4px', display: 'inline-block'}}>{p.category}</span>
                                <button 
                                  onClick={() => togglePaymentMode(p.id, p.is_cod_available !== false)}
                                  style={{
                                     backgroundColor: p.is_cod_available !== false ? '#065f46' : '#075985',
                                     color: '#f8fafc', border: '1px solid', borderColor: p.is_cod_available !== false ? '#10b981' : '#38bdf8', 
                                     padding: '3px 8px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', marginLeft: '5px'
                                  }}
                                >
                                  {p.is_cod_available !== false ? '🔄 💵 COD (Change)' : '🔄 💳 Online Only (Change)'}
                                </button>
                              </div>

                              <div style={{color: '#4ade80', fontWeight: 'bold', marginTop: '8px', fontSize: '15px'}}>Price: ₹{p.price}</div>
                            </div>
                          </div>
                          
                          <div style={{ flex: '1 1 120px', textAlign: 'center', padding: '12px', borderRadius: '8px', backgroundColor: isLowStock ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)', border: `1px solid ${isLowStock ? '#ef4444' : '#10b981'}`, color: isLowStock ? '#fca5a5' : '#6ee7b7', fontWeight: 'bold' }}>
                            Stock Left: <br/><span style={{fontSize: '24px', color: isLowStock ? '#ef4444' : '#4ade80'}}>{p.total_stock || 0}</span> <span style={{fontSize: '14px'}}>{p.unit || 'Pc'}</span>
                          </div>
                          
                          <div style={{ flex: '1 1 120px', textAlign: 'center', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#93c5fd', fontWeight: 'bold' }}>
                            Total Sold: <br/><span style={{fontSize: '20px'}}>{p.sold_quantity || 0} {p.unit || 'Pc'}</span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => { 
                              setEditingProduct(p); 
                              setEditPrice(p.price); 
                              setEditStock(p.total_stock); 
                              setEditImage(p.image_url || ''); 
                              setEditIsCodAvailable(p.is_cod_available !== false); 
                            }} style={{...editBtn, backgroundColor: '#3b82f6', padding: '12px 20px'}}>✏️ Edit</button>
                            <button onClick={() => setProductToDelete(p)} style={{...editBtn, backgroundColor: '#ef4444', padding: '12px 20px'}}>🗑️ Delete</button>
                          </div>
                      </div>
                  )})
                )}
              </div>
          </div>
      )}

      {selectedOrder && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed #334155', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '22px' }}>🧾 Bill Receipt</h2>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Order ID: #{selectedOrder.order_no || selectedOrder.id.toString().substring(0,8)}</span>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '24px', cursor: 'pointer' }}>✖</button>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #334155' }}>
              <p style={{ margin: '0 0 5px 0', color: '#cbd5e1' }}><strong>Customer:</strong> {selectedOrder.customer_name || 'N/A'}</p>
              <p style={{ margin: '0 0 5px 0', color: '#cbd5e1' }}><strong>Phone:</strong> {selectedOrder.user_phone || 'N/A'}</p>
              <p style={{ margin: 0, color: '#cbd5e1' }}><strong>Date:</strong> {new Date(selectedOrder.created_at).toLocaleString('en-IN')}</p>
            </div>

            <h4 style={{ color: '#e2e8f0', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '10px' }}>🛍️ Items Purchased</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px', paddingRight: '10px' }}>
              <table style={{ width: '100%', fontSize: '14px', color: '#cbd5e1' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                    <th style={{ padding: '8px 0' }}>Item Name</th>
                    <th style={{ padding: '8px 0', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {getProductDetailsArray(selectedOrder).map((item: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px 0' }}>{item.name}</td>
                      <td style={{ padding: '8px 0', textAlign: 'center' }}>{item.quantity || item.qty || 1} {item.unit || ''}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>₹{(Number(item.price || 0) * Number(item.quantity || item.qty || 1)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: '#064e3b', padding: '20px', borderRadius: '12px', border: '1px solid #10b981' }}>
              {(() => {
                const calc = calculateFinances(selectedOrder);
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#94a3b8' }}><span>Gross Bill Amount:</span><strong>₹{calc.totalBill.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#f87171' }}><span>Delivery Charge Deducted:</span><strong>- ₹{calc.deliveryCharge.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#a7f3d0' }}><span>Total Item Amount:</span><strong>₹{calc.itemTotal.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: '#fca5a5', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '12px' }}><span>Admin Comm. ({dynamicAdminCommission * 100}%):</span><strong>- ₹{calc.adminComm.toFixed(2)}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}><span style={{ fontSize: '16px', fontWeight: 'bold' }}>Your Net Payout:</span><strong style={{ fontSize: '24px', color: '#10b981', background: '#fff', padding: '4px 10px', borderRadius: '6px' }}>₹{calc.netEarning.toFixed(2)}</strong></div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `.hover-row:hover { background-color: #334155 !important; } .image-overlay:hover { opacity: 1 !important; }`}} />
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = { padding: '12px 20px', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: '0.2s' };
const filterBtnStyle = (active: boolean, isCustom: boolean = false): React.CSSProperties => ({ padding: '10px 20px', borderRadius: '8px', border: '1px solid #334155', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', backgroundColor: active ? (isCustom ? '#f59e0b' : '#38bdf8') : '#0f172a', color: active ? '#0f172a' : '#cbd5e1', boxShadow: active ? '0 4px 10px rgba(0,0,0,0.3)' : 'none' });
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', fontSize: '14px', boxSizing: 'border-box' };
const editBtn: React.CSSProperties = { border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', transition: '0.2s' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: '0', left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px', backdropFilter: 'blur(4px)' };
const modalContentStyle: React.CSSProperties = { backgroundColor: '#1e293b', padding: '30px', borderRadius: '16px', width: '100%', maxWidth: '450px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #38bdf8', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' };