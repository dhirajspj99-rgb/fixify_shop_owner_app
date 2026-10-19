"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation'; 
import OrdersTab from './components/OrdersTab';
import InventoryTab from './components/InventoryTab';
import SalesAndStockTab from './components/SalesAndStockTab';
import ShopWalletPassbook from './components/ShopWalletPassbook';
import ShopProfile from './components/ShopProfile';
import AdminSupportTab from './components/AdminSupportTab';
import CounterBillingTab from './components/CounterBillingTab';

// 📡 NIGRANI (ADMIN MONITORING) LIVE ACTIVITY LOGGER
const logNigraniActivity = async (shop: any, actionType: string, description: string, extraMeta?: any) => {
  if (!shop?.id) return;
  try {
    await supabase.from('user_activities').insert({
      user_id: String(shop.id),
      user_name: shop.name || 'Shop Owner',
      user_phone: shop.phone || '',
      user_role: 'shop_owner',
      action: actionType,
      description: description,
      metadata: extraMeta ? JSON.stringify(extraMeta) : null,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Nigrani logging failed:", e);
  }
};

export default function ShopOwnerDashboard() {
  const router = useRouter();  
  const [activeTab, setActiveTab] = useState('sales');
  const activeTabRef = useRef(activeTab);
  
  const [currentShop, setCurrentShop] = useState<any>(null); 
  const currentShopIdRef = useRef<any>(null);
  const isInitialLoadedRef = useRef(false);

  const [products, setProducts] = useState<any[]>([]); 
  const [orders, setOrders] = useState<any[]>([]); 
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); 
  const isProfileModalOpenRef = useRef(isProfileModalOpen); 
  
  const [notices, setNotices] = useState<any[]>([]);

  // 🔔 SOUND & NOTIFICATION STATES
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  
  // 🎯 USED FOR ROUTING TO SPECIFIC ORDER FROM WALLET, NOTIFICATIONS, OR SALES LEDGER
  const [targetOrderId, setTargetOrderId] = useState<any>(null);
  
  const [openAdminChatTrigger, setOpenAdminChatTrigger] = useState(0);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { isProfileModalOpenRef.current = isProfileModalOpen; }, [isProfileModalOpen]);
  useEffect(() => { currentShopIdRef.current = currentShop?.id; }, [currentShop?.id]);

  const playAlertSound = useCallback(() => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(() => {});
    } catch(e) {}
  }, []);

  // ==========================================
  // 🔥 SMART BACK BUTTON (PopState Logic)
  // ==========================================
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = () => {
      if (isProfileModalOpenRef.current) {
        setIsProfileModalOpen(false);
        window.history.pushState(null, '', window.location.href);
      } 
      else if (activeTabRef.current !== 'sales') {
        setActiveTab('sales');
        window.history.pushState(null, '', window.location.href);
      } 
      else {
        if (window.confirm("Aap app se bahar ja rahe hain. Kya aap logout karna chahte hain?")) {
          handleLogout();
        } else {
          window.history.pushState(null, '', window.location.href);
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop]);

  // ==========================================
  // ⚡ FAST & SAFE FETCH FUNCTIONS
  // ==========================================
  const fetchNotices = useCallback(async () => {
    try {
      const { data } = await supabase.from('notices').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(5);
      if (data) setNotices(data);
    } catch {}
  }, []);

  const fetchProducts = useCallback(async (forceRefresh = false, shopIdParam?: any) => {
    const sid = shopIdParam ?? currentShopIdRef.current;
    try {
      let query = supabase.from('products').select('*').order('id', { ascending: false }).limit(500);
      if (sid) {
        query = query.eq('shop_id', sid);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        setProducts(data);
      } else if (sid) {
        const { data: allData } = await supabase.from('products').select('*').limit(400);
        if (allData) {
          const shopProds = allData.filter(p => !p.shop_id || String(p.shop_id) === String(sid));
          setProducts(shopProds.length > 0 ? shopProds : allData);
        }
      }
    } catch (e) {
      console.warn("Products fetch error:", e);
    }
  }, []);

  const fetchOrders = useCallback(async (shopIdToFetch?: string | number, forceRefresh = false) => {
    const sid = shopIdToFetch !== undefined ? shopIdToFetch : currentShopIdRef.current;
    if (!sid) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', String(sid))
        .order('created_at', { ascending: false })
        .limit(300);

      let rawOrders = data || [];

      if (rawOrders.length === 0 && !error) {
        const { data: fallbackData } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(250);
        if (fallbackData) {
          rawOrders = fallbackData.filter(o => String(o.shop_id || '').trim() === String(sid).trim());
        }
      }

      const finalOrders = rawOrders
        .filter(o => !String(o.type || '').trim().toLowerCase().includes('labour'))
        .map(order => {
          let parsedMsgs = order.messages;
          if (typeof parsedMsgs === 'string') {
            try { parsedMsgs = JSON.parse(parsedMsgs); } catch { parsedMsgs = []; }
          }
          if (!Array.isArray(parsedMsgs)) parsedMsgs = [];
          return {
            ...order,
            messages: parsedMsgs,
            is_payment_verified: order.is_payment_verified ?? false
          };
        });

      setOrders(finalOrders);
    } catch (e) {
      console.warn("Orders fetch error:", e);
    }
  }, []);

  const fetchAuthAndData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      let phoneNo = '';
      const savedShopData = localStorage.getItem('fixifiy_shop');
      if (savedShopData) {
        try {
          const parsed = JSON.parse(savedShopData);
          phoneNo = parsed.phone;
          if (parsed?.id && !currentShopIdRef.current) {
            setCurrentShop(parsed);
            currentShopIdRef.current = parsed.id;
          }
        } catch(e) {}
      }

      if (!phoneNo) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          let sessionPhone = session.user.email?.replace('@fixifiy.in', '').replace(/[^0-9]/g, '');
          if (sessionPhone && sessionPhone.startsWith('91') && sessionPhone.length === 12) {
            sessionPhone = sessionPhone.substring(2);
          }
          phoneNo = sessionPhone || '';
        }
      }

      if (!phoneNo) {
        router.push('/login');
        return;
      }

      const { data: shopData } = await supabase.from('shops').select('*').eq('phone', phoneNo).maybeSingle();
      if (shopData) {
        setCurrentShop(shopData);
        currentShopIdRef.current = shopData.id;
        try { localStorage.setItem('fixifiy_shop', JSON.stringify(shopData)); } catch {}
        await Promise.all([
          fetchProducts(true, shopData.id),
          fetchOrders(shopData.id, true),
          fetchNotices()
        ]);
      } else {
        router.push('/login');
      }
    } catch (e) {
      console.warn("Auth error:", e);
    } finally {
      setIsLoadingData(false);
    }
  }, [fetchNotices, fetchOrders, fetchProducts, router]);

  // ==========================================
  // 🔥 RUN INITIAL LOAD ONLY ONCE
  // ==========================================
  useEffect(() => {
    if (!isInitialLoadedRef.current) {
      isInitialLoadedRef.current = true;
      fetchAuthAndData();
    }
  }, [fetchAuthAndData]);

  // ==========================================
  // 📡 REALTIME SUBSCRIPTION
  // ==========================================
  useEffect(() => {
    if (!currentShop?.id) return;
    const myShopIdStr = String(currentShop.id);

    const ordersSubscription = supabase
      .channel(`realtime-shop-orders-${myShopIdStr}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updatedOrder: any = payload.new;
            if (!updatedOrder) return;

            if (String(updatedOrder.shop_id) !== myShopIdStr) return;
            if (String(updatedOrder.type || '').toLowerCase().includes('labour')) return;

            let parsedMsgs = updatedOrder.messages;
            if (typeof parsedMsgs === 'string') {
              try { parsedMsgs = JSON.parse(parsedMsgs); } catch { parsedMsgs = []; }
            }
            if (!Array.isArray(parsedMsgs)) parsedMsgs = [];
            updatedOrder.messages = parsedMsgs;

            setOrders(prevOrders => {
              const exists = prevOrders.find(o => o.id === updatedOrder.id);

              if (payload.eventType === 'INSERT' && !exists) {
                playAlertSound();
                setNotifications(prev => [{
                  id: Date.now(),
                  title: '📦 New Order Received!',
                  desc: `Order #${updatedOrder.order_no || updatedOrder.id} - ₹${updatedOrder.total_amount}`,
                  type: 'order',
                  refId: updatedOrder.id,
                  isRead: false
                }, ...prev.slice(0, 29)]);
              }

              if (payload.eventType === 'UPDATE' && exists) {
                const oldMsgs = exists.messages || [];
                if (parsedMsgs.length > oldMsgs.length) {
                  const lastMsg = parsedMsgs[parsedMsgs.length - 1];
                  if (lastMsg?.sender === 'customer') {
                    playAlertSound();
                    setNotifications(prev => [{
                      id: Date.now(),
                      title: '💬 New Customer Message',
                      desc: `Order #${updatedOrder.order_no || updatedOrder.id}: ${(lastMsg.text || '').substring(0, 28)}...`,
                      type: 'order_chat',
                      refId: updatedOrder.id,
                      isRead: false
                    }, ...prev.slice(0, 29)]);
                  } else if (lastMsg?.sender === 'delivery_boy') {
                    playAlertSound();
                    let notifTitle = '🛵 Delivery Partner Update';
                    if (lastMsg.type === 'picked_up') notifTitle = '🏬 दुकान से माल पिकअप हो गया!';
                    else if (lastMsg.type === 'warehouse_drop') notifTitle = '🏭 माल वेयरहाउस में जमा हो गया!';
                    else if (lastMsg.type === 'time_extended') notifTitle = '⏳ डिलीवरी का समय आगे बढ़ाया गया';
                    else if (lastMsg.type === 'delivered') notifTitle = '✅ आर्डर सफलतापूर्वक डिलीवर हो गया!';

                    setNotifications(prev => [{
                      id: Date.now(),
                      title: notifTitle,
                      desc: `Order #${updatedOrder.order_no || updatedOrder.id}: ${(lastMsg.text || '').substring(0, 45)}`,
                      type: 'order',
                      refId: updatedOrder.id,
                      isRead: false
                    }, ...prev.slice(0, 29)]);
                  }
                }
              }

              if (exists) return prevOrders.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o);
              return [updatedOrder, ...prevOrders];
            });
          }
        }
      )
      .subscribe();

    const chatSubscription = supabase
      .channel(`realtime-helpdesk-${myShopIdStr}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'helpdesk_chats' },
        (payload) => {
          const newChat: any = payload.new;
          if (newChat?.sender === 'admin' && String(newChat.shop_id) === myShopIdStr) {
            playAlertSound();
            setNotifications(prev => [{
              id: Date.now(),
              title: '🎧 Admin Support Reply',
              desc: (newChat.message || '').substring(0, 30) + '...',
              type: 'admin_chat',
              isRead: false
            }, ...prev.slice(0, 29)]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(chatSubscription);
    };
  }, [currentShop?.id, playAlertSound]);

  // 🔥 SMART TAB CHANGE HANDLER (MAPS 'pos' -> 'counter_pos' AUTOMATICALLY) 🔥
  const handleTabChange = useCallback((tab: string) => {
    const normalizedTab = tab === 'pos' ? 'counter_pos' : tab;
    setActiveTab(normalizedTab);
    window.history.pushState(null, '', window.location.href);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // 🔥 DIRECT REDIRECT FROM SALES LEDGER TO SPECIFIC ORDER OR POS TAB 🔥
  const handleSelectOrderFromLedger = useCallback((orderObj: any) => {
    if (!orderObj) return;
    const isCounterSale =
      orderObj.type === 'counter_sale' ||
      Boolean(orderObj.bill_no) ||
      String(orderObj.order_no || orderObj.billNo || '').startsWith('POS-') ||
      String(orderObj.payment_mode || '').toLowerCase().includes('counter pos');

    if (isCounterSale) {
      handleTabChange('counter_pos');
    } else {
      setTargetOrderId(orderObj.id);
      handleTabChange('orders');
    }
  }, [handleTabChange]);

  const handleNotificationClick = (notif: any) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    setShowNotifMenu(false);

    if (notif.type === 'order' || notif.type === 'order_chat') {
      setTargetOrderId(notif.refId);
      handleTabChange('orders');
    } else if (notif.type === 'admin_chat') {
      setOpenAdminChatTrigger(prev => prev + 1);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleManualRefresh = async () => {
    if (!currentShop?.id) return;
    await Promise.all([
      fetchProducts(true, currentShop.id),
      fetchOrders(currentShop.id, true),
      fetchNotices()
    ]);
    
    await logNigraniActivity(currentShop, 'MANUAL_DATA_REFRESH', 'Shop owner manually refreshed dashboard data.');
    
    alert("✅ Data Successfully Refreshed from Server!");
  };

  const handleLogout = async () => { 
    if (currentShop?.id) {
       await logNigraniActivity(currentShop, 'SHOP_LOGOUT', 'Shop owner signed out of the dashboard.');
    }
    
    localStorage.removeItem('fixifiy_shop'); 
    localStorage.removeItem('shop_login_time'); 
    localStorage.removeItem('fixifiy_products');
    localStorage.removeItem('fixifiy_products_time');
    if (currentShop?.id) {
      localStorage.removeItem(`fixifiy_orders_${currentShop.id}`);
      localStorage.removeItem(`fixifiy_orders_time_${currentShop.id}`);
    }
    await supabase.auth.signOut(); 
    router.push('/'); 
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', width: '100%', boxSizing: 'border-box', padding: '15px', color: 'white', fontFamily: 'sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* 📢 LIGHTWEIGHT NOTICE BOARD */}
      {notices.length > 0 && (
        <div style={{ backgroundColor: '#fef3c7', borderLeft: '5px solid #f59e0b', padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '10px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <strong style={{ fontSize: '14px' }}>📢 NOTICE:</strong>
          <div style={{ fontWeight: 'bold', fontSize: '13px', display: 'flex', gap: '25px' }}>
            {notices.map((n, i) => <span key={i}>⭐ {n.message}</span>)}
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px', position: 'relative' }}>
        
        <div onClick={() => handleTabChange('sales')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          {currentShop?.profile_pic ? <img src={currentShop.profile_pic} alt="Shop" style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ fontSize: '35px' }}>🏪</div>}
          <div>
            <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '18px' }}>Fixifiy Shop Dashboard</h1>
            <p style={{ color: '#94a3b8', margin: '3px 0 0 0', fontSize: '13px' }}>
              <strong>{currentShop?.name || (isLoadingData ? 'Loading Shop...' : 'New Shop')}</strong> {currentShop?.block ? `(${currentShop.block})` : ''}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <button onClick={handleManualRefresh} style={{...editBtn, backgroundColor: '#0284c7'}} title="Fetch Fresh Data">🔄 Refresh</button>

          <div style={{ position: 'relative' }}>
             <button onClick={() => setShowNotifMenu(!showNotifMenu)} style={{...editBtn, backgroundColor: '#334155', position: 'relative', fontSize: '16px', padding: '8px 12px'}}>
              🔔
              {unreadCount > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px' }}>{unreadCount}</span>}
             </button>
             
             {showNotifMenu && (
               <div style={{ position: 'absolute', top: '45px', right: '0', width: '290px', backgroundColor: '#1e293b', border: '1px solid #38bdf8', borderRadius: '12px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 15px', backgroundColor: '#0284c7', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>Notifications</div>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                     {notifications.length === 0 ? (
                         <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No new notifications</div>
                     ) : (
                         notifications.map((n) => (
                             <div key={n.id} onClick={() => handleNotificationClick(n)} style={{ padding: '12px 15px', borderBottom: '1px solid #334155', cursor: 'pointer', backgroundColor: n.isRead ? '#1e293b' : '#0f172a' }}>
                                 <div style={{ fontSize: '14px', fontWeight: 'bold', color: n.isRead ? '#94a3b8' : '#38bdf8', marginBottom: '4px' }}>{n.title}</div>
                                 <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{n.desc}</div>
                             </div>
                         ))
                     )}
                  </div>
               </div>
             )}
          </div>

          <button onClick={() => { setIsProfileModalOpen(true); window.history.pushState(null, '', window.location.href); }} style={{...editBtn, backgroundColor: '#3b82f6'}}>⚙️ Profile</button>
          
          <button onClick={() => {
            if (window.confirm("Aap app se bahar ja rahe hain. Kya aap logout karna chahte hain?")) handleLogout();
          }} style={{...editBtn, backgroundColor: '#ef4444'}}>🚪 Logout</button>
          
        </div>
      </div>

      {/* TABS BUTTONS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '5px' }}>
        <button onClick={() => handleTabChange('sales')} style={tabBtn(activeTab === 'sales')}>📈 Sales & Ledger</button>
        <button onClick={() => handleTabChange('counter_pos')} style={tabBtn(activeTab === 'counter_pos')}>🧾 Counter Billing (POS)</button>
        <button onClick={() => handleTabChange('orders')} style={tabBtn(activeTab === 'orders')}>🛒 Orders ({orders.length})</button>
        <button onClick={() => handleTabChange('delivery_partners')} style={tabBtn(activeTab === 'delivery_partners')}>🛵 Delivery Partners</button>
        <button onClick={() => handleTabChange('inventory')} style={tabBtn(activeTab === 'inventory')}>📦 Inventory ({products.length})</button>
        <button onClick={() => handleTabChange('wallet')} style={tabBtn(activeTab === 'wallet')}>💳 Wallet</button>
        <button onClick={() => handleTabChange('stock')} style={tabBtn(activeTab === 'stock')}>📊 Stock Report</button>
      </div>

      {/* TABS CONTENT */}
      <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }}>
        {(activeTab === 'sales' || activeTab === 'stock') && (
          <SalesAndStockTab
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            onSelectOrderFromLedger={handleSelectOrderFromLedger}
            orders={orders}
            currentShop={currentShop}
            products={products}
            fetchProducts={fetchProducts}
            fetchOrders={fetchOrders}
          />
        )}
        
        {activeTab === 'counter_pos' && (
          <CounterBillingTab
            currentShop={currentShop}
            setCurrentShop={setCurrentShop}
            products={products}
            fetchProducts={fetchProducts}
            orders={orders}
            setOrders={setOrders}
            fetchOrders={fetchOrders}
            mode="pos"
          />
        )}

        {activeTab === 'delivery_partners' && (
          <CounterBillingTab
            currentShop={currentShop}
            setCurrentShop={setCurrentShop}
            products={products}
            fetchProducts={fetchProducts}
            orders={orders}
            setOrders={setOrders}
            fetchOrders={fetchOrders}
            mode="delivery_partners"
          />
        )}

        {/* 🎯 TARGET ORDER ID PROPS PASSED HERE */}
        {activeTab === 'orders' && (
          <OrdersTab
            targetOrderId={targetOrderId}
            setTargetOrderId={setTargetOrderId}
            orders={orders}
            setOrders={setOrders}
            products={products}
            currentShop={currentShop}
            fetchOrders={fetchOrders}
            fetchProducts={fetchProducts}
          />
        )}
        
        {activeTab === 'inventory' && <InventoryTab products={products} fetchProducts={fetchProducts} currentShop={currentShop} />}
        
        {activeTab === 'wallet' && (
          <ShopWalletPassbook 
            supabase={supabase} 
            shopUser={currentShop} 
            setAppStep={() => handleTabChange('sales')} 
            onGoToOrder={(orderId: any) => {
              setTargetOrderId(orderId);
              handleTabChange('orders');
            }}
          />
        )}
      </div>

      {isProfileModalOpen && <ShopProfile currentShop={currentShop} setCurrentShop={setCurrentShop} onClose={() => setIsProfileModalOpen(false)} fetchAuthAndData={fetchAuthAndData} />}

      <AdminSupportTab currentShop={currentShop} openTrigger={openAdminChatTrigger} />

    </div>
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({ padding: '10px 15px', backgroundColor: active ? '#38bdf8' : '#334155', border: 'none', borderRadius: '8px', color: active ? '#0f172a' : 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', flex: '1 0 auto', textAlign: 'center' });
const editBtn: React.CSSProperties = { padding: '6px 12px', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' };