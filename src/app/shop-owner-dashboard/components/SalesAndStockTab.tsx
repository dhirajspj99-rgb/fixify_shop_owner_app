"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function SalesAndStockTab({
  activeTab,
  setActiveTab,
  setOrderSubTab,
  onSelectOrderFromLedger,
  orders,
  currentShop,
  products,
  fetchProducts,
  fetchOrders
}: any) {
  const [salesTimeframe, setSalesTimeframe] = useState<'today' | 'week' | 'month' | 'year' | 'all' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // 🔥 6 VISIBLE & CLICKABLE FILTERS IN SALES LEDGER 🔥
  const [salesTypeFilter, setSalesTypeFilter] = useState<
    'all' | 'partner_online' | 'self_cod' | 'self_prepaid' | 'self_all' | 'counter'
  >('all');

  // 🆕 BILL HISTORY OPEN/CLOSE STATE (क्लिक करने के बाद नीचे खुलेगा)
  const [isBillHistoryOpen, setIsBillHistoryOpen] = useState<boolean>(false);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // ==========================================
  // 🔴 LIVE DATABASE STATES (`counter_bills`, `orders`, `products`)
  // ==========================================
  const [liveCounterBills, setLiveCounterBills] = useState<any[]>([]);
  const [liveOnlineOrders, setLiveOnlineOrders] = useState<any[]>([]);
  const [liveProducts, setLiveProducts] = useState<any[]>([]);
  const [isRefreshingLive, setIsRefreshingLive] = useState<boolean>(false);

  // ==========================================
  // 📦 STOCK ROOM STATES & DATE FILTERS
  // ==========================================
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [stockCategory, setStockCategory] = useState('All Categories');
  const [stockTimeframe, setStockTimeframe] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [stockStartDate, setStockStartDate] = useState('');
  const [stockEndDate, setStockEndDate] = useState('');
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editIsCodAvailable, setEditIsCodAvailable] = useState(true);

  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [deletePassword, setDeletePassword] = useState('');

  // ==============================================================
  // 🔥 1. DYNAMIC & CATEGORY-WISE ADMIN COMMISSION (`app_settings` + AUTO 20%) 🔥
  // ==============================================================
  const [defaultCommissionPct, setDefaultCommissionPct] = useState<number>(20); // Auto 20% Fallback
  const [categoryRates, setCategoryRates] = useState<Record<string, number>>({});
  const [defaultSelfDeliveryFee, setDefaultSelfDeliveryFee] = useState<number>(20);

  const safeShopId = currentShop?.id ? String(currentShop.id).trim() : null;

  const toPercentNumber = (val: any, fallbackPct = 20): number => {
    if (val === undefined || val === null || val === '') return fallbackPct;
    const cleaned = String(val).replace('%', '').trim();
    const num = Number(cleaned);
    if (isNaN(num) || num <= 0) return fallbackPct;
    if (num > 0 && num < 1 && String(val).includes('.')) {
      return Number((num * 100).toFixed(2));
    }
    return num;
  };

  // ==========================================================
  // 🔄 FETCH LIVE DATA FROM SUPABASE (`app_settings` + `counter_bills` + `orders` + `products`)
  // ==========================================================
  const fetchAllLiveSalesAndStock = async () => {
    if (!safeShopId) return;
    setIsRefreshingLive(true);
    try {
      const { data: commData } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (commData) {
        const rawGlobalRate =
          commData.commission_rate ??
          commData.admin_commission ??
          commData.default_commission ??
          20;
        const globalPct = toPercentNumber(rawGlobalRate, 20);
        setDefaultCommissionPct(globalPct);

        if (commData.shop_self_delivery_fee !== undefined) {
          setDefaultSelfDeliveryFee(Number(commData.shop_self_delivery_fee) || 20);
        }

        if (commData.category_commissions) {
          let parsedCats = commData.category_commissions;
          if (typeof parsedCats === 'string') {
            try { parsedCats = JSON.parse(parsedCats); } catch {}
          }
          const normalizedRates: Record<string, number> = {};
          if (Array.isArray(parsedCats)) {
            parsedCats.forEach((item: any) => {
              const catName = String(item.category || item.name || item.title || '').trim().toLowerCase();
              const rawRate = item.rate ?? item.commission ?? item.commission_rate ?? item.percentage ?? item.value;
              if (catName && rawRate !== undefined && rawRate !== null && rawRate !== '') {
                normalizedRates[catName] = toPercentNumber(rawRate, 20);
              }
            });
          } else if (typeof parsedCats === 'object' && parsedCats !== null) {
            Object.keys(parsedCats).forEach(k => {
              const cleanKey = k.trim().toLowerCase();
              const val = parsedCats[k];
              if (typeof val === 'object' && val !== null) {
                normalizedRates[cleanKey] = toPercentNumber(val.rate ?? val.commission ?? val.percentage ?? val.value, 20);
              } else if (val !== undefined && val !== null && val !== '') {
                normalizedRates[cleanKey] = toPercentNumber(val, 20);
              }
            });
          }
          setCategoryRates(normalizedRates);
        }
      }

      const { data: cbData, error: cbErr } = await supabase
        .from('counter_bills')
        .select('*')
        .eq('shop_id', safeShopId)
        .order('created_at', { ascending: false });

      if (!cbErr && cbData) {
        setLiveCounterBills(cbData);
      }

      const { data: ordData, error: ordErr } = await supabase
        .from('orders')
        .select('*')
        .eq('shop_id', safeShopId)
        .order('created_at', { ascending: false });

      if (!ordErr && ordData) {
        setLiveOnlineOrders(ordData);
      }

      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', safeShopId)
        .order('id', { ascending: false });

      if (!prodErr && prodData) {
        setLiveProducts(prodData);
      }
    } catch (e) {
      console.warn('Live sync warning:', e);
    } finally {
      setIsRefreshingLive(false);
    }
  };

  useEffect(() => {
    if (!safeShopId) return;
    fetchAllLiveSalesAndStock();

    const liveChannel = supabase
      .channel(`sales_stock_live_${safeShopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'counter_bills', filter: `shop_id=eq.${safeShopId}` },
        () => fetchAllLiveSalesAndStock()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => fetchAllLiveSalesAndStock()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `shop_id=eq.${safeShopId}` },
        () => fetchAllLiveSalesAndStock()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(liveChannel);
    };
  }, [safeShopId]);

  // ==========================================================
  // ↗️ SMART PAGE REDIRECT HANDLER
  // ==========================================================
  const navigateToTargetPage = (targetType: 'orders_history' | 'pos_history' | 'wallet', orderObj?: any) => {
    if (orderObj && typeof onSelectOrderFromLedger === 'function') {
      onSelectOrderFromLedger(orderObj);
      return;
    }
    if (typeof setActiveTab === 'function') {
      if (targetType === 'pos_history') {
        setActiveTab('pos');
      } else if (targetType === 'wallet') {
        setActiveTab('wallet');
      } else {
        setActiveTab('orders');
        if (typeof setOrderSubTab === 'function') setOrderSubTab('history');
      }
      return;
    }

    const buttons = Array.from(document.querySelectorAll('button, a'));
    const keywords =
      targetType === 'pos_history'
        ? ['काउंटर', 'counter', 'pos']
        : targetType === 'wallet'
        ? ['वॉलेट', 'wallet', 'payout', 'earning']
        : ['आर्डर', 'ऑर्डर', 'orders', 'order'];

    const matchedBtn = buttons.find(btn => {
      const txt = (btn.textContent || '').toLowerCase();
      return keywords.some(k => txt.includes(k));
    }) as HTMLElement | undefined;

    if (matchedBtn) {
      matchedBtn.click();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (orderObj) {
      setSelectedOrder(orderObj);
    }
  };

  // Merge Products
  const shopProducts = useMemo(() => {
    const map = new Map<string, any>();
    (products || []).forEach((p: any) => {
      if (safeShopId && String(p.shop_id).trim() === safeShopId) {
        map.set(String(p.id), p);
      }
    });
    liveProducts.forEach((p: any) => {
      if (safeShopId && String(p.shop_id).trim() === safeShopId) {
        map.set(String(p.id), { ...map.get(String(p.id)), ...p });
      }
    });
    return Array.from(map.values());
  }, [products, liveProducts, safeShopId]);

  const isOrderCounterPos = (o: any): boolean => {
    if (!o) return false;
    return (
      o.type === 'counter_sale' ||
      Boolean(o.bill_no) ||
      String(o.order_no || o.billNo || o.bill_no || '').startsWith('POS-') ||
      String(o.payment_mode || '').toLowerCase().includes('counter pos') ||
      String(o.address || '').toLowerCase().includes('counter') ||
      (Array.isArray(o.messages) && o.messages.some((m: any) => m?.type === 'counter_bill'))
    );
  };

  const isOrderSelfDelivered = (o: any): boolean => {
    if (!o || isOrderCounterPos(o)) return false;
    if (String(o.delivery_boy_name || '').toLowerCase().includes('self delivery')) return true;
    if (safeShopId && String(o.delivery_boy_id || '').trim() === safeShopId) return true;
    let msgs = o.messages;
    if (typeof msgs === 'string') {
      try { msgs = JSON.parse(msgs); } catch { msgs = []; }
    }
    if (Array.isArray(msgs) && msgs.some((m: any) => String(m?.text || '').toLowerCase().includes('self delivered'))) {
      return true;
    }
    const items = getProductDetailsArray(o);
    if (items.some((it: any) => String(it?.shop_message || '').toLowerCase().includes('self delivered'))) {
      return true;
    }
    return false;
  };

  const isOrderCodMode = (o: any): boolean => {
    const pm = String(o?.payment_mode || o?.payment_method || '').toUpperCase();
    return pm.includes('COD') || pm.includes('CASH') || pm.includes('PAY ON DELIVERY') || pm === '';
  };

  const isOrderCompletedStatus = (o: any): boolean => {
    if (!o) return false;
    const s = String(o.status || '').toLowerCase().trim();
    if (s.includes('cancel') || s.includes('reject') || s.includes('rto') || s.includes('refund') || s.includes('return')) {
      return false;
    }
    return (
      s === 'completed' ||
      s === 'complete' ||
      s === 'delivered' ||
      s.includes('completed') ||
      s.includes('delivered') ||
      Boolean(o.delivered_at)
    );
  };

  // ==========================================================
  // 🔗 MERGE & DEDUPLICATE ALL COMPLETED ONLINE + COUNTER SALES
  // ==========================================================
  const completedShopOrders = useMemo(() => {
    const map = new Map<string, any>();

    (orders || []).forEach((o: any) => {
      if (!safeShopId) return;
      const matchesShop =
        String(o.shop_id || '').trim() === safeShopId ||
        (currentShop?.name && String(o.shop_name || '').trim().toLowerCase() === String(currentShop.name).trim().toLowerCase());

      if (matchesShop && isOrderCompletedStatus(o)) {
        const key = isOrderCounterPos(o) ? `POS_${o.order_no || o.bill_no || o.id}` : `ORD_${o.id}`;
        map.set(key, o);
      }
    });

    liveOnlineOrders.forEach((o: any) => {
      if (!safeShopId || String(o.shop_id || '').trim() !== safeShopId) return;
      if (isOrderCompletedStatus(o)) {
        const key = isOrderCounterPos(o) ? `POS_${o.order_no || o.bill_no || o.id}` : `ORD_${o.id}`;
        map.set(key, { ...map.get(key), ...o });
      }
    });

    liveCounterBills.forEach((cb: any) => {
      if (!safeShopId || String(cb.shop_id || '').trim() !== safeShopId) return;
      const key = `POS_${cb.bill_no || cb.id}`;
      const normalizedCounterBill = {
        ...cb,
        id: cb.id,
        order_no: cb.bill_no,
        bill_no: cb.bill_no,
        shop_id: cb.shop_id,
        customer_name: cb.customer_name || 'Counter Walk-in Customer',
        user_phone: cb.customer_phone || '',
        phone: cb.customer_phone || '',
        address: cb.customer_address || 'Direct Shop Counter Pickup',
        items: cb.items || [],
        product_details: cb.items || [],
        subtotal: Number(cb.subtotal || 0),
        discount: Number(cb.discount || 0),
        labour_charge: Number(cb.labour_charge || 0),
        transport_charge: Number(cb.transport_charge || 0),
        delivery_charge: Number(cb.transport_charge || 0),
        is_gst_bill: Boolean(cb.is_gst_bill),
        gst_percent: Number(cb.gst_percent || 0),
        gst_amount: Number(cb.gst_amount || 0),
        total_amount: Number(cb.grand_total || 0),
        grand_total: Number(cb.grand_total || 0),
        payment_method: cb.payment_method || 'Cash',
        payment_mode: cb.payment_mode || `Counter POS - ${cb.payment_method || 'Cash'}`,
        status: 'completed',
        type: 'counter_sale',
        created_at: cb.created_at
      };
      map.set(key, { ...map.get(key), ...normalizedCounterBill });
    });

    return Array.from(map.values()).sort(
      (a: any, b: any) => new Date(b.delivered_at || b.created_at || 0).getTime() - new Date(a.delivered_at || a.created_at || 0).getTime()
    );
  }, [orders, liveOnlineOrders, liveCounterBills, safeShopId, currentShop?.name]);

  const now = new Date();
  const todayDateString = now.toDateString();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentDay = now.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - distanceToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  function getProductDetailsArray(order: any) {
    if (!order) return [];
    let details = order.product_details || order.items || order.products || order.cart_items || order.cart_details || order.order_items;
    if (!details) return [];
    if (Array.isArray(details)) return details;
    try {
      let parsed = typeof details === 'string' ? JSON.parse(details) : details;
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  const findLiveProduct = (item: any) => {
    if (!item || !shopProducts) return null;
    const itemId = item.product_id || item.item_id || item.id;
    if (itemId) {
      const exactMatch = shopProducts.find((p: any) => String(p.id) === String(itemId));
      if (exactMatch) return exactMatch;
    }
    const itemNameRaw = String(item.name || item.product_name || item.item_name || item.product || item.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!itemNameRaw) return null;
    return shopProducts.find((p: any) => {
      const dbName = String(p.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      return dbName && (dbName === itemNameRaw || dbName.includes(itemNameRaw) || itemNameRaw.includes(dbName));
    });
  };

  const getCategoryCommissionPct = (categoryStr: string): number => {
    const cat = String(categoryStr || '').toLowerCase().trim();

    if (cat && categoryRates && Object.keys(categoryRates).length > 0) {
      if (categoryRates[cat] !== undefined) return categoryRates[cat];
      const matchedKey = Object.keys(categoryRates).find(k => k && (cat.includes(k) || k.includes(cat)));
      if (matchedKey && categoryRates[matchedKey] !== undefined) return categoryRates[matchedKey];
    }

    if (categoryRates['default'] !== undefined) return categoryRates['default'];
    if (categoryRates['all'] !== undefined) return categoryRates['all'];
    if (categoryRates['other'] !== undefined) return categoryRates['other'];
    if (categoryRates['general'] !== undefined) return categoryRates['general'];

    return defaultCommissionPct || 20; // Auto 20% Fallback
  };

  // ==========================================================
  // 🔥 2. CALCULATE FINANCES (INCLUDES SELF-DELIVERY COD vs PREPAID) 🔥
  // ==========================================================
  const calculateFinances = (order: any) => {
    const items = getProductDetailsArray(order);
    const isCounter = isOrderCounterPos(order);
    const isSelfDel = isOrderSelfDelivered(order);
    const isCod = isOrderCodMode(order);

    let calcItemTotal = 0;
    let calcAdminComm = 0;

    if (items.length > 0) {
      items.forEach((item: any) => {
        const n = String(item.name || item.product_name || item.item_name || '').toLowerCase();
        const c = String(item.category || '').toLowerCase().trim();

        const isExcluded = ['labour', 'mistri', 'mistry', 'mechanic', 'repair'].some(w => n.includes(w) || c.includes(w)) || item.type === 'labour';
        const isDelivery = n.includes('delivery') || n.includes('transport') || n.includes('shipping') || n.includes('freight') || n.includes('km') || n.includes('bhada');

        if (!isExcluded && !isDelivery) {
          const qty = Number(item.quantity || item.qty || 1);
          const rawPrice = Number(item.price || item.selling_price || 0);

          let lineTotal = 0;
          if (item.total !== undefined && item.total !== null) {
            lineTotal = Number(item.total);
          } else if (isCounter) {
            lineTotal = rawPrice * qty;
          } else {
            const liveProd = findLiveProduct(item);
            const unitRate = Number(liveProd?.price || item.unit_price || item.rate || 0);
            if (qty > 1 && unitRate > 0 && Math.abs(rawPrice - unitRate * qty) < 5) {
              lineTotal = rawPrice;
            } else if (qty > 1 && unitRate > 0 && Math.abs(rawPrice - unitRate) < 5) {
              lineTotal = rawPrice * qty;
            } else {
              lineTotal = rawPrice;
            }
          }

          calcItemTotal += lineTotal;

          if (!isCounter) {
            const liveProduct = findLiveProduct(item);
            const cat = String(item.category || liveProduct?.category || '').toLowerCase().trim();
            const commPct = getCategoryCommissionPct(cat);
            calcAdminComm += lineTotal * (commPct / 100);
          }
        }
      });
    }

    const deliveryCharge = Number(order.transport_charge ?? order.delivery_charge ?? order.delivery_fee ?? 0);
    const labourCharge = Number(order.labour_charge ?? 0);
    const discountAmt = Number(order.discount ?? 0);
    const gstAmt = Number(order.gst_amount ?? 0);
    const selfDelBonus = !isCounter && isSelfDel ? Number(order.delivery_boy_fee || defaultSelfDeliveryFee || 20) : 0;

    let totalBill = Number(order.grand_total ?? order.total_amount ?? 0);

    if (calcItemTotal === 0 && totalBill > 0) {
      calcItemTotal = Math.max(0, totalBill - deliveryCharge - labourCharge - gstAmt + discountAmt);
      if (!isCounter) {
        const fallbackPct = getCategoryCommissionPct('');
        calcAdminComm = calcItemTotal * (fallbackPct / 100);
      }
    }

    if (totalBill === 0 && calcItemTotal > 0) {
      totalBill = calcItemTotal + deliveryCharge + labourCharge + gstAmt - discountAmt;
    }

    const productNetEarning = Number(Math.max(0, calcItemTotal - calcAdminComm).toFixed(2));
    const netEarning = isCounter
      ? totalBill
      : Number((productNetEarning + selfDelBonus).toFixed(2));

    const walletAdjustment = isCounter
      ? 0
      : isSelfDel && isCod
      ? -Number(calcAdminComm.toFixed(2))
      : netEarning;

    const pmRaw = String(order.payment_method || order.payment_mode || order.paymentMethod || '').toLowerCase();
    let payBucket: 'cash' | 'upi' | 'khata' = 'cash';
    if (pmRaw.includes('upi') || pmRaw.includes('online') || pmRaw.includes('qr') || pmRaw.includes('bank') || pmRaw.includes('account') || pmRaw.includes('razorpay') || pmRaw.includes('prepaid')) {
      payBucket = 'upi';
    } else if (pmRaw.includes('khata') || pmRaw.includes('due') || pmRaw.includes('udhar') || pmRaw.includes('credit')) {
      payBucket = 'khata';
    }

    return {
      totalBill: Number(totalBill.toFixed(2)),
      deliveryCharge: Number(deliveryCharge.toFixed(2)),
      labourCharge: Number(labourCharge.toFixed(2)),
      discountAmt: Number(discountAmt.toFixed(2)),
      gstAmt: Number(gstAmt.toFixed(2)),
      selfDelBonus: Number(selfDelBonus.toFixed(2)),
      itemTotal: Number(calcItemTotal.toFixed(2)),
      adminComm: Number(calcAdminComm.toFixed(2)),
      productNetEarning,
      netEarning,
      walletAdjustment,
      isCounter,
      isSelfDel,
      isCod,
      payBucket
    };
  };

  // ==========================================================
  // 📊 TOP 4 KPI CARDS
  // ==========================================================
  let grossTodaysSales = 0, todayOnline = 0, todayCounter = 0;
  let grossMonthlySales = 0, monthOnline = 0, monthCounter = 0;
  let grossYearlySales = 0, yearOnline = 0, yearCounter = 0;
  let grossLifetimeSales = 0, lifeOnline = 0, lifeCounter = 0;

  completedShopOrders.forEach((o: any) => {
    const calc = calculateFinances(o);
    const d = new Date(o.delivered_at || o.created_at);
    const val = calc.isCounter ? calc.totalBill : calc.itemTotal;

    grossLifetimeSales += val;
    if (calc.isCounter) lifeCounter += val; else lifeOnline += val;

    if (d.getFullYear() === currentYear) {
      grossYearlySales += val;
      if (calc.isCounter) yearCounter += val; else yearOnline += val;

      if (d.getMonth() === currentMonth) {
        grossMonthlySales += val;
        if (calc.isCounter) monthCounter += val; else monthOnline += val;
      }
    }
    if (d.toDateString() === todayDateString) {
      grossTodaysSales += val;
      if (calc.isCounter) todayCounter += val; else todayOnline += val;
    }
  });

  // ==========================================================
  // ⏳ DATE FILTER LOGIC (SALES)
  // ==========================================================
  const filteredSalesOrders = useMemo(() => {
    return completedShopOrders.filter((o: any) => {
      if (salesTimeframe === 'all') return true;
      const d = new Date(o.delivered_at || o.created_at);
      d.setHours(0, 0, 0, 0);
      if (salesTimeframe === 'today') return d.toDateString() === todayDateString;
      if (salesTimeframe === 'week') return d >= startOfWeek;
      if (salesTimeframe === 'month') return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      if (salesTimeframe === 'year') return d.getFullYear() === currentYear;
      if (salesTimeframe === 'custom') {
        if (!customStartDate || !customEndDate) return true;
        const start = new Date(customStartDate); start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate); end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
      }
      return true;
    });
  }, [completedShopOrders, salesTimeframe, customStartDate, customEndDate, todayDateString, startOfWeek, currentMonth, currentYear]);

  // Calculate Period Totals for the 4 Cards
  let partnerOnlineGross = 0, partnerOnlineNet = 0, partnerOnlineComm = 0, partnerOnlineCount = 0;
  let selfCodItemGross = 0, selfCodCashCollected = 0, selfCodCommCut = 0, selfCodBonus = 0, selfCodNetProfit = 0, selfCodCount = 0;
  let selfPrepaidItemGross = 0, selfPrepaidCommCut = 0, selfPrepaidBonus = 0, selfPrepaidWalletCredit = 0, selfPrepaidCount = 0;
  let periodCounterGross = 0, periodCounterCount = 0;
  let counterCashAmt = 0, counterUpiAmt = 0, counterKhataAmt = 0;

  filteredSalesOrders.forEach((o: any) => {
    const calc = calculateFinances(o);
    if (calc.isCounter) {
      periodCounterGross += calc.totalBill;
      periodCounterCount++;
      if (calc.payBucket === 'cash') counterCashAmt += calc.totalBill;
      else if (calc.payBucket === 'upi') counterUpiAmt += calc.totalBill;
      else counterKhataAmt += calc.totalBill;
    } else if (calc.isSelfDel) {
      if (calc.isCod) {
        selfCodItemGross += calc.itemTotal;
        selfCodCashCollected += calc.totalBill;
        selfCodCommCut += calc.adminComm;
        selfCodBonus += calc.selfDelBonus;
        selfCodNetProfit += calc.netEarning;
        selfCodCount++;
      } else {
        selfPrepaidItemGross += calc.itemTotal;
        selfPrepaidCommCut += calc.adminComm;
        selfPrepaidBonus += calc.selfDelBonus;
        selfPrepaidWalletCredit += calc.netEarning;
        selfPrepaidCount++;
      }
    } else {
      partnerOnlineGross += calc.itemTotal;
      partnerOnlineComm += calc.adminComm;
      partnerOnlineNet += calc.netEarning;
      partnerOnlineCount++;
    }
  });

  // 🔥 APPLY TYPE FILTER FOR TABLE & EXPORTS 🔥
  const displayedOrders = useMemo(() => {
    return filteredSalesOrders.filter((o: any) => {
      const isCounter = isOrderCounterPos(o);
      const isSelf = isOrderSelfDelivered(o);
      const isCod = isOrderCodMode(o);

      if (salesTypeFilter === 'partner_online') return !isCounter && !isSelf;
      if (salesTypeFilter === 'self_cod') return isSelf && isCod;
      if (salesTypeFilter === 'self_prepaid') return isSelf && !isCod;
      if (salesTypeFilter === 'self_all') return isSelf;
      if (salesTypeFilter === 'counter') return isCounter;
      return true;
    });
  }, [filteredSalesOrders, salesTypeFilter]);

  let filteredGrossItems = 0, filteredNet = 0, filteredFee = 0;

  displayedOrders.forEach((o: any) => {
    const calc = calculateFinances(o);
    const grossVal = calc.isCounter ? calc.totalBill : calc.itemTotal;
    filteredGrossItems += grossVal;
    filteredFee += calc.adminComm;
    filteredNet += calc.netEarning;
  });

  const getSalesPeriodLabel = () => {
    if (salesTimeframe === 'today') return 'Aaj (1 Day)';
    if (salesTimeframe === 'week') return 'Is Hafte (1 Week)';
    if (salesTimeframe === 'month') return 'Is Mahine (1 Month)';
    if (salesTimeframe === 'year') return 'Is Saal (1 Year)';
    if (salesTimeframe === 'custom') return `${customStartDate || 'Start'} to ${customEndDate || 'End'}`;
    return 'All Time Lifetime';
  };

  const getStockPeriodLabel = () => {
    if (stockTimeframe === 'today') return 'Aaj (1 Day)';
    if (stockTimeframe === 'week') return 'Is Hafte (1 Week)';
    if (stockTimeframe === 'month') return 'Is Mahine (1 Month)';
    if (stockTimeframe === 'custom') return `${stockStartDate || 'Start'} to ${stockEndDate || 'End'}`;
    return 'All Time Total';
  };

  // ==========================================================
  // 📥 SALES EXCEL & PDF EXPORT
  // ==========================================================
  const exportToExcel = () => {
    if (displayedOrders.length === 0) return alert('Download karne ke liye is filter mein koi sales data nahi hai.');
    const rows: string[] = [];
    rows.push(`"${currentShop?.name || 'Shop'} - SALES LEDGER REPORT (${salesTypeFilter.toUpperCase()})"`);
    rows.push(`"Period","${getSalesPeriodLabel()}","Generated On","${new Date().toLocaleString('en-IN')}"`);
    rows.push('');
    rows.push('"S.No","Date & Time","Order / Bill ID","Sale & Delivery Type","Customer Name","Phone","Items Purchased","Total Bill (Rs)","Item Amount (Rs)","Self-Del Bonus (Rs)","Admin Comm (Rs)","Your Net Earning (Rs)","Payment Mode","Wallet / Cash Hisab"');

    displayedOrders.forEach((o: any, idx: number) => {
      const calc = calculateFinances(o);
      const dateStr = new Date(o.delivered_at || o.created_at).toLocaleString('en-IN');
      const orderType = calc.isCounter ? 'Counter POS Bill' : calc.isSelfDel ? (calc.isCod ? 'Self-Delivery (COD)' : 'Self-Delivery (Prepaid)') : 'Partner Online Order';
      const items = getProductDetailsArray(o);
      const itemSummary = items.map((i: any) => `${i.name || i.product_name} (${i.quantity || i.qty || 1} ${i.unit || 'Pc'})`).join(' | ');
      const walletStatus = calc.isCounter ? `Direct Counter (${calc.payBucket.toUpperCase()})` : calc.isSelfDel && calc.isCod ? `Cash Collected: Rs ${calc.totalBill.toFixed(2)} | Comm Cut: -Rs ${calc.adminComm.toFixed(2)}` : `Credited to Wallet (+Rs ${calc.netEarning.toFixed(2)})`;

      rows.push([
        idx + 1, `"${dateStr}"`, `"${o.order_no || o.bill_no || o.id}"`, `"${orderType}"`,
        `"${String(o.customer_name || 'Walk-in').replace(/"/g, '""')}"`, `"${o.user_phone || o.phone || 'N/A'}"`,
        `"${itemSummary.replace(/"/g, '""')}"`, calc.totalBill.toFixed(2), calc.itemTotal.toFixed(2),
        calc.selfDelBonus.toFixed(2), calc.adminComm.toFixed(2), calc.netEarning.toFixed(2),
        `"${o.payment_mode || o.payment_method || 'Cash'}"`, `"${walletStatus}"`
      ].join(','));
    });

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Sales_Ledger_${salesTypeFilter}_${salesTimeframe}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (displayedOrders.length === 0) return alert('Print karne ke liye is filter mein koi sales data nahi hai.');
    const printWin = window.open('', '_blank');
    if (!printWin) return alert('Popup blocker is active.');

    let rowsHtml = '';
    displayedOrders.forEach((o: any, idx: number) => {
      const calc = calculateFinances(o);
      const orderType = calc.isCounter ? '🏪 Counter POS' : calc.isSelfDel ? (calc.isCod ? '🙋‍♂️💵 Self-Del (COD)' : '🙋‍♂️💳 Self-Del (Online)') : '🛵 Partner Online';
      const items = getProductDetailsArray(o);
      const itemSummary = items.map((i: any) => `${i.name || i.product_name} (${i.quantity || i.qty || 1})`).join(', ');
      const walletStatus = calc.isCounter ? `Direct` : calc.isSelfDel && calc.isCod ? `<span style="color:#b45309;font-weight:bold;">Cash: ₹${calc.totalBill.toFixed(0)}<br/>Comm Cut: -₹${calc.adminComm.toFixed(2)}</span>` : `<strong style="color:#15803d;">+₹${calc.netEarning.toFixed(2)} in Wallet</strong>`;

      rowsHtml += `<tr><td>${idx + 1}</td><td>${new Date(o.delivered_at || o.created_at).toLocaleDateString('en-IN')}</td><td><strong>#${o.order_no || o.bill_no || o.id}</strong></td><td>${orderType}</td><td>${o.customer_name || 'Walk-in'}</td><td>${itemSummary || '-'}</td><td style="text-align:right;">₹${calc.itemTotal.toFixed(2)}</td><td style="text-align:right;color:#dc2626;">₹${calc.adminComm.toFixed(2)}</td><td style="text-align:right;font-weight:bold;color:#15803d;">₹${calc.netEarning.toFixed(2)}</td><td>${walletStatus}</td></tr>`;
    });

    printWin.document.write(`<html><head><title>Sales Ledger Report</title><style>body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #0f172a; } table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11.5px; } th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; } th { background-color: #1e293b; color: #fff; }</style></head><body><h2>📈 Sales Ledger Report (${salesTypeFilter.toUpperCase()})</h2><p>Period: ${getSalesPeriodLabel()}</p><table><thead><tr><th>#</th><th>Date</th><th>ID</th><th>Type</th><th>Customer</th><th>Items</th><th style="text-align:right;">Total</th><th style="text-align:right;">Comm</th><th style="text-align:right;">Net</th><th>Hisab</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`);
    printWin.document.close(); printWin.onload = () => printWin.print();
  };

  // ==========================================================
  // 📦 STOCK ROOM CRUD & DATE-TO-DATE CALCULATIONS
  // ==========================================================
  const updateStockProduct = async () => {
    if (!editPrice || !editStock) return alert('Price aur Stock khali nahi chhod sakte!');
    try {
      await supabase.from('products').update({ price: Number(editPrice), total_stock: Number(editStock), image_url: editImage, is_cod_available: editIsCodAvailable }).eq('id', editingProduct.id);
      alert('✅ Product update ho gaya!'); setEditingProduct(null); fetchAllLiveSalesAndStock(); if (typeof fetchProducts === 'function') fetchProducts();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const confirmDeleteProduct = async () => {
    if (!deletePassword) return alert('Password dalein!');
    if (currentShop?.password && deletePassword !== currentShop.password) return alert('❌ Galat password!');
    try {
      await supabase.from('products').delete().eq('id', productToDelete.id);
      alert('✅ Product delete ho gaya!'); setProductToDelete(null); setDeletePassword(''); fetchAllLiveSalesAndStock(); if (typeof fetchProducts === 'function') fetchProducts();
    } catch (e: any) { alert('Error: ' + e.message); }
  };

  const togglePaymentMode = async (productId: number, currentStatus: boolean) => {
    await supabase.from('products').update({ is_cod_available: !currentStatus }).eq('id', productId);
    fetchAllLiveSalesAndStock(); if (typeof fetchProducts === 'function') fetchProducts();
  };

  const uniqueStockCategories = useMemo(() => {
    return ['All Categories', ...Array.from(new Set(shopProducts.map((p: any) => p.category).filter(Boolean)))];
  }, [shopProducts]);

  // 🔥 CALCULATE SOLD QTY & REVENUE IN SELECTED STOCK TIMEFRAME (Today, Week, Month, Custom Date-to-Date)
  const { soldQtyInStockTimeframe, soldRevInStockTimeframe } = useMemo(() => {
    const qtyMap: Record<string, number> = {};
    const revMap: Record<string, number> = {};

    completedShopOrders.forEach((o: any) => {
      const d = new Date(o.delivered_at || o.created_at);
      d.setHours(0, 0, 0, 0);

      let pass = true;
      if (stockTimeframe === 'today') {
        pass = d.toDateString() === todayDateString;
      } else if (stockTimeframe === 'week') {
        pass = d >= startOfWeek;
      } else if (stockTimeframe === 'month') {
        pass = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      } else if (stockTimeframe === 'custom') {
        if (stockStartDate && stockEndDate) {
          const start = new Date(stockStartDate); start.setHours(0, 0, 0, 0);
          const end = new Date(stockEndDate); end.setHours(23, 59, 59, 999);
          pass = d >= start && d <= end;
        }
      }

      if (pass) {
        const isCounter = isOrderCounterPos(o);
        getProductDetailsArray(o).forEach((it: any) => {
          const idKey = String(it.product_id || it.item_id || it.id || '').toLowerCase().trim();
          const nameKey = String(it.name || it.product_name || it.item_name || '').toLowerCase().trim();
          const q = Number(it.quantity || it.qty || 1);
          const rawP = Number(it.price || it.selling_price || 0);
          const lineAmt = it.total !== undefined ? Number(it.total) : isCounter ? rawP * q : rawP;

          if (idKey) {
            qtyMap[idKey] = (qtyMap[idKey] || 0) + q;
            revMap[idKey] = (revMap[idKey] || 0) + lineAmt;
          }
          if (nameKey) {
            qtyMap[nameKey] = (qtyMap[nameKey] || 0) + q;
            revMap[nameKey] = (revMap[nameKey] || 0) + lineAmt;
          }
        });
      }
    });

    return { soldQtyInStockTimeframe: qtyMap, soldRevInStockTimeframe: revMap };
  }, [completedShopOrders, stockTimeframe, stockStartDate, stockEndDate, todayDateString, startOfWeek, currentMonth, currentYear]);

  const getProductPeriodSold = (p: any) => {
    const byId = soldQtyInStockTimeframe[String(p.id).toLowerCase()];
    const byName = soldQtyInStockTimeframe[String(p.name || '').toLowerCase().trim()];
    if (byId !== undefined) return byId;
    if (byName !== undefined) return byName;
    return stockTimeframe === 'all' ? Number(p.sold_quantity || 0) : 0;
  };

  const getProductPeriodRevenue = (p: any) => {
    const byId = soldRevInStockTimeframe[String(p.id).toLowerCase()];
    const byName = soldRevInStockTimeframe[String(p.name || '').toLowerCase().trim()];
    if (byId !== undefined) return byId;
    if (byName !== undefined) return byName;
    return getProductPeriodSold(p) * Number(p.price || 0);
  };

  const displayedStock = shopProducts.filter((p: any) => {
    const mName = !stockSearchTerm || (p?.name || '').toLowerCase().includes(stockSearchTerm.toLowerCase()) || (p?.category || '').toLowerCase().includes(stockSearchTerm.toLowerCase());
    const mCat = stockCategory === 'All Categories' || p.category === stockCategory;
    return mName && mCat;
  });

  const totalStockProductsCount = displayedStock.length;
  const totalStockUnitsLeft = displayedStock.reduce((s, p) => s + Number(p.total_stock || 0), 0);
  const totalStockValueAmount = displayedStock.reduce((s, p) => s + (Number(p.price || 0) * Number(p.total_stock || 0)), 0);
  const totalPeriodSoldUnits = displayedStock.reduce((s, p) => s + getProductPeriodSold(p), 0);
  const lowStockCount = displayedStock.filter(p => Number(p.total_stock || 0) <= 5).length;

  // ==========================================================
  // 📥 STOCK EXCEL & PDF EXPORT (WITH DATE & CATEGORY FILTER)
  // ==========================================================
  const exportStockToExcel = () => {
    if (displayedStock.length === 0) return alert('Download karne ke liye is filter mein koi stock product nahi hai.');
    const rows: string[] = [];
    rows.push(`"${currentShop?.name || 'Shop'} - TOTAL STOCK & INVENTORY REPORT"`);
    rows.push(`"Category Filter","${stockCategory}","Sold Qty Period","${getStockPeriodLabel()}","Generated On","${new Date().toLocaleString('en-IN')}"`);
    rows.push(`"Total Items","${totalStockProductsCount}","Total Stock Left","${totalStockUnitsLeft} Units","Total Stock Value","Rs ${totalStockValueAmount.toFixed(2)}","Period Sold Units","${totalPeriodSoldUnits}"`);
    rows.push('');
    rows.push('"S.No","Product ID","Product Name","Category","Unit Rate (Rs)","Unit","Available Stock Left","Total Stock Value (Rs)","Sold Qty (' + getStockPeriodLabel() + ')","Sold Revenue (Rs)","COD Status","Stock Alert"');

    displayedStock.forEach((p: any, idx: number) => {
      const stockLeft = Number(p.total_stock || 0);
      const rate = Number(p.price || 0);
      const stockVal = stockLeft * rate;
      const soldQty = getProductPeriodSold(p);
      const soldRev = getProductPeriodRevenue(p);
      const statusAlert = stockLeft <= 0 ? 'OUT OF STOCK' : stockLeft <= 5 ? 'LOW STOCK' : 'IN STOCK';

      rows.push([
        idx + 1,
        `"${p.id}"`,
        `"${String(p.name || '').replace(/"/g, '""')}"`,
        `"${String(p.category || 'Uncategorized').replace(/"/g, '""')}"`,
        rate.toFixed(2),
        `"${p.unit || 'Pc'}"`,
        stockLeft,
        stockVal.toFixed(2),
        soldQty,
        soldRev.toFixed(2),
        `"${p.is_cod_available !== false ? 'COD On' : 'Prepaid Only'}"`,
        `"${statusAlert}"`
      ].join(','));
    });

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Stock_Inventory_${stockCategory.replace(/\s+/g, '_')}_${stockTimeframe}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportStockToPDF = () => {
    if (displayedStock.length === 0) return alert('Print karne ke liye is filter mein koi stock product nahi hai.');
    const printWin = window.open('', '_blank');
    if (!printWin) return alert('Popup blocker is active.');

    let rowsHtml = '';
    displayedStock.forEach((p: any, idx: number) => {
      const stockLeft = Number(p.total_stock || 0);
      const rate = Number(p.price || 0);
      const stockVal = stockLeft * rate;
      const soldQty = getProductPeriodSold(p);
      const soldRev = getProductPeriodRevenue(p);
      const statusColor = stockLeft <= 0 ? '#dc2626' : stockLeft <= 5 ? '#d97706' : '#15803d';
      const statusText = stockLeft <= 0 ? 'Out of Stock' : stockLeft <= 5 ? 'Low Stock' : 'In Stock';

      rowsHtml += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category || '-'}</td>
          <td style="text-align:right;">₹${rate.toLocaleString('en-IN')} / ${p.unit || 'Pc'}</td>
          <td style="text-align:center;font-weight:bold;color:${statusColor};">${stockLeft} ${p.unit || 'Pc'}</td>
          <td style="text-align:right;font-weight:bold;">₹${stockVal.toLocaleString('en-IN')}</td>
          <td style="text-align:center;color:#0284c7;font-weight:bold;">${soldQty} ${p.unit || 'Pc'}</td>
          <td style="text-align:right;color:#15803d;">₹${soldRev.toLocaleString('en-IN')}</td>
          <td style="text-align:center;color:${statusColor};font-weight:bold;">${statusText}</td>
        </tr>
      `;
    });

    printWin.document.write(`
      <html>
        <head>
          <title>Stock & Inventory Report</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #0f172a; }
            .summary-box { display: flex; gap: 15px; flex-wrap: wrap; margin: 12px 0; padding: 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11.5px; }
            th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; }
            th { background-color: #1e293b; color: #fff; }
          </style>
        </head>
        <body>
          <h2>📦 ${currentShop?.name || 'Shop'} — Stock & Inventory Report</h2>
          <p style="margin:4px 0;font-size:13px;">
            <strong>Category:</strong> ${stockCategory} &nbsp;|&nbsp; 
            <strong>Sold Period:</strong> ${getStockPeriodLabel()} &nbsp;|&nbsp; 
            <strong>Date:</strong> ${new Date().toLocaleString('en-IN')}
          </p>
          <div class="summary-box">
            <div><strong>कुल प्रोडक्ट्स:</strong> ${totalStockProductsCount} Items</div>
            <div><strong>कुल बचा स्टॉक:</strong> ${totalStockUnitsLeft} Units</div>
            <div><strong>कुल स्टॉक वैल्यू:</strong> ₹${totalStockValueAmount.toLocaleString('en-IN')}</div>
            <div><strong>पीरियड में बिका (Sold):</strong> ${totalPeriodSoldUnits} Units</div>
            <div><strong>Low / Out of Stock:</strong> ${lowStockCount} Items</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product Name</th>
                <th>Category</th>
                <th style="text-align:right;">Rate</th>
                <th style="text-align:center;">Stock Left</th>
                <th style="text-align:right;">Stock Value</th>
                <th style="text-align:center;">Sold (${getStockPeriodLabel()})</th>
                <th style="text-align:right;">Sold Amt</th>
                <th style="text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWin.document.close(); printWin.onload = () => printWin.print();
  };

  // 🔽 Open Bill Table & Smooth Scroll
  const scrollToBillTable = (
    filterType: 'all' | 'partner_online' | 'self_cod' | 'self_prepaid' | 'self_all' | 'counter',
    timeframe?: 'today' | 'week' | 'month' | 'year' | 'all'
  ) => {
    setSalesTypeFilter(filterType);
    if (timeframe) setSalesTimeframe(timeframe);
    setIsBillHistoryOpen(true); // कार्ड पर क्लिक करते ही नीचे की लिस्ट अपने आप खुल जाएगी
    setTimeout(() => {
      document.getElementById('sales-ledger-bill-table')?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* ========================================================== */}
      {/* 🚀 SALES TAB - LEDGER & ANALYTICS */}
      {/* ========================================================== */}
      {activeTab === 'sales' && (
        <div style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <h2 style={{ color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'clamp(18px, 3vw, 24px)' }}>
              <span style={{ fontSize: '28px' }}>📈</span> Live Sales Ledger & Complete Hisab
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => navigateToTargetPage('orders_history')} style={{ background: '#4f46e5', color: '#fff', border: '1px solid #818cf8', padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12.5px' }}>↗️ Orders पेज</button>
              <button onClick={() => navigateToTargetPage('pos_history')} style={{ background: '#059669', color: '#fff', border: '1px solid #34d399', padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12.5px' }}>↗️ Counter POS</button>
              <button onClick={() => navigateToTargetPage('wallet')} style={{ background: '#d97706', color: '#fff', border: '1px solid #fbbf24', padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12.5px' }}>↗️ Wallet पेज</button>
              <button onClick={fetchAllLiveSalesAndStock} style={{ background: '#0284c7', color: '#fff', border: '1px solid #38bdf8', padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12.5px' }}>{isRefreshingLive ? '⏳...' : '🔄 Refresh'}</button>
            </div>
          </div>

          {/* 📊 TOP 4 TIMEFRAME CARDS */}
          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '25px' }}>
            <div onClick={() => scrollToBillTable('all', 'today')} style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '18px', borderRadius: '16px', cursor: 'pointer', border: salesTimeframe === 'today' ? '2px solid #4ade80' : '1px solid transparent' }}>
              <p style={{ margin: 0, color: '#a7f3d0', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>📅 आज की कुल बिक्री (Today)</p>
              <h2 style={{ margin: '8px 0', color: '#fff', fontSize: '26px' }}>₹ {grossTodaysSales.toLocaleString('en-IN')}</h2>
              <div style={{ fontSize: '11.5px', color: '#d1fae5', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
                <span>🌐 Online: ₹{todayOnline.toLocaleString('en-IN')}</span>
                <span>🏪 POS: ₹{todayCounter.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div onClick={() => scrollToBillTable('all', 'month')} style={{ background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)', padding: '18px', borderRadius: '16px', cursor: 'pointer', border: salesTimeframe === 'month' ? '2px solid #38bdf8' : '1px solid transparent' }}>
              <p style={{ margin: 0, color: '#bfdbfe', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>🗓️ इस महीने की बिक्री (Month)</p>
              <h2 style={{ margin: '8px 0', color: '#fff', fontSize: '26px' }}>₹ {grossMonthlySales.toLocaleString('en-IN')}</h2>
              <div style={{ fontSize: '11.5px', color: '#dbeafe', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
                <span>🌐 Online: ₹{monthOnline.toLocaleString('en-IN')}</span>
                <span>🏪 POS: ₹{monthCounter.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div onClick={() => scrollToBillTable('all', 'year')} style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', padding: '18px', borderRadius: '16px', cursor: 'pointer', border: salesTimeframe === 'year' ? '2px solid #c084fc' : '1px solid transparent' }}>
              <p style={{ margin: 0, color: '#ddd6fe', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>📆 इस साल की बिक्री (Year)</p>
              <h2 style={{ margin: '8px 0', color: '#fff', fontSize: '26px' }}>₹ {grossYearlySales.toLocaleString('en-IN')}</h2>
              <div style={{ fontSize: '11.5px', color: '#ede9fe', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
                <span>🌐 Online: ₹{yearOnline.toLocaleString('en-IN')}</span>
                <span>🏪 POS: ₹{yearCounter.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div onClick={() => scrollToBillTable('all', 'all')} style={{ background: 'linear-gradient(135deg, #7f1d1d, #b91c1c)', padding: '18px', borderRadius: '16px', cursor: 'pointer', border: salesTimeframe === 'all' ? '2px solid #fca5a5' : '1px solid transparent' }}>
              <p style={{ margin: 0, color: '#fecaca', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>♾️ कुल लाइफटाइम (Total)</p>
              <h2 style={{ margin: '8px 0', color: '#fff', fontSize: '26px' }}>₹ {grossLifetimeSales.toLocaleString('en-IN')}</h2>
              <div style={{ fontSize: '11.5px', color: '#fee2e2', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px', flexWrap: 'wrap', gap: '4px' }}>
                <span>🌐 Online: ₹{lifeOnline.toLocaleString('en-IN')}</span>
                <span>🏪 POS: ₹{lifeCounter.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* DATE & EXPORT BAR */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ flex: '1 1 320px' }}>
                <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '12px', fontSize: '15px' }}>⏳ तारीख चुनें:</strong>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => setSalesTimeframe('today')} style={filterBtnStyle(salesTimeframe === 'today')}>आज</button>
                  <button onClick={() => setSalesTimeframe('week')} style={filterBtnStyle(salesTimeframe === 'week')}>1 हफ्ता</button>
                  <button onClick={() => setSalesTimeframe('month')} style={filterBtnStyle(salesTimeframe === 'month')}>1 महीना</button>
                  <button onClick={() => setSalesTimeframe('year')} style={filterBtnStyle(salesTimeframe === 'year')}>इस साल</button>
                  <button onClick={() => setSalesTimeframe('all')} style={filterBtnStyle(salesTimeframe === 'all')}>पूरा इतिहास</button>
                  <button onClick={() => setSalesTimeframe('custom')} style={filterBtnStyle(salesTimeframe === 'custom', true)}>📅 Date-to-Date</button>
                </div>

                {salesTimeframe === 'custom' && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '14px', alignItems: 'center', backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #f59e0b', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: '12px', color: '#94a3b8' }}>Start Date</label><input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} style={inputStyle} /></div>
                    <div style={{ flex: '1 1 140px' }}><label style={{ fontSize: '12px', color: '#94a3b8' }}>End Date</label><input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} style={inputStyle} /></div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', flex: '0 1 200px', minWidth: '170px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>📥 सेल्स रिपोर्ट डाउनलोड:</span>
                <button onClick={exportToPDF} style={{ ...actionBtnStyle, backgroundColor: '#ef4444' }}>📄 PDF Print</button>
                <button onClick={exportToExcel} style={{ ...actionBtnStyle, backgroundColor: '#10b981' }}>📊 Excel Download</button>
              </div>
            </div>
          </div>

          {/* 🔥 4 SEPARATE CLICKABLE HISAB CARDS WITH REDIRECT BUTTONS 🔥 */}
          <h3 style={{ color: '#fbbf24', marginBottom: '12px', fontSize: '16px' }}>📊 4 अलग-अलग बिक्री खाते (क्लिक करके हिसाब देखें या पेज पर जाएं):</h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '25px' }}>
            {/* 1. Partner Online */}
            <div onClick={() => scrollToBillTable('partner_online')} style={{ background: 'linear-gradient(135deg, #2e1065, #0f172a)', padding: '18px', borderRadius: '16px', border: salesTypeFilter === 'partner_online' ? '2px solid #a855f7' : '1px solid #4c1d95', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ background: '#7e22ce', color: '#fff', padding: '4px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>🛵 1. डिलीवरी पार्टनर ऑनलाइन</span>
                <span style={{ color: '#d8b4fe', fontSize: '12px', fontWeight: 'bold' }}>{partnerOnlineCount} Orders</span>
              </div>
              <h2 style={{ margin: '6px 0', color: '#fff', fontSize: '25px' }}>₹ {partnerOnlineGross.toLocaleString('en-IN')}</h2>
              <div style={{ fontSize: '12px', color: '#cbd5e1', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', lineHeight: '1.6' }}>
                <div>Admin Comm: <strong style={{ color: '#f87171' }}>-₹{partnerOnlineComm.toFixed(0)}</strong></div>
                <div>Wallet Net: <strong style={{ color: '#4ade80' }}>+₹{partnerOnlineNet.toFixed(0)}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button onClick={(e) => { e.stopPropagation(); scrollToBillTable('partner_online'); }} style={{ flex: 1, background: '#3b0764', color: '#e9d5ff', border: '1px solid #a855f7', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📊 लिस्ट देखें</button>
                <button onClick={(e) => { e.stopPropagation(); navigateToTargetPage('orders_history'); }} style={{ flex: 1, background: '#7e22ce', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>↗️ Orders पेज</button>
              </div>
            </div>

            {/* 2. Self-Delivery COD */}
            <div onClick={() => scrollToBillTable('self_cod')} style={{ background: 'linear-gradient(135deg, #78350f, #0f172a)', padding: '18px', borderRadius: '16px', border: salesTypeFilter === 'self_cod' ? '2px solid #fbbf24' : '1px solid #d97706', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ background: '#d97706', color: '#fff', padding: '4px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>🙋‍♂️💵 2. खुद डिलीवरी (COD)</span>
                <span style={{ color: '#fde68a', fontSize: '12px', fontWeight: 'bold' }}>{selfCodCount} Orders</span>
              </div>
              <h2 style={{ margin: '6px 0', color: '#fff', fontSize: '25px' }}>₹ {selfCodItemGross.toLocaleString('en-IN')}</h2>
              <div style={{ fontSize: '12px', color: '#fef3c7', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', lineHeight: '1.6' }}>
                <div>नकद वसूला: <strong style={{ color: '#fbbf24' }}>₹{selfCodCashCollected.toLocaleString('en-IN')}</strong></div>
                <div>Comm Cut: <strong style={{ color: '#f87171' }}>-₹{selfCodCommCut.toFixed(0)}</strong></div>
                <div>शुद्ध बचत: <strong style={{ color: '#4ade80' }}>₹{selfCodNetProfit.toFixed(0)}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button onClick={(e) => { e.stopPropagation(); scrollToBillTable('self_cod'); }} style={{ flex: 1, background: '#451a03', color: '#fde68a', border: '1px solid #f59e0b', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📊 COD हिसाब</button>
                <button onClick={(e) => { e.stopPropagation(); navigateToTargetPage('wallet'); }} style={{ flex: 1, background: '#d97706', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>↗️ Wallet पेज</button>
              </div>
            </div>

            {/* 3. Self-Delivery Online Prepaid */}
            <div onClick={() => scrollToBillTable('self_prepaid')} style={{ background: 'linear-gradient(135deg, #0c4a6e, #0f172a)', padding: '18px', borderRadius: '16px', border: salesTypeFilter === 'self_prepaid' ? '2px solid #38bdf8' : '1px solid #0284c7', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ background: '#0284c7', color: '#fff', padding: '4px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>🙋‍♂️💳 3. खुद डिलीवरी (Online)</span>
                <span style={{ color: '#bae6fd', fontSize: '12px', fontWeight: 'bold' }}>{selfPrepaidCount} Orders</span>
              </div>
              <h2 style={{ margin: '6px 0', color: '#fff', fontSize: '25px' }}>₹ {selfPrepaidItemGross.toLocaleString('en-IN')}</h2>
              <div style={{ fontSize: '12px', color: '#e0f2fe', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', lineHeight: '1.6' }}>
                <div>Comm Cut: <strong style={{ color: '#f87171' }}>-₹{selfPrepaidCommCut.toFixed(0)}</strong></div>
                <div>डिलीवरी बोनस: <strong style={{ color: '#fde68a' }}>+₹{selfPrepaidBonus.toFixed(0)}</strong></div>
                <div>Wallet में जुड़ा: <strong style={{ color: '#4ade80' }}>+₹{selfPrepaidWalletCredit.toFixed(0)}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button onClick={(e) => { e.stopPropagation(); scrollToBillTable('self_prepaid'); }} style={{ flex: 1, background: '#082f49', color: '#bae6fd', border: '1px solid #38bdf8', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📊 Online हिसाब</button>
                <button onClick={(e) => { e.stopPropagation(); navigateToTargetPage('orders_history'); }} style={{ flex: 1, background: '#0284c7', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>↗️ Orders पेज</button>
              </div>
            </div>

            {/* 4. Counter POS */}
            <div onClick={() => scrollToBillTable('counter')} style={{ background: 'linear-gradient(135deg, #064e3b, #0f172a)', padding: '18px', borderRadius: '16px', border: salesTypeFilter === 'counter' ? '2px solid #4ade80' : '1px solid #059669', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ background: '#059669', color: '#fff', padding: '4px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}>🏪 4. दुकान काउंटर (Counter POS)</span>
                <span style={{ color: '#6ee7b7', fontSize: '12px', fontWeight: 'bold' }}>{periodCounterCount} Bills</span>
              </div>
              <h2 style={{ margin: '6px 0', color: '#fff', fontSize: '25px' }}>₹ {periodCounterGross.toLocaleString('en-IN')}</h2>
              <div style={{ fontSize: '12px', color: '#d1fae5', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', lineHeight: '1.6' }}>
                <div>💵 Cash गल्ला: <strong>₹{counterCashAmt.toLocaleString('en-IN')}</strong></div>
                <div>🏦 Shop UPI: <strong>₹{counterUpiAmt.toLocaleString('en-IN')}</strong></div>
                <div>📒 Khata उधार: <strong style={{ color: '#fbbf24' }}>₹{counterKhataAmt.toLocaleString('en-IN')}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                <button onClick={(e) => { e.stopPropagation(); scrollToBillTable('counter'); }} style={{ flex: 1, background: '#022c22', color: '#6ee7b7', border: '1px solid #10b981', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>📊 POS लिस्ट देखें</button>
                <button onClick={(e) => { e.stopPropagation(); navigateToTargetPage('pos_history'); }} style={{ flex: 1, background: '#059669', color: '#fff', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>↗️ POS पेज</button>
              </div>
            </div>
          </div>

          {/* TOTAL SUMMARY BOX */}
          <div style={{ background: 'linear-gradient(90deg, #022c22, #064e3b)', padding: '22px', borderRadius: '16px', border: '1px solid #10b981', marginBottom: '25px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#34d399', fontSize: '16px' }}>💰 कुल बिक्री व शुद्ध कमाई ({salesTypeFilter.toUpperCase()} — {displayedOrders.length} Records)</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <span>Total Item Sales:</span><strong>₹ {filteredGrossItems.toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <span>Admin Commission (0% on POS & Self-COD Comm adjustments):</span><strong style={{ color: '#f87171' }}>- ₹ {filteredFee.toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ color: '#6ee7b7', fontWeight: 'bold', fontSize: '17px' }}>Your Net Earning:</span>
              <strong style={{ color: '#10b981', fontSize: '26px' }}>₹ {filteredNet.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {/* ========================================================== */}
          {/* 🧾 CLICKABLE BILL HISTORY BAR (क्लिक करने पर नीचे खुलेगा) */}
          {/* ========================================================== */}
          <div
            id="sales-ledger-bill-table"
            onClick={() => setIsBillHistoryOpen(prev => !prev)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#1e293b',
              padding: '16px 20px',
              borderRadius: isBillHistoryOpen ? '14px 14px 0 0' : '14px',
              border: '1px solid #38bdf8',
              cursor: 'pointer',
              flexWrap: 'wrap',
              gap: '12px',
              marginTop: '20px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              transition: '0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🧾 Bill History & Hisab ({displayedOrders.length} Bills)
              </h3>
              <span style={{
                background: isBillHistoryOpen ? '#ef4444' : '#0284c7',
                color: '#fff',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                {isBillHistoryOpen ? '🔼 बंद करें (Hide)' : '🔽 देखने के लिए क्लिक करें (Open)'}
              </span>
            </div>

            <div
              onClick={e => e.stopPropagation()}
              style={{ display: 'flex', gap: '5px', background: '#0f172a', padding: '5px', borderRadius: '10px', border: '1px solid #334155', flexWrap: 'wrap' }}
            >
              <button onClick={() => { setSalesTypeFilter('all'); setIsBillHistoryOpen(true); }} style={{ background: salesTypeFilter === 'all' ? '#38bdf8' : 'transparent', color: salesTypeFilter === 'all' ? '#0f172a' : '#cbd5e1', border: 'none', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>All ({filteredSalesOrders.length})</button>
              <button onClick={() => { setSalesTypeFilter('partner_online'); setIsBillHistoryOpen(true); }} style={{ background: salesTypeFilter === 'partner_online' ? '#8b5cf6' : 'transparent', color: salesTypeFilter === 'partner_online' ? '#fff' : '#cbd5e1', border: 'none', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>🛵 Online ({partnerOnlineCount})</button>
              <button onClick={() => { setSalesTypeFilter('self_cod'); setIsBillHistoryOpen(true); }} style={{ background: salesTypeFilter === 'self_cod' ? '#f59e0b' : 'transparent', color: salesTypeFilter === 'self_cod' ? '#0f172a' : '#cbd5e1', border: 'none', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>🙋‍♂️💵 Self COD ({selfCodCount})</button>
              <button onClick={() => { setSalesTypeFilter('self_prepaid'); setIsBillHistoryOpen(true); }} style={{ background: salesTypeFilter === 'self_prepaid' ? '#0284c7' : 'transparent', color: salesTypeFilter === 'self_prepaid' ? '#fff' : '#cbd5e1', border: 'none', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>🙋‍♂️💳 Self Paid ({selfPrepaidCount})</button>
              <button onClick={() => { setSalesTypeFilter('counter'); setIsBillHistoryOpen(true); }} style={{ background: salesTypeFilter === 'counter' ? '#10b981' : 'transparent', color: salesTypeFilter === 'counter' ? '#fff' : '#cbd5e1', border: 'none', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>🏪 POS ({periodCounterCount})</button>
            </div>
          </div>

          {/* 🔽 COLLAPSIBLE BILL TABLE BODY */}
          {isBillHistoryOpen && (
            <div style={{ backgroundColor: '#1e293b', borderRadius: '0 0 14px 14px', overflow: 'hidden', border: '1px solid #38bdf8', borderTop: 'none', marginBottom: '30px', overflowX: 'auto', animation: 'fadeIn 0.25s ease-in-out' }}>
              {displayedOrders.length === 0 ? (
                <p style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>इस फिल्टर में कोई बिल नहीं मिला।</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8', fontSize: '13px' }}>
                      <th style={{ padding: '14px' }}>Date</th>
                      <th style={{ padding: '14px' }}>Bill / ID</th>
                      <th style={{ padding: '14px' }}>Sale Type</th>
                      <th style={{ padding: '14px' }}>Customer</th>
                      <th style={{ padding: '14px' }}>Items</th>
                      <th style={{ padding: '14px' }}>Total</th>
                      <th style={{ padding: '14px' }}>Comm</th>
                      <th style={{ padding: '14px' }}>Net</th>
                      <th style={{ padding: '14px' }}>Hisab / Settlement</th>
                      <th style={{ padding: '14px', textAlign: 'center' }}>Action / Go</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedOrders.map((o: any) => {
                      const calc = calculateFinances(o);
                      const items = getProductDetailsArray(o);
                      const itemNames = items.map((i: any) => `${i.name || i.product_name} (${i.quantity || i.qty || 1})`).join(', ');
                      const displayDate = o.delivered_at || o.created_at;
                      return (
                        <tr key={`${o.order_no || o.id}_${o.created_at}`} style={{ borderBottom: '1px solid #334155', cursor: 'pointer' }} onClick={() => setSelectedOrder(o)} className="hover-row">
                          <td style={{ padding: '14px', color: '#cbd5e1', fontSize: '13px' }}>
                            {new Date(displayDate).toLocaleDateString('en-IN')}<br />
                            <small style={{ color: '#64748b' }}>{new Date(displayDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
                          </td>
                          <td style={{ padding: '14px', color: '#38bdf8', fontWeight: 'bold' }}>#{o.order_no || o.bill_no || String(o.id).substring(0, 6)}</td>
                          <td style={{ padding: '14px' }}>
                            {calc.isCounter ? (
                              <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#4ade80', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', border: '1px solid #10b981', fontWeight: 'bold' }}>🏪 Counter POS</span>
                            ) : calc.isSelfDel ? (
                              <span style={{ background: calc.isCod ? 'rgba(245, 158, 11, 0.2)' : 'rgba(2, 132, 199, 0.2)', color: calc.isCod ? '#fbbf24' : '#38bdf8', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', border: calc.isCod ? '1px solid #f59e0b' : '1px solid #0284c7', fontWeight: 'bold' }}>
                                {calc.isCod ? '🙋‍♂️💵 Self-Del (COD)' : '🙋‍♂️💳 Self-Del (Online)'}
                              </span>
                            ) : (
                              <span style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', border: '1px solid #8b5cf6', fontWeight: 'bold' }}>🛵 Partner Online</span>
                            )}
                          </td>
                          <td style={{ padding: '14px', color: '#f8fafc', fontSize: '13.5px' }}>
                            <strong>{o.customer_name || o.name || 'Walk-in'}</strong>
                            {o.user_phone || o.phone ? <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>📞 {o.user_phone || o.phone}</div> : null}
                          </td>
                          <td style={{ padding: '14px', color: '#cbd5e1', fontSize: '12.5px', maxWidth: '190px' }}>{itemNames || '-'}</td>
                          <td style={{ padding: '14px', color: '#f8fafc', fontWeight: 'bold' }}>₹{calc.itemTotal.toFixed(2)}</td>
                          <td style={{ padding: '14px', color: calc.isCounter ? '#94a3b8' : '#f87171', fontSize: '13px' }}>{calc.isCounter ? '₹0' : `-₹${calc.adminComm.toFixed(2)}`}</td>
                          <td style={{ padding: '14px', color: '#10b981', fontWeight: 'bold', fontSize: '15px' }}>₹{calc.netEarning.toFixed(2)}</td>
                          <td style={{ padding: '14px', fontSize: '12px' }}>
                            {calc.isCounter ? (
                              <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{calc.payBucket === 'upi' ? '🏦 Shop UPI' : calc.payBucket === 'khata' ? '📒 Khata' : '💵 Cash'} (Direct)</span>
                            ) : calc.isSelfDel && calc.isCod ? (
                              <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>💵 Cash: ₹{calc.totalBill.toFixed(0)} <br /><small style={{ color: '#f87171' }}>Comm: -₹{calc.adminComm.toFixed(2)}</small></span>
                            ) : (
                              <span style={{ color: '#4ade80', fontWeight: 'bold' }}>+₹{calc.netEarning.toFixed(2)} <br /><small style={{ color: '#a7f3d0' }}>in Wallet</small></span>
                            )}
                          </td>
                          <td style={{ padding: '14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button onClick={() => setSelectedOrder(o)} style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 'bold' }}>👁️ View</button>
                              <button onClick={() => navigateToTargetPage(calc.isCounter ? 'pos_history' : 'orders_history', o)} style={{ backgroundColor: '#059669', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11.5px', fontWeight: 'bold' }}>↗️ Page</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* 📦 STOCK TAB (WITH CATEGORY, DATE FILTERS & PDF/EXCEL EXPORT) */}
      {/* ========================================================== */}
      {activeTab === 'stock' && (
        <div style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
          {/* TOP HEADER + SEARCH + CATEGORY DROPDOWN */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h2 style={{ color: '#38bdf8', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'clamp(18px, 3vw, 24px)' }}>
              <span style={{ fontSize: '28px' }}>📦</span> Live Stock Room & Inventory Report
            </h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
              <button onClick={fetchAllLiveSalesAndStock} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                {isRefreshingLive ? '⏳...' : '🔄 Sync Stock'}
              </button>

              <select
                value={stockCategory}
                onChange={(e) => setStockCategory(e.target.value)}
                style={{ ...inputStyle, width: 'auto', minWidth: '170px', margin: 0, border: '1px solid #38bdf8', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {uniqueStockCategories.map((cat: any) => (
                  <option key={cat} value={cat}>📂 {cat}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="🔍 Search product in stock..."
                value={stockSearchTerm}
                onChange={(e) => setStockSearchTerm(e.target.value)}
                style={{ ...inputStyle, width: '240px', maxWidth: '100%', margin: 0, border: '1px solid #38bdf8' }}
              />
            </div>
          </div>

          {/* 🆕 CLICKABLE CATEGORY PILLS FOR QUICK FILTERING */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '16px' }}>
            {uniqueStockCategories.map((cat: any) => {
              const active = stockCategory === cat;
              const countInCat = cat === 'All Categories' ? shopProducts.length : shopProducts.filter((p: any) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setStockCategory(cat)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: active ? '1px solid #38bdf8' : '1px solid #334155',
                    backgroundColor: active ? '#0284c7' : '#0f172a',
                    color: active ? '#fff' : '#cbd5e1',
                    fontWeight: 'bold',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {cat} ({countInCat})
                </button>
              );
            })}
          </div>

          {/* 🆕 STOCK DATE FILTER (TODAY, 1 WEEK, 1 MONTH, DATE-TO-DATE) & EXCEL/PDF DOWNLOAD BAR */}
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ flex: '1 1 320px' }}>
                <strong style={{ color: '#e2e8f0', display: 'block', marginBottom: '12px', fontSize: '15px' }}>
                  ⏳ स्टॉक बिक्री (Sold Qty) की तारीख चुनें:
                </strong>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => setStockTimeframe('all')} style={filterBtnStyle(stockTimeframe === 'all')}>पूरा स्टॉक (All Time)</button>
                  <button onClick={() => setStockTimeframe('today')} style={filterBtnStyle(stockTimeframe === 'today')}>आज (Today)</button>
                  <button onClick={() => setStockTimeframe('week')} style={filterBtnStyle(stockTimeframe === 'week')}>1 हफ्ता (1 Week)</button>
                  <button onClick={() => setStockTimeframe('month')} style={filterBtnStyle(stockTimeframe === 'month')}>1 महीना (1 Month)</button>
                  <button onClick={() => setStockTimeframe('custom')} style={filterBtnStyle(stockTimeframe === 'custom', true)}>📅 Date-to-Date</button>
                </div>

                {stockTimeframe === 'custom' && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '14px', alignItems: 'center', backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #f59e0b', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={{ fontSize: '12px', color: '#94a3b8' }}>Start Date</label>
                      <input type="date" value={stockStartDate} onChange={e => setStockStartDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={{ fontSize: '12px', color: '#94a3b8' }}>End Date</label>
                      <input type="date" value={stockEndDate} onChange={e => setStockEndDate(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', flex: '0 1 210px', minWidth: '180px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>📥 टोटल स्टॉक डाउनलोड ({getStockPeriodLabel()}):</span>
                <button onClick={exportStockToPDF} style={{ ...actionBtnStyle, backgroundColor: '#ef4444' }}>📄 Stock PDF Print</button>
                <button onClick={exportStockToExcel} style={{ ...actionBtnStyle, backgroundColor: '#10b981' }}>📊 Stock Excel Download</button>
              </div>
            </div>
          </div>

          {/* 📊 STOCK SUMMARY CARDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '15px', marginBottom: '22px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #1d4ed8)', padding: '18px', borderRadius: '14px' }}>
              <p style={{ margin: 0, color: '#bfdbfe', fontSize: '12.5px', fontWeight: 'bold' }}>कुल प्रोडक्ट्स ({stockCategory})</p>
              <h2 style={{ margin: '8px 0 2px 0', color: '#fff', fontSize: '25px' }}>{totalStockProductsCount} Items</h2>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '18px', borderRadius: '14px' }}>
              <p style={{ margin: 0, color: '#a7f3d0', fontSize: '12.5px', fontWeight: 'bold' }}>कुल बचा हुआ स्टॉक</p>
              <h2 style={{ margin: '8px 0 2px 0', color: '#fff', fontSize: '25px' }}>{totalStockUnitsLeft} Units</h2>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #4c1d95, #6d28d9)', padding: '18px', borderRadius: '14px' }}>
              <p style={{ margin: 0, color: '#ddd6fe', fontSize: '12.5px', fontWeight: 'bold' }}>कुल स्टॉक वैल्यू</p>
              <h2 style={{ margin: '8px 0 2px 0', color: '#fff', fontSize: '25px' }}>₹ {totalStockValueAmount.toLocaleString('en-IN')}</h2>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #0c4a6e, #0284c7)', padding: '18px', borderRadius: '14px' }}>
              <p style={{ margin: 0, color: '#bae6fd', fontSize: '12.5px', fontWeight: 'bold' }}>Sold ({getStockPeriodLabel()})</p>
              <h2 style={{ margin: '8px 0 2px 0', color: '#fff', fontSize: '25px' }}>{totalPeriodSoldUnits} Units</h2>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #b91c1c)', padding: '18px', borderRadius: '14px' }}>
              <p style={{ margin: 0, color: '#fecaca', fontSize: '12.5px', fontWeight: 'bold' }}>Low / Out of Stock</p>
              <h2 style={{ margin: '8px 0 2px 0', color: '#fff', fontSize: '25px' }}>{lowStockCount} Items</h2>
            </div>
          </div>

          {/* 📦 STOCK ITEMS LIST (AUTO-ADJUST RESPONSIVE) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {displayedStock.length === 0 ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px', backgroundColor: '#1e293b', borderRadius: '12px' }}>
                <h3>इस कैटेगरी या सर्च में कोई प्रोडक्ट नहीं मिला।</h3>
              </div>
            ) : (
              displayedStock.map((p: any) => {
                const isLow = Number(p.total_stock) <= 5;
                const sold = getProductPeriodSold(p);
                const soldRev = getProductPeriodRevenue(p);
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px',
                      backgroundColor: '#1e293b',
                      border: `1px solid ${isLow ? '#ef4444' : '#334155'}`,
                      borderRadius: '14px',
                      flexWrap: 'wrap',
                      gap: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '2 1 240px' }}>
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          onClick={() => setViewPhoto(p.image_url)}
                          style={{ width: '54px', height: '54px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer', border: '1px solid #475569' }}
                        />
                      )}
                      <div>
                        <strong style={{ fontSize: '16.5px', color: '#f8fafc', display: 'block' }}>{p.name}</strong>
                        <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                          Category: <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{p.category || 'General'}</span> | Rate: <strong style={{ color: '#f8fafc' }}>₹{p.price}</strong> / {p.unit || 'Pc'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#cbd5e1', marginTop: '3px' }}>
                          Stock Value: <strong>₹{(Number(p.price || 0) * Number(p.total_stock || 0)).toLocaleString('en-IN')}</strong>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flex: '2 1 280px', justifyContent: 'space-between' }}>
                      <div style={{ textAlign: 'center', padding: '8px 14px', background: isLow ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: isLow ? '#f87171' : '#4ade80', fontWeight: 'bold', flex: '1 1 110px' }}>
                        Stock Left: <span style={{ fontSize: '19px' }}>{p.total_stock || 0}</span> {p.unit || 'Pc'}
                      </div>

                      <div style={{ textAlign: 'center', padding: '8px 14px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: '#93c5fd', fontWeight: 'bold', flex: '1 1 130px' }}>
                        Sold ({stockTimeframe === 'all' ? 'Total' : stockTimeframe}): <span style={{ fontSize: '19px' }}>{sold}</span> {p.unit || 'Pc'}
                        <div style={{ fontSize: '11px', color: '#bfdbfe' }}>₹{soldRev.toLocaleString('en-IN')}</div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => togglePaymentMode(p.id, p.is_cod_available !== false)}
                          style={{ ...editBtn, backgroundColor: p.is_cod_available !== false ? '#059669' : '#d97706', padding: '9px 12px' }}
                        >
                          {p.is_cod_available !== false ? '💵 COD On' : '💳 Prepaid'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setEditPrice(String(p.price || ''));
                            setEditStock(String(p.total_stock || ''));
                            setEditImage(p.image_url || '');
                            setEditIsCodAvailable(p.is_cod_available !== false);
                          }}
                          style={{ ...editBtn, backgroundColor: '#3b82f6', padding: '9px 14px' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setProductToDelete(p)}
                          style={{ ...editBtn, backgroundColor: '#ef4444', padding: '9px 14px' }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ✏️ EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div style={modalOverlayStyle} onClick={() => setEditingProduct(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#38bdf8' }}>✏️ Edit Product: {editingProduct.name}</h3>
            <label style={{ fontSize: '12.5px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>Selling Price (₹)</label>
            <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />

            <label style={{ fontSize: '12.5px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>Available Stock ({editingProduct.unit || 'Pc'})</label>
            <input type="number" value={editStock} onChange={e => setEditStock(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />

            <label style={{ fontSize: '12.5px', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>Image URL</label>
            <input type="text" value={editImage} onChange={e => setEditImage(e.target.value)} style={{ ...inputStyle, marginBottom: '14px' }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '13.5px', marginBottom: '18px', cursor: 'pointer' }}>
              <input type="checkbox" checked={editIsCodAvailable} onChange={e => setEditIsCodAvailable(e.target.checked)} />
              Cash on Delivery (COD) Available
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={updateStockProduct} style={{ flex: 1, padding: '11px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✅ Save</button>
              <button onClick={() => setEditingProduct(null)} style={{ flex: 1, padding: '11px', background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✖ Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ DELETE PRODUCT MODAL */}
      {productToDelete && (
        <div style={modalOverlayStyle} onClick={() => setProductToDelete(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#f87171' }}>🗑️ Delete: {productToDelete.name}?</h3>
            <p style={{ color: '#cbd5e1', fontSize: '13.5px' }}>प्रोडक्ट डिलीट करने के लिए दुकान का पासवर्ड डालें:</p>
            <input type="password" placeholder="Enter Password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} style={{ ...inputStyle, marginBottom: '15px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={confirmDeleteProduct} style={{ flex: 1, padding: '11px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🗑️ Confirm Delete</button>
              <button onClick={() => { setProductToDelete(null); setDeletePassword(''); }} style={{ flex: 1, padding: '11px', background: '#475569', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✖ Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ PHOTO VIEW MODAL */}
      {viewPhoto && (
        <div style={modalOverlayStyle} onClick={() => setViewPhoto(null)}>
          <div style={{ ...modalContentStyle, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <img src={viewPhoto} alt="Product" style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '12px' }} />
            <button onClick={() => setViewPhoto(null)} style={{ marginTop: '12px', padding: '8px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>✖ बंद करें</button>
          </div>
        </div>
      )}

      {/* 🧾 BILL RECEIPT MODAL WITH REDIRECT BUTTONS */}
      {selectedOrder && (
        <div style={modalOverlayStyle} onClick={() => setSelectedOrder(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed #334155', paddingBottom: '15px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '20px' }}>
                  🧾 Bill Receipt {calculateFinances(selectedOrder).isCounter ? '(🏪 Counter POS)' : calculateFinances(selectedOrder).isSelfDel ? '(🙋‍♂️ Self-Delivered)' : '(🌐 Online App)'}
                </h2>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Order/Bill ID: #{selectedOrder.order_no || selectedOrder.bill_no || String(selectedOrder.id).substring(0, 8)}</span>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '24px', cursor: 'pointer' }}>✖</button>
            </div>

            <div style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #334155' }}>
              <p style={{ margin: '0 0 5px 0', color: '#cbd5e1' }}><strong>Customer:</strong> {selectedOrder.customer_name || selectedOrder.name || 'Walk-in'}</p>
              <p style={{ margin: '0 0 5px 0', color: '#cbd5e1' }}><strong>Phone:</strong> {selectedOrder.user_phone || selectedOrder.phone || 'N/A'}</p>
              {selectedOrder.address && <p style={{ margin: '0 0 5px 0', color: '#cbd5e1' }}><strong>Address:</strong> {selectedOrder.address}</p>}
              <p style={{ margin: '0 0 5px 0', color: '#cbd5e1' }}><strong>Payment Mode:</strong> {selectedOrder.payment_mode || selectedOrder.payment_method || 'Cash'}</p>
              <p style={{ margin: 0, color: '#cbd5e1' }}><strong>Date:</strong> {new Date(selectedOrder.delivered_at || selectedOrder.created_at).toLocaleString('en-IN')}</p>
            </div>

            <h4 style={{ color: '#e2e8f0', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '10px' }}>🛍️ Items Purchased</h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '20px', paddingRight: '10px' }}>
              <table style={{ width: '100%', fontSize: '13.5px', color: '#cbd5e1' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
                    <th style={{ padding: '6px 0' }}>Item Name</th>
                    <th style={{ padding: '6px 0', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '6px 0', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {getProductDetailsArray(selectedOrder).map((item: any, i: number) => {
                    const isCounter = isOrderCounterPos(selectedOrder);
                    const qty = Number(item.quantity || item.qty || 1);
                    const rawP = Number(item.price || 0);
                    const lineAmt = item.total !== undefined ? Number(item.total) : isCounter ? rawP * qty : rawP;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '6px 0' }}>{item.name || item.product_name || item.item_name}</td>
                        <td style={{ padding: '6px 0', textAlign: 'center' }}>{qty} {item.unit || ''}</td>
                        <td style={{ padding: '6px 0', textAlign: 'right' }}>₹{lineAmt.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ backgroundColor: '#064e3b', padding: '18px', borderRadius: '12px', border: '1px solid #10b981', marginBottom: '20px' }}>
              {(() => {
                const calc = calculateFinances(selectedOrder);
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#a7f3d0' }}><span>Item Total Amount:</span><strong>₹{calc.itemTotal.toFixed(2)}</strong></div>
                    {calc.selfDelBonus > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#fde68a' }}><span>🙋‍♂️ Self Delivery Bonus:</span><strong>+₹{calc.selfDelBonus.toFixed(2)}</strong></div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#fca5a5', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '8px' }}>
                      <span>Admin Comm. {calc.isCounter ? '(0% on POS)' : 'Deducted'}:</span>
                      <strong>-₹{calc.adminComm.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff', marginBottom: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 'bold' }}>Your Net Payout:</span>
                      <strong style={{ fontSize: '22px', color: '#10b981', background: '#fff', padding: '2px 8px', borderRadius: '6px' }}>₹{calc.netEarning.toFixed(2)}</strong>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const ord = selectedOrder;
                  setSelectedOrder(null);
                  navigateToTargetPage(calculateFinances(ord).isCounter ? 'pos_history' : 'orders_history', ord);
                }}
                style={{ flex: 1, padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
              >
                ↗️ Main Page पर खोलें
              </button>
              {!calculateFinances(selectedOrder).isCounter && (
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    navigateToTargetPage('wallet');
                  }}
                  style={{ flex: 1, padding: '12px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                >
                  💳 Wallet में देखें
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
          .hover-row:hover { background-color: #334155 !important; }
          .image-overlay:hover { opacity: 1 !important; }
          @media (max-width: 640px) {
            .responsive-grid-4 { grid-template-columns: 1fr !important; }
          }
        `
      }} />
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = { padding: '11px 16px', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13.5px', transition: '0.2s', width: '100%' };
const filterBtnStyle = (active: boolean, isCustom: boolean = false): React.CSSProperties => ({ padding: '9px 15px', borderRadius: '8px', border: '1px solid #334155', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s', backgroundColor: active ? (isCustom ? '#f59e0b' : '#38bdf8') : '#0f172a', color: active ? '#0f172a' : '#cbd5e1', boxShadow: active ? '0 4px 10px rgba(0,0,0,0.3)' : 'none', fontSize: '13px' });
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', fontSize: '14px', boxSizing: 'border-box' };
const editBtn: React.CSSProperties = { border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px', transition: '0.2s' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: '0', left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '16px', backdropFilter: 'blur(4px)', boxSizing: 'border-box' };
const modalContentStyle: React.CSSProperties = { backgroundColor: '#1e293b', padding: '22px', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #38bdf8', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', boxSizing: 'border-box' };