"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { useRouter } from 'next/navigation'; 
import OrdersTab from './components/OrdersTab';
import InventoryTab from './components/InventoryTab';
import SalesAndStockTab from './components/SalesAndStockTab';
import ShopWalletPassbook from './components/ShopWalletPassbook';
import ShopProfile from './components/ShopProfile';
import AdminSupportTab from './components/AdminSupportTab';

export default function ShopOwnerDashboard() {
  const router = useRouter();  
  const [activeTab, setActiveTab] = useState('sales');
  
  const [currentShop, setCurrentShop] = useState<any>(null); 
  const [products, setProducts] = useState<any[]>([]); 
  const [orders, setOrders] = useState<any[]>([]); 
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false); 
  const [isPrimeModalOpen, setIsPrimeModalOpen] = useState(false); 

  const [notices, setNotices] = useState<any[]>([]);
  const [idCardUpi, setIdCardUpi] = useState('admin@upi');
  const [premiumUpi, setPremiumUpi] = useState('admin@upi');
  const [registrationUpi, setRegistrationUpi] = useState('admin@upi');

  // ==========================================
  // 🔥 SOUND & NOTIFICATION STATES 🔥
  // ==========================================
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [openAdminChatTrigger, setOpenAdminChatTrigger] = useState(0);

  // 🔔 Sound Play Function
  const playAlertSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log("Auto-play blocked by browser. User needs to interact first."));
    } catch(e) {}
  };

  useEffect(() => { 
    fetchAuthAndData(); 
    
    // 🔥 REAL-TIME ORDERS & CUSTOMER CHATS
    const ordersSubscription = supabase.channel('realtime-orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => { 
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updatedOrder = payload.new;

            if (updatedOrder.type === 'Labour Booking') return; 
            if (currentShop?.id && String(updatedOrder.shop_id) !== String(currentShop.id)) return; 

            let parsedMsgs = updatedOrder.messages;
            if (typeof parsedMsgs === 'string') { try { parsedMsgs = JSON.parse(parsedMsgs); } catch(e) { parsedMsgs = []; } }
            if (!Array.isArray(parsedMsgs)) parsedMsgs = [];
            updatedOrder.messages = parsedMsgs;

            setOrders(prevOrders => {
                const exists = prevOrders.find(o => o.id === updatedOrder.id);
                
                // 🔔 NEW ORDER ALERT
                if (payload.eventType === 'INSERT' && !exists) {
                    playAlertSound();
                    setNotifications(prev => [{ id: Date.now(), title: '📦 New Order Received!', desc: `Order #${updatedOrder.order_no || updatedOrder.id} - ₹${updatedOrder.total_amount}`, type: 'order', refId: updatedOrder.id, isRead: false }, ...prev]);
                }
                
                // 🔔 NEW CUSTOMER MESSAGE ALERT
                if (payload.eventType === 'UPDATE' && exists) {
                    const oldMsgs = exists.messages || [];
                    if (parsedMsgs.length > oldMsgs.length) {
                        const lastMsg = parsedMsgs[parsedMsgs.length - 1];
                        if (lastMsg.sender === 'customer') {
                            playAlertSound();
                            setNotifications(prev => [{ id: Date.now(), title: '💬 New Customer Message', desc: `Order #${updatedOrder.order_no || updatedOrder.id}: ${lastMsg.text.substring(0,20)}...`, type: 'order_chat', refId: updatedOrder.id, isRead: false }, ...prev]);
                        }
                    }
                }

                if (exists) return prevOrders.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o);
                else return [updatedOrder, ...prevOrders];
            });
        }
    }).subscribe();

    // 🔥 REAL-TIME ADMIN HELP DESK CHATS
    const chatSubscription = supabase.channel('realtime-helpdesk').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'helpdesk_chats' }, (payload) => { 
        const newChat = payload.new;
        if(newChat.sender === 'admin' && String(newChat.shop_id) === String(currentShop?.id)) {
            playAlertSound();
            setNotifications(prev => [{ id: Date.now(), title: '🎧 Admin Support Reply', desc: newChat.message.substring(0,30) + '...', type: 'admin_chat', isRead: false }, ...prev]);
        }
    }).subscribe();

    return () => { 
      supabase.removeChannel(ordersSubscription); 
      supabase.removeChannel(chatSubscription);
    };
  }, [currentShop?.id]); 

  // ==========================================
  // 🔥 NOTIFICATION CLICK HANDLER 🔥
  // ==========================================
  const handleNotificationClick = (notif: any) => {
    // Mark as read
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    setShowNotifMenu(false);

    // Auto-Routing Logic
    if (notif.type === 'order' || notif.type === 'order_chat') {
        setActiveTab('orders');
        setTargetOrderId(notif.refId); 
    } else if (notif.type === 'admin_chat') {
        setOpenAdminChatTrigger(prev => prev + 1); 
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchAuthAndData = async () => {
    const { data: settingsData } = await supabase.from('app_settings').select('*').maybeSingle();
    if (settingsData) {
      if (settingsData.idCardUpi) setIdCardUpi(settingsData.idCardUpi);
      if (settingsData.premiumUpi) setPremiumUpi(settingsData.premiumUpi);
      if (settingsData.registrationUpi) setRegistrationUpi(settingsData.registrationUpi); 
    }

    let phoneNo = '';
    const savedShopData = localStorage.getItem('fixifiy_shop');
    if (savedShopData) {
       try { phoneNo = JSON.parse(savedShopData).phone; } catch(e) {}
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!phoneNo && session?.user) {
        let sessionPhone = session.user.email?.replace('@fixifiy.in', '').replace(/[^0-9]/g, '');
        if (sessionPhone && sessionPhone.startsWith('91') && sessionPhone.length === 12) {
            sessionPhone = sessionPhone.substring(2);
        }
        phoneNo = sessionPhone || '';
    }

    let shopData = null;

    if (phoneNo) {
        const { data } = await supabase.from('shops').select('*').eq('phone', phoneNo).maybeSingle();
        if (data) {
            shopData = data;
            setCurrentShop(data);
            localStorage.setItem('fixifiy_shop', JSON.stringify(data)); 
        }
    } else {
        router.push('/login');
        return;
    }
    
    fetchProducts(); 
    if(shopData?.id) fetchOrders(shopData.id); 
    fetchNotices(); 
  };

  const fetchNotices = async () => {
    const { data } = await supabase.from('notices').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (data) setNotices(data);
  };

  const fetchProducts = async () => { const { data } = await supabase.from('products').select('*'); if (data) setProducts(data); };
  
  const fetchOrders = async (shopIdToFetch?: string | number) => {
    const sid = shopIdToFetch !== undefined ? shopIdToFetch : currentShop?.id;
    if (!sid) return; 

    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }); 
      
    if (!error) {
      const parsedOrders = (data || []).map(order => {
        let parsedMsgs = order.messages;
        if (typeof parsedMsgs === 'string') { try { parsedMsgs = JSON.parse(parsedMsgs); } catch(e) { parsedMsgs = []; } }
        if (!Array.isArray(parsedMsgs)) parsedMsgs = [];
        return { ...order, messages: parsedMsgs };
      });

      const finalOrders = parsedOrders.filter(o => {
        const oShopId = String(o.shop_id || '').trim();
        const myShopId = String(sid).trim();
        if (String(o.type || '').trim() === 'Labour Booking') return false; 
        if (oShopId === myShopId) return true;
        return false; 
      });

      setOrders(finalOrders);
    }
  };

  const handleLogout = async () => { 
      if (window.confirm("Logout karein?")) { 
          localStorage.removeItem('fixifiy_shop'); 
          localStorage.removeItem('shop_login_time'); 
          await supabase.auth.signOut(); 
          router.push('/'); 
      } 
  };

  const handleConfirmPrimePayment = async () => {
    alert("✅ Welcome to Fixifiy Prime! Payment of ₹999 recorded.");
    if(currentShop?.id) {
       const { error } = await supabase.from('shops').update({ is_prime: true }).eq('id', currentShop.id);
       if (!error) setCurrentShop({...currentShop, is_prime: true});
    }
    setIsPrimeModalOpen(false);
  };

  return (
    <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', width: '100%', boxSizing: 'border-box', padding: '15px', color: 'white', fontFamily: 'sans-serif', position: 'relative', overflowX: 'hidden' }}>
      
      {/* 📢 NOTICE BOARD */}
      {notices.length > 0 && (
        <div style={{ backgroundColor: '#fef3c7', borderLeft: '5px solid #f59e0b', padding: '10px', borderRadius: '8px', marginBottom: '20px', color: '#b45309', display: 'flex', alignItems: 'center' }}>
          <strong style={{ fontSize: '16px', marginRight: '10px' }}>📢 NOTICE:</strong>
          <marquee behavior="scroll" direction="left" scrollamount="6" style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {notices.map((n, i) => <span key={i} style={{ marginRight: '40px' }}>⭐ {n.message}</span>)}
          </marquee>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px', position: 'relative' }}>
        
        <div onClick={() => setActiveTab('sales')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          {currentShop?.profile_pic ? <img src={currentShop.profile_pic} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ fontSize: '35px' }}>🏪</div>}
          <div>
            <h1 style={{ color: '#38bdf8', margin: 0, fontSize: '18px' }}>Fixifiy Shop Dashboard</h1>
            <p style={{ color: '#94a3b8', margin: '3px 0 0 0', fontSize: '13px' }}><strong>{currentShop?.name || 'New Shop'}</strong></p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* 🔥 NOTIFICATION BELL WITH DROPDOWN 🔥 */}
          <div style={{ position: 'relative' }}>
             <button onClick={() => setShowNotifMenu(!showNotifMenu)} style={{...editBtn, backgroundColor: '#334155', position: 'relative', fontSize: '16px', padding: '8px 12px'}}>
               🔔
               {unreadCount > 0 && <span style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px' }}>{unreadCount}</span>}
             </button>
             
             {showNotifMenu && (
               <div style={{ position: 'absolute', top: '45px', right: '0', width: '280px', backgroundColor: '#1e293b', border: '1px solid #38bdf8', borderRadius: '12px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                 <div style={{ padding: '12px 15px', backgroundColor: '#0284c7', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>Notifications</div>
                 <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No new notifications</div>
                    ) : (
                        notifications.map((n) => (
                            <div key={n.id} onClick={() => handleNotificationClick(n)} style={{ padding: '12px 15px', borderBottom: '1px solid #334155', cursor: 'pointer', backgroundColor: n.isRead ? '#1e293b' : '#0f172a', transition: '0.2s' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: n.isRead ? '#94a3b8' : '#38bdf8', marginBottom: '4px' }}>{n.title}</div>
                                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{n.desc}</div>
                            </div>
                        ))
                    )}
                 </div>
               </div>
             )}
          </div>

          <button onClick={() => setIsProfileModalOpen(true)} style={{...editBtn, backgroundColor: '#3b82f6'}}>⚙️ Profile</button>
          <button onClick={handleLogout} style={{...editBtn, backgroundColor: '#ef4444'}}>🚪 Logout</button>
        </div>
      </div>

      {/* TABS BUTTONS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '5px' }}>
        <button onClick={() => setActiveTab('sales')} style={tabBtn(activeTab === 'sales')}>📈 Sales & Ledger</button>
        <button onClick={() => setActiveTab('orders')} style={tabBtn(activeTab === 'orders')}>🛒 Orders</button>
        <button onClick={() => setActiveTab('inventory')} style={tabBtn(activeTab === 'inventory')}>📦 Inventory</button>
        <button onClick={() => setActiveTab('wallet')} style={tabBtn(activeTab === 'wallet')}>💳 Wallet</button>
        <button onClick={() => setActiveTab('stock')} style={tabBtn(activeTab === 'stock')}>📊 Stock Report</button>
      </div>

      {/* TABS CONTENT */}
      <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '10px', width: '100%', boxSizing: 'border-box' }}>
        {(activeTab === 'sales' || activeTab === 'stock') && <SalesAndStockTab activeTab={activeTab} orders={orders} currentShop={currentShop} products={products} fetchProducts={fetchProducts} fetchOrders={fetchOrders} />}
        
        {/* 🔥 PASSED targetOrderId TO OrdersTab 🔥 */}
        {activeTab === 'orders' && <OrdersTab targetOrderId={targetOrderId} setTargetOrderId={setTargetOrderId} orders={orders} setOrders={setOrders} products={products} currentShop={currentShop} fetchOrders={fetchOrders} fetchProducts={fetchProducts} />}
        
        {activeTab === 'inventory' && <InventoryTab products={products} fetchProducts={fetchProducts} currentShop={currentShop} />}
        {activeTab === 'wallet' && <ShopWalletPassbook supabase={supabase} shopUser={currentShop} setAppStep={() => setActiveTab('sales')} />}
      </div>

      {isProfileModalOpen && <ShopProfile currentShop={currentShop} setCurrentShop={setCurrentShop} onClose={() => setIsProfileModalOpen(false)} fetchAuthAndData={fetchAuthAndData} idCardUpi={idCardUpi} registrationUpi={registrationUpi} />}

      {/* 🔥 PASSED openAdminChatTrigger TO AdminSupportTab 🔥 */}
      <AdminSupportTab currentShop={currentShop} openTrigger={openAdminChatTrigger} />

    </div>
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({ padding: '10px 15px', backgroundColor: active ? '#38bdf8' : '#334155', border: 'none', borderRadius: '8px', color: active ? '#0f172a' : 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', flex: '1 0 auto', textAlign: 'center' });
const editBtn: React.CSSProperties = { padding: '6px 12px', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' };