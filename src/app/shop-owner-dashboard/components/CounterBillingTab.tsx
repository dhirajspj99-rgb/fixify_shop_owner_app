"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import GstReturnTab from './GstReturnTab';

const UNIT_OPTIONS = ['Pc', 'Kg', 'Gm', 'Pkt', 'Box', 'Ft', 'Mtr', 'Set', 'Ltr', 'Bag'];

export default function CounterBillingTab({
  currentShop,
  setCurrentShop,
  products,
  fetchProducts,
  orders,
  setOrders,
  fetchOrders,
  mode = 'pos' // 'pos' | 'delivery_partners'
}: any) {
  // ==========================================
  // 🖥️ DEDICATED FULL-SCREEN POS MODE STATE
  // ==========================================
  const [isFullScreenPos, setIsFullScreenPos] = useState<boolean>(false);

  const toggleFullScreenPos = () => {
    const nextState = !isFullScreenPos;
    setIsFullScreenPos(nextState);
    try {
      if (nextState && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!nextState && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  };

  // ==========================================
  // 💳 SUBSCRIPTION PLANS & STRICT ADMIN APPROVAL STATE
  // ==========================================
  const [adminUpi, setAdminUpi] = useState('admin@ybl');
  const [selectedPlan, setSelectedPlan] = useState<any>({
    id: '1_month',
    name: '1 Month Plan (Monthly)',
    months: 1,
    days: 30,
    price: 199,
    origPrice: 249,
    badge: '₹199 / Month'
  });
  const [utrNumber, setUtrNumber] = useState('');
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [pendingPaymentRecord, setPendingPaymentRecord] = useState<any>(null);

  const posPlans = [
    { id: '1_month', name: '1 Month Plan (Monthly)', months: 1, days: 30, price: 199, origPrice: 249, badge: '₹199 / Month' },
    { id: '3_months', name: '3 Months Plan (Quarterly)', months: 3, days: 90, price: 549, origPrice: 597, badge: 'Save ₹48' },
    { id: '6_months', name: '6 Months Plan (Half-Yearly)', months: 6, days: 180, price: 999, origPrice: 1194, badge: 'Save ₹195' },
    { id: '12_months', name: '12 Months Plan (Annual)', months: 12, days: 365, price: 1999, origPrice: 2388, badge: 'Best Value • Save ₹389' }
  ];

  // ==========================================
  // 🧾 POS BILLING, CHARGES & GST STATES
  // ==========================================
  const [posSubView, setPosSubView] = useState<'pos_screen' | 'counter_history' | 'online_history' | 'gst_return'>('pos_screen');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState<any[]>([]);

  // Live Synced Inventory State from Supabase `products` table
  const [liveDbProducts, setLiveDbProducts] = useState<any[]>([]);
  const [isSyncingStock, setIsSyncingStock] = useState<boolean>(false);

  // Dedicated Supabase `counter_bills` State
  const [dbCounterBills, setDbCounterBills] = useState<any[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState<boolean>(false);

  // Local Stock Override Map so UI immediately reflects deducted stock after sale
  const [localStockOverrides, setLocalStockOverrides] = useState<Record<string, number>>({});

  // Product QR / Barcode Camera Scanner States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanStatusMsg, setScanStatusMsg] = useState('Position the product QR or Barcode inside the frame...');
  const [manualScanCode, setManualScanCode] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Customer Details
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');

  // Extra Charges & Discounts
  const [discount, setDiscount] = useState<string>('0');
  const [labourCharge, setLabourCharge] = useState<string>('0');
  const [transportCharge, setTransportCharge] = useState<string>('0');

  // GST Settings (Inclusive / Exclusive)
  const [isGstBillEnabled, setIsGstBillEnabled] = useState<boolean>(false);
  const [gstType, setGstType] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [gstPercent, setGstPercent] = useState<number>(18);
  const [shopGstNumber, setShopGstNumber] = useState<string>('');
  const [custGstNumber, setCustGstNumber] = useState<string>('');
  const [isEditingGst, setIsEditingGst] = useState<boolean>(false);

  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Khata_Due'>('Cash');
  const [isGeneratingBill, setIsGeneratingBill] = useState(false);
  const [lastGeneratedBill, setLastGeneratedBill] = useState<any | null>(null);

  // ✏️ Old Bill Edit & 📱 Mobile Bill Preview States
  const [editingBill, setEditingBill] = useState<any | null>(null);
  const [mobilePreviewBill, setMobilePreviewBill] = useState<any | null>(null);

  // Quick Custom Item State
  const [showCustomItemBox, setShowCustomItemBox] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState('1');
  const [customItemUnit, setCustomItemUnit] = useState('Pc');

  // Shop Owner UPI ID for Bill QR Code
  const [shopUpiId, setShopUpiId] = useState('');
  const [isEditingUpi, setIsEditingUpi] = useState(false);

  // Local backup history for Counter Bills
  const [localCounterBills, setLocalCounterBills] = useState<any[]>([]);

  // ==========================================
  // 📊 DATE & PAYMENT FILTER STATES (FOR REPORTS)
  // ==========================================
  const [dateRangePreset, setDateRangePreset] = useState<'today' | '7days' | 'month' | 'all' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'upi' | 'khata'>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [showProductSummaryModal, setShowProductSummaryModal] = useState(false);

  // ==========================================
  // 🛵 DELIVERY PARTNERS FILTER STATES
  // ==========================================
  const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);
  const [filterBlock, setFilterBlock] = useState(currentShop?.block || '');
  const [filterPincode, setFilterPincode] = useState(currentShop?.pincode || '');
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState<string>('');

  // Helper to detect Mobile / Android WebView
  const checkIsMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|wv|Capacitor/i.test(navigator.userAgent) || window.innerWidth <= 900;
  };

  // Helper to extract Shop Owner's own UPI from profile object
  const extractProfileShopUpi = (shopObj: any): string => {
    if (!shopObj) return '';
    const candidate =
      shopObj.upi_id ||
      shopObj.upi ||
      shopObj.shop_upi ||
      shopObj.payment_upi ||
      shopObj.owner_upi ||
      '';
    const trimmed = String(candidate).trim();
    return trimmed.includes('@') && trimmed.toLowerCase() !== 'admin@ybl' ? trimmed : '';
  };

  // 1. DIRECT SUPABASE STOCK FETCHER (`products` table)
  const fetchLiveShopStockFromDb = async () => {
    if (!currentShop?.id) return;
    setIsSyncingStock(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('shop_id', currentShop.id)
        .order('id', { ascending: false });

      if (!error && data) {
        setLiveDbProducts(data);
        setLocalStockOverrides({});
      }
    } catch (err) {
      console.warn('Stock sync error:', err);
    } finally {
      setIsSyncingStock(false);
    }
  };

  // 2. DIRECT SUPABASE COUNTER BILLS FETCHER (`counter_bills` table)
  const fetchCounterBillsFromDb = async () => {
    if (!currentShop?.id) return;
    setIsLoadingBills(true);
    try {
      const { data, error } = await supabase
        .from('counter_bills')
        .select('*')
        .eq('shop_id', String(currentShop.id))
        .order('created_at', { ascending: false });

      if (!error && data) {
        const normalized = data.map((row: any) => ({
          ...row,
          order_no: row.bill_no,
          billNo: row.bill_no,
          subTotal: Number(row.subtotal || 0),
          discountAmt: Number(row.discount || 0),
          labourCharge: Number(row.labour_charge || 0),
          transportCharge: Number(row.transport_charge || 0),
          isGstBill: Boolean(row.is_gst_bill),
          gstPercent: Number(row.gst_percent || 0),
          gstAmt: Number(row.gst_amount || 0),
          shopGstNo: row.shop_gst_no || '',
          custGstNo: row.customer_gst_no || '',
          grandTotal: Number(row.grand_total || 0),
          total_amount: Number(row.grand_total || 0),
          cartItems: row.items || [],
          items: row.items || [],
          paymentMethod: row.payment_method || 'Cash',
          payment_mode: row.payment_mode || `Counter POS - ${row.payment_method || 'Cash'}`,
          type: 'counter_sale',
          custName: row.customer_name || 'Walk-in Customer',
          customer_name: row.customer_name || 'Walk-in Customer',
          custPhone: row.customer_phone || '',
          phone: row.customer_phone || '',
          custAddress: row.customer_address || '',
          address: row.customer_address || '',
          shopUpiId: row.shop_upi_id || ''
        }));
        setDbCounterBills(normalized);
      }
    } catch (err) {
      console.warn('Counter bills load error:', err);
    } finally {
      setIsLoadingBills(false);
    }
  };

  useEffect(() => {
    fetchAdminUpiAndPlanStatus();
    if (currentShop?.id) {
      fetchLiveShopStockFromDb();
      fetchCounterBillsFromDb();

      const profileUpi =
        extractProfileShopUpi(currentShop) ||
        localStorage.getItem(`fixifiy_shop_upi_${currentShop.id}`) ||
        '';
      setShopUpiId(profileUpi.includes('@') && profileUpi.toLowerCase() !== 'admin@ybl' ? profileUpi.trim() : '');

      const savedGst =
        currentShop?.gst_no ||
        currentShop?.gstin ||
        currentShop?.gst_number ||
        currentShop?.gst ||
        localStorage.getItem(`fixifiy_shop_gst_${currentShop.id}`) ||
        '';
      setShopGstNumber(savedGst);

      try {
        const savedLocal = localStorage.getItem(`fixifiy_counter_bills_${currentShop.id}`);
        if (savedLocal) setLocalCounterBills(JSON.parse(savedLocal));
      } catch {}

      const posChannel = supabase
        .channel(`pos_live_channel_${currentShop.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products',
            filter: `shop_id=eq.${currentShop.id}`
          },
          () => {
            fetchLiveShopStockFromDb();
            if (typeof fetchProducts === 'function') fetchProducts();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'counter_bills',
            filter: `shop_id=eq.${currentShop.id}`
          },
          () => {
            fetchCounterBillsFromDb();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(posChannel);
      };
    }
    if (mode === 'delivery_partners') {
      fetchAreaDeliveryPartners();
    }
  }, [currentShop?.id, currentShop?.upi_id, currentShop?.upi, mode]);

  useEffect(() => {
    if (Array.isArray(products) && products.length > 0 && currentShop?.id) {
      const shopItems = products.filter((p: any) => String(p.shop_id) === String(currentShop.id));
      if (shopItems.length > 0) {
        setLiveDbProducts(shopItems);
        setLocalStockOverrides({});
      }
    }
  }, [products, currentShop?.id]);

  const playBeepSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  const saveShopOwnerUpi = async () => {
    const cleanUpi = shopUpiId.trim();
    if (cleanUpi && !cleanUpi.includes('@')) {
      return alert('Please enter a valid UPI ID (e.g., 9876543210@ybl).');
    }
    if (cleanUpi) {
      localStorage.setItem(`fixifiy_shop_upi_${currentShop?.id}`, cleanUpi);
    } else {
      localStorage.removeItem(`fixifiy_shop_upi_${currentShop?.id}`);
    }
    try {
      await supabase.from('shops').update({ upi_id: cleanUpi || null }).eq('id', currentShop.id);
    } catch {}
    if (setCurrentShop && currentShop) {
      const updated = { ...currentShop, upi_id: cleanUpi };
      setCurrentShop(updated);
      localStorage.setItem('fixifiy_shop', JSON.stringify(updated));
    }
    setIsEditingUpi(false);
    alert(cleanUpi ? 'Store UPI ID saved successfully. Your QR code will now appear on invoices.' : 'Store UPI ID removed.');
  };

  const saveShopGstNumber = async () => {
    const cleanGst = shopGstNumber.trim().toUpperCase();
    localStorage.setItem(`fixifiy_shop_gst_${currentShop?.id}`, cleanGst);
    try {
      await supabase.from('shops').update({ gst_no: cleanGst }).eq('id', currentShop.id);
    } catch {}
    if (setCurrentShop && currentShop) {
      const updated = { ...currentShop, gst_no: cleanGst };
      setCurrentShop(updated);
      localStorage.setItem('fixifiy_shop', JSON.stringify(updated));
    }
    setIsEditingGst(false);
    alert('Store GSTIN saved successfully. It will now print automatically on all GST invoices.');
  };

  // ==========================================================
  // 🔒 FETCH & VERIFY ADMIN APPROVAL FOR POS SUBSCRIPTION
  // ==========================================================
  const fetchAdminUpiAndPlanStatus = async (showAlert = false) => {
    if (showAlert) setIsCheckingStatus(true);
    try {
      const { data } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
      if (data) {
        const upi = data.delivery_boy_upi || data.upi_id || data.upi || data.company_upi || data.admin_upi;
        if (upi) setAdminUpi(upi);
      }
    } catch {}

    if (currentShop?.id) {
      try {
        const { data: freshShop } = await supabase
          .from('shops')
          .select('*')
          .eq('id', currentShop.id)
          .maybeSingle();

        if (freshShop) {
          const freshProfileUpi = extractProfileShopUpi(freshShop);
          if (freshProfileUpi) {
            setShopUpiId(freshProfileUpi);
            localStorage.setItem(`fixifiy_shop_upi_${currentShop.id}`, freshProfileUpi);
          }
          if (setCurrentShop) {
            setCurrentShop((prev: any) => ({ ...prev, ...freshShop }));
            localStorage.setItem('fixifiy_shop', JSON.stringify({ ...currentShop, ...freshShop }));
          }
        }

        const { data: pmData } = await supabase
          .from('premium_payments')
          .select('*')
          .eq('shop_id', currentShop.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pmData) {
          setPendingPaymentRecord(pmData);
          const st = String(pmData.status || '').toLowerCase();
          if (showAlert) {
            if (st === 'approved' || st === 'active' || st === 'completed' || freshShop?.pos_plan_status === 'active') {
              alert('Payment Approved! Your Counter Billing (POS) system is now active.');
            } else if (st === 'rejected' || st === 'declined') {
              alert('Your UTR number was rejected by Admin. Please submit a valid UTR.');
            } else {
              alert('Your payment is currently pending admin verification. Please check back shortly.');
            }
          }
        }
      } catch {}
    }
    if (showAlert) setIsCheckingStatus(false);
  };

  const fetchAreaDeliveryPartners = async () => {
    try {
      const { data } = await supabase.from('delivery_boys').select('*').order('id', { ascending: false });
      if (data) setDeliveryBoys(data);
    } catch {}
  };

  const checkIsPosActive = () => {
    if (!currentShop) return false;

    const shopStatus = String(currentShop.pos_plan_status || '').toLowerCase();
    if (shopStatus === 'active' || shopStatus === 'approved' || currentShop.is_pos_active === true) {
      if (currentShop.pos_plan_expiry) {
        const exp = new Date(currentShop.pos_plan_expiry);
        return exp.getTime() > Date.now();
      }
      return true;
    }

    if (pendingPaymentRecord) {
      const st = String(pendingPaymentRecord.status || '').toLowerCase();
      if (st === 'approved' || st === 'active' || st === 'completed') {
        const created = new Date(pendingPaymentRecord.created_at);
        const days = Number(pendingPaymentRecord.days || selectedPlan.days || 30);
        const expDate = new Date(created.getTime() + days * 86400000);
        if (expDate.getTime() > Date.now()) return true;
      }
    }

    return false;
  };

  const getPosExpiryDate = () => {
    if (currentShop?.pos_plan_expiry) return new Date(currentShop.pos_plan_expiry);
    if (pendingPaymentRecord) {
      const st = String(pendingPaymentRecord.status || '').toLowerCase();
      if (st === 'approved' || st === 'active' || st === 'completed') {
        const created = new Date(pendingPaymentRecord.created_at);
        const days = Number(pendingPaymentRecord.days || 30);
        return new Date(created.getTime() + days * 86400000);
      }
    }
    return null;
  };

  const handleSubscribePlan = async () => {
    const cleanUtr = utrNumber.trim();
    if (!/^\d{12}$/.test(cleanUtr) && cleanUtr.length < 8) {
      return alert('Please enter a valid 12-digit UTR / Transaction Reference Number.');
    }
    setIsSubmittingPlan(true);
    try {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + selectedPlan.days * 86400000);
      const expiryIso = expiryDate.toISOString();

      const paymentPayload = {
        shop_id: currentShop.id,
        shop_name: currentShop.name,
        plan_name: `Counter POS - ${selectedPlan.name} (${selectedPlan.days} Days)`,
        amount: selectedPlan.price,
        utr_number: cleanUtr,
        status: 'pending',
        created_at: now.toISOString()
      };

      const { data: pm, error: pmErr } = await supabase
        .from('premium_payments')
        .insert(paymentPayload)
        .select()
        .maybeSingle();

      if (!pmErr && pm) {
        setPendingPaymentRecord(pm);
      } else {
        setPendingPaymentRecord({ id: `temp_${Date.now()}`, ...paymentPayload });
      }

      const planMeta = {
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        days: selectedPlan.days,
        amount: selectedPlan.price,
        utr: cleanUtr,
        requested_at: now.toISOString(),
        expected_expiry: expiryIso,
        status: 'pending'
      };

      try {
        await supabase
          .from('shops')
          .update({
            pos_plan_status: 'pending',
            pos_plan_details: planMeta
          })
          .eq('id', currentShop.id);
      } catch {}

      try {
        await supabase.from('user_activities').insert({
          user_id: String(currentShop.id),
          user_name: currentShop.name || 'Shop Owner',
          user_phone: currentShop.phone || '',
          user_role: 'shop_owner',
          action: 'POS_UTR_SUBMITTED_PENDING',
          description: `Submitted UTR for Counter POS Plan: ${selectedPlan.name} (₹${selectedPlan.price}) | UTR: ${cleanUtr} | Waiting for Admin Approval`,
          created_at: now.toISOString()
        });
      } catch {}

      if (setCurrentShop) {
        const updatedShop = { ...currentShop, pos_plan_status: 'pending', pos_plan_details: planMeta };
        setCurrentShop(updatedShop);
        localStorage.setItem('fixifiy_shop', JSON.stringify(updatedShop));
      }

      alert(
        `UTR (${cleanUtr}) submitted successfully for Admin verification.\n\nYour Counter Billing system will activate immediately upon Admin approval.`
      );
      setUtrNumber('');
    } catch (e: any) {
      alert('Error submitting UTR: ' + e.message);
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  // ==========================================
  // 🖼️ UNIVERSAL PRODUCT IMAGE EXTRACTOR
  // ==========================================
  const getProductImageUrl = (p: any): string => {
    if (!p) return '';

    const extractValidString = (val: any): string => {
      if (!val) return '';
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[]') return '';
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed) && parsed.length > 0) return extractValidString(parsed[0]);
          } catch {}
        }
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed);
            return extractValidString(parsed.url || parsed.src || parsed.image || parsed.publicUrl);
          } catch {}
        }
        if (trimmed.includes(',') && (trimmed.startsWith('http') || trimmed.startsWith('/'))) {
          return trimmed.split(',')[0].trim();
        }
        return trimmed;
      }
      if (Array.isArray(val) && val.length > 0) {
        return extractValidString(val[0]);
      }
      if (typeof val === 'object') {
        return extractValidString(val.url || val.src || val.image || val.image_url || val.publicUrl);
      }
      return '';
    };

    const candidateKeys = [
      p.image_url,
      p.image,
      p.img,
      p.photo,
      p.photo_url,
      p.thumbnail,
      p.product_image,
      p.pic,
      p.images,
      p.photos,
      p.media,
      p.icon
    ];

    for (const candidate of candidateKeys) {
      const found = extractValidString(candidate);
      if (found) {
        if (
          !found.startsWith('http://') &&
          !found.startsWith('https://') &&
          !found.startsWith('data:image') &&
          !found.startsWith('blob:') &&
          !found.startsWith('/')
        ) {
          const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (supaUrl) {
            return `${supaUrl}/storage/v1/object/public/products/${found}`;
          }
        }
        return found;
      }
    }
    return '';
  };

  // ==========================================
  // 📦 REAL STOCK ROOM CONNECTION (`total_stock` PRIORITY)
  // ==========================================
  const combinedShopProducts = useMemo(() => {
    const map = new Map<string, any>();
    (products || []).forEach((p: any) => {
      if (String(p.shop_id) === String(currentShop?.id)) {
        map.set(String(p.id), p);
      }
    });
    liveDbProducts.forEach((p: any) => {
      if (String(p.shop_id) === String(currentShop?.id)) {
        map.set(String(p.id), { ...map.get(String(p.id)), ...p });
      }
    });
    return Array.from(map.values());
  }, [products, liveDbProducts, currentShop?.id]);

  const getBaseProductStock = (p: any): number => {
    if (!p) return 0;
    if (localStockOverrides[String(p.id)] !== undefined) {
      return Math.max(0, Number(localStockOverrides[String(p.id)]));
    }
    if (p.total_stock !== undefined && p.total_stock !== null && p.total_stock !== '') {
      return Math.max(0, Number(p.total_stock));
    }
    if (p.stock !== undefined && p.stock !== null && p.stock !== '' && Number(p.stock) !== 999) {
      return Math.max(0, Number(p.stock));
    }
    if (p.quantity !== undefined && p.quantity !== null && p.quantity !== '' && Number(p.quantity) !== 999) {
      return Math.max(0, Number(p.quantity));
    }
    return 0;
  };

  const getRemainingStockAfterCart = (p: any): number => {
    const base = getBaseProductStock(p);
    const inCartItem = cart.find(c => String(c.id) === String(p.id));
    const cartQty = inCartItem ? Number(inCartItem.qty) : 0;
    return Math.max(0, Number((base - cartQty).toFixed(2)));
  };

  const myShopInStockProducts = useMemo(() => {
    return combinedShopProducts.sort((a: any, b: any) => {
      const aStock = getBaseProductStock(a) > 0 ? 1 : 0;
      const bStock = getBaseProductStock(b) > 0 ? 1 : 0;
      return bStock - aStock;
    });
  }, [combinedShopProducts, localStockOverrides]);

  const productCategories = useMemo(() => {
    const cats = new Set<string>(['All']);
    myShopInStockProducts.forEach((p: any) => {
      const c = String(p.category || 'General').trim();
      if (c) cats.add(c);
    });
    return Array.from(cats);
  }, [myShopInStockProducts]);

  const filteredProducts = useMemo(() => {
    return myShopInStockProducts.filter((p: any) => {
      const q = searchQuery.trim().toLowerCase();
      const cat = String(p.category || 'General').trim();
      const matchCat = selectedCategory === 'All' || cat.toLowerCase() === selectedCategory.toLowerCase();
      const matchQuery =
        !q ||
        String(p.name || p.product_name || '').toLowerCase().includes(q) ||
        String(p.description || p.desc || '').toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        String(p.code || p.barcode || p.sku || p.id || '').toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [myShopInStockProducts, searchQuery, selectedCategory]);

  // ==========================================
  // 🛒 CART & INCLUSIVE/EXCLUSIVE GST CALCULATIONS
  // ==========================================
  const addToCart = (product: any) => {
    const baseStock = getBaseProductStock(product);
    if (baseStock <= 0) {
      return alert(`"${product.name || product.product_name}" is currently Out of Stock. Please restock in Inventory first.`);
    }

    const existing = cart.find(item => String(item.id) === String(product.id));
    if (existing && existing.qty + 1 > (existing.maxStock || baseStock)) {
      return alert(`Only ${existing.maxStock || baseStock} ${product.unit || 'Pc'} available in stock.`);
    }

    playBeepSound();
    setCart(prev => {
      const found = prev.find(item => String(item.id) === String(product.id));
      if (found) {
        return prev.map(item =>
          String(item.id) === String(product.id) ? { ...item, qty: Number((item.qty + 1).toFixed(2)) } : item
        );
      }
      const price = Number(product.price || product.selling_price || product.rate || 0);
      return [
        ...prev,
        {
          id: product.id,
          name: product.name || product.product_name || 'Item',
          category: product.category || 'General',
          image: getProductImageUrl(product),
          price: price,
          unit: product.unit || 'Pc',
          qty: 1,
          maxStock: baseStock,
          isCustom: false
        }
      ];
    });
  };

  // ==========================================
  // 📷 PRODUCT QR / BARCODE SCANNER LOGIC
  // ==========================================
  const stopCameraScanner = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach(track => track.stop());
      scannerStreamRef.current = null;
    }
    setIsScannerOpen(false);
  };

  const matchAndAddScannedProduct = (rawText: string) => {
    const cleaned = String(rawText || '').trim();
    if (!cleaned) return false;

    let candidateId = cleaned;
    if (cleaned.startsWith('{')) {
      try {
        const parsed = JSON.parse(cleaned);
        candidateId = String(parsed.id || parsed.code || parsed.barcode || parsed.name || cleaned);
      } catch {}
    } else if (cleaned.toUpperCase().startsWith('PROD:')) {
      candidateId = cleaned.slice(5).trim();
    }

    const qLower = candidateId.toLowerCase();
    const qRawLower = cleaned.toLowerCase();

    let matchedProd = myShopInStockProducts.find((p: any) => {
      return (
        String(p.id).toLowerCase() === qLower ||
        String(p.code || '').toLowerCase() === qLower ||
        String(p.barcode || '').toLowerCase() === qLower ||
        String(p.sku || '').toLowerCase() === qLower ||
        String(p.name || p.product_name || '').trim().toLowerCase() === qLower ||
        String(p.name || p.product_name || '').trim().toLowerCase() === qRawLower
      );
    });

    if (!matchedProd) {
      matchedProd = myShopInStockProducts.find((p: any) => {
        const nameStr = String(p.name || p.product_name || '').toLowerCase();
        const descStr = String(p.description || p.desc || '').toLowerCase();
        return nameStr.includes(qLower) || descStr.includes(qLower) || qRawLower.includes(nameStr);
      });
    }

    if (matchedProd) {
      addToCart(matchedProd);
      setScanStatusMsg(`Added: "${matchedProd.name || matchedProd.product_name}" (₹${matchedProd.price || matchedProd.selling_price})`);
      return true;
    } else {
      setSearchQuery(candidateId);
      setScanStatusMsg(`Searched "${candidateId}" in inventory catalog.`);
      return false;
    }
  };

  const startCameraScanner = async () => {
    setIsScannerOpen(true);
    setScanStatusMsg('Starting camera... Align product QR or Barcode.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      scannerStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if ('BarcodeDetector' in window) {
        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e']
        });

        scanIntervalRef.current = setInterval(async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const codeVal = barcodes[0].rawValue;
                if (codeVal) {
                  const found = matchAndAddScannedProduct(codeVal);
                  if (found) {
                    stopCameraScanner();
                  }
                }
              }
            } catch {}
          }
        }, 450);
      } else {
        setScanStatusMsg('Enter or scan barcode manually below:');
      }
    } catch {
      setScanStatusMsg('Camera permission unavailable. Enter code manually below:');
    }
  };

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (scannerStreamRef.current) {
        scannerStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const printProductQrSticker = (prod: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const pName = prod.name || prod.product_name || 'Product';
    const price = prod.price || prod.selling_price || 0;
    const qrPayload = `PROD:${prod.code || prod.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrPayload)}`;

    if (checkIsMobileDevice()) {
      const a = document.createElement('a');
      a.href = qrUrl;
      a.download = `QR_${pName.replace(/\s+/g, '_')}.png`;
      a.target = '_blank';
      a.click();
      return;
    }

    const win = window.open('', '_blank', 'width=360,height=420');
    if (!win) return;
    win.document.write(`
      <html>
        <head><title>Product QR - ${pName}</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:15px;">
          <div style="border:2px dashed #000;padding:12px;border-radius:10px;display:inline-block;">
            <div style="font-size:12px;font-weight:bold;">${currentShop?.name || 'STORE'}</div>
            <h3 style="margin:6px 0;font-size:16px;">${pName}</h3>
            <img src="${qrUrl}" style="width:140px;height:140px;display:block;margin:6px auto;" onload="setTimeout(()=>window.print(),200)" />
            <div style="font-size:11px;color:#444;">SKU: #${prod.code || prod.id}</div>
            <div style="font-size:18px;font-weight:900;margin-top:4px;">MRP / Rate: ₹${price}</div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim() || !customItemPrice) {
      return alert('Please enter item name and rate.');
    }
    const price = Math.max(0, parseFloat(customItemPrice) || 0);
    const qty = Math.max(0.01, parseFloat(customItemQty) || 1);
    setCart(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: customItemName.trim(),
        category: 'Custom Item',
        image: '',
        price,
        unit: customItemUnit || 'Pc',
        qty,
        maxStock: 10000,
        isCustom: true
      }
    ]);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty('1');
    setShowCustomItemBox(false);
  };

  const updateCartQty = (id: any, newQty: number) => {
    if (isNaN(newQty)) return;
    if (newQty <= 0) {
      setCart(prev => prev.filter(item => item.id !== id));
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.id === id) {
          if (!item.isCustom) {
            const currentMax = item.maxStock || 10000;
            if (newQty > currentMax) {
              alert(`Only ${currentMax} ${item.unit || 'Pc'} available in inventory.`);
              return item;
            }
          }
          return { ...item, qty: Number(newQty.toFixed(3)) };
        }
        return item;
      })
    );
  };

  const updateCartUnit = (id: any, newUnit: string) => {
    setCart(prev => prev.map(item => (item.id === id ? { ...item, unit: newUnit } : item)));
  };

  const updateCartPrice = (id: any, newPrice: number) => {
    setCart(prev => prev.map(item => (item.id === id ? { ...item, price: Math.max(0, newPrice) } : item)));
  };

  // 🔥 PROFESSIONAL GST INCLUSIVE & EXCLUSIVE CALCULATION 🔥
  const subTotal = Number(cart.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2));
  const discountAmt = Math.min(subTotal, Math.max(0, parseFloat(discount) || 0));
  const labourAmt = Math.max(0, parseFloat(labourCharge) || 0);
  const transportAmt = Math.max(0, parseFloat(transportCharge) || 0);

  const netAfterDiscount = Math.max(0, subTotal - discountAmt);
  const activeGstRate = isGstBillEnabled ? gstPercent : 0;

  let taxableAmt = netAfterDiscount;
  let gstAmt = 0;

  if (isGstBillEnabled && activeGstRate > 0) {
    if (gstType === 'inclusive') {
      taxableAmt = Number((netAfterDiscount / (1 + activeGstRate / 100)).toFixed(2));
      gstAmt = Number((netAfterDiscount - taxableAmt).toFixed(2));
    } else {
      taxableAmt = netAfterDiscount;
      gstAmt = Number(((taxableAmt * activeGstRate) / 100).toFixed(2));
    }
  }

  const grandTotal = Math.round(
    (gstType === 'inclusive' ? netAfterDiscount : taxableAmt + gstAmt) + labourAmt + transportAmt
  );

  // ==========================================================
  // 🔥 STRICT SHOP OWNER UPI QR GENERATOR
  // ==========================================================
  const getShopOwnerQrData = (amount: number, billNoStr: string, savedBillUpi?: string) => {
    const rawUpi = String(
      savedBillUpi ||
      shopUpiId.trim() ||
      extractProfileShopUpi(currentShop) ||
      ''
    ).trim();

    if (!rawUpi || !rawUpi.includes('@') || rawUpi.toLowerCase() === 'admin@ybl') {
      return { activeUpi: '', upiUri: '', qrImg: '' };
    }

    const shopTitle = encodeURIComponent(currentShop?.name || 'Store');
    const upiUri = `upi://pay?pa=${rawUpi}&pn=${shopTitle}&am=${amount}&cu=INR&tn=Invoice_${billNoStr}`;
    const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;
    return { activeUpi: rawUpi, upiUri, qrImg };
  };

  const extractBillDetails = (bill: any) => {
    const meta = Array.isArray(bill.messages)
      ? bill.messages.find((m: any) => m?.type === 'counter_bill') || {}
      : {};
    const subTotalVal = Number(bill.subTotal ?? bill.subtotal ?? meta.subtotal ?? bill.total_amount ?? bill.grand_total ?? 0);
    const discountVal = Number(bill.discountAmt ?? bill.discount ?? meta.discount ?? 0);
    const labourVal = Number(bill.labourCharge ?? bill.labour_charge ?? meta.labourCharge ?? 0);
    const transportVal = Number(bill.transportCharge ?? bill.transport_charge ?? meta.transportCharge ?? bill.delivery_charge ?? 0);
    const isGstVal = Boolean(bill.isGstBill ?? bill.is_gst_bill ?? meta.isGstBill ?? (Number(bill.gstAmt ?? bill.gst_amount ?? meta.gstAmt ?? 0) > 0));
    const gstRateVal = Number(bill.gstPercent ?? bill.gst_percent ?? meta.gstPercent ?? (isGstVal ? 18 : 0));
    const gstAmtVal = Number(bill.gstAmt ?? bill.gst_amount ?? meta.gstAmt ?? 0);
    const totalVal = Number(bill.grandTotal ?? bill.grand_total ?? bill.total_amount ?? 0);
    const taxableVal = Number(
      bill.taxableAmt ?? meta.taxableAmt ?? Math.max(0, totalVal - labourVal - transportVal - gstAmtVal)
    );
    const shopGstVal = String(
      bill.shopGstNo || bill.shop_gst_no || meta.shopGstNo || shopGstNumber || currentShop?.gst_no || ''
    ).trim();
    const custGstVal = String(bill.custGstNo || bill.customer_gst_no || meta.custGstNo || '').trim();
    const addrVal = String(bill.custAddress || bill.customer_address || bill.address || meta.custAddress || '').trim();
    const billShopUpiVal = String(bill.shopUpiId || bill.shop_upi_id || meta.shopUpiId || '').trim();

    return {
      subTotalVal,
      discountVal,
      labourVal,
      transportVal,
      isGstVal,
      gstRateVal,
      gstAmtVal,
      taxableVal,
      shopGstVal,
      custGstVal,
      addrVal,
      totalVal,
      billShopUpiVal
    };
  };

  // ==========================================================
  // ✏️ LOAD OLD BILL INTO POS FOR EDITING
  // ==========================================================
  const handleStartEditBill = (bill: any) => {
    const d = extractBillDetails(bill);
    let rawItems = bill.cartItems || bill.items || [];
    if (typeof rawItems === 'string') {
      try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
    }

    const mappedCart = (Array.isArray(rawItems) ? rawItems : []).map((it: any) => {
      const liveProd = combinedShopProducts.find((p: any) => String(p.id) === String(it.id));
      const baseStock = liveProd ? getBaseProductStock(liveProd) : 10000;
      const qtyNum = Number(it.qty ?? it.quantity ?? 1);
      return {
        id: it.id || `custom_${Date.now()}_${Math.random()}`,
        name: it.name || it.product_name || 'Item',
        category: it.category || 'General',
        image: it.image || (liveProd ? getProductImageUrl(liveProd) : ''),
        price: Number(it.price || 0),
        unit: it.unit || 'Pc',
        qty: qtyNum,
        maxStock: baseStock + qtyNum,
        isCustom: !liveProd
      };
    });

    setEditingBill(bill);
    setCart(mappedCart);
    setCustName(bill.customer_name || bill.custName || '');
    setCustPhone(bill.customer_phone || bill.phone || bill.custPhone || '');
    setCustAddress(d.addrVal || '');
    setDiscount(String(d.discountVal || 0));
    setLabourCharge(String(d.labourVal || 0));
    setTransportCharge(String(d.transportVal || 0));
    setIsGstBillEnabled(Boolean(d.isGstVal));
    if (d.gstRateVal) setGstPercent(d.gstRateVal);
    setCustGstNumber(d.custGstVal || '');

    const bucket = getPayBucket(bill);
    setPaymentMethod(bucket === 'upi' ? 'UPI' : bucket === 'khata' ? 'Khata_Due' : 'Cash');

    setPosSubView('pos_screen');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditBill = () => {
    setEditingBill(null);
    setCart([]);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustGstNumber('');
    setDiscount('0');
    setLabourCharge('0');
    setTransportCharge('0');
  };

  // ==========================================================
  // 🧾 SAVE OR UPDATE COUNTER BILL IN `counter_bills` + `orders`
  // ==========================================================
  const handleGenerateCounterBill = async () => {
    if (cart.length === 0) return alert('Please add at least one item to generate an invoice.');
    const finalCustName = custName.trim() || 'Walk-in Customer';
    const finalCustPhone = custPhone.trim() || '';
    const finalCustAddress = custAddress.trim() || 'Counter Pickup';
    const effectiveGstNo =
      shopGstNumber.trim() ||
      currentShop?.gst_no ||
      currentShop?.gstin ||
      (isGstBillEnabled ? '10ABCDE1234F1Z5' : '');

    const verifiedShopUpi = shopUpiId.trim() || extractProfileShopUpi(currentShop) || '';

    setIsGeneratingBill(true);
    try {
      const isEditing = Boolean(editingBill);
      const nowIso = isEditing && editingBill.created_at ? editingBill.created_at : new Date().toISOString();
      const billNo = isEditing
        ? String(editingBill.bill_no || editingBill.billNo || editingBill.order_no)
        : `POS-${Date.now().toString().slice(-6)}`;

      const newOverrides: Record<string, number> = { ...localStockOverrides };

      // 0. IF EDITING OLD BILL, RESTORE PREVIOUS STOCK FIRST
      if (isEditing) {
        let oldItems = editingBill.cartItems || editingBill.items || [];
        if (typeof oldItems === 'string') {
          try { oldItems = JSON.parse(oldItems); } catch { oldItems = []; }
        }
        for (const oldIt of Array.isArray(oldItems) ? oldItems : []) {
          if (oldIt.id && !String(oldIt.id).startsWith('custom_')) {
            const { data: fp } = await supabase
              .from('products')
              .select('id, total_stock, sold_quantity')
              .eq('id', oldIt.id)
              .maybeSingle();
            if (fp) {
              const oldQty = Number(oldIt.qty ?? oldIt.quantity ?? 0);
              await supabase
                .from('products')
                .update({
                  total_stock: Number(fp.total_stock || 0) + oldQty,
                  sold_quantity: Math.max(0, Number(fp.sold_quantity || 0) - oldQty)
                })
                .eq('id', oldIt.id);
            }
          }
        }
      }

      // 1. DEDUCT `total_stock` AND INCREMENT `sold_quantity` IN SUPABASE
      for (const item of cart) {
        if (!item.isCustom) {
          const { data: freshProd } = await supabase
            .from('products')
            .select('id, total_stock, sold_quantity')
            .eq('id', item.id)
            .maybeSingle();

          const fallbackProd = combinedShopProducts.find((p: any) => String(p.id) === String(item.id));
          const currentAvail =
            freshProd && freshProd.total_stock !== undefined && freshProd.total_stock !== null
              ? Number(freshProd.total_stock)
              : getBaseProductStock(fallbackProd);

          const currentSold =
            freshProd && freshProd.sold_quantity !== undefined && freshProd.sold_quantity !== null
              ? Number(freshProd.sold_quantity)
              : Number(fallbackProd?.sold_quantity || 0);

          const soldQtyNow = Number(item.qty);
          const newTotalStock = Math.max(0, Number((currentAvail - soldQtyNow).toFixed(3)));
          const newSoldQuantity = Number((currentSold + soldQtyNow).toFixed(3));

          newOverrides[String(item.id)] = newTotalStock;

          const { error: updateErr } = await supabase
            .from('products')
            .update({
              total_stock: newTotalStock,
              sold_quantity: newSoldQuantity
            })
            .eq('id', item.id);

          if (updateErr) {
            await supabase
              .from('products')
              .update({ total_stock: newTotalStock })
              .eq('id', item.id);
          }
        }
      }

      setLocalStockOverrides(newOverrides);
      setLiveDbProducts(prev =>
        prev.map(p =>
          newOverrides[String(p.id)] !== undefined
            ? {
                ...p,
                total_stock: newOverrides[String(p.id)],
                sold_quantity: Number(p.sold_quantity || 0) + Number(cart.find(c => String(c.id) === String(p.id))?.qty || 0)
              }
            : p
        )
      );

      const structuredItems = cart.map(c => ({
        id: c.id,
        name: c.name,
        product_name: c.name,
        category: c.category || 'General',
        image: c.image || '',
        quantity: c.qty,
        qty: c.qty,
        unit: c.unit,
        price: c.price,
        total: Number((c.price * c.qty).toFixed(2))
      }));

      // 2. SAVE OR UPDATE IN DEDICATED `counter_bills` TABLE
      const counterBillPayload = {
        bill_no: billNo,
        shop_id: String(currentShop.id),
        shop_name: currentShop.name || '',
        customer_name: finalCustName,
        customer_phone: finalCustPhone,
        customer_address: finalCustAddress,
        items: structuredItems,
        subtotal: subTotal,
        discount: discountAmt,
        labour_charge: labourAmt,
        transport_charge: transportAmt,
        is_gst_bill: isGstBillEnabled,
        gst_percent: activeGstRate,
        gst_amount: gstAmt,
        shop_gst_no: effectiveGstNo,
        customer_gst_no: custGstNumber.trim(),
        grand_total: grandTotal,
        payment_method: paymentMethod,
        payment_mode: `Counter POS - ${paymentMethod}`,
        shop_upi_id: verifiedShopUpi,
        status: 'completed',
        created_at: nowIso
      };

      let savedCounterRow: any = null;
      if (isEditing) {
        const { data } = await supabase
          .from('counter_bills')
          .update(counterBillPayload)
          .eq('bill_no', billNo)
          .eq('shop_id', String(currentShop.id))
          .select()
          .maybeSingle();
        savedCounterRow = data;
      } else {
        const { data } = await supabase
          .from('counter_bills')
          .insert(counterBillPayload)
          .select()
          .maybeSingle();
        savedCounterRow = data;
      }

      // 3. ALSO INSERT OR UPDATE `orders` SO SALES LEDGER RECEIVES IT
      const billMetaMsg = {
        sender: 'shop_owner',
        type: 'counter_bill',
        text: `Invoice (${billNo}) | Subtotal: ₹${subTotal} | Discount: ₹${discountAmt} | Labour: ₹${labourAmt} | Transport: ₹${transportAmt} | GST (${gstType}): ₹${gstAmt} | Net: ₹${grandTotal} (${paymentMethod})`,
        subtotal: subTotal,
        discount: discountAmt,
        labourCharge: labourAmt,
        transportCharge: transportAmt,
        isGstBill: isGstBillEnabled,
        gstType,
        gstPercent: activeGstRate,
        gstAmt,
        taxableAmt,
        shopGstNo: effectiveGstNo,
        custGstNo: custGstNumber.trim(),
        custAddress: finalCustAddress,
        paymentMethod,
        shopUpiId: verifiedShopUpi,
        timestamp: nowIso
      };

      const orderPayload: any = {
        order_no: billNo,
        shop_id: currentShop.id,
        shop_name: currentShop.name,
        customer_name: finalCustName,
        phone: finalCustPhone,
        user_phone: finalCustPhone,
        address: finalCustAddress,
        block: currentShop.block || '',
        district: currentShop.district || 'Samastipur',
        pincode: currentShop.pincode || '',
        items: structuredItems,
        product_details: structuredItems,
        total_amount: grandTotal,
        delivery_charge: transportAmt,
        payment_mode: `Counter POS - ${paymentMethod}`,
        status: 'completed',
        type: 'counter_sale',
        delivered_at: nowIso,
        created_at: nowIso,
        messages: [billMetaMsg]
      };

      let savedOrder: any = null;
      if (isEditing) {
        const { data: updatedOrd } = await supabase
          .from('orders')
          .update(orderPayload)
          .eq('order_no', billNo)
          .eq('shop_id', currentShop.id)
          .select()
          .maybeSingle();
        savedOrder = updatedOrd;
      } else {
        const { data: dbOrder, error } = await supabase.from('orders').insert(orderPayload).select().single();
        if (error) {
          const minimalPayload = {
            shop_id: currentShop.id,
            shop_name: currentShop.name,
            customer_name: finalCustName,
            phone: finalCustPhone,
            address: finalCustAddress,
            items: structuredItems,
            total_amount: grandTotal,
            payment_mode: `Counter POS - ${paymentMethod}`,
            status: 'completed',
            created_at: nowIso
          };
          const { data: retryOrder } = await supabase.from('orders').insert(minimalPayload).select().single();
          savedOrder = retryOrder;
        } else {
          savedOrder = dbOrder;
        }
      }

      const completeBillRecord = {
        ...(savedCounterRow || savedOrder || { id: `local_${Date.now()}`, ...orderPayload }),
        order_no: billNo,
        billNo,
        bill_no: billNo,
        subTotal,
        discountAmt,
        labourCharge: labourAmt,
        transportCharge: transportAmt,
        isGstBill: isGstBillEnabled,
        gstType,
        gstPercent: activeGstRate,
        gstAmt,
        taxableAmt,
        shopGstNo: effectiveGstNo,
        custGstNo: custGstNumber.trim(),
        grandTotal,
        total_amount: grandTotal,
        cartItems: structuredItems,
        items: structuredItems,
        paymentMethod,
        payment_mode: `Counter POS - ${paymentMethod}`,
        type: 'counter_sale',
        custName: finalCustName,
        customer_name: finalCustName,
        custPhone: finalCustPhone,
        phone: finalCustPhone,
        custAddress: finalCustAddress,
        address: finalCustAddress,
        shopUpiId: verifiedShopUpi,
        created_at: nowIso
      };

      if (isEditing) {
        setDbCounterBills(prev => prev.map(b => (String(b.bill_no || b.billNo || b.order_no) === billNo ? completeBillRecord : b)));
        if (setOrders) {
          setOrders((prev: any[]) => (prev || []).map(o => (String(o.order_no || o.billNo) === billNo ? completeBillRecord : o)));
        }
        const updatedLocal = localCounterBills.map(b => (String(b.bill_no || b.billNo || b.order_no) === billNo ? completeBillRecord : b));
        setLocalCounterBills(updatedLocal);
        try {
          localStorage.setItem(`fixifiy_counter_bills_${currentShop.id}`, JSON.stringify(updatedLocal.slice(0, 500)));
        } catch {}
      } else {
        setDbCounterBills(prev => [completeBillRecord, ...prev]);
        if (setOrders) {
          setOrders((prev: any[]) => [completeBillRecord, ...(prev || [])]);
        }
        const updatedLocal = [completeBillRecord, ...localCounterBills];
        setLocalCounterBills(updatedLocal);
        try {
          localStorage.setItem(`fixifiy_counter_bills_${currentShop.id}`, JSON.stringify(updatedLocal.slice(0, 500)));
        } catch {}
      }

      await fetchLiveShopStockFromDb();
      await fetchCounterBillsFromDb();
      if (typeof fetchProducts === 'function') fetchProducts(true);
      if (typeof fetchOrders === 'function') fetchOrders(currentShop.id, true);

      setLastGeneratedBill(completeBillRecord);
      setEditingBill(null);

      setCart([]);
      setCustName('');
      setCustPhone('');
      setCustAddress('');
      setCustGstNumber('');
      setDiscount('0');
      setLabourCharge('0');
      setTransportCharge('0');
    } catch (e: any) {
      alert('Error generating invoice: ' + e.message);
    } finally {
      setIsGeneratingBill(false);
    }
  };

  // ==========================================================
  // 🚫 STRICT SEPARATION: COUNTER SALES VS ONLINE ORDERS
  // ==========================================================
  const isOrderCounterSale = (o: any): boolean => {
    return (
      o.type === 'counter_sale' ||
      Boolean(o.bill_no) ||
      String(o.order_no || o.billNo || o.bill_no || '').startsWith('POS-') ||
      String(o.payment_mode || '').toLowerCase().includes('counter pos') ||
      String(o.address || '').toLowerCase().includes('counter') ||
      (Array.isArray(o.messages) && o.messages.some((m: any) => m?.type === 'counter_bill'))
    );
  };

  const getPayBucket = (o: any): 'cash' | 'upi' | 'khata' => {
    const pmRaw = String(o.paymentMethod || o.payment_method || o.payment_mode || '').toLowerCase();
    if (
      pmRaw.includes('upi') ||
      pmRaw.includes('online') ||
      pmRaw.includes('razorpay') ||
      pmRaw.includes('prepaid') ||
      pmRaw.includes('bank') ||
      pmRaw.includes('account')
    ) {
      return 'upi';
    }
    if (pmRaw.includes('khata') || pmRaw.includes('due') || pmRaw.includes('udhar') || pmRaw.includes('credit')) {
      return 'khata';
    }
    return 'cash';
  };

  const allCounterSalesOnly = useMemo(() => {
    const dbOrdersCounter = (orders || []).filter(
      (o: any) => String(o.shop_id) === String(currentShop?.id) && isOrderCounterSale(o)
    );
    const map = new Map<string, any>();

    localCounterBills.forEach(lb => {
      const key = String(lb.bill_no || lb.order_no || lb.billNo || lb.id);
      map.set(key, lb);
    });
    dbOrdersCounter.forEach((dbo: any) => {
      const key = String(dbo.order_no || dbo.id);
      map.set(key, { ...map.get(key), ...dbo });
    });
    dbCounterBills.forEach((cb: any) => {
      const key = String(cb.bill_no || cb.order_no || cb.billNo || cb.id);
      map.set(key, { ...map.get(key), ...cb });
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }, [dbCounterBills, orders, localCounterBills, currentShop?.id]);

  const allOnlineSalesOnly = useMemo(() => {
    return (orders || [])
      .filter((o: any) => {
        const isMyShop = String(o.shop_id) === String(currentShop?.id);
        const st = String(o.status || '').toLowerCase();
        const notCancelled = st !== 'cancelled' && st !== 'rejected';
        return isMyShop && notCancelled && !isOrderCounterSale(o);
      })
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [orders, currentShop?.id]);

  const activeDataset = posSubView === 'online_history' ? allOnlineSalesOnly : allCounterSalesOnly;

  const filteredActiveRecords = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7Days = startOfToday - 6 * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return activeDataset.filter((o: any) => {
      const t = new Date(o.created_at || Date.now()).getTime();
      let passDate = true;
      if (dateRangePreset === 'today') passDate = t >= startOfToday;
      else if (dateRangePreset === '7days') passDate = t >= startOf7Days;
      else if (dateRangePreset === 'month') passDate = t >= startOfMonth;
      else if (dateRangePreset === 'custom') {
        const s = customStartDate ? new Date(customStartDate + 'T00:00:00').getTime() : 0;
        const e = customEndDate ? new Date(customEndDate + 'T23:59:59').getTime() : Infinity;
        passDate = t >= s && t <= e;
      }

      const payBucket = getPayBucket(o);
      const passPay = paymentFilter === 'all' || payBucket === paymentFilter;

      const q = historySearch.trim().toLowerCase();
      const passSearch =
        !q ||
        String(o.customer_name || o.custName || '').toLowerCase().includes(q) ||
        String(o.phone || o.custPhone || o.customer_phone || '').toLowerCase().includes(q) ||
        String(o.bill_no || o.order_no || o.billNo || o.id || '').toLowerCase().includes(q);

      return passDate && passPay && passSearch;
    });
  }, [activeDataset, dateRangePreset, customStartDate, customEndDate, paymentFilter, historySearch]);

  const activeMetrics = useMemo(() => {
    let totalAmt = 0;
    let cashAmt = 0;
    let cashCount = 0;
    let upiAmt = 0;
    let upiCount = 0;
    let khataAmt = 0;
    let khataCount = 0;

    filteredActiveRecords.forEach((o: any) => {
      const amt = Number(o.grand_total || o.total_amount || o.grandTotal || 0);
      const bucket = getPayBucket(o);
      totalAmt += amt;
      if (bucket === 'cash') {
        cashAmt += amt;
        cashCount++;
      } else if (bucket === 'upi') {
        upiAmt += amt;
        upiCount++;
      } else {
        khataAmt += amt;
        khataCount++;
      }
    });

    return {
      totalAmt,
      totalCount: filteredActiveRecords.length,
      cashAmt,
      cashCount,
      upiAmt,
      upiCount,
      khataAmt,
      khataCount
    };
  }, [filteredActiveRecords]);

  const activeProductsSoldList = useMemo(() => {
    const map = new Map<string, { name: string; category: string; unit: string; qty: number; revenue: number }>();
    filteredActiveRecords.forEach((o: any) => {
      let rawItems = o.items || o.cartItems || [];
      if (typeof rawItems === 'string') {
        try {
          rawItems = JSON.parse(rawItems);
        } catch {
          rawItems = [];
        }
      }
      if (!Array.isArray(rawItems)) rawItems = [];
      rawItems.forEach((it: any) => {
        const name = String(it.name || it.product_name || 'Item').trim();
        const key = name.toLowerCase();
        const qty = Number(it.qty ?? it.quantity ?? 1);
        const price = Number(it.price ?? it.selling_price ?? 0);
        const total = Number(it.total ?? qty * price);
        const prev = map.get(key) || {
          name,
          category: String(it.category || 'General'),
          unit: String(it.unit || 'Pc'),
          qty: 0,
          revenue: 0
        };
        prev.qty = Number((prev.qty + qty).toFixed(3));
        prev.revenue = Number((prev.revenue + total).toFixed(2));
        map.set(key, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredActiveRecords]);

  // ==========================================
  // 📄 ZERO-DEPENDENCY CANVAS TO REAL PDF GENERATOR
  // ==========================================
  const createPdfBlobFromCanvas = (canvas: HTMLCanvasElement): Blob => {
    const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
    const base64 = jpegDataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const jpegBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      jpegBytes[i] = binaryStr.charCodeAt(i);
    }

    const imgW = canvas.width;
    const imgH = canvas.height;
    const pdfW = 420;
    const pdfH = Math.round((imgH / imgW) * pdfW);

    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const offsets: number[] = [];
    let currentOffset = 0;

    const pushStr = (s: string) => {
      const b = enc.encode(s);
      chunks.push(b);
      currentOffset += b.length;
    };
    const pushBytes = (b: Uint8Array) => {
      chunks.push(b);
      currentOffset += b.length;
    };

    pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

    // 1: Catalog
    offsets.push(currentOffset);
    pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    // 2: Pages
    offsets.push(currentOffset);
    pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

    // 3: Page
    offsets.push(currentOffset);
    pushStr(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
    );

    // 4: Image XObject
    offsets.push(currentOffset);
    pushStr(
      `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
    );
    pushBytes(jpegBytes);
    pushStr('\nendstream\nendobj\n');

    // 5: Content stream
    const contentStream = `q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im0 Do\nQ\n`;
    offsets.push(currentOffset);
    pushStr(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

    // xref
    const xrefOffset = currentOffset;
    pushStr(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
    for (const off of offsets) {
      pushStr(String(off).padStart(10, '0') + ' 00000 n \n');
    }

    pushStr(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
  };

  // ==========================================
  // 📄 DOWNLOAD BILL AS REAL PDF OR SHARE PDF ON WHATSAPP
  // ==========================================
  const downloadOrShareBillPdf = async (bill: any, shareOnWhatsApp = false) => {
    try {
      let rawItems = bill.cartItems || bill.items || [];
      if (typeof rawItems === 'string') {
        try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
      }
      const d = extractBillDetails(bill);
      const bNo = bill.bill_no || bill.billNo || bill.order_no || bill.id;
      const { activeUpi } = getShopOwnerQrData(d.totalVal, String(bNo), d.billShopUpiVal);

      const scale = 2; // High-res crisp PDF
      const width = 440;
      const rowHeight = 28;
      const height = 380 + rawItems.length * rowHeight + (d.isGstVal ? 85 : 0) + (activeUpi ? 40 : 0);

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return alert('PDF generation not supported on this browser.');

      ctx.scale(scale, scale);

      // White Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Top Header Bar
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(0, 0, width, 8);

      let y = 34;
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.font = 'bold 21px sans-serif';
      ctx.fillText(currentShop?.name || 'STORE INVOICE', width / 2, y);
      y += 20;

      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#334155';
      if (d.shopGstVal) {
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`GSTIN: ${d.shopGstVal}`, width / 2, y);
        y += 16;
        ctx.font = '12px sans-serif';
      }
      ctx.fillText(`${currentShop?.address || ''} ${currentShop?.block || ''}`.trim().slice(0, 52), width / 2, y);
      y += 16;
      ctx.fillText(`Ph: +91 ${currentShop?.phone || ''}`, width / 2, y);
      y += 18;

      // Dashed Divider
      ctx.strokeStyle = '#94a3b8';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(width - 16, y); ctx.stroke();
      ctx.setLineDash([]);
      y += 20;

      // Meta Info
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`Invoice No: #${bNo}`, 18, y);
      ctx.textAlign = 'right';
      ctx.fillText(new Date(bill.created_at || Date.now()).toLocaleDateString('en-IN'), width - 18, y);
      y += 18;

      ctx.textAlign = 'left';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Customer: ${bill.custName || bill.customer_name || 'Walk-in'}`, 18, y);
      ctx.textAlign = 'right';
      ctx.fillText(`Pay: ${bill.paymentMethod || bill.payment_method || 'Cash'}`, width - 18, y);
      y += 22;

      // Table Header
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(16, y - 14, width - 32, 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left'; ctx.fillText('Item', 22, y + 2);
      ctx.textAlign = 'center'; ctx.fillText('Qty / Wt', 255, y + 2);
      ctx.textAlign = 'right'; ctx.fillText('Amount', width - 22, y + 2);
      y += 26;

      // Items List
      ctx.font = '12px sans-serif';
      rawItems.forEach((it: any, idx: number) => {
        const name = `${idx + 1}. ${it.name || it.product_name}`.slice(0, 28);
        const qtyVal = it.qty ?? it.quantity ?? 1;
        const qtyStr = `${qtyVal} ${it.unit || 'Pc'}`;
        const amt = `Rs.${Number((qtyVal * it.price).toFixed(2))}`;
        ctx.textAlign = 'left'; ctx.fillText(name, 22, y);
        ctx.textAlign = 'center'; ctx.fillText(qtyStr, 255, y);
        ctx.textAlign = 'right'; ctx.fillText(amt, width - 22, y);
        y += rowHeight;
      });

      // Divider
      ctx.strokeStyle = '#0f172a';
      ctx.beginPath(); ctx.moveTo(16, y - 8); ctx.lineTo(width - 16, y - 8); ctx.stroke();
      y += 14;

      // Totals
      ctx.textAlign = 'right';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Subtotal: Rs.${d.subTotalVal}`, width - 22, y); y += 18;
      if (d.discountVal > 0) { ctx.fillText(`Discount: -Rs.${d.discountVal}`, width - 22, y); y += 18; }
      if (d.isGstVal) {
        ctx.fillText(`Taxable Value: Rs.${d.taxableVal.toFixed(2)}`, width - 22, y); y += 16;
        ctx.fillText(`CGST (${d.gstRateVal / 2}%): Rs.${(d.gstAmtVal / 2).toFixed(2)}`, width - 22, y); y += 16;
        ctx.fillText(`SGST (${d.gstRateVal / 2}%): Rs.${(d.gstAmtVal / 2).toFixed(2)}`, width - 22, y); y += 18;
      }
      if (d.labourVal > 0) { ctx.fillText(`Labour Charges: +Rs.${d.labourVal}`, width - 22, y); y += 18; }
      if (d.transportVal > 0) { ctx.fillText(`Transport: +Rs.${d.transportVal}`, width - 22, y); y += 18; }

      ctx.font = 'bold 19px sans-serif';
      ctx.fillStyle = '#15803d';
      ctx.fillText(`GRAND TOTAL: Rs.${d.totalVal}`, width - 22, y + 6);
      y += 32;

      if (activeUpi) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1e3a8a';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`Pay via UPI: ${activeUpi}`, width / 2, y);
        y += 22;
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = '11px sans-serif';
      ctx.fillText('Thank you for shopping with us!', width / 2, y + 10);

      // Generate Real PDF Blob
      const pdfBlob = createPdfBlobFromCanvas(canvas);
      const fileName = `Bill_${bNo}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // Share PDF directly on Mobile (WhatsApp / Share Sheet)
      if (shareOnWhatsApp) {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              title: `Invoice #${bNo}`,
              text: `${currentShop?.name || 'Store'} - Invoice #${bNo} (₹${d.totalVal})`,
              files: [pdfFile]
            });
            return;
          } catch {}
        }
        // Fallback: Download PDF + open WhatsApp text bill
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        sendBillOnWhatsApp(bill);
        return;
      }

      // Direct PDF Download
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err: any) {
      alert('PDF Error: ' + err.message);
    }
  };

  // ==========================================
  // 📲 WHATSAPP TEXT BILL & 🖨️ PRINT
  // ==========================================
  const sendBillOnWhatsApp = (bill: any) => {
    let rawItems = bill.cartItems || bill.items || [];
    if (typeof rawItems === 'string') {
      try {
        rawItems = JSON.parse(rawItems);
      } catch {
        rawItems = [];
      }
    }
    const itemsListText = rawItems
      .map(
        (it: any, idx: number) =>
          `${idx + 1}. *${it.name || it.product_name}* (${it.qty || it.quantity} ${it.unit || 'Pc'}) x ₹${it.price} = *₹${Number(((it.qty || it.quantity) * it.price).toFixed(2))}*`
      )
      .join('%0A');

    const d = extractBillDetails(bill);
    const bNo = bill.bill_no || bill.billNo || bill.order_no || bill.id;
    const { activeUpi, upiUri } = getShopOwnerQrData(d.totalVal, String(bNo), d.billShopUpiVal);

    const msg =
      `🏪 *${currentShop?.name || 'TAX INVOICE'}*%0A` +
      (d.shopGstVal ? `🏛️ *GSTIN:* ${d.shopGstVal}%0A` : '') +
      `📍 ${currentShop?.address || ''}, ${currentShop?.block || ''}%0A` +
      `📞 Contact: ${currentShop?.phone || ''}%0A` +
      `--------------------------------%0A` +
      `*Invoice No:* #${bNo}%0A` +
      `*Date:* ${new Date(bill.created_at || Date.now()).toLocaleString('en-IN')}%0A` +
      `*Customer:* ${bill.custName || bill.customer_name}%0A` +
      (d.addrVal ? `*Address:* ${d.addrVal}%0A` : '') +
      (d.custGstVal ? `*Buyer GSTIN:* ${d.custGstVal}%0A` : '') +
      `--------------------------------%0A` +
      `*Item Details:*%0A${itemsListText}%0A` +
      `--------------------------------%0A` +
      `*Subtotal:* ₹${d.subTotalVal}%0A` +
      (d.discountVal > 0 ? `*Discount:* -₹${d.discountVal}%0A` : '') +
      (d.isGstVal && d.gstAmtVal > 0
        ? `*Taxable Value:* ₹${d.taxableVal.toFixed(2)}%0A*CGST (${d.gstRateVal / 2}%):* ₹${(d.gstAmtVal / 2).toFixed(2)}%0A*SGST (${d.gstRateVal / 2}%):* ₹${(d.gstAmtVal / 2).toFixed(2)}%0A`
        : '') +
      (d.labourVal > 0 ? `*Labour Charges:* +₹${d.labourVal}%0A` : '') +
      (d.transportVal > 0 ? `*Transport / Freight:* +₹${d.transportVal}%0A` : '') +
      `💰 *Grand Total: ₹${d.totalVal}*%0A` +
      `💳 *Payment Mode:* ${bill.paymentMethod || bill.payment_method || bill.payment_mode}%0A` +
      (activeUpi
        ? `🏦 *Store UPI:* ${activeUpi}%0A📲 *Pay via UPI:* ${encodeURIComponent(upiUri)}%0A`
        : '') +
      `--------------------------------%0A` +
      `Thank you for your business!`;

    const cleanPhone = String(bill.custPhone || bill.customer_phone || bill.phone || '').replace(/\D/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;

    if (checkIsMobileDevice()) {
      window.location.href = waUrl;
    } else {
      window.open(waUrl, '_blank');
    }
  };

  const printInvoiceWithQr = (bill: any, format: 'thermal' | 'a4' = 'thermal') => {
    // 📱 Mobile par window.open crash karta hai -> Mobile PDF Preview Modal kholein
    if (checkIsMobileDevice()) {
      setMobilePreviewBill(bill);
      return;
    }

    const printWin = window.open('', '_blank', format === 'thermal' ? 'width=420,height=780' : 'width=860,height=920');
    if (!printWin) {
      setMobilePreviewBill(bill);
      return;
    }

    let rawItems = bill.cartItems || bill.items || [];
    if (typeof rawItems === 'string') {
      try {
        rawItems = JSON.parse(rawItems);
      } catch {
        rawItems = [];
      }
    }

    const d = extractBillDetails(bill);
    const bNo = bill.bill_no || bill.billNo || bill.order_no || bill.id;
    const { activeUpi, qrImg } = getShopOwnerQrData(d.totalVal, String(bNo), d.billShopUpiVal);

    const itemsHtml = rawItems
      .map(
        (it: any, i: number) => `
        <tr>
          <td style="padding:5px 4px;border-bottom:1px dashed #ccc;">${i + 1}. ${it.name || it.product_name}</td>
          <td style="padding:5px 4px;border-bottom:1px dashed #ccc;text-align:center;">${it.qty || it.quantity} ${it.unit || 'Pc'}</td>
          <td style="padding:5px 4px;border-bottom:1px dashed #ccc;text-align:right;">₹${it.price}</td>
          <td style="padding:5px 4px;border-bottom:1px dashed #ccc;text-align:right;font-weight:bold;">₹${Number(((it.qty || it.quantity) * it.price).toFixed(2))}</td>
        </tr>
      `
      )
      .join('');

    const maxWidthCss = format === 'thermal' ? '345px' : '780px';
    const halfGstRate = (d.gstRateVal / 2).toFixed(1);
    const halfGstAmt = (d.gstAmtVal / 2).toFixed(2);

    printWin.document.write(`
      <html>
        <head>
          <title>${d.isGstVal ? 'Tax Invoice' : 'Invoice'} #${bNo}</title>
          <style>
            body { font-family: 'Segoe UI', monospace, sans-serif; padding: 15px; max-width: ${maxWidthCss}; margin: 0 auto; color: #000; }
            h2, h3, h4, p { margin: 3px 0; }
            .center { text-align: center; }
            .badge { display:inline-block; padding:3px 10px; border:1.5px solid #000; border-radius:4px; font-size:11.5px; font-weight:900; margin:5px 0; background:#f1f5f9; }
            table { width: 100%; border-collapse: collapse; font-size: ${format === 'thermal' ? '12px' : '13.5px'}; margin-top: 8px; }
            th { border-bottom: 2px solid #000; border-top: 1px solid #000; padding: 6px 4px; background:#f8fafc; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .gst-summary-box { border: 1px solid #000; padding: 6px; margin: 6px 0; font-size: 11px; background: #fafafa; }
            .qr-box { text-align: center; margin-top: 10px; padding: 8px; border: 1px solid #000; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="center">
            ${d.isGstVal ? `<span class="badge">TAX INVOICE (GST)</span>` : `<span class="badge">CASH MEMO / BILL</span>`}
            <h2 style="font-size:${format === 'thermal' ? '19px' : '25px'};margin-top:4px;">${currentShop?.name || 'STORE INVOICE'}</h2>
            ${d.shopGstVal ? `<p style="font-size:12px;font-weight:900;">GSTIN: ${d.shopGstVal}</p>` : ''}
            <p style="font-size:11.5px;">${currentShop?.address || ''}, ${currentShop?.block || ''} ${currentShop?.pincode ? '- ' + currentShop.pincode : ''}</p>
            <p style="font-size:11.5px;"><strong>Phone:</strong> +91 ${currentShop?.phone || ''}</p>
          </div>
          <div class="divider"></div>
          <div style="display:flex;justify-content:space-between;font-size:11.5px;flex-wrap:wrap;gap:6px;">
            <div style="max-width:60%;">
              <p><strong>Invoice No:</strong> #${bNo}</p>
              <p><strong>Customer:</strong> ${bill.custName || bill.customer_name}</p>
              ${bill.custPhone || bill.customer_phone || bill.phone ? `<p><strong>Mobile:</strong> ${bill.custPhone || bill.customer_phone || bill.phone}</p>` : ''}
              ${d.addrVal ? `<p><strong>Address:</strong> ${d.addrVal}</p>` : ''}
              ${d.custGstVal ? `<p><strong>Buyer GSTIN:</strong> ${d.custGstVal}</p>` : ''}
            </div>
            <div style="text-align:right;">
              <p><strong>Date:</strong> ${new Date(bill.created_at || Date.now()).toLocaleDateString('en-IN')}</p>
              <p><strong>Time:</strong> ${new Date(bill.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
              <p><strong>Payment:</strong> ${bill.paymentMethod || bill.payment_method || bill.payment_mode}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="text-align:left;">Description</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Rate</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="divider"></div>
          <div style="font-size:12px;text-align:right;line-height:1.6;">
            <div>Items Subtotal: <strong>₹${d.subTotalVal}</strong></div>
            ${d.discountVal > 0 ? `<div>Discount: <strong>-₹${d.discountVal}</strong></div>` : ''}
            ${
              d.isGstVal
                ? `
              <div class="gst-summary-box" style="text-align:right;">
                <div>Taxable Value: ₹${d.taxableVal.toFixed(2)}</div>
                <div>CGST (@${halfGstRate}%): ₹${halfGstAmt}</div>
                <div>SGST (@${halfGstRate}%): ₹${halfGstAmt}</div>
                <div><strong>Total GST (${d.gstRateVal}%): ₹${d.gstAmtVal.toFixed(2)}</strong></div>
              </div>
            `
                : ''
            }
            ${d.labourVal > 0 ? `<div>Labour Charges: <strong>+₹${d.labourVal}</strong></div>` : ''}
            ${d.transportVal > 0 ? `<div>Transport / Freight: <strong>+₹${d.transportVal}</strong></div>` : ''}
          </div>
          <div class="divider"></div>
          <h3 style="text-align:right;font-size:${format === 'thermal' ? '17px' : '21px'};margin:6px 0;">GRAND TOTAL: ₹${d.totalVal}</h3>
          <div class="divider"></div>
          ${
            activeUpi && qrImg
              ? `
            <div class="qr-box">
              <p style="font-size:11px;font-weight:bold;margin-bottom:4px;">Scan QR to Pay ₹${d.totalVal} to ${currentShop?.name || 'Store'}</p>
              <img id="shopQrImg" src="${qrImg}" alt="Payment QR" style="width:130px;height:130px;display:block;margin:4px auto;" />
              <p style="font-size:10.5px;"><strong>UPI ID:</strong> ${activeUpi}</p>
            </div>
          `
              : ''
          }
          <p class="center" style="font-size:11px;margin-top:10px;">Thank you for shopping with us!</p>
          <script>
            const img = document.getElementById('shopQrImg');
            if (img) {
              img.onload = function() { setTimeout(function(){ window.print(); }, 200); };
              img.onerror = function() { window.print(); };
            } else {
              window.onload = function() { setTimeout(function(){ window.print(); }, 150); };
            }
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // ==========================================
  // 📥 SEPARATE EXCEL & PDF EXPORT FOR ACTIVE TAB
  // ==========================================
  const exportActiveTabToExcel = () => {
    if (filteredActiveRecords.length === 0) return alert('No records available to export.');
    const reportTypeTitle = posSubView === 'online_history' ? 'ONLINE_ORDERS_REPORT' : 'COUNTER_POS_SALES_REPORT';

    const csvRows: string[] = [];
    csvRows.push(`"${currentShop?.name || 'Store'} - ${reportTypeTitle}"`);
    csvRows.push(`"Generated On","${new Date().toLocaleString('en-IN')}","Filter","${dateRangePreset.toUpperCase()}"`);
    csvRows.push(
      `"Total Revenue","Rs ${activeMetrics.totalAmt}","Cash","Rs ${activeMetrics.cashAmt}","UPI / Bank","Rs ${activeMetrics.upiAmt}","Credit / Khata","Rs ${activeMetrics.khataAmt}"`
    );
    csvRows.push('');
    csvRows.push('"Invoice No","Date & Time","Customer Name","Phone","Address","Payment Mode","Payment Bucket","Labour","Transport","GST Amt","Items","Total Amount (Rs)"');

    filteredActiveRecords.forEach((o: any) => {
      const bucket = getPayBucket(o);
      const d = extractBillDetails(o);
      let rawItems = o.items || o.cartItems || [];
      if (typeof rawItems === 'string') {
        try {
          rawItems = JSON.parse(rawItems);
        } catch {
          rawItems = [];
        }
      }
      const itemSummary = Array.isArray(rawItems)
        ? rawItems.map((i: any) => `${i.name || i.product_name} (${i.qty || i.quantity} ${i.unit || ''})`).join(' | ')
        : '';

      csvRows.push(
        [
          `"${o.bill_no || o.order_no || o.billNo || o.id}"`,
          `"${new Date(o.created_at || Date.now()).toLocaleString('en-IN')}"`,
          `"${o.customer_name || o.custName || 'Walk-in'}"`,
          `"${o.customer_phone || o.phone || o.custPhone || ''}"`,
          `"${d.addrVal.replace(/"/g, '""')}"`,
          `"${o.paymentMethod || o.payment_method || o.payment_mode || 'Cash'}"`,
          `"${bucket === 'upi' ? 'Bank / UPI' : bucket === 'cash' ? 'Cash' : 'Credit / Khata'}"`,
          `"${d.labourVal}"`,
          `"${d.transportVal}"`,
          `"${d.gstAmtVal}"`,
          `"${itemSummary.replace(/"/g, '""')}"`,
          `"${d.totalVal}"`
        ].join(',')
      );
    });

    csvRows.push('');
    csvRows.push('"--- PRODUCT-WISE SUMMARY ---"');
    csvRows.push('"Product Name","Category","Sold Qty","Total Revenue (Rs)"');
    activeProductsSoldList.forEach(p => {
      csvRows.push([`"${p.name.replace(/"/g, '""')}"`, `"${p.category}"`, `"${p.qty} ${p.unit}"`, `"${p.revenue}"`].join(','));
    });

    const csvString = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTypeTitle}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportActiveTabToPdf = () => {
    if (checkIsMobileDevice()) {
      exportActiveTabToExcel();
      return;
    }
    const pdfWin = window.open('', '_blank', 'width=960,height=850');
    if (!pdfWin) return exportActiveTabToExcel();
    const isOnline = posSubView === 'online_history';

    const rowsHtml = filteredActiveRecords
      .map((o: any, i: number) => {
        const bucket = getPayBucket(o);
        const d = extractBillDetails(o);
        let rawItems = o.items || o.cartItems || [];
        if (typeof rawItems === 'string') {
          try {
            rawItems = JSON.parse(rawItems);
          } catch {
            rawItems = [];
          }
        }
        const itemsText = Array.isArray(rawItems)
          ? rawItems.map((it: any) => `${it.name || it.product_name} (${it.qty || it.quantity} ${it.unit || ''})`).join(', ')
          : '';
        return `
          <tr>
            <td>${i + 1}</td>
            <td>#${o.bill_no || o.order_no || o.billNo || o.id}</td>
            <td>${new Date(o.created_at || Date.now()).toLocaleString('en-IN')}</td>
            <td>${o.customer_name || o.custName || 'Walk-in'}<br/><small>${o.customer_phone || o.phone || ''} ${d.addrVal ? `| ${d.addrVal}` : ''}</small></td>
            <td>${itemsText}</td>
            <td>${bucket === 'upi' ? 'Bank / UPI' : bucket === 'cash' ? 'Cash' : 'Credit / Khata'}</td>
            <td style="text-align:right;font-weight:bold;">₹${d.totalVal}</td>
          </tr>
        `;
      })
      .join('');

    pdfWin.document.write(`
      <html>
        <head>
          <title>${isOnline ? 'Online Orders Report' : 'Counter Sales Report'}</title>
          <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #111; }
            .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
            .card { border: 1px solid #333; padding: 10px; border-radius: 8px; background: #f8fafc; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #e2e8f0; }
          </style>
        </head>
        <body>
          <h2>${currentShop?.name || 'STORE'} ${shopGstNumber ? `(GSTIN: ${shopGstNumber})` : ''} — ${isOnline ? 'Online Orders Report' : 'Counter POS Sales Report'}</h2>
          <p>Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${activeMetrics.totalCount}</p>
          <div class="grid">
            <div class="card"><strong>Total Sales</strong><h3>₹${activeMetrics.totalAmt}</h3></div>
            <div class="card"><strong>Cash</strong><h3>₹${activeMetrics.cashAmt} (${activeMetrics.cashCount})</h3></div>
            <div class="card"><strong>Bank / UPI</strong><h3>₹${activeMetrics.upiAmt} (${activeMetrics.upiCount})</h3></div>
            <div class="card"><strong>Credit / Khata</strong><h3>₹${activeMetrics.khataAmt} (${activeMetrics.khataCount})</h3></div>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Invoice No</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th style="text-align:right;">Total</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    pdfWin.document.close();
  };

  // ==========================================================
  // 🛵 MODE 2: DELIVERY PARTNERS FILTER BY BLOCK & PINCODE
  // ==========================================================
  if (mode === 'delivery_partners') {
    const parseBoyLocations = (boy: any) => {
      let workLocs: any[] = [];
      if (Array.isArray(boy.work_locations)) workLocs = boy.work_locations;
      else if (typeof boy.work_locations === 'string') {
        try {
          workLocs = JSON.parse(boy.work_locations);
        } catch {}
      }
      const allBlocks = Array.from(
        new Set([boy.block, boy.service_blocks, ...workLocs.map((l: any) => l.block)].filter(Boolean))
      ).join(', ');
      const allPincodes = Array.from(
        new Set([boy.pincode, boy.service_pincodes, ...workLocs.map((l: any) => l.pincode)].filter(Boolean))
      ).join(', ');
      return { workLocs, allBlocks, allPincodes };
    };

    const filteredBoys = deliveryBoys.filter(boy => {
      const { allBlocks, allPincodes } = parseBoyLocations(boy);
      const bQuery = filterBlock.trim().toLowerCase();
      const pQuery = filterPincode.trim().toLowerCase();
      const matchBlock = !bQuery || allBlocks.toLowerCase().includes(bQuery) || String(boy.district || '').toLowerCase().includes(bQuery);
      const matchPin = !pQuery || allPincodes.toLowerCase().includes(pQuery);
      return matchBlock && matchPin;
    });

    const assignOrderToBoy = async (boy: any) => {
      if (!selectedOrderForAssign) return alert('Please select a pending online order first.');
      try {
        const { error } = await supabase
          .from('orders')
          .update({
            delivery_boy_id: String(boy.id),
            delivery_boy_name: boy.name,
            delivery_boy_phone: boy.phone,
            status: 'Assigned to Delivery Partner'
          })
          .eq('id', selectedOrderForAssign);
        if (error) throw new Error(error.message);
        alert(`Order #${selectedOrderForAssign} assigned to ${boy.name}.`);
        fetchOrders(currentShop?.id, true);
      } catch (e: any) {
        alert('Error: ' + e.message);
      }
    };

    const pendingShopOrders = allOnlineSalesOnly.filter((o: any) => {
      const st = String(o.status || '').toLowerCase();
      return !['completed', 'delivered', 'cancelled'].includes(st);
    });

    return (
      <div style={{ color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, color: '#38bdf8', fontSize: '20px' }}>🛵 Area Delivery Partners</h2>
          <button onClick={fetchAreaDeliveryPartners} style={{ background: '#0284c7', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            🔄 Refresh List
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', background: '#0f172a', padding: '14px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="Filter by Block..."
            value={filterBlock}
            onChange={e => setFilterBlock(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', boxSizing: 'border-box' }}
          />
          <input
            type="text"
            placeholder="Filter by Pincode..."
            value={filterPincode}
            onChange={e => setFilterPincode(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', boxSizing: 'border-box' }}
          />
          <select
            value={selectedOrderForAssign}
            onChange={e => setSelectedOrderForAssign(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #f59e0b', background: '#1e293b', color: 'white', boxSizing: 'border-box' }}
          >
            <option value="">-- Select Pending Online Order --</option>
            {pendingShopOrders.map((o: any) => (
              <option key={o.id} value={o.id}>
                Order #{o.order_no || o.id} - {o.customer_name} (PIN: {o.pincode || 'N/A'})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {filteredBoys.map((boy: any) => {
            const { allBlocks, allPincodes } = parseBoyLocations(boy);
            return (
              <div key={boy.id} style={{ background: '#0f172a', border: '1px solid #334155', borderLeft: '5px solid #22c55e', borderRadius: '12px', padding: '15px' }}>
                <div style={{ fontSize: '16px', fontWeight: '900', color: 'white' }}>🛵 {boy.name}</div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', margin: '8px 0' }}>
                  <div><strong>Block:</strong> {allBlocks || boy.district}</div>
                  <div><strong>Pincode:</strong> <span style={{ color: '#4ade80' }}>{allPincodes || 'All'}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { window.location.href = `tel:${boy.phone}`; }} style={{ flex: 1, padding: '10px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                    📞 Call Partner
                  </button>
                  {selectedOrderForAssign && (
                    <button onClick={() => assignOrderToBoy(boy)} style={{ flex: 1.3, padding: '10px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}>
                      ✅ Assign Order
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================================
  // 🔒 STRICT SUBSCRIPTION LOCK SCREEN
  // ==========================================================
  const isPosActive = checkIsPosActive();
  const posExpiry = getPosExpiryDate();
  const isPendingAdminApproval =
    !isPosActive &&
    ((pendingPaymentRecord && String(pendingPaymentRecord.status || '').toLowerCase() === 'pending') ||
      String(currentShop?.pos_plan_status || '').toLowerCase() === 'pending');

  if (!isPosActive) {
    const upiLink = `upi://pay?pa=${adminUpi}&pn=Fixifiy%20Enterprise%20POS&am=${selectedPlan.price}&cu=INR&tn=POS_Plan_${currentShop?.id || ''}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiLink)}`;

    return (
      <div style={{ color: 'white', maxWidth: '880px', margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #0f172a 100%)', padding: '22px', borderRadius: '16px', border: '2px solid #38bdf8', marginBottom: '18px', textAlign: 'center' }}>
          <h2 style={{ margin: '6px 0', fontSize: '22px', color: '#fff' }}>🧾 Activate Enterprise Counter Billing (POS)</h2>
          <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0 }}>
            Full-Screen POS, Barcode/QR Scanner, Real-Time Inventory Deduction, GST Inclusive/Exclusive Invoicing & GSTR-1 Export.
          </p>
        </div>

        {isPendingAdminApproval && (
          <div style={{ background: 'linear-gradient(135deg, #78350f, #0f172a)', border: '2px solid #f59e0b', borderRadius: '16px', padding: '18px', marginBottom: '20px', textAlign: 'center' }}>
            <span style={{ background: '#fbbf24', color: '#0f172a', padding: '4px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '900' }}>
              ⏳ ADMIN VERIFICATION PENDING
            </span>
            <h3 style={{ margin: '10px 0 6px 0', color: '#fff', fontSize: '19px' }}>
              Payment UTR Submitted for Verification
            </h3>
            <p style={{ color: '#fde68a', fontSize: '13px', maxWidth: '620px', margin: '0 auto 12px auto', lineHeight: '1.5' }}>
              UTR Number: <strong>{pendingPaymentRecord?.utr_number || currentShop?.pos_plan_details?.utr || 'Submitted'}</strong> | Amount: <strong>₹{pendingPaymentRecord?.amount || selectedPlan.price}</strong>
              <br />
              Your Counter Billing system will unlock automatically once Admin approves your payment.
            </p>
            <button
              disabled={isCheckingStatus}
              onClick={() => fetchAdminUpiAndPlanStatus(true)}
              style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '900', fontSize: '13.5px', cursor: 'pointer' }}
            >
              {isCheckingStatus ? 'Checking...' : '🔄 Refresh Approval Status'}
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {posPlans.map(plan => {
            const isSelected = selectedPlan.id === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                style={{
                  background: isSelected ? 'linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)' : '#0f172a',
                  border: isSelected ? '2px solid #fbbf24' : '1px solid #334155',
                  borderRadius: '14px',
                  padding: '16px',
                  cursor: 'pointer'
                }}
              >
                <span style={{ background: '#fbbf24', color: '#0f172a', padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '900' }}>{plan.badge}</span>
                <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '10px' }}>{plan.name}</div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#4ade80', margin: '6px 0' }}>₹{plan.price}</div>
                <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Validity: {plan.days} Days</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '16px', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', background: '#1e293b', padding: '15px', borderRadius: '12px' }}>
            <img src={qrUrl} alt="Company UPI QR" style={{ width: '170px', height: '170px', borderRadius: '10px', border: '4px solid white', margin: '0 auto 8px auto', display: 'block' }} />
            <div style={{ fontSize: '12px', color: '#cbd5e1' }}>Official UPI: <strong style={{ color: '#fff' }}>{adminUpi}</strong></div>
          </div>
          <div>
            <h3 style={{ margin: '0 0 8px 0', color: '#fbbf24' }}>Submit 12-Digit UTR Number</h3>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: 0 }}>
              Complete the UPI payment and enter your 12-digit UTR / Reference Number below for verification.
            </p>
            <input
              type="text"
              placeholder="Enter 12-Digit UTR Number..."
              value={utrNumber}
              onChange={e => setUtrNumber(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #38bdf8', background: '#1e293b', color: 'white', fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', boxSizing: 'border-box' }}
            />
            <button
              disabled={isSubmittingPlan}
              onClick={handleSubscribePlan}
              style={{ width: '100%', padding: '14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '15px', cursor: 'pointer' }}
            >
              {isSubmittingPlan ? 'Submitting...' : `Submit ₹${selectedPlan.price} UTR for Approval`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // 🎨 MAIN ENTERPRISE POS UI (WITH DEDICATED FULL-SCREEN MODE)
  // ==========================================================
  const liveBillQr = getShopOwnerQrData(grandTotal, 'LIVE');
  const displayShopGst = shopGstNumber.trim() || currentShop?.gst_no || currentShop?.gstin || '';

  const categoryColorPalette = [
    'linear-gradient(135deg, #2563eb, #1d4ed8)',
    'linear-gradient(135deg, #9333ea, #7e22ce)',
    'linear-gradient(135deg, #059669, #047857)',
    'linear-gradient(135deg, #ea580c, #c2410c)',
    'linear-gradient(135deg, #db2777, #be185d)',
    'linear-gradient(135deg, #0891b2, #0e7490)'
  ];

  const containerStyle: React.CSSProperties = isFullScreenPos
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9990,
        background: '#020617',
        color: 'white',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '12px',
        boxSizing: 'border-box'
      }
    : {
        color: 'white',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      };

  return (
    <div style={containerStyle}>
      <style>{`
        .pos-flex-split-container {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 14px;
          width: 100%;
          box-sizing: border-box;
        }
        .pos-half-pane {
          flex: 1 1 50%;
          width: 50%;
          min-width: 0;
          box-sizing: border-box;
        }
        .pos-compact-product-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: ${isFullScreenPos ? 'calc(100vh - 230px)' : '600px'};
          overflow-y: auto;
          padding-right: 4px;
        }
        .pos-compact-product-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }
        .pos-compact-product-row:hover {
          transform: translateX(3px);
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.2);
        }
        .pos-live-receipt-box {
          background: #ffffff;
          color: #0f172a;
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
          border-top: 6px solid #4f46e5;
          box-sizing: border-box;
          width: 100%;
        }
        .pos-mobile-sticky-bar {
          display: none;
        }
        @media (max-width: 900px) {
          .pos-flex-split-container {
            flex-direction: column;
            padding-bottom: 68px;
          }
          .pos-half-pane {
            flex: 1 1 100%;
            width: 100%;
          }
          .pos-compact-product-list {
            max-height: 410px;
          }
          .pos-mobile-sticky-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(90deg, #1e1b4b, #312e81);
            border-top: 2px solid #38bdf8;
            padding: 10px 14px;
            z-index: 9995;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 -4px 16px rgba(0,0,0,0.6);
          }
        }
      `}</style>

      {/* ========================================================== */}
      {/* 📱 MOBILE-SPECIAL PDF BILL PREVIEW & SHARE MODAL (NO CRASH) */}
      {/* ========================================================== */}
      {mobilePreviewBill && (() => {
        const d = extractBillDetails(mobilePreviewBill);
        const bNo = mobilePreviewBill.bill_no || mobilePreviewBill.billNo || mobilePreviewBill.order_no || mobilePreviewBill.id;
        let rawItems = mobilePreviewBill.cartItems || mobilePreviewBill.items || [];
        if (typeof rawItems === 'string') {
          try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
        }
        const qrInfo = getShopOwnerQrData(d.totalVal, String(bNo), d.billShopUpiVal);

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(2, 6, 23, 0.92)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              overflowY: 'auto'
            }}
          >
            <div style={{ background: '#ffffff', color: '#0f172a', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '16px', boxSizing: 'border-box', maxHeight: '92vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed #cbd5e1', paddingBottom: '8px', marginBottom: '10px' }}>
                <span style={{ background: '#4f46e5', color: 'white', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900' }}>
                  📄 PDF BILL #{bNo}
                </span>
                <button
                  onClick={() => setMobilePreviewBill(null)}
                  style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 10px', fontWeight: '900', cursor: 'pointer' }}
                >
                  ✖ Close
                </button>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>{currentShop?.name || 'STORE'}</h3>
                {d.shopGstVal && <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#059669' }}>GSTIN: {d.shopGstVal}</div>}
                <div style={{ fontSize: '11px', color: '#475569' }}>{currentShop?.address || ''} {currentShop?.block || ''}</div>
                <div style={{ fontSize: '11px', color: '#475569' }}>Ph: {currentShop?.phone || ''}</div>
              </div>

              <div style={{ fontSize: '12px', background: '#f8fafc', padding: '8px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #e2e8f0' }}>
                <div><strong>Customer:</strong> {mobilePreviewBill.custName || mobilePreviewBill.customer_name || 'Walk-in'}</div>
                {(mobilePreviewBill.custPhone || mobilePreviewBill.phone) && <div><strong>Phone:</strong> {mobilePreviewBill.custPhone || mobilePreviewBill.phone}</div>}
                <div><strong>Date:</strong> {new Date(mobilePreviewBill.created_at || Date.now()).toLocaleString('en-IN')}</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '10px' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0' }}>
                    <th style={{ padding: '6px', textAlign: 'left' }}>Item</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Qty / Wt</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(rawItems) ? rawItems : []).map((it: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px dashed #cbd5e1' }}>
                      <td style={{ padding: '6px' }}>{idx + 1}. {it.name || it.product_name}</td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>{it.qty || it.quantity} {it.unit || 'Pc'}</td>
                      <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(((it.qty || it.quantity) * it.price).toFixed(2))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ textAlign: 'right', fontSize: '12px', borderTop: '1px solid #cbd5e1', paddingTop: '8px', marginBottom: '12px' }}>
                <div>Subtotal: <strong>₹{d.subTotalVal}</strong></div>
                {d.discountVal > 0 && <div>Discount: <strong>-₹{d.discountVal}</strong></div>}
                {d.isGstVal && <div>GST ({d.gstRateVal}%): <strong>₹{d.gstAmtVal.toFixed(2)}</strong></div>}
                {d.labourVal > 0 && <div>Labour: <strong>+₹{d.labourVal}</strong></div>}
                {d.transportVal > 0 && <div>Transport: <strong>+₹{d.transportVal}</strong></div>}
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#15803d', marginTop: '4px' }}>
                  GRAND TOTAL: ₹{d.totalVal}
                </div>
              </div>

              {qrInfo.activeUpi && qrInfo.qrImg && (
                <div style={{ textAlign: 'center', marginBottom: '12px', padding: '8px', background: '#eff6ff', borderRadius: '8px', border: '1px dashed #3b82f6' }}>
                  <img src={qrInfo.qrImg} alt="QR" style={{ width: '100px', height: '100px', margin: '0 auto', display: 'block' }} />
                  <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '4px' }}>UPI: {qrInfo.activeUpi}</div>
                </div>
              )}

              {/* 📱 MOBILE SPECIAL PDF ACTION BUTTONS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => downloadOrShareBillPdf(mobilePreviewBill, false)}
                  style={{ width: '100%', padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '14px', cursor: 'pointer' }}
                >
                  📄 Download Bill PDF
                </button>
                <button
                  onClick={() => downloadOrShareBillPdf(mobilePreviewBill, true)}
                  style={{ width: '100%', padding: '12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '14px', cursor: 'pointer' }}
                >
                  📤 Send PDF on WhatsApp
                </button>
                <button
                  onClick={() => sendBillOnWhatsApp(mobilePreviewBill)}
                  style={{ width: '100%', padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '900', fontSize: '13px', cursor: 'pointer' }}
                >
                  💬 Send Text Bill on WhatsApp
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================== */}
      {/* 🌈 TOP NAVIGATION BAR + FULL-SCREEN DEDICATED POS BUTTON   */}
      {/* ========================================================== */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 65%, #1e3a8a 100%)',
          padding: '12px 14px',
          borderRadius: '14px',
          border: '1px solid #4f46e5',
          marginBottom: '14px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ background: '#f59e0b', color: '#0f172a', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: '900' }}>
                ENTERPRISE POS
              </span>
              <h2 style={{ margin: 0, fontSize: '17px', color: '#ffffff', fontWeight: '900' }}>
                🏪 {currentShop?.name || 'Counter Billing Terminal'}
              </h2>
              {displayShopGst && (
                <span style={{ background: '#065f46', color: '#4ade80', border: '1px solid #22c55e', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900' }}>
                  GSTIN: {displayShopGst}
                </span>
              )}
            </div>

            <div style={{ fontSize: '11.5px', color: '#a5b4fc', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>● Valid Till: {posExpiry ? posExpiry.toLocaleDateString('en-IN') : 'Active'}</span>
              <span>|</span>
              <span>
                Store UPI:{' '}
                {liveBillQr.activeUpi ? (
                  <strong style={{ color: '#4ade80' }}>{liveBillQr.activeUpi}</strong>
                ) : (
                  <strong style={{ color: '#f87171' }}>Not Configured</strong>
                )}
              </span>
              <button
                onClick={() => setIsEditingUpi(!isEditingUpi)}
                style={{
                  background: '#312e81',
                  color: '#38bdf8',
                  border: '1px solid #38bdf8',
                  borderRadius: '6px',
                  padding: '2px 7px',
                  fontSize: '10.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {liveBillQr.activeUpi ? 'Edit UPI' : '+ Add UPI'}
              </button>
              <button
                onClick={() => setIsEditingGst(!isEditingGst)}
                style={{
                  background: '#064e3b',
                  color: '#4ade80',
                  border: '1px solid #22c55e',
                  borderRadius: '6px',
                  padding: '2px 7px',
                  fontSize: '10.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                {displayShopGst ? 'Edit GSTIN' : '+ Add GSTIN'}
              </button>
            </div>
          </div>

          {/* 4 NAVIGATION TABS + DEDICATED FULL-SCREEN BUTTON */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setPosSubView('pos_screen')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: posSubView === 'pos_screen' ? '2px solid #fff' : '1px solid #475569',
                background: posSubView === 'pos_screen' ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : '#1e293b',
                color: posSubView === 'pos_screen' ? '#0f172a' : '#e2e8f0',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🛒 1. Counter POS
            </button>

            <button
              onClick={() => {
                setPosSubView('counter_history');
                fetchCounterBillsFromDb();
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: posSubView === 'counter_history' ? '2px solid #fff' : '1px solid #475569',
                background: posSubView === 'counter_history' ? 'linear-gradient(135deg, #10b981, #059669)' : '#1e293b',
                color: 'white',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🧾 2. Counter Sales ({allCounterSalesOnly.length})
            </button>

            <button
              onClick={() => setPosSubView('online_history')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: posSubView === 'online_history' ? '2px solid #fff' : '1px solid #475569',
                background: posSubView === 'online_history' ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : '#1e293b',
                color: 'white',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🌐 3. Online Orders ({allOnlineSalesOnly.length})
            </button>

            <button
              onClick={() => setPosSubView('gst_return')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: posSubView === 'gst_return' ? '2px solid #fff' : '1px solid #475569',
                background: posSubView === 'gst_return' ? 'linear-gradient(135deg, #0d9488, #0f766e)' : '#1e293b',
                color: 'white',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🏛️ 4. GST Returns
            </button>

            <button
              onClick={toggleFullScreenPos}
              title="Run dedicated Counter Billing full-screen on Mobile or Laptop"
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: isFullScreenPos ? '2px solid #fca5a5' : '2px solid #38bdf8',
                background: isFullScreenPos ? '#dc2626' : '#0284c7',
                color: 'white',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {isFullScreenPos ? '✖ Exit Full-Screen' : '🖥️ Full-Screen POS'}
            </button>
          </div>
        </div>

        {isEditingUpi && (
          <div style={{ marginTop: '10px', background: '#0f172a', padding: '10px', borderRadius: '10px', border: '1px solid #38bdf8', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 'bold' }}>Store UPI ID (For Invoice Payment QR):</span>
            <input
              type="text"
              placeholder="e.g. 9876543210@ybl"
              value={shopUpiId}
              onChange={e => setShopUpiId(e.target.value)}
              style={{ flex: 1, minWidth: '180px', padding: '7px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: '#4ade80', fontWeight: 'bold' }}
            />
            <button onClick={saveShopOwnerUpi} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}>
              Save UPI
            </button>
          </div>
        )}

        {isEditingGst && (
          <div style={{ marginTop: '10px', background: '#0f172a', padding: '10px', borderRadius: '10px', border: '1px solid #22c55e', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 'bold' }}>Store GSTIN Number:</span>
            <input
              type="text"
              placeholder="e.g. 10ABCDE1234F1Z5"
              value={shopGstNumber}
              onChange={e => setShopGstNumber(e.target.value.toUpperCase())}
              style={{ flex: 1, minWidth: '180px', padding: '7px 10px', borderRadius: '6px', border: '1px solid #475569', background: '#1e293b', color: '#4ade80', fontWeight: 'bold' }}
            />
            <button onClick={saveShopGstNumber} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '6px', fontWeight: '900', cursor: 'pointer' }}>
              Save GSTIN
            </button>
          </div>
        )}
      </div>

      {/* 🎉 INVOICE SAVED BANNER (PDF DOWNLOAD + WHATSAPP PDF) */}
      {lastGeneratedBill && (
        <div style={{ background: 'linear-gradient(135deg, #064e3b, #0f172a)', border: '2px solid #22c55e', borderRadius: '14px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <span style={{ background: '#4ade80', color: '#064e3b', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '900' }}>
                ✅ {lastGeneratedBill.isGstBill ? 'GST TAX INVOICE SAVED' : 'INVOICE SAVED'} (#{lastGeneratedBill.billNo})
              </span>
              <h3 style={{ margin: '5px 0 0 0', fontSize: '16px', color: 'white' }}>
                👤 {lastGeneratedBill.custName} — Net Payable: <span style={{ color: '#4ade80' }}>₹{lastGeneratedBill.grandTotal}</span> ({lastGeneratedBill.paymentMethod})
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => downloadOrShareBillPdf(lastGeneratedBill, false)} style={{ padding: '8px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                📄 Download PDF
              </button>
              <button onClick={() => downloadOrShareBillPdf(lastGeneratedBill, true)} style={{ padding: '8px 12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                📤 Send PDF WhatsApp
              </button>
              <button onClick={() => printInvoiceWithQr(lastGeneratedBill, 'thermal')} style={{ padding: '8px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                🖨️ Thermal / Preview
              </button>
              <button onClick={() => printInvoiceWithQr(lastGeneratedBill, 'a4')} style={{ padding: '8px 12px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}>
                📄 A4 Print
              </button>
              <button onClick={() => setLastGeneratedBill(null)} style={{ padding: '8px 10px', background: '#334155', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                ✖
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 📷 CAMERA QR / BARCODE SCANNER MODAL                       */}
      {/* ========================================================== */}
      {isScannerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.88)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '15px'
          }}
        >
          <div style={{ background: '#1e293b', border: '2px solid #38bdf8', borderRadius: '16px', padding: '18px', width: '100%', maxWidth: '420px', textAlign: 'center', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#38bdf8' }}>📷 Barcode / QR Scanner</h3>
              <button onClick={stopCameraScanner} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 10px', fontWeight: 'bold', cursor: 'pointer' }}>
                ✖ Close
              </button>
            </div>

            <div style={{ width: '100%', height: '230px', background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '2px dashed #4ade80', marginBottom: '10px' }}>
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
              <div style={{ position: 'absolute', inset: '20%', border: '2px solid rgba(74, 222, 128, 0.8)', borderRadius: '10px', pointerEvents: 'none' }} />
            </div>

            <p style={{ fontSize: '12px', color: '#fde68a', fontWeight: 'bold', margin: '6px 0 10px 0' }}>{scanStatusMsg}</p>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                autoFocus
                placeholder="Scan or type SKU / Barcode and press Enter..."
                value={manualScanCode}
                onChange={e => setManualScanCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && manualScanCode.trim()) {
                    const ok = matchAndAddScannedProduct(manualScanCode);
                    setManualScanCode('');
                    if (ok) stopCameraScanner();
                  }
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #38bdf8', background: '#0f172a', color: 'white', fontSize: '13px', fontWeight: 'bold' }}
              />
              <button
                type="button"
                onClick={() => {
                  if (manualScanCode.trim()) {
                    const ok = matchAndAddScannedProduct(manualScanCode);
                    setManualScanCode('');
                    if (ok) stopCameraScanner();
                  }
                }}
                style={{ background: '#16a34a', color: 'white', border: 'none', padding: '10px 14px', borderRadius: '8px', fontWeight: '900', cursor: 'pointer' }}
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW 1: 50-50 SPLIT SCREEN POS TERMINAL                    */}
      {/* ========================================================== */}
      {posSubView === 'pos_screen' && (
        <div className="pos-flex-split-container">
          {/* LEFT 50% PANE: INVENTORY CATALOG */}
          <div
            className="pos-half-pane"
            style={{
              background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
              padding: '14px',
              borderRadius: '14px',
              border: '2px solid #3b82f6'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#38bdf8', fontWeight: '900' }}>
                  📦 Inventory Catalog ({filteredProducts.length} Items)
                </h3>
                <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                  Real-time Stock Sync • Auto-deducts on Billing
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={fetchLiveShopStockFromDb}
                  title="Refresh live stock from database"
                  style={{
                    background: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #38bdf8',
                    padding: '6px 9px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '900',
                    cursor: 'pointer'
                  }}
                >
                  {isSyncingStock ? 'Syncing...' : '🔄 Sync Stock'}
                </button>
                <button
                  type="button"
                  onClick={startCameraScanner}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    border: '1px solid #4ade80',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: '900',
                    cursor: 'pointer'
                  }}
                >
                  📷 Scan QR
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomItemBox(!showCustomItemBox)}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#0f172a',
                    border: 'none',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: '900',
                    cursor: 'pointer'
                  }}
                >
                  ➕ Custom Item
                </button>
              </div>
            </div>

            {/* BIGGER CUSTOM ITEM BOX WITH WEIGHT / PC / PKT UNIT SELECTOR */}
            {showCustomItemBox && (
              <div style={{ background: '#1e293b', padding: '12px', borderRadius: '10px', border: '2px solid #f59e0b', marginBottom: '10px' }}>
                <div style={{ fontSize: '12.5px', color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px' }}>➕ Quick Add Non-Catalog Item (Weight / Pc / Pkt):</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Item Name..."
                    value={customItemName}
                    onChange={e => setCustomItemName(e.target.value)}
                    style={{ gridColumn: '1 / -1', padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '14px', fontWeight: 'bold' }}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Rate ₹"
                    value={customItemPrice}
                    onChange={e => setCustomItemPrice(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', fontSize: '14px', fontWeight: 'bold' }}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Qty / Kg"
                    value={customItemQty}
                    onChange={e => setCustomItemQty(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '2px solid #38bdf8', background: '#0f172a', color: '#4ade80', fontSize: '15px', fontWeight: '900' }}
                  />
                  <select
                    value={customItemUnit}
                    onChange={e => setCustomItemUnit(e.target.value)}
                    style={{ padding: '10px', borderRadius: '8px', border: '2px solid #f59e0b', background: '#0f172a', color: '#fbbf24', fontSize: '14px', fontWeight: '900', cursor: 'pointer' }}
                  >
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  style={{ width: '100%', background: '#16a34a', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '900', cursor: 'pointer', fontSize: '14px' }}
                >
                  + Add Item to Bill
                </button>
              </div>
            )}

            {/* Search & Category */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '2 1 180px' }}>
                <input
                  type="text"
                  placeholder="🔍 Search item name, SKU, or scan barcode..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      if (filteredProducts.length === 1) {
                        addToCart(filteredProducts[0]);
                        setSearchQuery('');
                      } else {
                        matchAndAddScannedProduct(searchQuery.trim());
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 30px 10px 12px',
                    borderRadius: '10px',
                    border: '2px solid #38bdf8',
                    background: '#0f172a',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    boxSizing: 'border-box'
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: '6px', top: '7px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '3px 7px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    ✖
                  </button>
                )}
              </div>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{
                  flex: '1 1 140px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '2px solid #f59e0b',
                  background: '#1e293b',
                  color: '#fbbf24',
                  fontSize: '12.5px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                {productCategories.map(cat => (
                  <option key={cat} value={cat} style={{ background: '#0f172a', color: 'white' }}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Product List */}
            <div className="pos-compact-product-list">
              {filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '35px 10px', color: '#94a3b8', fontSize: '13px' }}>
                  No matching items found in inventory.
                </div>
              ) : (
                filteredProducts.map((prod: any, idx: number) => {
                  const pName = String(prod.name || prod.product_name || 'Item');
                  const price = Number(prod.price || prod.selling_price || prod.rate || 0);
                  const mrp = Number(prod.mrp || prod.original_price || 0);
                  const baseStock = getBaseProductStock(prod);
                  const remainingStock = getRemainingStockAfterCart(prod);
                  const isOutOfStock = baseStock <= 0;
                  const isLowStock = baseStock > 0 && baseStock <= 5;
                  const imgUrl = getProductImageUrl(prod);
                  const inCart = cart.find(c => String(c.id) === String(prod.id));
                  const avatarBg = categoryColorPalette[idx % categoryColorPalette.length];

                  return (
                    <div
                      key={prod.id}
                      onClick={() => addToCart(prod)}
                      className="pos-compact-product-row"
                      style={{
                        background: inCart
                          ? 'linear-gradient(90deg, #064e3b, #0f172a)'
                          : isOutOfStock
                          ? 'rgba(239, 68, 68, 0.08)'
                          : '#1e293b',
                        border: inCart
                          ? '2px solid #4ade80'
                          : isOutOfStock
                          ? '1px dashed #ef4444'
                          : isLowStock
                          ? '1px solid #f59e0b'
                          : '1px solid #334155',
                        opacity: isOutOfStock ? 0.6 : 1
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: '48px',
                            height: '48px',
                            minWidth: '48px',
                            borderRadius: '10px',
                            background: imgUrl ? '#ffffff' : avatarBg,
                            border: '2px solid #38bdf8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                          }}
                        >
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={pName}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={e => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.fallback-initial')) {
                                  const span = document.createElement('span');
                                  span.className = 'fallback-initial';
                                  span.style.cssText = 'font-size:18px;font-weight:900;color:#0f172a;';
                                  span.innerText = pName.charAt(0).toUpperCase();
                                  parent.appendChild(span);
                                }
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '18px', fontWeight: '900', color: '#ffffff' }}>
                              {pName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: '13.5px',
                              fontWeight: '800',
                              color: '#ffffff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {pName}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                            <span style={{ background: '#312e81', color: '#a5b4fc', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                              {prod.category || 'General'}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '900',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: isOutOfStock
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : isLowStock
                                  ? 'rgba(245, 158, 11, 0.2)'
                                  : 'rgba(16, 185, 129, 0.15)',
                                color: isOutOfStock ? '#f87171' : isLowStock ? '#fbbf24' : '#4ade80'
                              }}
                            >
                              {isOutOfStock ? 'Out of Stock' : `Stock: ${remainingStock} ${prod.unit || 'Pc'}`}
                            </span>
                            <button
                              type="button"
                              onClick={e => printProductQrSticker(prod, e)}
                              title="Print Product QR Sticker"
                              style={{
                                background: '#0f172a',
                                color: '#38bdf8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                fontSize: '9.5px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              🏷️ QR
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '15px', fontWeight: '900', color: '#4ade80' }}>₹{price}</div>
                          {mrp > price && (
                            <div style={{ fontSize: '10px', color: '#94a3b8', textDecoration: 'line-through' }}>₹{mrp}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          style={{
                            background: isOutOfStock
                              ? '#475569'
                              : inCart
                              ? '#22c55e'
                              : 'linear-gradient(135deg, #38bdf8, #2563eb)',
                            color: inCart ? '#052e16' : 'white',
                            border: 'none',
                            padding: '7px 11px',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            fontWeight: '900',
                            cursor: isOutOfStock ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {isOutOfStock ? '0 Stock' : inCart ? `✔ (${inCart.qty} ${inCart.unit})` : '+ Add'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT 50% PANE: LIVE INVOICE TERMINAL */}
          <div id="live-bill-receipt-section" className="pos-half-pane">
            <div className="pos-live-receipt-box">
              {/* ✏️ EDITING OLD BILL BANNER */}
              {editingBill && (
                <div style={{ background: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '900', color: '#92400e' }}>
                    ✏️ Editing Old Bill #{editingBill.bill_no || editingBill.billNo || editingBill.order_no}
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEditBill}
                    style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    ✖ Cancel Edit
                  </button>
                </div>
              )}

              <div style={{ textAlign: 'center', borderBottom: '2px dashed #94a3b8', paddingBottom: '8px', marginBottom: '10px' }}>
                {isGstBillEnabled && (
                  <span style={{ background: '#059669', color: 'white', padding: '2px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: '900', display: 'inline-block', marginBottom: '4px' }}>
                    TAX INVOICE ({gstType === 'inclusive' ? 'INCLUSIVE OF GST' : 'EXCLUSIVE OF GST'})
                  </span>
                )}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '900' }}>
                    {currentShop?.name || 'STORE NAME'}
                  </h2>
                  {displayShopGst && (
                    <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #16a34a', padding: '1px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '900' }}>
                      GSTIN: {displayShopGst}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#475569', fontWeight: 'bold', marginTop: '2px' }}>
                  {currentShop?.address || ''}, {currentShop?.block || ''} | Ph: {currentShop?.phone || ''}
                </div>
              </div>

              {/* Customer Inputs */}
              <div style={{ background: '#f1f5f9', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <div style={{ flex: '1 1 130px', minWidth: 0 }}>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '2px' }}>Customer Name:</label>
                    <input
                      type="text"
                      placeholder="Walk-in Customer"
                      value={custName}
                      onChange={e => setCustName(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #94a3b8', background: '#fff', color: '#0f172a', fontSize: '12px', fontWeight: 'bold', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: '1 1 130px', minWidth: 0 }}>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '2px' }}>Mobile / WhatsApp:</label>
                    <input
                      type="tel"
                      placeholder="10-digit mobile..."
                      maxLength={10}
                      value={custPhone}
                      onChange={e => setCustPhone(e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #94a3b8', background: '#fff', color: '#0f172a', fontSize: '12px', fontWeight: 'bold', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '2px' }}>Billing Address:</label>
                  <input
                    type="text"
                    placeholder="Customer address (optional)..."
                    value={custAddress}
                    onChange={e => setCustAddress(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #94a3b8', background: '#fff', color: '#0f172a', fontSize: '12px', fontWeight: 'bold', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* BIGGER CART ITEMS LIST (EASY QTY / WEIGHT / PC / PKT INPUTS) */}
              <div style={{ minHeight: '180px', maxHeight: '320px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '10px', background: '#f8fafc', padding: '6px' }}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '55px 10px', color: '#64748b', fontWeight: 'bold', fontSize: '13px' }}>
                    Select items from Inventory or Scan QR to start billing.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {cart.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '8px 10px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                        }}
                      >
                        {/* Row 1: Name + Delete */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            {item.image ? (
                              <img src={item.image} alt="" style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #94a3b8' }} />
                            ) : (
                              <span style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '6px', background: '#e2e8f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '900' }}>
                                {String(item.name || 'I').charAt(0).toUpperCase()}
                              </span>
                            )}
                            <div style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {idx + 1}. {item.name}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, 0)}
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontWeight: '900', fontSize: '11px' }}
                          >
                            ✖
                          </button>
                        </div>

                        {/* Row 2: Bigger Rate, Bigger Qty/Weight + Unit Dropdown + Amount */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          {/* Rate */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>₹</span>
                            <input
                              type="number"
                              step="any"
                              value={item.price}
                              onChange={e => updateCartPrice(item.id, parseFloat(e.target.value) || 0)}
                              style={{ width: '70px', padding: '6px', textAlign: 'center', borderRadius: '6px', border: '1.5px solid #94a3b8', fontWeight: '900', color: '#0f172a', fontSize: '13.5px' }}
                            />
                          </div>

                          {/* Bigger Qty / Weight Controls + Unit Selector */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, Number((item.qty - 1).toFixed(2)))}
                              style={{ width: '30px', height: '32px', borderRadius: '6px', border: 'none', background: '#e2e8f0', color: '#0f172a', fontWeight: '900', fontSize: '16px', cursor: 'pointer' }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              step="any"
                              value={item.qty}
                              onChange={e => updateCartQty(item.id, parseFloat(e.target.value))}
                              style={{ width: '68px', height: '32px', textAlign: 'center', padding: '4px', borderRadius: '6px', border: '2px solid #2563eb', fontWeight: '900', fontSize: '14px', color: '#0f172a', boxSizing: 'border-box' }}
                            />
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.id, Number((item.qty + 1).toFixed(2)))}
                              style={{ width: '30px', height: '32px', borderRadius: '6px', border: 'none', background: '#2563eb', color: 'white', fontWeight: '900', fontSize: '16px', cursor: 'pointer' }}
                            >
                              +
                            </button>
                            <select
                              value={item.unit || 'Pc'}
                              onChange={e => updateCartUnit(item.id, e.target.value)}
                              style={{ height: '32px', padding: '0 6px', borderRadius: '6px', border: '1.5px solid #f59e0b', background: '#fef3c7', color: '#92400e', fontWeight: '900', fontSize: '12.5px', cursor: 'pointer' }}
                            >
                              {UNIT_OPTIONS.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>

                          {/* Total */}
                          <div style={{ fontSize: '14.5px', fontWeight: '900', color: '#15803d', marginLeft: 'auto' }}>
                            ₹{Number((item.price * item.qty).toFixed(2))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals, Charges & GST Settings */}
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px', color: '#334155' }}>
                  <span>Subtotal ({cart.length} Items):</span>
                  <strong>₹{subTotal}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
                  <div style={{ background: '#fff', padding: '5px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: '#dc2626', display: 'block' }}>Discount (₹):</label>
                    <input
                      type="number"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#dc2626', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ background: '#fff', padding: '5px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', display: 'block' }}>Labour (₹):</label>
                    <input
                      type="number"
                      value={labourCharge}
                      onChange={e => setLabourCharge(e.target.value)}
                      style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#1e3a8a', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ background: '#fff', padding: '5px 6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: '#7c3aed', display: 'block' }}>Transport (₹):</label>
                    <input
                      type="number"
                      value={transportCharge}
                      onChange={e => setTransportCharge(e.target.value)}
                      style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #e2e8f0', fontWeight: 'bold', color: '#5b21b6', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* GST TAX INVOICE TOGGLE + INCLUSIVE / EXCLUSIVE SWITCH */}
                <div style={{ background: isGstBillEnabled ? '#ecfdf5' : '#f1f5f9', border: isGstBillEnabled ? '1.5px solid #10b981' : '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={isGstBillEnabled}
                      onChange={e => setIsGstBillEnabled(e.target.checked)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>🏛️ Generate GST Tax Invoice</span>
                  </label>

                  {isGstBillEnabled && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #6ee7b7' }}>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setGstType('inclusive')}
                          style={{
                            flex: 1,
                            padding: '5px',
                            borderRadius: '6px',
                            border: gstType === 'inclusive' ? '2px solid #047857' : '1px solid #cbd5e1',
                            background: gstType === 'inclusive' ? '#059669' : '#fff',
                            color: gstType === 'inclusive' ? '#fff' : '#0f172a',
                            fontSize: '11px',
                            fontWeight: '900',
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Inclusive of GST (In Price)
                        </button>
                        <button
                          type="button"
                          onClick={() => setGstType('exclusive')}
                          style={{
                            flex: 1,
                            padding: '5px',
                            borderRadius: '6px',
                            border: gstType === 'exclusive' ? '2px solid #1d4ed8' : '1px solid #cbd5e1',
                            background: gstType === 'exclusive' ? '#2563eb' : '#fff',
                            color: gstType === 'exclusive' ? '#fff' : '#0f172a',
                            fontSize: '11px',
                            fontWeight: '900',
                            cursor: 'pointer'
                          }}
                        >
                          ➕ Exclusive of GST (+ Extra)
                        </button>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#065f46' }}>GST Slab (CGST + SGST):</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[5, 12, 18, 28].map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setGstPercent(g)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '5px',
                                border: gstPercent === g ? '2px solid #047857' : '1px solid #cbd5e1',
                                background: gstPercent === g ? '#059669' : '#fff',
                                color: gstPercent === g ? '#fff' : '#0f172a',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              {g}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#065f46', display: 'block' }}>Store GSTIN:</label>
                          <input
                            type="text"
                            placeholder="10ABCDE1234F1Z5"
                            value={shopGstNumber}
                            onChange={e => setShopGstNumber(e.target.value.toUpperCase())}
                            style={{ width: '100%', padding: '5px', borderRadius: '5px', border: '1px solid #10b981', fontSize: '11px', fontWeight: 'bold', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#065f46', display: 'block' }}>Buyer GSTIN (B2B):</label>
                          <input
                            type="text"
                            placeholder="Optional..."
                            value={custGstNumber}
                            onChange={e => setCustGstNumber(e.target.value.toUpperCase())}
                            style={{ width: '100%', padding: '5px', borderRadius: '5px', border: '1px solid #94a3b8', fontSize: '11px', fontWeight: 'bold', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>

                      <div style={{ fontSize: '11px', color: '#047857', fontWeight: 'bold', marginTop: '5px', textAlign: 'right' }}>
                        Taxable: ₹{taxableAmt.toFixed(2)} | CGST ({gstPercent / 2}%): ₹{(gstAmt / 2).toFixed(2)} + SGST ({gstPercent / 2}%): ₹{(gstAmt / 2).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* GRAND TOTAL */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '18px', fontWeight: '900', color: '#15803d', borderTop: '2px dashed #94a3b8', paddingTop: '6px' }}>
                  <span>GRAND TOTAL:</span>
                  <span>₹{grandTotal}</span>
                </div>
              </div>

              {/* Payment Mode */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                {[
                  { id: 'Cash', label: '💵 Cash', bg: '#16a34a' },
                  { id: 'UPI', label: '🏦 UPI / Bank', bg: '#7c3aed' },
                  { id: 'Khata_Due', label: '📒 Credit / Khata', bg: '#ea580c' }
                ].map(pm => {
                  const active = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id as any)}
                      style={{
                        flex: '1 1 90px',
                        padding: '9px 6px',
                        borderRadius: '8px',
                        border: active ? '2px solid #0f172a' : '1px solid #cbd5e1',
                        background: active ? pm.bg : '#f1f5f9',
                        color: active ? '#fff' : '#334155',
                        fontWeight: '900',
                        fontSize: '11.5px',
                        cursor: 'pointer'
                      }}
                    >
                      {pm.label}
                    </button>
                  );
                })}
              </div>

              {/* Store Payment QR */}
              {grandTotal > 0 && liveBillQr.activeUpi && liveBillQr.qrImg && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', border: '1px dashed #3b82f6', borderRadius: '8px', padding: '6px 10px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '900', color: '#1e3a8a' }}>Store Payment QR (₹{grandTotal})</div>
                    <div style={{ fontSize: '10px', color: '#475569' }}>UPI: <strong>{liveBillQr.activeUpi}</strong></div>
                    <div style={{ fontSize: '9.5px', color: '#15803d', fontWeight: 'bold' }}>✔ Auto-prints on customer invoice</div>
                  </div>
                  <img src={liveBillQr.qrImg} alt="Store QR" style={{ width: '58px', height: '58px', borderRadius: '6px', border: '2px solid #fff' }} />
                </div>
              )}

              {/* UPI Not Found Warning Box */}
              {grandTotal > 0 && !liveBillQr.activeUpi && paymentMethod === 'UPI' && (
                <div style={{ background: '#fef2f2', border: '1px dashed #ef4444', borderRadius: '8px', padding: '7px 10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '900' }}>
                    ⚠️ Store UPI ID is not configured. Add your UPI ID to display payment QR.
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingUpi(true)}
                    style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    + Add UPI ID
                  </button>
                </div>
              )}

              {/* Save / Update Invoice Button */}
              <button
                disabled={isGeneratingBill || cart.length === 0}
                onClick={handleGenerateCounterBill}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: cart.length === 0 ? '#94a3b8' : editingBill ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: editingBill ? '#0f172a' : 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '900',
                  fontSize: '14.5px',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {isGeneratingBill
                  ? 'Processing Invoice & Updating Stock...'
                  : editingBill
                  ? `✏️ Update Old Bill #${editingBill.bill_no || editingBill.billNo || editingBill.order_no} (₹${grandTotal})`
                  : `✅ Save & Generate ${isGstBillEnabled ? 'GST Invoice' : 'Bill'} (₹${grandTotal})`}
              </button>
            </div>
          </div>

          {/* Mobile Sticky Checkout Bar */}
          {cart.length > 0 && (
            <div className="pos-mobile-sticky-bar">
              <div>
                <div style={{ fontSize: '11.5px', color: '#a5b4fc', fontWeight: 'bold' }}>🛒 {cart.length} Items in Cart</div>
                <div style={{ fontSize: '16px', color: '#4ade80', fontWeight: '900' }}>Total: ₹{grandTotal}</div>
              </div>
              <button
                onClick={() => document.getElementById('live-bill-receipt-section')?.scrollIntoView({ behavior: 'smooth' })}
                style={{ background: '#f59e0b', color: '#0f172a', border: 'none', padding: '9px 14px', borderRadius: '8px', fontWeight: '900', fontSize: '12.5px', cursor: 'pointer' }}
              >
                🧾 View Bill ↓
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW 2 & 3: COUNTER SALES & ONLINE ORDERS REGISTERS        */}
      {/* ========================================================== */}
      {(posSubView === 'counter_history' || posSubView === 'online_history') && (
        <div>
          <div
            style={{
              background:
                posSubView === 'counter_history'
                  ? 'linear-gradient(135deg, #065f46, #0f172a)'
                  : 'linear-gradient(135deg, #4c1d95, #0f172a)',
              padding: '14px',
              borderRadius: '12px',
              border: posSubView === 'counter_history' ? '2px solid #10b981' : '2px solid #8b5cf6',
              marginBottom: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#fff', fontWeight: '900' }}>
                {posSubView === 'counter_history' ? '🧾 Counter POS Sales Register' : '🌐 Online App Orders Register'}
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '11.5px', color: '#cbd5e1' }}>
                {posSubView === 'counter_history'
                  ? 'Permanent database ledger of all Counter POS invoices. Click Edit to modify any old bill.'
                  : 'Dedicated ledger of all Online App orders.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {posSubView === 'counter_history' && (
                <button
                  onClick={fetchCounterBillsFromDb}
                  style={{ background: '#0284c7', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '11.5px', cursor: 'pointer' }}
                >
                  {isLoadingBills ? 'Loading...' : '🔄 Refresh'}
                </button>
              )}
              <button
                onClick={() => setShowProductSummaryModal(!showProductSummaryModal)}
                style={{ background: '#f59e0b', color: '#0f172a', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '11.5px', cursor: 'pointer' }}
              >
                📦 {showProductSummaryModal ? 'Show Invoices' : 'Item-Wise Summary'}
              </button>
              <button
                onClick={exportActiveTabToExcel}
                style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '11.5px', cursor: 'pointer' }}
              >
                📥 Export Excel
              </button>
              <button
                onClick={exportActiveTabToPdf}
                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '11.5px', cursor: 'pointer' }}
              >
                📄 Export PDF
              </button>
            </div>
          </div>

          {/* Date & Payment Filters */}
          <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', border: '1px solid #334155', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                  { id: 'custom', label: 'Custom Range' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setDateRangePreset(p.id as any)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '8px',
                      border: dateRangePreset === p.id ? '1px solid #38bdf8' : '1px solid #334155',
                      background: dateRangePreset === p.id ? '#0284c7' : '#1e293b',
                      color: 'white',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value as any)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '11.5px', fontWeight: 'bold' }}
                >
                  <option value="all">All Payment Modes</option>
                  <option value="cash">Cash Only</option>
                  <option value="upi">Bank / UPI Only</option>
                  <option value="khata">Credit / Khata Only</option>
                </select>
                <input
                  type="text"
                  placeholder="Search Invoice or Customer..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #475569', background: '#1e293b', color: 'white', fontSize: '11.5px' }}
                />
              </div>
            </div>

            {dateRangePreset === 'custom' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: '#1e293b', padding: '10px', borderRadius: '8px', marginTop: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', marginRight: '6px' }}>From:</label>
                  <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} style={{ padding: '5px', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid #475569' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', marginRight: '6px' }}>To:</label>
                  <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} style={{ padding: '5px', borderRadius: '6px', background: '#0f172a', color: 'white', border: '1px solid #475569' }} />
                </div>
              </div>
            )}
          </div>

          {/* 4 KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', borderLeft: '4px solid #38bdf8', border: '1px solid #334155' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Total Sales</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#38bdf8', margin: '3px 0' }}>₹{activeMetrics.totalAmt}</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{activeMetrics.totalCount} Invoices</div>
            </div>

            <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', borderLeft: '4px solid #22c55e', border: '1px solid #334155' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Cash Collection</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#4ade80', margin: '3px 0' }}>₹{activeMetrics.cashAmt}</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{activeMetrics.cashCount} Cash Bills</div>
            </div>

            <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', borderLeft: '4px solid #a855f7', border: '1px solid #334155' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>UPI / Bank Transfer</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#c084fc', margin: '3px 0' }}>₹{activeMetrics.upiAmt}</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{activeMetrics.upiCount} Digital Bills</div>
            </div>

            <div style={{ background: '#0f172a', padding: '12px', borderRadius: '12px', borderLeft: '4px solid #f59e0b', border: '1px solid #334155' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Credit / Khata Due</div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#fbbf24', margin: '3px 0' }}>₹{activeMetrics.khataAmt}</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{activeMetrics.khataCount} Credit Bills</div>
            </div>
          </div>

          {showProductSummaryModal ? (
            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '12px', border: '1px solid #334155', overflowX: 'auto' }}>
              <h3 style={{ margin: '0 0 10px 0', color: '#fbbf24', fontSize: '15px' }}>
                Item-Wise Sales Summary ({activeProductsSoldList.length} Products)
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#38bdf8', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>#</th>
                    <th style={{ padding: '8px' }}>Product</th>
                    <th style={{ padding: '8px' }}>Category</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Qty Sold</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProductsSoldList.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '8px', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: 'white' }}>{p.name}</td>
                      <td style={{ padding: '8px', color: '#38bdf8' }}>{p.category}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#fbbf24' }}>
                        {p.qty} {p.unit}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: '900', color: '#4ade80' }}>₹{p.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '12px', border: '1px solid #334155' }}>
              {filteredActiveRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No records found for the selected filter.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredActiveRecords.map((sale: any) => {
                    const bucket = getPayBucket(sale);
                    const isOnline = posSubView === 'online_history';
                    const d = extractBillDetails(sale);
                    let rawItems = sale.items || sale.cartItems || [];
                    if (typeof rawItems === 'string') {
                      try {
                        rawItems = JSON.parse(rawItems);
                      } catch {
                        rawItems = [];
                      }
                    }

                    return (
                      <div
                        key={sale.id || sale.bill_no || sale.order_no}
                        style={{
                          background: '#1e293b',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          borderLeft: isOnline ? '4px solid #8b5cf6' : '4px solid #10b981',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', fontWeight: '900', color: 'white' }}>
                              #{sale.bill_no || sale.order_no || sale.billNo || sale.id}
                            </span>
                            {d.isGstVal && (
                              <span style={{ background: '#065f46', color: '#4ade80', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                GST INVOICE
                              </span>
                            )}
                            <span
                              style={{
                                background: bucket === 'upi' ? '#7e22ce' : bucket === 'cash' ? '#15803d' : '#b45309',
                                color: 'white',
                                padding: '2px 7px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}
                            >
                              {bucket === 'upi' ? 'Bank / UPI' : bucket === 'cash' ? 'Cash' : 'Credit / Khata'}
                            </span>
                          </div>

                          <div style={{ fontSize: '12.5px', color: '#e2e8f0', marginTop: '3px', fontWeight: 'bold' }}>
                            {sale.customer_name || sale.custName || 'Walk-in'} {sale.customer_phone || sale.phone || sale.custPhone ? `(${sale.customer_phone || sale.phone || sale.custPhone})` : ''}
                            {d.addrVal ? <span style={{ color: '#94a3b8', fontWeight: 'normal' }}> | {d.addrVal}</span> : null}
                          </div>

                          {Array.isArray(rawItems) && rawItems.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px', fontWeight: 'bold' }}>
                              Items: {rawItems.map((it: any) => `${it.name || it.product_name} (${it.qty || it.quantity} ${it.unit || 'Pc'})`).join(', ')}
                            </div>
                          )}

                          {(d.labourVal > 0 || d.transportVal > 0) && (
                            <div style={{ fontSize: '10.5px', color: '#fbbf24', marginTop: '2px' }}>
                              {d.labourVal > 0 ? `Labour: ₹${d.labourVal} ` : ''}
                              {d.transportVal > 0 ? `| Transport: ₹${d.transportVal}` : ''}
                            </div>
                          )}

                          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                            {new Date(sale.created_at || Date.now()).toLocaleString('en-IN')}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '17px', fontWeight: '900', color: '#4ade80', marginRight: '4px' }}>
                            ₹{d.totalVal}
                          </span>
                          {!isOnline && (
                            <button
                              onClick={() => handleStartEditBill(sale)}
                              style={{ background: '#f59e0b', color: '#0f172a', border: 'none', padding: '7px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                            >
                              ✏️ Edit
                            </button>
                          )}
                          <button
                            onClick={() => downloadOrShareBillPdf(sale, false)}
                            style={{ background: '#dc2626', color: 'white', border: 'none', padding: '7px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                          >
                            📄 PDF
                          </button>
                          <button
                            onClick={() => downloadOrShareBillPdf(sale, true)}
                            style={{ background: '#16a34a', color: 'white', border: 'none', padding: '7px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                          >
                            📤 WA PDF
                          </button>
                          <button
                            onClick={() => printInvoiceWithQr(sale, 'thermal')}
                            style={{ background: '#2563eb', color: 'white', border: 'none', padding: '7px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                          >
                            🖨️ Thermal
                          </button>
                          <button
                            onClick={() => printInvoiceWithQr(sale, 'a4')}
                            style={{ background: '#7c3aed', color: 'white', border: 'none', padding: '7px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer' }}
                          >
                            📄 A4
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* VIEW 4: GST RETURN FILING CENTER (MONTHLY & QUARTERLY)     */}
      {/* ========================================================== */}
      {posSubView === 'gst_return' && (
        <GstReturnTab
          currentShop={currentShop}
          shopGstNumber={shopGstNumber}
          counterBills={allCounterSalesOnly}
          onlineOrders={allOnlineSalesOnly}
          extractBillDetails={extractBillDetails}
        />
      )}
    </div>
  );
}