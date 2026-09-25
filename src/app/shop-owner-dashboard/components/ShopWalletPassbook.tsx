"use client";
import React, { useState, useEffect } from 'react';

export default function ShopWalletPassbook({ supabase, shopUser, setAppStep, onGoToOrder }: any) {
  // Balances State
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [withdrawableBalance, setWithdrawableBalance] = useState<number>(0);
  const [clearingBalance, setClearingBalance] = useState<number>(0); 
  const [pendingClearance, setPendingClearance] = useState<number>(0);
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(10);

  // Withdraw State
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState('all'); 
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Modals
  const [selectedTxnDetails, setSelectedTxnDetails] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [txnToDelete, setTxnToDelete] = useState<any>(null);

  // Dynamic Commission
  const [dynamicAdminCommission, setDynamicAdminCommission] = useState(0.05); 
  const [categoryRates, setCategoryRates] = useState<any>({});

  useEffect(() => {
    const fetchDatabaseCommission = async () => {
      try {
        const { data } = await supabase.from('app_settings').select('commission_rate, category_commissions').eq('id', 1).maybeSingle();
        if (data) {
          if (data.commission_rate !== undefined && data.commission_rate !== null) {
            let rate = Number(data.commission_rate);
            if (rate > 1) rate = rate / 100;
            setDynamicAdminCommission(rate);
          }
          if (data.category_commissions) {
            let parsed = data.category_commissions;
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            setCategoryRates(parsed);
          }
        }
      } catch (e) {
        console.warn("Commission load error:", e);
      }
    };
    fetchDatabaseCommission();
  }, [supabase]);

  useEffect(() => {
    if (shopUser?.id) {
      fetchShopWalletData();
    } else {
      setIsLoading(false);
    }
  }, [shopUser, dynamicAdminCommission, categoryRates]);

  const getProductDetailsArray = (order: any) => {
    let details = order.product_details || order.items || order.cart_items || order.products || [];
    if (Array.isArray(details)) return details;
    try { return JSON.parse(details); } catch (e) { return []; }
  };

  // 🔥 FINANCIAL CALCULATOR 🔥
  const calculateFinances = (order: any) => {
    const items = getProductDetailsArray(order);
    let calcItemTotal = 0;
    let calcAdminComm = 0;

    if (items.length > 0) {
      items.forEach((item: any) => {
        const n = String(item.name || item.product_name || '').toLowerCase();
        const c = String(item.category || '').toLowerCase().trim();
        
        const isExcluded = ['labour', 'mistri', 'mechanic', 'repair'].some(w => n.includes(w) || c.includes(w)) || item.type === 'labour';
        const isDelivery = n.includes('delivery') || n.includes('transport') || n.includes('shipping') || n.includes('freight');

        if (!isExcluded && !isDelivery) {
          const qty = Number(item.quantity || item.qty || 1);
          const lineTotal = Number(item.price || 0) * qty;

          let rate = dynamicAdminCommission;
          if (categoryRates && Object.keys(categoryRates).length > 0) {
             const matchedKey = Object.keys(categoryRates).find(k => k.toLowerCase().trim() === c);
             if (matchedKey && categoryRates[matchedKey] !== undefined) {
               let catRate = Number(categoryRates[matchedKey]);
               if (catRate > 1) catRate = catRate / 100;
               rate = catRate;
             }
          }

          calcItemTotal += lineTotal;
          calcAdminComm += (lineTotal * rate);
        }
      });
    }

    const totalBill = Number(order.total_amount || 0);
    const deliveryCharge = Number(order.delivery_charge || order.delivery_fee || 0);
    
    if (calcItemTotal === 0 && totalBill > 0) {
       calcItemTotal = Math.max(0, totalBill - deliveryCharge);
       calcAdminComm = calcItemTotal * dynamicAdminCommission;
    }

    const netEarning = calcItemTotal - calcAdminComm; 
    return { totalBill, deliveryCharge, itemTotal: calcItemTotal, adminComm: calcAdminComm, netEarning };
  };

  // 🔥 MAIN WALLET ENGINE 🔥
  const fetchShopWalletData = async () => {
    try {
      setIsLoading(true);

      // Yahan filter nahi laga rahe taki crash na ho agar column exist na kare
      const { data: ordersData } = await supabase.from('orders').select('*').eq('shop_id', shopUser.id);
      const { data: walletData } = await supabase.from('wallet_transactions').select('*').eq('shop_id', shopUser.id);

      let unifiedLedger: any[] = [];
      
      let pendingAmt = 0;   // Accepted, in transit
      let clearingAmt = 0;  // Delivered < 7 Days
      let availableAmt = 0; // Delivered >= 7 Days
      let totalDebits = 0;  // Past Withdrawals

      const clearedStatuses = ['completed', 'delivered', 'return accepted'];
      const pendingStatuses = ['accepted', 'processing', 'out_for_delivery', 'shipped'];
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days
      const now = Date.now();

      // 1. ORDERS CALCULATION
      (ordersData || []).forEach((o: any) => {
        const status = String(o.status || '').toLowerCase().trim();
        const calc = calculateFinances(o);
        const orderTime = new Date(o.created_at).getTime();
        const isSevenDaysOld = (now - orderTime) >= SEVEN_DAYS_MS;

        // Balance calculate karna (Bina hide kiye)
        if (clearedStatuses.includes(status)) {
          if (isSevenDaysOld) availableAmt += calc.netEarning;
          else clearingAmt += calc.netEarning;
        } else if (pendingStatuses.includes(status)) {
          pendingAmt += calc.netEarning;
        }

        // Ledger List mein dalna (Sirf unhe jo delete/hide nahi kiye gaye)
        if (!o.wallet_hidden) {
          if (clearedStatuses.includes(status)) {
            unifiedLedger.push({
              id: 'order_' + o.id, real_id: o.id, type: 'credit', amount: calc.netEarning,
              admin_fee_deducted: calc.adminComm, reason: `Order Earnings #${o.order_no || o.id}`,
              created_at: o.created_at, status: isSevenDaysOld ? 'cleared' : 'clearing', raw_data: o,
              search_key: `${o.order_no || ''} ${o.id}`.toLowerCase()
            });
          } else if (pendingStatuses.includes(status)) {
            unifiedLedger.push({
              id: 'order_' + o.id, real_id: o.id, type: 'credit', amount: calc.netEarning,
              admin_fee_deducted: calc.adminComm, reason: `Order Processing #${o.order_no || o.id}`,
              created_at: o.created_at, status: 'pending_delivery', raw_data: o,
              search_key: `${o.order_no || ''} ${o.id}`.toLowerCase()
            });
          }
        }
      });

      // 2. WITHDRAWALS CALCULATION
      (walletData || []).forEach((w: any) => {
        let tokenNo = w.token_no;
        if (!tokenNo || tokenNo.startsWith('TXN-') || tokenNo.includes('-')) {
          tokenNo = `FIX-${String(w.id).slice(-4).padStart(4, '0')}`;
        }

        if (w.type === 'debit' && (w.status === 'completed' || w.status === 'pending')) {
           totalDebits += Number(w.amount);
        }

        if (!w.wallet_hidden) {
          unifiedLedger.push({
            id: 'txn_' + w.id, real_id: w.id, type: w.type, amount: Number(w.amount),
            reason: w.reason || 'Withdrawal Request', created_at: w.created_at, status: w.status,
            token_no: tokenNo, raw_data: w,
            search_key: `${tokenNo} ${w.utr_no || ''} ${w.reason || ''}`.toLowerCase()
          });
        }
      });

      // Final Math Sort
      unifiedLedger.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      availableAmt -= totalDebits; // Withdrawals sirf main balance se katenge

      const totalAll = Math.max(0, availableAmt + clearingAmt + pendingAmt);
      setTotalBalance(totalAll);
      setWithdrawableBalance(Math.max(0, availableAmt)); 
      setClearingBalance(Math.max(0, clearingAmt));
      setPendingClearance(Math.max(0, pendingAmt));
      setTransactions(unifiedLedger);

      // Safe DB Update
      await supabase.from('shops').update({ balance: Math.max(0, availableAmt + clearingAmt) }).eq('id', shopUser.id);

    } catch (e: any) {
      console.error("Error calculating shop wallet:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 DELETE HISTORY SECURELY WITH PIN 🔥
  const confirmDeleteTransaction = async () => {
    if (!deletePassword) return alert("Kripya apna Shop Password daalein.");
    if (deletePassword !== shopUser.password) {
      return alert("❌ Galat Password! Record hide nahi hua.");
    }

    setIsProcessing(true);
    try {
      if (txnToDelete.id.startsWith('order_')) {
        const { error } = await supabase.from('orders').update({ wallet_hidden: true }).eq('id', txnToDelete.real_id);
        if (error) {
          alert("Aapke database me 'wallet_hidden' column nahi hai. Kripya Admin SQL Editor se isey add karein.");
          throw error;
        }
      } 
      else if (txnToDelete.id.startsWith('txn_')) {
        const { error } = await supabase.from('wallet_transactions').update({ wallet_hidden: true }).eq('id', txnToDelete.real_id);
        if (error) {
          alert("Aapke database me 'wallet_hidden' column nahi hai. Kripya Admin SQL Editor se isey add karein.");
          throw error;
        }
      }

      alert("✅ Record successfully cleared from Wallet screen!\n(Aapka balance wahi rahega, sirf history chhupegi)");
      setDeleteModalOpen(false);
      setSelectedTxnDetails(null);
      fetchShopWalletData(); 
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdrawRequest = async () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) return alert("Kripya sahi amount daalein.");
    if (amt > withdrawableBalance) return alert(`Aap abhi sirf ₹${withdrawableBalance.toFixed(2)} nikal sakte hain.`);

    setIsProcessing(true);
    try {
      const uniqueTokenNo = `FIX-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error: txnError } = await supabase.from('wallet_transactions').insert({
        shop_id: shopUser.id, user_type: 'shop', amount: amt, type: 'debit',
        status: 'pending', reason: `Shop Withdrawal Request`, token_no: uniqueTokenNo 
      });

      if (txnError) throw txnError;

      alert(`✅ ₹${amt} ka withdrawal request bhej diya gaya hai!\n🎫 Token Number: ${uniqueTokenNo}`);
      setShowWithdraw(false); 
      setWithdrawAmount('');
      fetchShopWalletData(); 
    } catch (e: any) { 
      alert("Withdrawal Error: " + e.message); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  // 🔥 ADVANCED FILTERING (Date to Date) 🔥
  const filteredTransactions = transactions.filter((txn: any) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = txn.search_key.includes(query) || txn.reason.toLowerCase().includes(query) || String(txn.amount).includes(query);
      if (!matchesSearch) return false;
    }

    const d = new Date(txn.created_at);
    d.setHours(0,0,0,0);
    const today = new Date(); 
    today.setHours(0,0,0,0);

    if (timeframe === 'today') return d.getTime() === today.getTime();
    if (timeframe === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return d >= weekAgo;
    }
    if (timeframe === 'month') return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    if (timeframe === 'custom') {
      if (!customStartDate || !customEndDate) return true;
      const start = new Date(customStartDate); start.setHours(0,0,0,0);
      const end = new Date(customEndDate); end.setHours(23,59,59,999);
      return d >= start && d <= end;
    }
    
    return true;
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif', padding: '20px' }}>
      
      <div style={{ background: '#0f172a', padding: '15px 20px', color: 'white', display: 'flex', alignItems: 'center', gap: '15px', borderRadius: '12px', marginBottom: '20px' }}>
        <button onClick={() => setAppStep('sales')} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>←</button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>Shop Owner Wallet</h2>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '16px', padding: '25px 20px', color: 'white', marginBottom: '25px', boxShadow: '0 10px 25px rgba(15, 23, 42, 0.3)', border: '1px solid #334155' }}>
        
        {/* MAIN WALLET SECTION */}
        <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px dashed #475569' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#cbd5e1' }}>Available Main Balance</p>
          <h1 style={{ margin: 0, fontSize: '42px', fontWeight: '900', color: '#10b981' }}>
            ₹{withdrawableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#64748b' }}>* Delivered orders older than 1 week.</p>
          
          <button 
            onClick={() => setShowWithdraw(true)}
            style={{ marginTop: '15px', background: withdrawableBalance > 0 ? '#10b981' : '#475569', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: withdrawableBalance > 0 ? 'pointer' : 'not-allowed', width: '100%', maxWidth: '300px' }}
            disabled={withdrawableBalance <= 0}
          >
            💸 Request Withdrawal
          </button>
        </div>

        {/* 3-BUCKET BREAKDOWN */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
          
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ margin: '0 0 2px 0', fontSize: '11px', color: '#f59e0b' }}>Clearing (Hold)</p>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#fcd34d' }}>₹{clearingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <span style={{fontSize: '10px', color: '#64748b'}}>Delivered &lt; 7 Days</span>
          </div>

          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <p style={{ margin: '0 0 2px 0', fontSize: '11px', color: '#93c5fd' }}>Pending (In-Transit)</p>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#bfdbfe' }}>₹{pendingClearance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <span style={{fontSize: '10px', color: '#64748b'}}>Accepted Orders</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ margin: '0 0 2px 0', fontSize: '11px', color: '#cbd5e1' }}>Total Gross Earning</p>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <span style={{fontSize: '10px', color: '#64748b'}}>Sum of all buckets</span>
          </div>

        </div>
      </div>

      {/* FILTER & SEARCH SECTION */}
      <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <input 
          type="text"
          placeholder="🔍 Search by Order No, Token, or UTR..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px', outline: 'none', boxSizing: 'border-box' }}
        />
        
        <strong style={{ color: '#0f172a', fontSize: '14px', display: 'block', marginBottom: '10px' }}>📅 Filter by Date:</strong>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => setTimeframe('all')} style={filterBtnStyle(timeframe === 'all')}>All</button>
          <button onClick={() => setTimeframe('today')} style={filterBtnStyle(timeframe === 'today')}>Today</button>
          <button onClick={() => setTimeframe('week')} style={filterBtnStyle(timeframe === 'week')}>1 Week</button>
          <button onClick={() => setTimeframe('month')} style={filterBtnStyle(timeframe === 'month')}>This Month</button>
          <button onClick={() => setTimeframe('custom')} style={filterBtnStyle(timeframe === 'custom', true)}>Custom</button>
        </div>

        {timeframe === 'custom' && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} />
            <span style={{ alignSelf: 'center', color: '#64748b' }}>To</span>
            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }} />
          </div>
        )}
      </div>

      <div onClick={() => setIsHistoryOpen(!isHistoryOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', cursor: 'pointer', userSelect: 'none' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>📜 Ledger History ({filteredTransactions.length})</h3>
        <span style={{ fontSize: '14px', color: '#0284c7', fontWeight: 'bold' }}>{isHistoryOpen ? '▲ Hide' : '▼ View'}</span>
      </div>

      {isHistoryOpen && (
        <div>
          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#64748b' }}>Loading history...</p>
          ) : filteredTransactions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748b', padding: '20px' }}>Koi transaction nahi mila.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTransactions.slice(0, visibleCount).map((txn: any) => {
                const isCredit = txn.type === 'credit';
                let amountColor = isCredit ? '#10b981' : '#ef4444';
                let icon = isCredit ? '💰' : '📉';
                let statusDisplay = txn.status.toUpperCase();
                
                if (txn.status === 'pending_delivery') {
                  amountColor = '#3b82f6'; icon = '🚚'; statusDisplay = 'IN-TRANSIT';
                } else if (txn.status === 'clearing') {
                  amountColor = '#f59e0b'; icon = '⏳'; statusDisplay = 'HOLD (1-WK)';
                } else if (txn.reason.toLowerCase().includes('refund')) {
                  amountColor = '#f59e0b'; icon = '⚠️';
                }

                return (
                  <div 
                    key={txn.id} 
                    onClick={() => setSelectedTxnDetails(txn)}
                    style={{ background: 'white', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  >
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{icon}</span> 
                        {txn.token_no && <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>🎫 {txn.token_no}</span>}
                        {txn.reason} 
                      </h4>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                        {new Date(txn.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short' })} 
                        &nbsp;•&nbsp;
                        <strong style={{ color: amountColor }}>{statusDisplay}</strong>
                      </p>
                    </div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: amountColor, whiteSpace: 'nowrap', marginLeft: '15px' }}>
                      {isCredit ? '+' : '-'} ₹{txn.amount.toFixed(2)}
                    </h3>
                  </div>
                );
              })}

              {filteredTransactions.length > visibleCount && (
                <button 
                  onClick={() => setVisibleCount(visibleCount + 10)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px', color: '#334155', width: '100%' }}
                >
                  Load More History ↓
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TRANSACTION DETAILS MODAL */}
      {selectedTxnDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: '15px' }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderRadius: '16px', padding: '25px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>📋 Details</h3>
              <button onClick={() => setSelectedTxnDetails(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {selectedTxnDetails.type === 'credit' ? (
              <div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#64748b' }}>Order ID / Number</p>
                  <h4 style={{ margin: 0, color: '#0284c7' }}>#{selectedTxnDetails.raw_data.order_no || selectedTxnDetails.raw_data.id}</h4>
                </div>

                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '4px 0' }}>
                    <span>Total Bill:</span><strong>₹{selectedTxnDetails.raw_data.total_amount}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '4px 0', color: '#ef4444' }}>
                    <span>Commission Deducted:</span><strong>- ₹{(selectedTxnDetails.admin_fee_deducted || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', margin: '8px 0 0 0', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', color: selectedTxnDetails.status === 'pending_delivery' ? '#3b82f6' : (selectedTxnDetails.status === 'clearing' ? '#f59e0b' : '#10b981') }}>
                    <strong>
                      {selectedTxnDetails.status === 'pending_delivery' ? 'Transit Earnings:' : 
                       selectedTxnDetails.status === 'clearing' ? 'Hold Earnings:' : 'Credited Earnings:'}
                    </strong>
                    <strong>+ ₹{selectedTxnDetails.amount.toFixed(2)}</strong>
                  </div>
                </div>
                
                {onGoToOrder && (
                  <button 
                    onClick={() => { onGoToOrder(selectedTxnDetails.real_id); setSelectedTxnDetails(null); }} 
                    style={{ width: '100%', marginBottom: '15px', padding: '15px', background: 'linear-gradient(90deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}
                  >
                    📦 View Full Order Details ➡️
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ background: '#fef2f2', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #fecaca' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#991b1b' }}>Token ID</p>
                  <h4 style={{ margin: 0, color: '#b91c1c' }}>🎫 {selectedTxnDetails.token_no}</h4>
                </div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
                  <p style={{ margin: '0 0 2px 0', fontSize: '11px', color: '#64748b' }}>Amount & Status</p>
                  <strong style={{ fontSize: '16px', color: '#ef4444' }}>₹{selectedTxnDetails.amount.toFixed(2)}</strong>
                  <span style={{ float: 'right', fontWeight: 'bold', color: selectedTxnDetails.status === 'completed' ? '#10b981' : '#f59e0b' }}>{selectedTxnDetails.status.toUpperCase()}</span>
                </div>
              </div>
            )}

            {/* CLEAR RECORD BUTTON (Opens Security Modal) */}
            <button 
              onClick={() => { setTxnToDelete(selectedTxnDetails); setDeletePassword(''); setDeleteModalOpen(true); }} 
              disabled={isProcessing}
              style={{ width: '100%', marginBottom: '10px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer' }}
            >
              🗑️ Clear Record from History
            </button>

            <button onClick={() => setSelectedTxnDetails(null)} style={{ width: '100%', padding: '12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* SECURE DELETE PIN MODAL */}
      {deleteModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100000, padding: '20px' }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: '350px', borderRadius: '16px', padding: '25px', border: '1px solid #ef4444', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔐</div>
            <h3 style={{ color: '#fca5a5', marginTop: 0 }}>Security Check</h3>
            <p style={{ color: '#cbd5e1', fontSize: '13px', marginBottom: '20px' }}>Is record ko apne Wallet se hide karne ke liye apna <strong>Shop Password</strong> daalein:</p>
            
            <input 
              type="password" 
              placeholder="Enter Password..." 
              value={deletePassword} 
              onChange={e => setDeletePassword(e.target.value)} 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ef4444', background: '#0f172a', color: 'white', marginBottom: '20px', textAlign: 'center', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }} 
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDeleteModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#475569', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteTransaction} disabled={isProcessing} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
                {isProcessing ? '⏳...' : '🗑️ Clear Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {showWithdraw && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', zIndex: 9999 }}>
          <div style={{ background: 'white', width: '100%', maxWidth: '500px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', padding: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Withdraw Shop Earnings</h3>
              <button onClick={() => setShowWithdraw(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '16px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            
            <div style={{ background: '#dcfce7', border: '1px solid #10b981', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#065f46' }}>Available to withdraw: <strong style={{ fontSize: '16px' }}>₹{withdrawableBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></p>
            </div>
            
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '5px' }}>Enter Amount (₹)</label>
            <input type="number" placeholder="e.g. 5000" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} style={{ width: '100%', padding: '14px', fontSize: '18px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '20px', boxSizing: 'border-box' }} />
            
            <button onClick={handleWithdrawRequest} disabled={isProcessing || !withdrawAmount || Number(withdrawAmount) > withdrawableBalance} style={{ width: '100%', padding: '15px', background: (!withdrawAmount || Number(withdrawAmount) > withdrawableBalance) ? '#94a3b8' : '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: (!withdrawAmount || Number(withdrawAmount) > withdrawableBalance) ? 'not-allowed' : 'pointer', transition: '0.2s' }}>
              {isProcessing ? 'Processing Request...' : 'Send Withdrawal Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const filterBtnStyle = (active: boolean, isCustom: boolean = false): React.CSSProperties => ({
  padding: '8px 16px', borderRadius: '20px', border: '1px solid #0ea5e9', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s',
  backgroundColor: active ? (isCustom ? '#f59e0b' : '#0ea5e9') : 'transparent',
  color: active ? 'white' : '#0ea5e9',
  fontSize: '13px'
});