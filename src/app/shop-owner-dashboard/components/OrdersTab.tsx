"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import OrderDetailsView from './OrderDetailsView'; 

const STATE_DISTRICT_DATA: { [key: string]: string[] } = {
  "Bihar": ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Nalanda", "Saran", "Rohtas", "Purnia", "Samastipur"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Varanasi", "Meerut", "Ghaziabad", "Noida", "Prayagraj", "Gorakhpur", "Jhansi"],
  "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh", "Giridih", "Ramgarh"],
  "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "South Delhi", "West Delhi"]
};
const COMMON_BLOCKS = ["Sadar", "Town", "City", "Rural", "North Zone", "South Zone", "East Zone", "West Zone", "Sector-1", "Sector-2"];

export default function OrdersTab({ orders, setOrders, products, currentShop, fetchOrders, fetchProducts }: any) {
  const [orderSubTab, setOrderSubTab] = useState('global'); 
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  // 🔥 NAYA: Master Search State
  const [masterSearch, setMasterSearch] = useState(''); 
  
  const [orderStateFilter, setOrderStateFilter] = useState('');
  const [orderDistrictFilter, setOrderDistrictFilter] = useState('');
  const [orderBlockFilter, setOrderBlockFilter] = useState('');
  const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);

  const safeShopId = currentShop?.id ? String(currentShop.id) : null;

  useEffect(() => {
    const fetchDeliveryBoys = async () => {
      const { data } = await supabase.from('delivery_boys').select('*');
      if (data) setDeliveryBoys(data);
    };
    fetchDeliveryBoys();
  }, []);

  const getProductDetailsArray = (order: any) => {
    let details = order?.product_details || order?.items || order?.products || order?.cart_items || [];
    if (typeof details === 'string') { try { details = JSON.parse(details); } catch(e) { return []; } }
    return Array.isArray(details) ? details : [];
  };

  const getShopItems = (order: any) => {
    return getProductDetailsArray(order).filter((item: any) => {
      const n = String(item.name || item.product_name || '').toLowerCase();
      const c = String(item.category || '').toLowerCase();
      return !(['labour', 'mistri'].some(w => n.includes(w) || c.includes(w)) || item.type === 'labour'); 
    });
  };

  const getShopTotal = (order: any) => {
    return getShopItems(order).reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
  };

  const getOrderColor = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    if (['delivered', 'completed', 'complete'].includes(s)) return '#10b981'; 
    if (['accepted', 'processing'].includes(s)) return '#facc15'; 
    if (s.includes('return') || s === 'refunded') return '#ef4444';
    return '#38bdf8'; 
  };

  const applyLocationFilter = (o: any) => {
    if (orderStateFilter && o.state !== orderStateFilter) return false;
    if (orderDistrictFilter && o.district !== orderDistrictFilter) return false;
    if (orderBlockFilter && o.block !== orderBlockFilter) return false;
    return true;
  };

  const availableStates = Array.from(new Set([...Object.keys(STATE_DISTRICT_DATA), ...(orders||[]).map((o:any) => o.state).filter(Boolean)])).sort() as string[];
  
  let availableDistricts: string[] = [];
  if (orderStateFilter) {
    const predefinedDistricts = STATE_DISTRICT_DATA[orderStateFilter] || [];
    const orderDistricts = (orders||[]).filter((o:any) => o.state === orderStateFilter).map((o:any) => o.district).filter(Boolean);
    availableDistricts = Array.from(new Set([...predefinedDistricts, ...orderDistricts])).sort() as string[];
  }
  
  let availableBlocks: string[] = [];
  if (orderDistrictFilter) {
    const orderBlocks = (orders||[]).filter((o:any) => o.district === orderDistrictFilter).map((o:any) => o.block).filter(Boolean);
    availableBlocks = Array.from(new Set([...COMMON_BLOCKS, ...orderBlocks])).sort() as string[];
  }

  const isOrderHistory = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    return ['completed', 'complete', 'delivered', 'cancelled', 'refunded'].includes(s);
  };
  
  const isNewStatus = (status: string) => {
    const s = String(status || '').toLowerCase().trim();
    return ['new', 'new order', 'pending', 'draft', ''].includes(s) || s.includes('new') || s.includes('pending');
  };
  
  const isGlobalUnassigned = (shopId: any) => !shopId || String(shopId) === 'null' || String(shopId).trim() === '' || String(shopId) === 'undefined' || String(shopId) === '0';
  const isMine = (shopId: any) => safeShopId && String(shopId) === safeShopId;

  // 🔥 NAYA: Master Search Matcher Function
  const matchesMasterSearch = (o: any, term: string) => {
    if (!term) return true;
    const lowerTerm = term.toLowerCase();
    return (
      String(o.id).toLowerCase().includes(lowerTerm) ||
      String(o.order_no).toLowerCase().includes(lowerTerm) ||
      String(o.customer_name || o.name).toLowerCase().includes(lowerTerm) ||
      String(o.phone || o.user_phone).toLowerCase().includes(lowerTerm)
    );
  };

  // 🔥 NAYA: Auto-Tab Switch Logic
  const handleMasterSearch = (text: string) => {
    setMasterSearch(text);
    if (text.trim().length >= 3) {
      const term = text.toLowerCase();
      // Find order anywhere in the list
      const foundOrder = (orders || []).find((o:any) => matchesMasterSearch(o, term));
      
      if (foundOrder) {
        if (isOrderHistory(foundOrder.status) && isMine(foundOrder.shop_id)) {
          setOrderSubTab('history');
        } else if (isNewStatus(foundOrder.status) || isGlobalUnassigned(foundOrder.shop_id)) {
          setOrderSubTab('global');
        } else if (isMine(foundOrder.shop_id)) {
          setOrderSubTab('local');
        }
      }
    }
  };

  // 1. GLOBAL MARKET
  const globalOrders = (orders || []).filter((o: any) => {
    if (isOrderHistory(o.status)) return false; 
    if (isNewStatus(o.status)) return true;
    if (isGlobalUnassigned(o.shop_id)) return true;
    return false;
  }).filter(applyLocationFilter).filter((o:any) => matchesMasterSearch(o, masterSearch));

  // 2. LOCAL WORKING
  const myLocalOrders = (orders || []).filter((o: any) => {
    if (!isMine(o.shop_id)) return false;
    if (isOrderHistory(o.status)) return false;
    if (isNewStatus(o.status)) return false; 
    return true; 
  }).filter(applyLocationFilter).filter((o:any) => matchesMasterSearch(o, masterSearch));

  // 3. HISTORY
  const historyOrders = (orders || []).filter((o: any) => {
    if (!isMine(o.shop_id)) return false;
    if (!isOrderHistory(o.status)) return false;
    return true;
  }).filter(applyLocationFilter).filter((o:any) => matchesMasterSearch(o, masterSearch));

  // 🔥 PAGE RENDER LOGIC 🔥
  if (selectedOrder) {
    return (
      <OrderDetailsView 
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        orders={orders}
        setOrders={setOrders}
        products={products}
        currentShop={currentShop}
        fetchOrders={fetchOrders}
        fetchProducts={fetchProducts}
        deliveryBoys={deliveryBoys}
        setOrderSubTab={setOrderSubTab} 
      />
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-in' }}>
      
      {/* 🔥 NAYA: Master Search Box 🔥 */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="🔍 Search by Order ID (#FIX...), Name, or Phone..." 
          value={masterSearch}
          onChange={(e) => handleMasterSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '15px 20px',
            borderRadius: '10px',
            border: '2px solid #38bdf8',
            backgroundColor: '#0f172a',
            color: 'white',
            fontSize: '15px',
            outline: 'none',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
          }}
        />
        {masterSearch && (
          <div style={{ fontSize: '12px', color: '#4ade80', marginTop: '5px', marginLeft: '5px' }}>
            Auto-searching across all tabs...
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', borderBottom: '2px solid #334155', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => setOrderSubTab('global')} style={{ background: 'transparent', border: 'none', color: orderSubTab === 'global' ? '#f59e0b' : '#94a3b8', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
          🌐 Global Market ({globalOrders.length})
        </button>
        <button onClick={() => setOrderSubTab('local')} style={{ background: 'transparent', border: 'none', color: orderSubTab === 'local' ? '#38bdf8' : '#94a3b8', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
          📍 Local Working ({myLocalOrders.length})
        </button>
        <button onClick={() => setOrderSubTab('history')} style={{ background: 'transparent', border: 'none', color: orderSubTab === 'history' ? '#10b981' : '#94a3b8', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
          📜 Order History ({historyOrders.length})
        </button>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
          <strong style={{ color: '#38bdf8', alignSelf: 'center', marginRight: '10px' }}>🌍 Filter Area:</strong>
          <select value={orderStateFilter} onChange={e => {setOrderStateFilter(e.target.value); setOrderDistrictFilter(''); setOrderBlockFilter('');}} style={filterSelectStyle}>
              <option value="">-- All States --</option>
              {availableStates.map((s:any) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={orderDistrictFilter} onChange={e => {setOrderDistrictFilter(e.target.value); setOrderBlockFilter('');}} style={filterSelectStyle} disabled={Boolean(!orderStateFilter)}>
              <option value="">-- All Districts --</option>
              {availableDistricts.map((d:any) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={orderBlockFilter} onChange={e => setOrderBlockFilter(e.target.value)} style={filterSelectStyle} disabled={Boolean(!orderDistrictFilter)}>
              <option value="">-- All Blocks --</option>
              {availableBlocks.map((b:any) => <option key={b} value={b}>{b}</option>)}
          </select>
      </div>

      {orderSubTab === 'local' && (
        <div>
          {myLocalOrders.length === 0 ? <p style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Koi active order nahi hai aapki shop ke liye.</p> : myLocalOrders.map((order:any) => (
            <div key={order.id} onClick={() => setSelectedOrder(order)} style={{...cardStyle, borderLeft: `6px solid ${getOrderColor(order.status)}`}}>
              <div>
                <strong style={{fontSize: '18px', color: '#f8fafc'}}>Order #{order.order_no || order.id}</strong> <br/>
                <span style={{color: '#94a3b8'}}>👤 {order.customer_name || order.name || 'Customer'}</span> <br/>
                <span style={{fontSize: '12px', color: '#cbd5e1'}}>📍 {order.block || order.location || 'Area N/A'}</span> <br/>
                <span style={{ color: getOrderColor(order.status), fontWeight: 'bold', fontSize: '14px' }}>• {(order.status || 'PENDING').toUpperCase()}</span>
              </div>
              <button style={smallBtn}>⚙️ View / Manage</button>
            </div>
          ))}
        </div>
      )}

      {orderSubTab === 'history' && (
        <div>
          {historyOrders.length === 0 ? <p style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Koi history record nahi mila.</p> : historyOrders.map((order:any) => (
            <div key={order.id} onClick={() => setSelectedOrder(order)} style={{ ...cardStyle, borderLeft: `6px solid ${getOrderColor(order.status)}` }}>
              <div>
                <strong style={{fontSize: '18px', color: '#f8fafc'}}>Order #{order.order_no || order.id}</strong> | <span style={{color: '#cbd5e1'}}>{order.customer_name || 'Customer'}</span> <br/>
                <span style={{ color: getOrderColor(order.status), fontWeight: 'bold', display: 'block', margin: '4px 0' }}>{(order.status || 'PENDING').toUpperCase()}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#4ade80', fontSize: '16px', fontWeight: 'bold', display: 'block' }}>Shop Bill: ₹{getShopTotal(order).toLocaleString()}</span>
                <span style={{ fontSize: '14px', color: '#38bdf8', fontWeight: 'bold', display: 'inline-block', marginTop: '5px' }}>📄 View Bill ➡️</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {orderSubTab === 'global' && (
        <div>
          {globalOrders.length === 0 ? <p style={{ color: '#94a3b8', padding: '20px', textAlign: 'center' }}>Market abhi khali hai. Koi naya order nahi aaya.</p> : globalOrders.map((order:any) => (
            <div key={order.id} onClick={() => setSelectedOrder(order)} style={{ ...cardStyle, borderLeft: `6px solid ${getOrderColor(order.status)}` }}>
              <div>
                <strong style={{fontSize: '18px', color: '#f8fafc'}}>Order #{order.order_no || order.id}</strong> | <span style={{color: '#cbd5e1'}}>{order.customer_name || 'Customer'}</span> <br/>
                📍 <span style={{color: '#f59e0b', fontWeight: 'bold'}}>{order.block || order.location || 'N/A'}</span> <br/>
                <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '16px' }}>₹{getShopTotal(order).toLocaleString()}</span>
              </div>
              <button style={{...smallBtn, backgroundColor: '#f59e0b'}}>👁️ Open Order</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const filterSelectStyle: React.CSSProperties = { padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', fontSize: '14px', flex: 1, minWidth: '150px' };
const cardStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #334155', cursor: 'pointer', backgroundColor: '#0f172a', margin: '10px 0', borderRadius: '12px', transition: '0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' };
const smallBtn: React.CSSProperties = { padding: '10px 15px', border: 'none', borderRadius: '6px', backgroundColor: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' };
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '12px', margin: '8px 0', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', fontSize: '15px', boxSizing: 'border-box' };