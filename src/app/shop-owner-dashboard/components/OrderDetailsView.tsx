"use client";
import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import PermanentFreeCall from '@/components/PermanentFreeCall';
import { printShopInvoice, printDeliveryChallan, printMiniChallan } from './InvoiceHelper'; 
// 🔥 IMPORT YOUR NEW ACCEPT BUTTON COMPONENT HERE
import AcceptOrderButton from './AcceptOrderButton'; 

const ADMIN_COMMISSION_PERCENTAGE = 0.05;

export default function OrderDetailsView({
  selectedOrder, setSelectedOrder, orders, setOrders, 
  products, currentShop, fetchOrders, fetchProducts, deliveryBoys, setOrderSubTab
}: any) {
  
  const [chatMessage, setChatMessage] = useState('');
  const [activeCall, setActiveCall] = useState<{roomId: string, title: string} | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 🔥 NEW STATES FOR COLLAPSIBLE SECTIONS
  const [showChatBox, setShowChatBox] = useState(false);
  const [showReturnPolicySettings, setShowReturnPolicySettings] = useState(false);

  const getProductDetailsArray = (order: any) => {
    if (!order) return [];
    let details = order.product_details || order.items || order.products || order.cart_items || order.cart_details || order.order_items;
    if (!details) return [];
    if (Array.isArray(details)) return details;
    try { 
      let parsed = typeof details === 'string' ? JSON.parse(details) : details;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed); 
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  };

  const getShopItems = (order: any) => {
    return getProductDetailsArray(order).filter((item: any) => {
      const n = String(item.name || item.product_name || item.item_name || '').toLowerCase();
      const c = String(item.category || '').toLowerCase();
      const excludedWords = ['labour', 'mistri', 'mistry', 'mechanic', 'repair'];
      const isExcluded = excludedWords.some(word => n.includes(word) || c.includes(word)) || item.type === 'labour';
      return !isExcluded; 
    });
  };

  const isDeliveryOrService = (item: any) => {
    const n = String(item.name || item.product_name || item.item_name || '').toLowerCase();
    const c = String(item.category || '').toLowerCase();
    return n.includes('delivery') || n.includes('transport') || n.includes('shipping') || n.includes('freight') || n.includes('km') || n.includes('bhada') || n.includes('kiraya') || c.includes('service') || c.includes('transport');
  };

  const getShopTotal = (order: any) => {
    if (!order) return 0;
    const items = getShopItems(order);
    return items.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
  };

  const findLiveProduct = (item: any) => {
    if (!item || !products) return null;
    const itemId = item.product_id || item.item_id || item.id;
    if (itemId) {
      const exactMatch = products.find((p:any) => String(p.id) === String(itemId));
      if (exactMatch) return exactMatch;
    }
    const itemNameRaw = String(item.name || item.product_name || item.item_name || item.product || item.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!itemNameRaw) return null;

    return products.find((p:any) => {
      const dbName = String(p.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!dbName) return false;
      return dbName === itemNameRaw || dbName.includes(itemNameRaw) || itemNameRaw.includes(dbName);
    });
  };

  const getOrderColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'delivered' || s === 'completed' || s === 'complete') return '#10b981'; 
    if (s === 'accepted' || s === 'processing') return '#facc15'; 
    if (s.includes('out') || s.includes('transit')) return '#a855f7'; 
    if (s.includes('return') || s === 'refunded') return '#ef4444';
    if (s.includes('rto') || s.includes('fail') || s.includes('undeliver')) return '#f97316';
    if (s === 'awaiting customer') return '#f43f5e'; 
    return '#38bdf8'; 
  };

  const getDetailsColumnName = (order: any) => {
    if (order?.product_details) return 'product_details';
    if (order?.items) return 'items';
    if (order?.products) return 'products';
    if (order?.cart_items) return 'cart_items';
    return 'product_details'; 
  };

  const handleSendReply = async () => {
    if (!chatMessage.trim() || !selectedOrder) return;
    setIsProcessing(true);
    const tableName = (selectedOrder.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';
    
    let currentMessages = selectedOrder.messages;
    if (typeof currentMessages === 'string') {
        try { currentMessages = JSON.parse(currentMessages); } catch(e) { currentMessages = []; }
    }
    if (!Array.isArray(currentMessages)) currentMessages = [];

    const newMsg = { sender: 'shop', text: chatMessage, timestamp: new Date().toISOString() };
    const updatedMessages = [...currentMessages, newMsg];

    setSelectedOrder({ ...selectedOrder, messages: updatedMessages });
    setOrders((prev: any[]) => prev.map((o:any) => o.id === selectedOrder.id ? { ...o, messages: updatedMessages } : o));
    setChatMessage('');

    try {
      await supabase.from(tableName).update({ messages: updatedMessages }).eq('id', selectedOrder.id);
    } catch (err: any) {} 
    finally { setIsProcessing(false); }
  };

  const updateOrderStatus = async (id: number, newStatus: string) => {
    const orderToUpdate = orders.find((o:any) => o.id === id);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';
    
    const newShopId = currentShop?.id || orderToUpdate.shop_id; 
    let newDate = orderToUpdate.estimated_delivery || "";

    if (newStatus === 'accepted' || newStatus === 'out_for_delivery') {
      const askDate = prompt(
        "Kripya Delivery ka EXACT DATE aur TIME batayein:\n(Format: 15 August 2026, 04:30 PM)", 
        newDate || "15 August 2026, 04:30 PM"
      );
      if (askDate !== null && askDate.trim() !== "") newDate = askDate;
      else return; 
    }

    setIsProcessing(true);
    setOrders((prev:any[]) => prev.map((o:any) => o.id === id ? { ...o, status: newStatus, shop_id: newShopId, estimated_delivery: newDate } : o));
    setSelectedOrder((prev: any) => ({ ...prev, status: newStatus, estimated_delivery: newDate }));

    try {
      const { error } = await supabase.from(tableName).update({ status: newStatus, shop_id: newShopId, estimated_delivery: newDate }).eq('id', id);
      if (!error) { 
        fetchOrders(); 
        if (newStatus === 'accepted' || newStatus === 'out_for_delivery') { 
          setSelectedOrder(null); 
          if(setOrderSubTab) setOrderSubTab('local');
        }
      } else alert("Error updating order: " + error.message);
    } catch(e:any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const markDeliveryFailed = async (orderId: number) => {
    if (!window.confirm("Kya sach mein delivery fail ho gayi hai? Haan karne par yeh order RTO (Return to Origin) list me chala jayega.")) return;
    
    setIsProcessing(true);
    try {
      const orderToUpdate = orders.find((o:any) => o.id === orderId);
      const tableName = (orderToUpdate?.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';
      
      await supabase.from(tableName).update({ status: 'RTO Initiated' }).eq('id', orderId);
      
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: 'RTO Initiated' } : o));
      setSelectedOrder((prev: any) => ({ ...prev, status: 'RTO Initiated' }));
      alert("⚠️ Order marked as RTO (Delivery Failed). Ab aap ise receive kar sakte hain jab packet wapas aaye.");
    } catch(e:any) { alert(e.message); } 
    finally { setIsProcessing(false); }
  };

  const editEntireOrderDeliveryTime = async (orderId: number) => {
    const orderToUpdate = orders.find((o:any) => o.id === orderId);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

    const newTime = prompt("Naya Delivery Date aur Time dalein:\n(Format: 15 August 2026, 04:30 PM)", selectedOrder?.estimated_delivery || "15 August 2026, 04:30 PM");
    if (!newTime || newTime.trim() === "") return;
    
    setIsProcessing(true);
    try {
      const newShopId = currentShop?.id || orderToUpdate.shop_id;
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, estimated_delivery: newTime, shop_id: newShopId } : o));
      setSelectedOrder((prev: any) => ({ ...prev, estimated_delivery: newTime }));
      await supabase.from(tableName).update({ estimated_delivery: newTime, shop_id: newShopId }).eq('id', orderId);
      fetchOrders(); 
    } catch(e:any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const updateLiveLocation = async (orderId: number) => {
    const orderToUpdate = orders.find((o:any) => o.id === orderId);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

    const loc = prompt("Product abhi kahan pahuncha hai? (Jaise: 'Patna Hub pahunch gaya')", selectedOrder?.current_location || "");
    if (loc === null) return;

    setIsProcessing(true);
    try {
      const newShopId = currentShop?.id || orderToUpdate.shop_id;
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, current_location: loc } : o));
      setSelectedOrder((prev: any) => ({ ...prev, current_location: loc }));
      await supabase.from(tableName).update({ current_location: loc, shop_id: newShopId }).eq('id', orderId);
    } catch(e:any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const updateReturnPolicy = async (orderId: number, policyType: '24_hours' | '7_days' | 'none') => {
    const orderToUpdate = orders.find((o:any) => o.id === orderId);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

    const allowReturn = policyType !== 'none';
    const displayMsg = policyType === 'none' ? "Aap is order se Return Policy HATA rahe hain." : `Aap is order pe ${policyType === '24_hours' ? '24 Ghante' : '7 Din'} ka Return Allow kar rahe hain.`;
    
    if (!window.confirm(`${displayMsg} Are you sure?`)) return;

    setIsProcessing(true);
    try {
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, allow_return: allowReturn, return_window: policyType } : o));
      setSelectedOrder((prev: any) => ({ ...prev, allow_return: allowReturn, return_window: policyType }));
      
      const { error } = await supabase.from(tableName).update({ allow_return: allowReturn, return_window: policyType }).eq('id', orderId);
      if (error) throw error;
      
      alert("Return setting updated successfully!");
    } catch (e: any) { alert("Return setting update failed: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const toggleGSTStatus = async (orderId: number, currentStatus: boolean) => {
    const orderToUpdate = orders.find((o:any) => o.id === orderId);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

    setIsProcessing(true);
    const newStatus = !currentStatus;
    
    const sName = currentShop?.name || currentShop?.shop_name || 'Verified Retail Partner';
    const sGst = currentShop?.gst_number || currentShop?.gstin || currentShop?.gst || 'Unregistered';

    try {
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, has_gst: newStatus, shop_name: sName, shop_gstin: sGst } : o));
      setSelectedOrder((prev: any) => ({ ...prev, has_gst: newStatus, shop_name: sName, shop_gstin: sGst }));

      const { error } = await supabase.from(tableName).update({ 
          has_gst: newStatus,
          shop_name: sName,
          shop_gstin: sGst
      }).eq('id', orderId);

      if (error) throw error;
    } catch (e: any) { 
      alert("Error updating GST status: " + e.message); 
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, has_gst: currentStatus } : o));
      setSelectedOrder((prev: any) => ({ ...prev, has_gst: currentStatus }));
    } 
    finally { setIsProcessing(false); }
  };

  const assignDeliveryBoy = async (orderId: number, boyId: string) => {
    if (!boyId) return;
    setIsProcessing(true);
    try {
      const orderToUpdate = orders.find((o:any) => o.id === orderId);
      const tableName = (orderToUpdate?.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';
      await supabase.from(tableName).update({ delivery_boy_id: boyId }).eq('id', orderId);
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, delivery_boy_id: boyId } : o));
      setSelectedOrder((prev: any) => ({ ...prev, delivery_boy_id: boyId }));
      alert("✅ Delivery Partner ko order successfully assign ho gaya hai!");
    } catch(e:any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const acceptReturnRequest = async (orderId: number) => {
    setIsProcessing(true);
    try {
      const orderToUpdate = orders.find((o:any) => o.id === orderId);
      const tableName = (orderToUpdate?.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';
      await supabase.from(tableName).update({ status: 'Return Accepted' }).eq('id', orderId);
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: 'Return Accepted' } : o));
      setSelectedOrder((prev: any) => ({ ...prev, status: 'Return Accepted' }));
      alert("✅ Return Request Accept ho gayi. Kripya Pickup ke liye Delivery Boy assign karein.");
    } catch(e:any) { alert(e.message); } 
    finally { setIsProcessing(false); }
  };

  const rejectReturnRequest = async (orderId: number) => {
    const reason = prompt("Kripya Return Reject karne ka reason batayein (Customer ko yahi dikhega):");
    if (!reason) return; 

    setIsProcessing(true);
    try {
      const orderToUpdate = orders.find((o:any) => o.id === orderId);
      const tableName = (orderToUpdate?.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';
      
      await supabase.from(tableName).update({ status: 'Return Rejected', cancel_reason: reason }).eq('id', orderId);
      
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: 'Return Rejected' } : o));
      setSelectedOrder((prev: any) => ({ ...prev, status: 'Return Rejected' }));
      alert("❌ Return Request Reject kar di gayi hai.");
    } catch(e:any) { alert(e.message); } 
    finally { setIsProcessing(false); }
  };

  const processRefundAndRestock = async (orderId: number) => {
    if (!window.confirm(`Kya Delivery Boy ne item laakar aapko de diya hai aur aapne verify kar liya hai?\n\nHaan karne par:\n1. Aapki Shop Inventory me stock add ho jayega.\n2. Aapke Shop Wallet se paisa katega.\n3. Admin ko command chala jayega ki Customer ko paise bhej dein.`)) return;
    
    setIsProcessing(true);
    try {
      const orderToUpdate = orders.find((o:any) => o.id === orderId);
      const tableName = (orderToUpdate?.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

      const items = getProductDetailsArray(orderToUpdate);
      for (let item of items) {
        if (!isDeliveryOrService(item)) { 
          const liveProduct = findLiveProduct(item);
          if (liveProduct) {
            const liveStock = Number(liveProduct.total_stock) || 0;
            const reqQty = Number(item.quantity || item.qty) || 1;
            await supabase.from('products').update({ total_stock: liveStock + reqQty }).eq('id', liveProduct.id);
          }
        }
      }

      const itemsTotal = getShopTotal(orderToUpdate);
      const shopDebitAmt = Number((itemsTotal * 0.95).toFixed(2)); 

      if (currentShop?.id) {
          const { data: sData } = await supabase.from('shops').select('balance').eq('id', currentShop.id).single();
          const newBal = Number(((Number(sData?.balance) || 0) - shopDebitAmt).toFixed(2));
          
          const { error: balError } = await supabase.from('shops').update({ balance: newBal }).eq('id', currentShop.id);
          if (balError) throw new Error("Balance Cut Failed: " + balError.message);
          
          const { error: txError } = await supabase.from('wallet_transactions').insert({
             shop_id: currentShop.id,
             user_type: 'shop',
             amount: shopDebitAmt,
             type: 'debit',
             status: 'completed',
             reason: `Refund Deduction for Return (Order #${orderToUpdate.order_no || orderToUpdate.id})`
          });

          if (txError) throw new Error("Balance cut gaya par History save nahi hui: " + txError.message);
      }

      const { error: statusError } = await supabase.from(tableName).update({ 
        status: 'Refunded', 
        refund_status: 'Pending Admin Refund' 
      }).eq('id', orderId);
      
      if (statusError) throw new Error("Order Status Update Failed: " + statusError.message);

      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: 'Refunded', refund_status: 'Pending Admin Refund' } : o));
      setSelectedOrder((prev: any) => ({ ...prev, status: 'Refunded', refund_status: 'Pending Admin Refund' }));
      
      alert("✅ Verification Complete!\nStock add ho gaya hai aur Shop Wallet se paise deduct ho gaye hain.\nAdmin ke Wallet Manager mein Customer ko pay karne ki request successfully chali gayi hai.");
      fetchProducts();
    } catch(e:any) { 
      alert("⚠️ ERROR: " + e.message); 
    } 
    finally { setIsProcessing(false); }
  };

  const processRtoReceive = async (orderId: number) => {
    if (!window.confirm("Kya Undelivered/RTO package aapki shop pe wapas aa chuka hai?\n\nHaan karne par package ka stock wapas inventory me add ho jayega.")) return;
    
    setIsProcessing(true);
    try {
      const orderToUpdate = orders.find((o:any) => o.id === orderId);
      const tableName = (orderToUpdate?.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

      const items = getProductDetailsArray(orderToUpdate);
      for (let item of items) {
        if (!isDeliveryOrService(item)) { 
          const liveProduct = findLiveProduct(item);
          if (liveProduct) {
            const liveStock = Number(liveProduct.total_stock) || 0;
            const reqQty = Number(item.quantity || item.qty) || 1;
            await supabase.from('products').update({ total_stock: liveStock + reqQty }).eq('id', liveProduct.id);
          }
        }
      }

      await supabase.from(tableName).update({ status: 'RTO Received' }).eq('id', orderId);
      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: 'RTO Received' } : o));
      setSelectedOrder((prev: any) => ({ ...prev, status: 'RTO Received' }));
      
      alert("📦 RTO Package Successfully Received!\nItems wapas Stock me add kar diye gaye hain.");
      fetchProducts();
    } catch(e:any) { 
      alert("⚠️ ERROR: " + e.message); 
    } 
    finally { setIsProcessing(false); }
  };

  const sendToCustomerApproval = async (orderId: number) => {
    const orderToUpdate = orders.find((o:any) => o.id === orderId);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

    const items = getProductDetailsArray(orderToUpdate);
    const customMessage = prompt("Customer ko kya message dena chahte hain?", "Stock jaldi hi update hoga, kripya approval dein.");
    if (customMessage === null) return;

    setIsProcessing(true);
    const updatedProductDetails = items.map((prod: any) => ({ ...prod, shop_message: customMessage }));
    const colName = getDetailsColumnName(orderToUpdate);
    const newShopId = currentShop?.id || orderToUpdate.shop_id;
    
    setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: 'Awaiting Customer', shop_id: newShopId } : o));
    try {
      const { error } = await supabase.from(tableName).update({ [colName]: updatedProductDetails, status: 'Awaiting Customer', shop_id: newShopId }).eq('id', orderId);
      if (!error) fetchOrders();
    } catch (e: any) { alert("Error: " + e.message); } 
    finally { setIsProcessing(false); }
  };

  const markOrderAsCompleted = async (orderId: number) => {
    const orderToUpdate = orders.find((o:any) => o.id === orderId);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

    if (!window.confirm("Kya order deliver ho gaya hai? Isse Stock minus hoga aur Shop Wallet mein paise add honge.")) return;

    setIsProcessing(true);
    const newShopId = currentShop?.id || orderToUpdate.shop_id;
    
    const sName = currentShop?.name || currentShop?.shop_name || 'Verified Retail Partner';
    const sGst = currentShop?.gst_number || currentShop?.gstin || currentShop?.gst || 'Unregistered';

    setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: 'completed', shop_id: newShopId, shop_name: sName, shop_gstin: sGst } : o));

    try {
      const items = getProductDetailsArray(orderToUpdate);
      for (let item of items) {
        if (item.availability !== 'available' && !isDeliveryOrService(item)) { 
          const liveProduct = findLiveProduct(item);
          if (liveProduct) {
            const liveStock = Number(liveProduct.total_stock) || 0;
            const reqQty = Number(item.quantity || item.qty) || 1;
            await supabase.from('products').update({
              total_stock: liveStock - reqQty,
              sold_quantity: (Number(liveProduct.sold_quantity) || 0) + reqQty
            }).eq('id', liveProduct.id);
          }
        }
      }

      const itemsTotal = getShopTotal(orderToUpdate);
      const shopEarn = Number((itemsTotal * 0.95).toFixed(2));
      const adminEarn = Number((itemsTotal * 0.05).toFixed(2));

      if (currentShop?.id) {
          const { data: sData } = await supabase.from('shops').select('balance').eq('id', currentShop.id).single();
          const newBal = Number(((Number(sData?.balance) || 0) + shopEarn).toFixed(2));
          
          await supabase.from('shops').update({ balance: newBal }).eq('id', currentShop.id);

          const { error: txError } = await supabase.from('wallet_transactions').insert({
             shop_id: currentShop.id,
             user_type: 'shop',
             amount: shopEarn,
             type: 'credit',
             status: 'completed',
             reason: `Sales Earning (Order #${orderToUpdate.order_no || orderToUpdate.id})`
          });
          
          if (txError) {
             throw new Error("Balance badh gaya par History save nahi hui: " + txError.message);
          }
      }

      const updatedDetails = items.map((p: any) => ({ ...p, availability: 'available', shop_message: '✅ Delivered Successfully' }));
      const colName = getDetailsColumnName(orderToUpdate);
      
      const { error } = await supabase.from(tableName).update({ 
          status: 'completed', 
          [colName]: updatedDetails, 
          shop_id: newShopId,
          shop_name: sName,
          shop_gstin: sGst
      }).eq('id', orderId);

      if (!error) { 
        alert(`✅ Order Completed!\nShop Earned: ₹${shopEarn}\nAdmin Comm: ₹${adminEarn}`);
        setSelectedOrder(null); 
        if(setOrderSubTab) setOrderSubTab('history');
        fetchOrders(); fetchProducts(); 
      }
    } catch(e:any) { 
      alert("⚠️ ERROR: " + e.message); 
    } 
    finally { setIsProcessing(false); }
  };

  const modifyItemQuantity = async (orderId: number, itemIdx: number) => {
    const orderToUpdate = orders.find((o:any) => o.id === orderId);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

    try {
      const items = getShopItems(orderToUpdate); 
      const item = items[itemIdx];
      if(!item) return;

      const oldQty = Number(item.quantity || item.qty || 1);
      const displayUnit = item.unit || 'Pc';
      const newQtyStr = prompt(`Customer ne ${oldQty} ${displayUnit} manga hai. Aap abhi kitna de sakte hain?`, oldQty.toString());
      if (newQtyStr === null) return;
      
      const newQty = Number(newQtyStr);
      if (isNaN(newQty) || newQty < 0) return alert("Kripya sahi number daalein!");

      setIsProcessing(true);

      const originalTotalLinePrice = Number(item.price || 0);
      const singleUnitPrice = originalTotalLinePrice / oldQty;
      const newTotalLinePrice = singleUnitPrice * newQty;
      const priceDiff = originalTotalLinePrice - newTotalLinePrice;

      const fullItems = getProductDetailsArray(orderToUpdate);
      const updatedProductDetails = fullItems.map((prod: any) => {
          if (prod.name === item.name) return { ...prod, quantity: newQty, qty: newQty, price: newTotalLinePrice, shop_message: `Quantity updated to ${newQty} ${displayUnit}.` };
          return prod;
      });

      const newTotalAmount = Number(orderToUpdate.total_amount || 0) - priceDiff;
      const colName = getDetailsColumnName(orderToUpdate);
      const newShopId = currentShop?.id || orderToUpdate.shop_id;

      let autoStatus = orderToUpdate.status;
      if(['draft', 'pending', 'new', 'confirmed', 'new order'].includes(autoStatus.toLowerCase().trim())) autoStatus = 'accepted';

      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: autoStatus, shop_id: newShopId, [colName]: updatedProductDetails, total_amount: newTotalAmount } : o));
      const { error } = await supabase.from(tableName).update({ [colName]: updatedProductDetails, total_amount: newTotalAmount, status: autoStatus, shop_id: newShopId }).eq('id', orderId);
      if (!error) fetchOrders(); 
    } catch(e:any) {} 
    finally { setIsProcessing(false); }
  };

  const updateItemStockStatus = async (orderId: number, itemIdx: number, status: 'available' | 'out_of_stock') => {
    const orderToUpdate = orders.find((o:any) => o.id === orderId);
    if (!orderToUpdate) return;
    const tableName = (orderToUpdate.type || '').toLowerCase().includes('labour') ? 'labour_bookings' : 'orders';

    try {
      const items = getShopItems(orderToUpdate);
      const item = items[itemIdx];
      if(!item) return;
      if (status === 'available' && item.availability === 'available') return alert("Yeh item pehle se pack ho chuka hai.");

      if (status === 'available') {
        const liveProduct = findLiveProduct(item);
        if (liveProduct) {
          const liveStock = Number(liveProduct.total_stock) || 0;
          const reqQty = Number(item.quantity || item.qty) || 1;
          const displayUnit = liveProduct.unit || 'Pc';
          if (liveStock < reqQty) {
            const manualOverride = window.confirm(`⚠️ WARNING: Stock mein sirf ${liveStock} ${displayUnit} hain! Kya aap phir bhi isey Manual Pack karna chahte hain?`);
            if (!manualOverride) return;
          }
          setIsProcessing(true);
          await supabase.from('products').update({ total_stock: liveStock - reqQty, sold_quantity: (Number(liveProduct.sold_quantity) || 0) + reqQty }).eq('id', liveProduct.id);
        } else {
          setIsProcessing(true);
        }
      }

      const fullItems = getProductDetailsArray(orderToUpdate);
      const updatedProductDetails = fullItems.map((prod: any) => {
          if (prod.name === item.name) return { ...prod, availability: status, ...(status === 'available' ? { shop_message: "✅ Manually Packed." } : {}) };
          return prod;
      });

      const colName = getDetailsColumnName(orderToUpdate);
      const newShopId = currentShop?.id || orderToUpdate.shop_id;
      let autoStatus = orderToUpdate.status;
      if(['draft', 'pending', 'new', 'confirmed', 'new order'].includes(autoStatus.toLowerCase().trim())) autoStatus = 'accepted';

      setOrders((prev:any[]) => prev.map((o:any) => o.id === orderId ? { ...o, status: autoStatus, shop_id: newShopId } : o));
      await supabase.from(tableName).update({ [colName]: updatedProductDetails, status: autoStatus, shop_id: newShopId }).eq('id', orderId);
      fetchOrders(); fetchProducts();
    } catch(e:any) {} 
    finally { setIsProcessing(false); }
  };

  const openCustomerChat = (order: any) => {
    if(!order) return;
    let phone = order.user_phone || order.phone || order.mobile || '';
    if (!phone) return alert("Customer ka mobile number nahi mila.");
    if (!phone.startsWith('91') && !phone.startsWith('+91')) phone = '91' + phone;
    else if (phone.startsWith('+')) phone = phone.substring(1);
    
    const cName = order.customer_name || order.name || order.full_name || 'Customer';
    const message = `Namaste ${cName},\nMain Fixifiy (Shop) se baat kar raha hoon. Aapke Order #${order.order_no || order.id} ke baare mein kuch jankari chahiye thi.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleInitiateCall = (order: any) => {
    if (!order) return;
    setActiveCall({
      roomId: `shop_${currentShop?.id || order.shop_id || 'general'}`,
      title: `Calling Customer (${order.customer_name || 'Customer'})`
    });
  };

  const orderItems = getShopItems(selectedOrder);
  const cName = selectedOrder?.customer_name || selectedOrder?.name || selectedOrder?.full_name || 'Customer';
  const cPhone = selectedOrder?.user_phone || selectedOrder?.phone || selectedOrder?.mobile || 'N/A';
  const cLocation = selectedOrder?.location || selectedOrder?.address || selectedOrder?.delivery_address || 'Not Provided';
  
  const s = (selectedOrder?.status || '').toLowerCase().trim();
  const isCompleted = ['completed', 'complete', 'delivered', 'refunded'].includes(s);
  const isGlobalOrder = !selectedOrder?.shop_id || String(selectedOrder.shop_id) === 'null' || String(selectedOrder.shop_id).trim() === '';
  
  const isReturnRequested = s === 'return requested';
  const isReturnPickedUp = s === 'return picked up';
  const isReturnAccepted = s === 'return accepted';
  const isReturnPhase = isReturnRequested || isReturnPickedUp || isReturnAccepted;
  
  const isRtoPhase = (s.includes('rto') && s !== 'rto received') || s.includes('fail') || s.includes('undeliver');
  const isRtoCompleted = s === 'rto received';

  const itemsTotalAmt = getShopTotal(selectedOrder);
  const deliveryAmt = Number(selectedOrder?.delivery_charge || selectedOrder?.shipping_charge || selectedOrder?.shipping_fee || 0);
  
  const shopAdminFee = itemsTotalAmt * ADMIN_COMMISSION_PERCENTAGE;
  const shopEarn = itemsTotalAmt - shopAdminFee;

  const currentReturnWindow = selectedOrder?.return_window || (selectedOrder?.allow_return ? '24_hours' : 'none');

  return (
    <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #38bdf8', animation: 'fadeIn 0.3s' }}>
        
      {/* Header WITH BACK BUTTON */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderBottom: '2px solid #334155', paddingBottom: '15px', marginBottom: '20px' }}>
        <button 
          onClick={() => setSelectedOrder(null)} 
          style={{ background: '#334155', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          ⬅️ Back to List
        </button>
        <h2 style={{ color: '#38bdf8', margin: 0 }}>🧾 Order #{selectedOrder?.order_no || selectedOrder?.id}</h2>
      </div>

      {isGlobalOrder && (
        <div style={{ backgroundColor: '#fef3c7', borderLeft: '4px solid #f59e0b', padding: '15px', marginBottom: '20px', borderRadius: '6px', color: '#b45309', fontWeight: 'bold', fontSize: '15px' }}>
          🌐 GLOBAL MARKET ORDER - 'Accept Normal' par click karte hi ye order sirf aapki shop ke naam map ho jayega!
        </div>
      )}

      {/* Customer Details - Fully Responsive */}
      <div style={{ backgroundColor: '#0f172a', padding: '25px 20px 20px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #334155', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-12px', left: '20px', background: '#38bdf8', color: '#0f172a', padding: '2px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px' }}>CUSTOMER DETAILS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div><span style={{color: '#94a3b8', fontSize: '12px', display: 'block'}}>Customer Name</span> <strong style={{fontSize: '16px', color: '#f8fafc'}}>{cName}</strong></div>
          <div><span style={{color: '#94a3b8', fontSize: '12px', display: 'block'}}>Phone Number</span> <strong style={{fontSize: '16px', color: '#f8fafc'}}>📞 {cPhone}</strong></div>
          <div style={{gridColumn: '1 / -1'}}><span style={{color: '#94a3b8', fontSize: '12px', display: 'block'}}>Delivery Address</span> 
            <strong style={{fontSize: '15px', color: '#cbd5e1'}}>📍 {selectedOrder?.block ? `${selectedOrder.block}, ${selectedOrder.district}, ${selectedOrder.state}` : cLocation}</strong>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1px dashed #4ade80' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#4ade80', fontSize: '16px' }}>💵 Shop Earnings & Split</h3>
          <span style={{ backgroundColor: getOrderColor(selectedOrder?.status), color: '#fff', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase' }}>
            {(selectedOrder?.status || 'PENDING')}
          </span>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px solid #334155', maxWidth: '400px' }}>
          <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '10px' }}>🏪 Your Product Earnings</strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#cbd5e1' }}>
            <span>Items Total:</span> <span>₹{itemsTotalAmt.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#f87171', margin: '5px 0' }}>
            <span>Admin Commission (5%):</span> <span>- ₹{shopAdminFee.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', color: '#4ade80', fontWeight: 'bold', marginTop: '10px', borderTop: '1px solid #334155', paddingTop: '10px' }}>
            <span>Net Credit to Shop Wallet:</span> <span>₹{shopEarn.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* DELIVERY BOY ASSIGNMENT UI */}
      {!isGlobalOrder && !isReturnPhase && !s.includes('refund') && !isRtoPhase && !isRtoCompleted && (
        <div style={{ 
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          padding: '25px', 
          borderRadius: '14px', 
          marginBottom: '25px', 
          border: '2px solid #6366f1',
          boxShadow: '0 8px 25px rgba(99, 102, 241, 0.35)',
          position: 'relative', 
          overflow: 'hidden' 
        }}>
          <div style={{ position: 'absolute', top: '-15px', right: '-15px', fontSize: '110px', opacity: 0.1, transform: 'rotate(-15deg)' }}>🛵</div>
          
          <h4 style={{ margin: '0 0 15px 0', color: '#e0e7ff', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <div style={{ background: '#4f46e5', padding: '8px', borderRadius: '10px', display: 'flex', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
              <span style={{ fontSize: '22px' }}>🛵</span>
            </div>
            <strong style={{ color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Assign Delivery Partner</strong>
          </h4>
          
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
            
            <div style={{ 
              flex: 1, 
              minWidth: '260px', 
              background: 'rgba(15, 23, 42, 0.6)', 
              border: '2px solid #818cf8', 
              borderRadius: '10px', 
              padding: '6px',
              boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.4)'
            }}>
              <select 
                value={selectedOrder?.delivery_boy_id || ''} 
                onChange={(e) => assignDeliveryBoy(selectedOrder.id, e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px 15px', 
                  borderRadius: '6px', 
                  backgroundColor: '#1e293b', 
                  color: '#fff', 
                  border: 'none', 
                  outline: 'none', 
                  fontSize: '16px', 
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}
              >
                <option value="" style={{ color: '#94a3b8' }}>🚀 -- Tap to Choose Delivery Partner -- 🚀</option>
                {deliveryBoys.map((boy: any) => (
                  <option key={boy.id} value={boy.id} style={{ color: '#fff' }}>{boy.name} (Ph: {boy.phone})</option>
                ))}
              </select>
            </div>
            
            {selectedOrder?.delivery_boy_id ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: 'linear-gradient(to right, #059669, #10b981)', 
                padding: '12px 20px', 
                borderRadius: '10px', 
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                border: '1px solid #34d399'
              }}>
                <span style={{ fontSize: '20px', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))' }}>✅</span>
                <span style={{ color: '#fff', fontSize: '15px', fontWeight: 'bold', letterSpacing: '0.5px' }}>Partner Assigned</span>
              </div>
            ) : (
              <div style={{ 
                padding: '12px 20px', 
                borderRadius: '10px', 
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px dashed #f87171',
                color: '#fca5a5',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ fontSize: '16px' }}>⚠️</span> Pending Assignment
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items List */}
      <h3 style={{ color: '#f8fafc', marginBottom: '15px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>🛍️ Items Ordered:</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
        {!Array.isArray(orderItems) || orderItems.length === 0 ? (
          <p style={{color: '#f87171', padding: '10px', background: '#450a0a', borderRadius: '8px'}}>Is order mein aapki shop ka koi physical item nahi hai.</p>
        ) : orderItems.map((item: any, idx: number) => {
          const isDelivery = isDeliveryOrService(item); 
          const liveProduct = isDelivery ? null : findLiveProduct(item);
          const liveStock = liveProduct ? Number(liveProduct.total_stock) || 0 : 0;
          const reqQty = Number(item?.quantity || item?.qty) || 1;
          const isEnoughStock = isDelivery || liveStock >= reqQty;
          const isMatched = isDelivery || !!liveProduct; 
          const displayUnit = liveProduct?.unit || item?.unit || 'Pc';
          const totalLinePrice = Number(item.price || 0);
          const itemUnitPrice = reqQty > 0 ? (totalLinePrice / reqQty).toFixed(2) : 0;
          const itemImage = liveProduct?.image_url || liveProduct?.image || item?.image_url || item?.image || null;

          return (
            <div key={idx} style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '10px', border: isDelivery ? '1px solid #8b5cf6' : (isMatched ? '1px solid #334155' : '1px solid #ef4444') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    
                    {/* 🔥 ENHANCED IMAGE PREVIEW TRIGGER 🔥 */}
                    {itemImage && !isDelivery && (
                      <div 
                        onClick={() => setPreviewImage(itemImage)}
                        style={{ cursor: 'zoom-in', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                      >
                        <img 
                          src={itemImage} alt="Thumbnail" 
                          style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #38bdf8', backgroundColor: '#334155' }} 
                          onError={(e) => { e.currentTarget.src = "https://placehold.co/60x60/1e293b/fff?text=No+Img"; }}
                        />
                        <span style={{fontSize: '10px', color: '#38bdf8', marginTop: '4px'}}>🔍 Zoom</span>
                      </div>
                    )}

                    <div style={{ flex: 1 }}>
                      <strong 
                        style={{ fontSize: '16px', color: '#38bdf8', cursor: itemImage ? 'pointer' : 'default', textDecoration: itemImage ? 'underline' : 'none' }}
                        onClick={() => itemImage && setPreviewImage(itemImage)}
                      >
                        {item?.name || item?.product_name || item?.item_name || 'Item'}
                      </strong> <br/>
                      <span style={{ fontSize: '14px', color: '#cbd5e1', display: 'inline-block', marginTop: '4px' }}>
                        Qty: <strong>{reqQty} {displayUnit}</strong> | Rate: ₹{itemUnitPrice} | Total: ₹{totalLinePrice}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#1e293b', borderRadius: '6px', borderLeft: isDelivery ? '4px solid #8b5cf6' : (isMatched ? '4px solid #10b981' : '4px solid #ef4444'), width: 'fit-content' }}>
                    {isDelivery ? (
                      <span style={{ color: '#a855f7', fontSize: '13px', fontWeight: 'bold' }}>🚚 Delivery / Service</span>
                    ) : isMatched ? (
                      <>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Inventory Match: <strong style={{color: '#fff'}}>{liveProduct.name}</strong></span><br/>
                        <span style={{ color: isEnoughStock ? '#4ade80' : '#f87171', fontSize: '14px', fontWeight: 'bold' }}>📦 Live Stock: {liveStock} {displayUnit}</span>
                      </>
                    ) : (
                      <span style={{ color: '#f87171', fontSize: '13px', fontWeight: 'bold' }}>⚠️ Inventory Match Failed!</span>
                    )}
                  </div>

                  {!isDelivery && (
                    <div style={{ marginTop: '10px' }}>
                      {item?.availability === 'available' ? (
                        <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold', background: '#064e3b', padding: '4px 8px', borderRadius: '4px' }}>✅ Item Packed</span>
                      ) : (
                        isEnoughStock && isMatched ? 
                        <span style={{ color: '#4ade80', fontSize: '12px', fontWeight: 'bold' }}>✅ Ready to Pack</span> : 
                        <span style={{ color: '#f87171', fontSize: '12px', fontWeight: 'bold' }}>❌ Action Required</span>
                      )}
                    </div>
                  )}
                </div>

                {!isDelivery && !isReturnPhase && !s.includes('refund') && !isRtoPhase && !isRtoCompleted && (
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', width: '100%', maxWidth: '140px' }}>
                    <button onClick={() => modifyItemQuantity(selectedOrder.id, idx)} style={{ ...smallBtn, backgroundColor: '#f59e0b' }} disabled={isCompleted || isProcessing}>✏️ Edit Qty</button>
                    <button onClick={() => updateItemStockStatus(selectedOrder.id, idx, 'available')} style={{ ...smallBtn, backgroundColor: isMatched ? '#10b981' : '#64748b', cursor: isMatched && !isCompleted ? 'pointer' : 'not-allowed', opacity: isMatched ? 1 : 0.6 }} disabled={isCompleted || !isMatched || isProcessing}>📦 Pack Item</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* PRINTING BUTTONS AREA */}
      <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px dashed #38bdf8' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '15px' }}>🖨️ Print Documents (A4 Size)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          
          <button 
            onClick={() => printShopInvoice(selectedOrder, currentShop, orderItems)} 
            style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '12px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
          >
            📄 Full GST Bill (2/Page)
          </button>
          
          <button 
            onClick={() => printDeliveryChallan(selectedOrder, currentShop, orderItems)} 
            style={{ backgroundColor: '#f59e0b', color: '#000', border: 'none', padding: '12px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
          >
            🚚 Large Label (2/Page)
          </button>
          
          <button 
            onClick={() => printMiniChallan(selectedOrder, currentShop, orderItems)} 
            style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '12px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
          >
            📦 Mini Label (4/Page)
          </button>

        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#94a3b8' }}>* Delivery Challan pe Mobile Number nahi hoga (Security for RTO). QR code scan karke details dekhein.</p>

        <div style={{ marginTop: '15px', padding: '15px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ color: '#cbd5e1', fontSize: '14px', flex: '1 1 200px' }}>
             <strong>📄 Customer GST Bill Access:</strong> <br/>
             <span style={{ fontSize: '12px', color: '#94a3b8' }}>Agar yeh ON hai, toh customer ko apne app me GST Bill download karne ka option milega.</span>
          </div>
          <button 
             onClick={() => toggleGSTStatus(selectedOrder.id, selectedOrder?.has_gst)} 
             disabled={isProcessing}
             style={{
               background: selectedOrder?.has_gst ? '#10b981' : '#334155',
               color: 'white',
               border: selectedOrder?.has_gst ? '1px solid #059669' : '1px solid #475569',
               padding: '10px 20px',
               borderRadius: '6px',
               fontWeight: 'bold',
               cursor: isProcessing ? 'wait' : 'pointer',
               flex: '0 0 auto'
             }}
          >
             {isProcessing ? '⏳...' : (selectedOrder?.has_gst ? '✅ GST Bill ON' : '❌ GST Bill OFF')}
          </button>
        </div>
      </div>

      {/* 🔥 NEW: COLLAPSIBLE RETURN POLICY SETTINGS 🔥 */}
      <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '20px' }}>
        <button 
          onClick={() => setShowReturnPolicySettings(!showReturnPolicySettings)}
          style={{ width: '100%', background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '16px', fontWeight: 'bold', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
        >
          <span>🔄 Manage Return Policy (Currently: {currentReturnWindow.replace('_', ' ')})</span>
          <span>{showReturnPolicySettings ? '▲' : '▼'}</span>
        </button>
        
        {showReturnPolicySettings && (
          <div style={{ marginTop: '15px', borderTop: '1px dashed #334155', paddingTop: '15px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => updateReturnPolicy(selectedOrder.id, '24_hours')} 
                disabled={isProcessing}
                style={{ flex: '1 1 120px', background: currentReturnWindow === '24_hours' ? '#10b981' : '#334155', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: isProcessing ? 'wait' : 'pointer' }}
              >
                24 Hours
              </button>
              <button 
                onClick={() => updateReturnPolicy(selectedOrder.id, '7_days')} 
                disabled={isProcessing}
                style={{ flex: '1 1 120px', background: currentReturnWindow === '7_days' ? '#3b82f6' : '#334155', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: isProcessing ? 'wait' : 'pointer' }}
              >
                7 Days
              </button>
              <button 
                onClick={() => updateReturnPolicy(selectedOrder.id, 'none')} 
                disabled={isProcessing}
                style={{ flex: '1 1 120px', background: currentReturnWindow === 'none' ? '#ef4444' : '#334155', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: isProcessing ? 'wait' : 'pointer' }}
              >
                No Return
              </button>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>* Customer can request return within this selected window.</p>
          </div>
        )}
      </div>

      {/* RTO PHASE */}
      {isRtoPhase && (
        <div style={{ background: '#451a03', padding: '20px', borderRadius: '12px', border: '2px solid #f59e0b', marginBottom: '25px' }}>
          <h3 style={{ color: '#fcd34d', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📦 RTO (Return To Origin) Phase
          </h3>
          <p style={{ color: '#fef3c7', fontSize: '14px', marginBottom: '15px' }}>
            Customer tak item deliver nahi ho paya. Delivery Boy ne ise RTO mark kiya hai. 
            <br/><br/><strong>Current Status:</strong> {selectedOrder?.status?.toUpperCase()}
          </p>
          <div style={{ background: '#78350f', padding: '15px', borderRadius: '8px', border: '1px solid #b45309' }}>
             <p style={{ color: '#fde68a', margin: '0 0 10px 0', fontSize: '14px' }}><strong>Action Required:</strong> Jab RTO package aapko theek thak mil jaye, tab Verify karke receive karein (Isse stock wapas add ho jayega).</p>
             <button onClick={() => processRtoReceive(selectedOrder.id)} disabled={isProcessing} style={{ ...actionBtnStyle, backgroundColor: '#f59e0b', width: '100%', padding: '15px', fontSize: '16px' }}>
               {isProcessing ? '⏳ Processing...' : '✅ Mark RTO Received & Restock Inventory'}
             </button>
          </div>
        </div>
      )}

      {/* RETURN MANAGEMENT SYSTEM */}
      {isReturnPhase ? (
        <div style={{ background: '#3f1d1d', padding: '20px', borderRadius: '12px', border: '2px solid #ef4444', marginBottom: '25px' }}>
          <h3 style={{ color: '#fca5a5', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>🚨 Return & Verification Phase</h3>
          <p style={{ color: '#f8fafc', fontSize: '14px', marginBottom: '15px' }}><strong>Current Status:</strong> <span style={{color: '#fcd34d'}}>{selectedOrder?.status?.toUpperCase()}</span></p>

          {isReturnRequested && (
            <div style={{ background: '#7f1d1d', padding: '15px', borderRadius: '8px' }}>
              <p style={{ color: '#fecaca', margin: '0 0 10px 0', fontSize: '13px' }}>Step 1: Customer ki return request aayi hai. Reason check karke Accept ya Reject karein.</p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => acceptReturnRequest(selectedOrder.id)} disabled={isProcessing} style={{ ...actionBtnStyle, backgroundColor: '#f59e0b', flex: 1 }}>{isProcessing ? '⏳...' : '✅ Accept Return Request'}</button>
                <button onClick={() => rejectReturnRequest(selectedOrder.id)} disabled={isProcessing} style={{ ...actionBtnStyle, backgroundColor: '#ef4444', flex: 1 }}>{isProcessing ? '⏳...' : '❌ Reject Return'}</button>
              </div>
            </div>
          )}
          {isReturnAccepted && (
            <div style={{ background: '#7f1d1d', padding: '15px', borderRadius: '8px', marginTop: isReturnRequested ? '10px' : '0' }}>
              <p style={{ color: '#fecaca', margin: '0 0 10px 0', fontSize: '13px' }}>Step 2: Return Pickup ke liye upar list se <strong>Delivery Partner</strong> assign karein.</p>
            </div>
          )}
          {isReturnPickedUp && (
            <div style={{ background: '#064e3b', padding: '15px', borderRadius: '8px', marginTop: '10px', border: '1px solid #10b981' }}>
              <p style={{ color: '#a7f3d0', margin: '0 0 10px 0', fontSize: '14px' }}><strong>Step 3: Verify Item & Send Admin Command</strong><br/>Jab item aapko shop pe mil jaye, tab Verify karein.</p>
              <button onClick={() => processRefundAndRestock(selectedOrder.id)} disabled={isProcessing} style={{ ...actionBtnStyle, backgroundColor: '#10b981', width: '100%', padding: '15px' }}>
                {isProcessing ? '⏳ Processing...' : '📦 Item Received at Shop (Verify & Refund Customer)'}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Normal Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        
        {!isReturnPhase && !s.includes('refund') && !isRtoPhase && !isRtoCompleted && (
          <>
            {/* 🔥 NEW ACCEPT BUTTON (WITH UPI LOCK) 🔥 */}
            <AcceptOrderButton 
              orderId={selectedOrder.id} 
              currentStatus={selectedOrder.status} 
              paymentMethod={selectedOrder.payment_method} 
              paymentStatus={selectedOrder.payment_status} 
              onStatusChange={fetchOrders} 
            />
            
            <button onClick={() => sendToCustomerApproval(selectedOrder.id)} style={{ ...actionBtnStyle, backgroundColor: '#f59e0b' }} disabled={isCompleted || isProcessing}>{isProcessing ? '⏳...' : '⚠️ Send to Customer Approval'}</button>
            <button onClick={() => updateOrderStatus(selectedOrder.id, 'out_for_delivery')} style={{ ...actionBtnStyle, backgroundColor: '#a855f7' }} disabled={isCompleted || isProcessing}>{isProcessing ? '⏳...' : '🛵 Mark Out for Delivery'}</button>
          </>
        )}

        <button onClick={() => openCustomerChat(selectedOrder)} style={{ ...actionBtnStyle, backgroundColor: '#25d366' }}>💬 WhatsApp Customer</button>
        <button onClick={() => handleInitiateCall(selectedOrder)} style={{ ...actionBtnStyle, backgroundColor: '#16a34a' }}>📞 Free Internet Call</button>
        
        {!isReturnPhase && !s.includes('refund') && !isRtoPhase && !isRtoCompleted && (
          <button onClick={() => updateLiveLocation(selectedOrder.id)} style={{ ...actionBtnStyle, backgroundColor: '#0284c7' }} disabled={isCompleted || isProcessing}>{isProcessing ? '⏳...' : '📍 Update Live Location'}</button>
        )}
        
        {!isReturnPhase && !s.includes('refund') && !isRtoPhase && !isRtoCompleted && (
          <button onClick={() => editEntireOrderDeliveryTime(selectedOrder.id)} style={{ ...actionBtnStyle, backgroundColor: '#6366f1' }} disabled={isCompleted || isProcessing}>{isProcessing ? '⏳...' : '⏱️ Reschedule Delivery Date/Time'}</button>
        )}
        
        {(s === 'out_for_delivery' || s.includes('out') || s.includes('transit')) && (
          <button onClick={() => markDeliveryFailed(selectedOrder.id)} style={{ ...actionBtnStyle, backgroundColor: '#f97316' }} disabled={isProcessing}>{isProcessing ? '⏳...' : '❌ Mark Delivery Failed (RTO)'}</button>
        )}
        
        {!isReturnPhase && !s.includes('refund') && !isRtoPhase && !isRtoCompleted && (
          <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
            <button onClick={() => markOrderAsCompleted(selectedOrder.id)} style={{ width: '100%', padding: '16px', backgroundColor: isCompleted ? '#334155' : '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px', cursor: isCompleted || isProcessing ? 'not-allowed' : 'pointer', boxShadow: isCompleted ? 'none' : '0 4px 10px rgba(239, 68, 68, 0.3)', opacity: isProcessing ? 0.7 : 1 }} disabled={isCompleted || isProcessing}>
              {isProcessing ? '⏳ PROCESSING...' : (isCompleted ? '✅ ALREADY DELIVERED' : '🏁 Mark Delivered & Add to Wallet')}
            </button>
          </div>
        )}
      </div>

      {/* 🔥 NEW: COLLAPSIBLE IN-APP CHAT SECTION 🔥 */}
      <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #334155', marginTop: '20px' }}>
        <button 
          onClick={() => setShowChatBox(!showChatBox)}
          style={{ width: '100%', background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '16px', fontWeight: 'bold', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
        >
          <span>💬 In-App Customer Chat</span>
          <span>{showChatBox ? '▲' : '▼'}</span>
        </button>

        {showChatBox && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ height: '250px', overflowY: 'auto', backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(() => {
                let displayMsgs = selectedOrder?.messages;
                if (typeof displayMsgs === 'string') { try { displayMsgs = JSON.parse(displayMsgs); } catch(e) { displayMsgs = []; } }
                if (!Array.isArray(displayMsgs)) displayMsgs = [];
                if (displayMsgs.length === 0) return <p style={{color: '#64748b', textAlign: 'center'}}>No messages yet.</p>;

                return displayMsgs.map((msg: any, idx: number) => (
                  <div key={idx} style={{ alignSelf: msg.sender === 'shop' || msg.sender === 'admin' ? 'flex-end' : 'flex-start', backgroundColor: msg.sender === 'shop' || msg.sender === 'admin' ? '#10b981' : '#334155', color: 'white', padding: '8px 12px', borderRadius: '8px', maxWidth: '80%', fontSize: '13px' }}>
                    <div style={{ fontSize: '10px', color: '#e2e8f0', marginBottom: '4px' }}>{msg.sender === 'customer' ? 'Customer' : 'You (Shop)'}</div>
                    <div>{msg.text}</div>
                    {msg.imageUrl && <img src={msg.imageUrl} alt="attachment" style={{width: '100%', marginTop: '5px', borderRadius: '4px'}}/>}
                  </div>
                ));
              })()}
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendReply()} placeholder="Type a reply to customer..." disabled={isProcessing} style={{ flex: 1, minWidth: '200px', padding: '12px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', outline: 'none' }} />
              <button onClick={handleSendReply} disabled={isProcessing} style={{ flex: '0 0 auto', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: isProcessing ? 'wait' : 'pointer' }}>{isProcessing ? '⏳' : 'Send Reply'}</button>
            </div>
          </div>
        )}
      </div>

      {/* 🔥 ENHANCED IMAGE LIGHTBOX PREVIEW 🔥 */}
      {previewImage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: '20px', boxSizing: 'border-box' }} 
          onClick={() => setPreviewImage(null)}
        >
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: '100%', maxHeight: '100%' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }} 
              style={{ position: 'absolute', top: '-40px', right: '0', background: 'transparent', border: 'none', color: '#fff', fontSize: '35px', cursor: 'pointer', fontWeight: 'bold', zIndex: 100000 }}
            >
              &times;
            </button>
            <img 
              src={previewImage} 
              alt="Preview" 
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,1)' }} 
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}

      {/* Active Call UI */}
      {activeCall && (
        <div style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10005}}>
          <div style={{backgroundColor: '#1e293b', padding: '30px', borderRadius: '16px', width: '90%', maxWidth: '350px', border: '1px solid #38bdf8', textAlign: 'center'}}>
             <h3 style={{ margin: '0 0 10px 0', color: '#38bdf8' }}>Connecting Call...</h3>
             <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: '14px' }}>{activeCall.title}</p>
             <div style={{ height: '300px', backgroundColor: '#0f172a', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #334155' }}>
                <PermanentFreeCall roomID={activeCall.roomId} customerName={currentShop?.name || "Shop Owner"} />
             </div>
             <button onClick={() => setActiveCall(null)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '30px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', width: '100%' }}>End Call & Close</button>
          </div>
        </div>
      )}

    </div>
  );
}

const actionBtnStyle: React.CSSProperties = { padding: '12px', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', textAlign: 'center', transition: '0.2s' };
const smallBtn: React.CSSProperties = { padding: '8px 12px', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' };