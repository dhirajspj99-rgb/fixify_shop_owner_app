"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ==========================================================
// 🎨 5 STUDIO BACKGROUNDS (INCLUDING FIXIFIY WATERMARK BG)
// ==========================================================
const STUDIO_BACKGROUNDS = [
  {
    id: 'pure_white',
    label: '⬜ Pure White Studio (सफेद बैकग्राउंड)',
    previewBg: '#ffffff',
    borderColor: '#94a3b8'
  },
  {
    id: 'white_floral',
    label: '🌸 White + Pink Flower (सफेद व गुलाबी फूल)',
    previewBg: 'linear-gradient(135deg, #ffffff 0%, #fff1f2 50%, #fce7f3 100%)',
    borderColor: '#f43f5e'
  },
  {
    id: 'royal_marigold',
    label: '🌼 Royal Gold Flower (गोल्डन फूल डिजाइन)',
    previewBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
    borderColor: '#f59e0b'
  },
  {
    id: 'lotus_mint',
    label: '🪷 Mint Lotus Flower (कमल फूल बैकग्राउंड)',
    previewBg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #e0f2fe 100%)',
    borderColor: '#10b981'
  },
  {
    id: 'fixifiy_watermark',
    label: '💧 Fixifiy Watermark BG (वाटरमार्क बैकग्राउंड)',
    previewBg: 'repeating-linear-gradient(-30deg, #f8fafc, #f8fafc 20px, #e0f2fe 20px, #e0f2fe 40px)',
    borderColor: '#0284c7'
  }
];

// ==========================================================
// 🧹 STRICT CATEGORY CLEANER (REMOVES "SHOP" DUPLICATES)
// ==========================================================
const defaultCategories = [
  'Mobiles & Accessories',
  'Motor Parts',
  'Laptops & Printers',
  'Fashion & Design',
  'Cosmetic Items',
  'Book & Diary',
  'Old Vehicles (Sell/Buy)',
  'Iron',
  'Cement',
  'Hardware',
  'Electric',
  'UPVC Windows',
  'Aluminium & Steel',
  'Furniture',
  'General Store',
  'Paints'
];

const standardizeCategory = (catStr: any): string => {
  if (!catStr) return 'General Store';
  let s = String(catStr).trim();
  if (!s) return 'General Store';

  const low = s.toLowerCase();
  if (
    low === 'general store' ||
    low === 'general shop' ||
    low === 'kirana' ||
    low === 'kirana shop' ||
    low === 'kirana store' ||
    low === 'grocery' ||
    low === 'grocery shop'
  ) {
    return 'General Store';
  }

  s = s
    .replace(/\s+(shop|shops|store|stores|dukan|mart|center|centre|showroom|agency|house|corner|point|bhandar|emporium|works)$/i, '')
    .trim();

  const cleanLow = s.toLowerCase();

  if (cleanLow === 'electric' || cleanLow === 'electrical' || cleanLow === 'electricals' || cleanLow === 'electronics' || cleanLow === 'electronic') {
    return 'Electric';
  }
  if (
    cleanLow === 'motor' ||
    cleanLow === 'motor part' ||
    cleanLow === 'motor parts' ||
    cleanLow === 'motar parts' ||
    cleanLow === 'motar part' ||
    cleanLow === 'auto parts' ||
    cleanLow === 'automobile parts' ||
    cleanLow === 'spare parts' ||
    cleanLow === 'bike parts'
  ) {
    return 'Motor Parts';
  }
  if (cleanLow === 'mobile' || cleanLow === 'mobiles' || cleanLow === 'mobile & accessories' || cleanLow === 'mobiles & accessories' || cleanLow === 'mobile phone') {
    return 'Mobiles & Accessories';
  }
  if (cleanLow === 'hardware' || cleanLow === 'hardwares' || cleanLow === 'sanitary' || cleanLow === 'plumbing') {
    return 'Hardware';
  }
  if (cleanLow === 'cement' || cleanLow === 'cements' || cleanLow === 'building material') {
    return 'Cement';
  }
  if (cleanLow === 'iron' || cleanLow === 'loha' || cleanLow === 'sariya' || cleanLow === 'tmt') {
    return 'Iron';
  }
  if (cleanLow === 'aluminium' || cleanLow === 'steel' || cleanLow === 'aluminium & steel' || cleanLow === 'aluminum & steel') {
    return 'Aluminium & Steel';
  }
  if (cleanLow === 'upvc' || cleanLow === 'upvc window' || cleanLow === 'upvc windows') {
    return 'UPVC Windows';
  }
  if (cleanLow === 'paint' || cleanLow === 'paints' || cleanLow === 'putty') {
    return 'Paints';
  }
  if (cleanLow === 'fashion' || cleanLow === 'cloth' || cleanLow === 'clothes' || cleanLow === 'garments' || cleanLow === 'saree' || cleanLow === 'fashion & design') {
    return 'Fashion & Design';
  }
  if (cleanLow === 'cosmetic' || cleanLow === 'cosmetics' || cleanLow === 'beauty' || cleanLow === 'cosmetic items') {
    return 'Cosmetic Items';
  }
  if (cleanLow === 'laptop' || cleanLow === 'computer' || cleanLow === 'printer' || cleanLow === 'laptops & printers') {
    return 'Laptops & Printers';
  }
  if (cleanLow === 'furniture' || cleanLow === 'furnitures' || cleanLow === 'wood') {
    return 'Furniture';
  }
  if (cleanLow === 'book' || cleanLow === 'books' || cleanLow === 'stationery' || cleanLow === 'book & diary') {
    return 'Book & Diary';
  }
  if (cleanLow.includes('vehicle') || cleanLow.includes('old bike') || cleanLow.includes('second hand')) {
    return 'Old Vehicles (Sell/Buy)';
  }

  const matchedDefault = defaultCategories.find(d => d.toLowerCase() === cleanLow);
  if (matchedDefault) return matchedDefault;

  return s.charAt(0).toUpperCase() + s.slice(1);
};

// ==========================================================
// 🔍 HELPER TO DETECT ANY DUMMY / UNCLAIMED PRODUCT (OLD OR NEW)
// ==========================================================
const isDummyOrDraftProduct = (p: any): boolean => {
  if (!p) return false;
  const nameStr = String(p.name || '');
  const imgStr = String(p.image_url || '');
  // Matches auto-generated dummy pattern "Model-123" OR no shop_id OR 0 stock OR old unsplash demo photo
  if (/Model-\d+/i.test(nameStr)) return true;
  if (!p.shop_id) return true;
  if (Number(p.total_stock || 0) <= 0) return true;
  if (imgStr.includes('images.unsplash.com')) return true;
  return false;
};

// ==========================================================
// 📚 MEGA INDIAN PRODUCT CATALOG FOR INSTANT 1-LETTER SEARCH
// ==========================================================
const MEGA_PRODUCT_SEARCH_CATALOG: string[] = [
  'Realme 12 Pro 5G (8GB RAM, 256GB ROM)',
  'Realme 12x 5G (6GB RAM, 128GB ROM)',
  'Realme Narzo 70 Pro 5G',
  'Redmi Note 13 Pro 5G (8GB/256GB)',
  'Redmi 13C 5G (6GB/128GB)',
  'Samsung Galaxy A15 5G (8GB/128GB)',
  'Samsung Galaxy M14 5G (6GB/128GB)',
  'Samsung 25W USB-C Super Fast Charger',
  'Vivo V30 5G (8GB/128GB)',
  'Vivo T3 5G (8GB/128GB)',
  'Oppo F25 Pro 5G (8GB/128GB)',
  'Apple iPhone 15 (128GB) Black',
  'Poco M6 Pro 5G (6GB/128GB)',
  'OnePlus Nord CE 4 5G (8GB/128GB)',
  'boAt Airdopes 141 Bluetooth Earbuds',
  'HP 15s Intel Core i5 12th Gen Laptop (8GB/512GB SSD)',
  'HP Smart Tank 589 All-in-One WiFi Color Printer',
  'Dell Inspiron 15 Intel Core i3 12th Gen (8GB/512GB SSD)',
  'Lenovo IdeaPad Slim 3 Intel Core i5 12th Gen',
  'Canon PIXMA G2020 Ink Tank Color Printer',
  'Epson EcoTank L3210 All-in-One Ink Tank Printer',
  'Hero Splendor Plus Genuine Clutch Plate Set',
  'Hero Splendor Plus Chain Sprocket Kit Rolon',
  'Bajaj Pulsar 150 Front Disc Brake Pad Set',
  'TVS Apache RTR 160 Clutch Cable Original',
  'Castrol Activ 4T 20W-40 Bike Engine Oil 1L',
  'Motul 7100 4T 10W-40 Full Synthetic Engine Oil 1L',
  'Exide Xplore XLTZ5 12V 5Ah VRLA Bike Battery',
  'Amaron Pro Bike Rider APBTZ5L 12V Battery',
  'Bosch Iridium Spark Plug for Two Wheeler',
  'Minda Dual Tone Trumpet Horn Set 12V',
  'CEAT Milaze 2.75-18 Tubeless Bike Tyre',
  'Havells 1200mm High Speed Ceiling Fan Brown',
  'Crompton High Flo Wave Plus 400mm Pedestal Fan',
  'Syska 12W B22 Cool Day Light LED Bulb',
  'Philips 9W Ace Saver LED Bulb Pack of 4',
  'Polycab 1.5 sqmm Flame Retardant House Wire 90m',
  'Finolex 1.0 sqmm Multistrand Copper Wire Coil',
  'Anchor Roma Classic 6A Modular Switch Box of 20',
  'UltraTech Super Weather Plus PPC Cement 50Kg Bag',
  'ACC Concrete Plus Xtra Strong Cement 50Kg Bag',
  'Ambuja Plus Cool Walls Cement 50Kg Bag',
  'Dalmia DSP Heavy Foundation Cement 50Kg Bag',
  'Tata Tiscon 550SD Super Ductile TMT Sariya 12mm',
  'Jindal Panther Fe-550D TMT Sariya 16mm',
  'Kamdhenu NXT TMT Sariya 12mm Bar',
  'JK Cement WallMaxX White Wall Putty 40Kg Bag',
  'Dr. Fixit 301 Pidiproof LW+ Waterproofing Liquid 1L',
  'Asian Paints Tractor Emulsion Smooth Wall Paint 20L',
  'Godrej Nav-Tal 7 Lever Brass Padlock with 3 Keys',
  'Banarasi Pure Kanjivaram Silk Saree with Blouse Piece',
  'Jaipuri Printed Pure Cotton Kurti Palazzo Dupatta Set'
];

// Live Google Suggest JSONP Helper
const fetchLiveGoogleSuggestionsJsonp = (query: string): Promise<string[]> => {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !query.trim()) return resolve([]);
    const cbName = `__google_sug_cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement('script');

    const timeout = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 1800);

    const cleanup = () => {
      clearTimeout(timeout);
      try {
        delete (window as any)[cbName];
      } catch {}
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    (window as any)[cbName] = (data: any) => {
      cleanup();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        const list = data[1]
          .map((item: any) => (typeof item === 'string' ? item : Array.isArray(item) ? item[0] : ''))
          .filter(Boolean);
        resolve(list);
      } else {
        resolve([]);
      }
    };

    script.src = `https://suggestqueries.google.com/complete/search?client=youtube&ds=sh&q=${encodeURIComponent(query)}&jsonp=${cbName}`;
    script.onerror = () => {
      cleanup();
      resolve([]);
    };
    document.body.appendChild(script);
  });
};

export default function InventoryTab({ products, fetchProducts, currentShop }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form States
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Mobiles & Accessories');
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('Pc');
  const [condition, setCondition] = useState('New');
  const [isHeavy, setIsHeavy] = useState(false);
  const [returnPolicy, setReturnPolicy] = useState('No Return');
  const [isCodAvailable, setIsCodAvailable] = useState(true);
  const [description, setDescription] = useState('');

  // Variants State
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState([{ name: '', price: '', stock: '' }]);

  // Custom Created Categories State
  const [customCategoriesList, setCustomCategoriesList] = useState<string[]>([]);
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [quickNewCategoryName, setQuickNewCategoryName] = useState('');

  // 🔍 Live Google/Web Name Search Suggestions State
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [isSearchingNames, setIsSearchingNames] = useState(false);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [editShowSuggestions, setEditShowSuggestions] = useState(false);
  const [editNameSuggestions, setEditNameSuggestions] = useState<string[]>([]);

  // 🌐 Web Description Search State
  const [isSearchingWebDesc, setIsSearchingWebDesc] = useState(false);

  // 🔍 Full-Screen Image Zoom Lightbox Modal State
  const [zoomedImageModal, setZoomedImageModal] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // 📸 Camera OCR Scanner for Product Details Description
  const [isScanningLabel, setIsScanningLabel] = useState(false);
  const [scanStatusText, setScanStatusText] = useState('');

  // 🌸 STUDIO BACKGROUND, FIXIFIY MARKA TOGGLE & 1-PHOTO INDEX
  const [selectedBgTheme, setSelectedBgTheme] = useState<string>('white_floral');
  const [autoRemoveBg, setAutoRemoveBg] = useState<boolean>(true);
  const [enableFixifiyMarka, setEnableFixifiyMarka] = useState<boolean>(true);
  const [markaPhotoIndex, setMarkaPhotoIndex] = useState<number>(0);

  const [isProcessingStudio, setIsProcessingStudio] = useState<boolean>(false);
  const [rawSourceImages, setRawSourceImages] = useState<File[]>([]);
  const [processedPreviews, setProcessedPreviews] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Edit & Temporary Dummy Products States
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editRawSources, setEditRawSources] = useState<File[]>([]);
  const [editProcessedPreviews, setEditProcessedPreviews] = useState<string[]>([]);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editMarkaPhotoIndex, setEditMarkaPhotoIndex] = useState<number>(0);
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // 🗑️ TEMPORARY DUMMY PRODUCTS TRACKER
  const [tempDummyProducts, setTempDummyProducts] = useState<any[]>([]);
  const [deletedIdsSet, setDeletedIdsSet] = useState<Set<any>>(new Set());
  const tempDummyIdsRef = useRef<number[]>([]);

  const safeShopId = currentShop?.id ? String(currentShop.id) : null;
  const dummyStorageKey = `fixifiy_temp_dummy_ids_${safeShopId || 'guest'}`;
  const heavyCategoriesList = ['Iron', 'Cement', 'Hardware', 'Aluminium & Steel', 'UPVC Windows'];

  // ==========================================================
  // 🗑️ 1. SINGLE PRODUCT DELETE (WORKS FOR ANY DUMMY OR SAVED ITEM)
  // ==========================================================
  const deleteSingleProduct = async (prod: any) => {
    if (!window.confirm(`क्या आप "${prod.name}" को हमेशा के लिए डिलीट करना चाहते हैं?`)) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', prod.id);
      if (error) throw error;

      setDeletedIdsSet(prev => new Set(prev).add(prod.id));
      setTempDummyProducts(prev => prev.filter(item => item.id !== prod.id));
      tempDummyIdsRef.current = tempDummyIdsRef.current.filter(id => id !== prod.id);
      try {
        localStorage.setItem(dummyStorageKey, JSON.stringify(tempDummyIdsRef.current));
      } catch {}

      if (typeof fetchProducts === 'function') await fetchProducts();
    } catch (err: any) {
      alert('❌ Delete Error: ' + err.message);
    }
  };

  // ==========================================================
  // 📉 2. MAKE ALL SAVED DUMMY PRODUCTS STOCK = 0 (HIDE FROM CUSTOMERS)
  // ==========================================================
  const zeroOutAllDummyStock = async () => {
    const allDummyItems = mergedRawProducts.filter(p => isDummyOrDraftProduct(p));
    if (allDummyItems.length === 0) {
      return alert('✅ कोई भी डमी प्रोडक्ट नहीं मिला!');
    }
    if (
      !window.confirm(
        `क्या आप सभी ${allDummyItems.length} डमी प्रोडक्ट्स का Stock = 0 और दुकान का नाम हटाना चाहते हैं ताकि वे ग्राहक को बिल्कुल न दिखें?`
      )
    ) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const dummyIds = allDummyItems.map(p => p.id);
      const { error } = await supabase
        .from('products')
        .update({ total_stock: 0, shop_id: null, image_url: '' })
        .in('id', dummyIds);

      if (error) throw error;

      setTempDummyProducts(prev =>
        prev.map(item => (dummyIds.includes(item.id) ? { ...item, total_stock: 0, shop_id: null, image_url: '' } : item))
      );
      if (typeof fetchProducts === 'function') await fetchProducts();
      alert(`✅ सभी ${dummyIds.length} डमी प्रोडक्ट्स का Stock 0 कर दिया गया है! अब ये ग्राहक को नहीं दिखेंगे।`);
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // ==========================================================
  // 🗑️ 3. DELETE ALL SAVED & UNUSED DUMMY PRODUCTS AT ONCE
  // ==========================================================
  const deleteAllDummyProductsFromDb = async (silent = false) => {
    const allDummyItems = mergedRawProducts.filter(p => isDummyOrDraftProduct(p));
    const trackedIds = tempDummyIdsRef.current;
    const allIdsToDelete = Array.from(new Set([...allDummyItems.map(p => p.id), ...trackedIds])).filter(Boolean);

    if (allIdsToDelete.length === 0) {
      if (!silent) alert('✅ डिलीट करने के लिए कोई डमी प्रोडक्ट नहीं बचा है!');
      return;
    }

    if (!silent) {
      if (
        !window.confirm(
          `🚨 क्या आप सेव हुए सभी ${allIdsToDelete.length} डमी (Dummy / 0-Stock) प्रोडक्ट्स को डेटाबेस से एक साथ डिलीट करना चाहते हैं?\n\n(जिन असली प्रोडक्ट्स में आपने नाम, फोटो और स्टॉक चढ़ाया है, वे सुरक्षित रहेंगे)`
        )
      ) {
        return;
      }
      setIsBulkDeleting(true);
    }

    try {
      // 1. Delete by collected IDs
      await supabase.from('products').delete().in('id', allIdsToDelete);
      // 2. Also delete any leftover "Model-xxx" pattern or 0-stock unassigned rows in DB
      await supabase.from('products').delete().ilike('name', '%Model-%').eq('total_stock', 0);
      await supabase.from('products').delete().is('shop_id', null).eq('total_stock', 0);

      setDeletedIdsSet(prev => {
        const next = new Set(prev);
        allIdsToDelete.forEach(id => next.add(id));
        return next;
      });
      tempDummyIdsRef.current = [];
      setTempDummyProducts([]);
      try {
        localStorage.removeItem(dummyStorageKey);
      } catch {}

      if (typeof fetchProducts === 'function' && !silent) {
        await fetchProducts();
      }
      if (!silent) {
        alert(`✅ सभी ${allIdsToDelete.length} डमी प्रोडक्ट्स डेटाबेस से हमेशा के लिए डिलीट हो गए!`);
      }
    } catch (err: any) {
      if (!silent) alert('❌ Delete Error: ' + err.message);
    } finally {
      if (!silent) setIsBulkDeleting(false);
    }
  };

  // Auto-delete unused dummy items on Logout or Tab Close
  useEffect(() => {
    try {
      const savedIds = localStorage.getItem(dummyStorageKey);
      if (savedIds) {
        const parsed = JSON.parse(savedIds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          tempDummyIdsRef.current = parsed;
        }
      }
    } catch {}

    const handleGlobalClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      const text = (target?.innerText || target?.textContent || '').toLowerCase();
      if (text.includes('logout') || text.includes('लॉगआउट') || text.includes('log out') || text.includes('sign out')) {
        deleteAllDummyProductsFromDb(true);
      }
    };

    const handleBeforeUnload = () => {
      if (tempDummyIdsRef.current.length > 0) {
        supabase.from('products').delete().in('id', tempDummyIdsRef.current).is('shop_id', null);
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dummyStorageKey]);

  // ==========================================================
  // 📋 ORIGINAL STRUCTURED PRODUCT DETAILS TEMPLATE FORMAT
  // ==========================================================
  const getCategoryTemplate = (cat: string, prodNameStr: string = '') => {
    const c = (cat || '').toLowerCase();
    const pTitle = (prodNameStr || '').trim();

    if (c.includes('mobile') || c.includes('camera')) {
      return (
        `• Model Name: ${pTitle}\n` +
        `• RAM / ROM: 8 GB RAM | 128 GB / 256 GB ROM\n` +
        `• Camera: 50MP AI Rear Camera | 16MP Front Selfie Camera\n` +
        `• Battery: 5000 mAh Fast Charging Battery\n` +
        `• Processor & Display: 5G Octa-Core Processor | 6.7 inch FHD+ 120Hz Display\n` +
        `• In The Box: Handset, Fast Charger, USB Type-C Cable, Sim Ejector, Cover\n` +
        `• Warranty: 1 Year Manufacturer Warranty`
      );
    }
    if (c.includes('laptop') || c.includes('printer')) {
      if (
        pTitle.toLowerCase().includes('printer') ||
        pTitle.toLowerCase().includes('pixma') ||
        pTitle.toLowerCase().includes('ecotank') ||
        pTitle.toLowerCase().includes('laserjet')
      ) {
        return (
          `• Brand & Model: ${pTitle}\n` +
          `• Printer Type: All-in-One Ink Tank / Laser Printer (Print, Scan, Copy)\n` +
          `• Connectivity: High-Speed USB 2.0 & Wi-Fi Wireless Printing\n` +
          `• Print Speed & Yield: High Page Yield & Low Cost Per Page\n` +
          `• Supported Paper Size: A4, B5, Letter, Photo Paper\n` +
          `• In The Box: Printer, Power Cord, USB Cable, Ink Bottles / Cartridge\n` +
          `• Warranty: 1 Year Official Manufacturer Warranty`
        );
      }
      return (
        `• Brand & Model: ${pTitle}\n` +
        `• Processor (CPU): Intel Core i5 / AMD Ryzen 5 (Latest Generation)\n` +
        `• RAM & SSD/HDD: 8 GB / 16 GB DDR4 RAM | 512 GB NVMe Fast SSD\n` +
        `• Graphics & OS: Integrated HD Graphics | Windows 11 Home + MS Office\n` +
        `• Screen Size & Display: 15.6 Inch Full HD (1920x1080) Anti-Glare Display\n` +
        `• Battery Backup: Up to 6-7 Hours Battery Backup with Fast Charge\n` +
        `• Warranty: 1 Year Onsite Manufacturer Warranty`
      );
    }
    if (c.includes('motor') || c.includes('auto')) {
      return (
        `• Part Name & Model: ${pTitle}\n` +
        `• Compatible Vehicle: Two-Wheeler / Four-Wheeler / Commercial Vehicle\n` +
        `• Brand / OEM Standard: 100% Genuine OEM Specification\n` +
        `• Material & Build Quality: Heavy-Duty Heat & Wear Resistant Grade\n` +
        `• Net Quantity: 1 Unit (Sealed Pack)\n` +
        `• Warranty / Guarantee: Replacement Guarantee against Manufacturing Defect`
      );
    }
    if (c.includes('fashion') || c.includes('cloth') || c.includes('design')) {
      return (
        `• Item / Design Name: ${pTitle}\n` +
        `• Fabric / Material: Pure Cotton / Premium Silk Blend\n` +
        `• Saree / Cloth Length: 5.5 Mtr (+ 0.8 Mtr Blouse Piece) / Standard Fit\n` +
        `• Pattern / Print: Latest Designer Embroidery / Printed Work\n` +
        `• Occasion: Casual / Party / Festival & Wedding Wear\n` +
        `• Wash Care: Hand Wash / Gentle Machine Wash\n` +
        `• Package Contains: 1 Piece`
      );
    }
    if (c.includes('iron') || c.includes('steel') || c.includes('aluminium')) {
      return (
        `• Brand / Make: ${pTitle}\n` +
        `• Gauge / Thickness: Heavy Gauge ISI Certified Grade (Fe-550D)\n` +
        `• Length & Dimensions: Standard Full Length & Accurate Size\n` +
        `• Weight / Unit: Exact Weight per Kg / Piece\n` +
        `• Corrosion Resistance: Yes (Rust & Weather Proof)\n` +
        `• Application: RCC Roof, Pillars, Building & Construction`
      );
    }
    if (c.includes('cement')) {
      return (
        `• Brand Name: ${pTitle}\n` +
        `• Grade (OPC / PPC): High Strength PPC / OPC 53 Grade\n` +
        `• Packaging: 50 Kg Moisture-Proof Laminated Bag\n` +
        `• Setting Time: Fast Setting & Crack-Resistant Formula\n` +
        `• Best For: RCC Slabs, Pillars, Beams, Plaster & Foundation`
      );
    }
    if (c.includes('vehicle')) {
      return (
        `• Model & Year: ${pTitle}\n` +
        `• Fuel Type: Petrol / Diesel\n` +
        `• KM Driven: Well Maintained Low Run\n` +
        `• Ownership: 1st Owner\n` +
        `• Insurance & Papers: Complete RC & Valid Insurance\n` +
        `• Condition: Excellent Engine, Tyres & Body Condition`
      );
    }
    return (
      `• Brand / Product Name: ${pTitle}\n` +
      `• Category: ${cat}\n` +
      `• Key Features: Premium Quality & High Durability\n` +
      `• Material / Quality: 100% Original Checked Product\n` +
      `• Net Quantity: 1 Pack / Unit\n` +
      `• Usage & Storage: Easy to Use for Home & Commercial Purpose\n` +
      `• Guarantee / Warranty: Standard Manufacturer Warranty`
    );
  };

  const applyAutoTemplate = (isEdit: boolean = false) => {
    const cat = isEdit ? editProduct.category : category;
    const pName = isEdit ? editProduct.name : name;
    const template = getCategoryTemplate(cat, pName);
    if (isEdit) {
      setEditProduct({ ...editProduct, description: template });
    } else {
      setDescription(template);
    }
  };

  useEffect(() => {
    if (isAdding && (!description || description.trim() === '')) {
      setDescription(getCategoryTemplate(category, name));
    }
  }, [category, isAdding]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fixifiy_custom_categories_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomCategoriesList(Array.from(new Set(parsed.map(standardizeCategory))));
        }
      }
    } catch {}
  }, []);

  // ==========================================================
  // 💰 SUPABASE CATEGORY COMMISSION % FETCH (DEFAULT 20%)
  // ==========================================================
  const [categoryCommissionMap, setCategoryCommissionMap] = useState<Record<string, number>>({});

  const fetchCategoryCommissions = async () => {
    const commMap: Record<string, number> = {};
    const storeRate = (catName: any, rateVal: any) => {
      const cleanKey = standardizeCategory(catName).toLowerCase();
      const num = parseFloat(String(rateVal ?? '').replace(/[^0-9.]/g, ''));
      if (cleanKey && !isNaN(num) && num >= 0 && num <= 100) {
        commMap[cleanKey] = num;
      }
    };

    const parseJsonSource = (raw: any) => {
      if (!raw) return;
      let obj = raw;
      if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj);
        } catch {
          return;
        }
      }
      if (Array.isArray(obj)) {
        obj.forEach((it: any) =>
          storeRate(
            it?.category || it?.name || it?.category_name,
            it?.commission ?? it?.admin_commission ?? it?.commission_percent ?? it?.rate
          )
        );
      } else if (typeof obj === 'object') {
        Object.entries(obj).forEach(([k, v]: [string, any]) => {
          if (typeof v === 'object' && v !== null) {
            storeRate(k, v.commission ?? v.admin_commission ?? v.rate);
          } else {
            storeRate(k, v);
          }
        });
      }
    };

    try {
      const { data: appSet } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
      if (appSet) {
        parseJsonSource(appSet.category_commissions);
        parseJsonSource(appSet.commissions);
        parseJsonSource(appSet.admin_commissions);
      }
    } catch {}

    try {
      const { data: ccRows } = await supabase.from('category_commissions').select('*');
      if (Array.isArray(ccRows)) {
        ccRows.forEach((r: any) =>
          storeRate(
            r.category || r.category_name || r.name,
            r.commission ?? r.admin_commission ?? r.commission_percent ?? r.rate
          )
        );
      }
    } catch {}

    try {
      const { data: catRows } = await supabase.from('categories').select('*');
      if (Array.isArray(catRows)) {
        catRows.forEach((r: any) => {
          if (r.name || r.category) {
            const cleanName = standardizeCategory(r.name || r.category);
            setCustomCategoriesList(prev => Array.from(new Set([...prev, cleanName])));
          }
          storeRate(
            r.name || r.category || r.category_name,
            r.commission ?? r.admin_commission ?? r.commission_percent ?? r.rate
          );
        });
      }
    } catch {}

    setCategoryCommissionMap(commMap);
  };

  useEffect(() => {
    fetchCategoryCommissions();
  }, [currentShop?.id]);

  const getCategoryCommission = (catName: string) => {
    const cleanKey = standardizeCategory(catName).toLowerCase();
    if (categoryCommissionMap[cleanKey] !== undefined) {
      return { percent: categoryCommissionMap[cleanKey], isFromDb: true };
    }
    for (const [k, v] of Object.entries(categoryCommissionMap)) {
      if (cleanKey.includes(k) || k.includes(cleanKey)) {
        return { percent: v, isFromDb: true };
      }
    }
    return { percent: 20, isFromDb: false };
  };

  useEffect(() => {
    if (heavyCategoriesList.includes(category)) setIsHeavy(true);
    else if (category !== 'Custom') setIsHeavy(false);

    const catLower = (category || '').toLowerCase();
    if (catLower.includes('iron') || catLower.includes('steel')) {
      setUnit('Kg');
    } else if (catLower.includes('cement')) {
      setUnit('Bag');
    } else {
      setUnit('Pc');
    }
  }, [category]);

  // ==========================================================
  // 🌐 REAL WEB / GOOGLE PRODUCT NAME SEARCH ENGINE
  // ==========================================================
  const runWebProductNameSearch = async (queryText: string, activeCat: string, isEdit = false) => {
    const q = (queryText || '').trim();
    if (q.length < 1) {
      if (isEdit) {
        setEditNameSuggestions([]);
        setEditShowSuggestions(false);
      } else {
        setNameSuggestions([]);
        setShowSuggestionsDropdown(false);
      }
      return;
    }

    setIsSearchingNames(true);
    const qLow = q.toLowerCase();
    const results: string[] = [];

    const startsWithMatches = MEGA_PRODUCT_SEARCH_CATALOG.filter(item =>
      item.toLowerCase().startsWith(qLow)
    );
    const includesMatches = MEGA_PRODUCT_SEARCH_CATALOG.filter(
      item => !item.toLowerCase().startsWith(qLow) && item.toLowerCase().includes(qLow)
    );
    results.push(...startsWithMatches, ...includesMatches);

    (products || []).forEach((p: any) => {
      if (p?.name && !/Model-\d+/i.test(p.name) && String(p.name).toLowerCase().includes(qLow)) {
        results.push(String(p.name));
      }
    });

    const initialUnique = Array.from(new Set(results)).slice(0, 8);
    if (isEdit) {
      setEditNameSuggestions(initialUnique);
    } else {
      setNameSuggestions(initialUnique);
    }

    if (q.length >= 2) {
      try {
        const googleLiveList = await fetchLiveGoogleSuggestionsJsonp(q);
        googleLiveList.forEach(gItem => {
          const clean = gItem.charAt(0).toUpperCase() + gItem.slice(1);
          results.push(clean);
        });
      } catch {}

      try {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&search=${encodeURIComponent(q)}&limit=5`
        );
        if (wikiRes.ok) {
          const wikiJson = await wikiRes.json();
          if (Array.isArray(wikiJson[1])) {
            wikiJson[1].forEach((title: string) => {
              if (title) results.push(title);
            });
          }
        }
      } catch {}
    }

    const formattedInput = q.charAt(0).toUpperCase() + q.slice(1);
    results.push(
      `${formattedInput} (${activeCat})`,
      `${formattedInput} Pro Original`,
      `${formattedInput} Heavy Duty Pack`
    );

    const finalUnique = Array.from(new Set(results)).slice(0, 10);
    if (isEdit) {
      setEditNameSuggestions(finalUnique);
    } else {
      setNameSuggestions(finalUnique);
    }
    setIsSearchingNames(false);
  };

  // ==========================================================
  // 🌐 DEDICATED WEB DESCRIPTION SEARCH ENGINE
  // ==========================================================
  const searchWebForProductDescription = async (productTitle: string, catName: string, isEditMode = false) => {
    const cleanTitle = (productTitle || '').trim();
    if (!cleanTitle) {
      return alert('⚠️ कृपया पहले ऊपर प्रोडक्ट का नाम (Product Name) लिखें, फिर Description Search दबाएं!');
    }

    setIsSearchingWebDesc(true);
    setShowSuggestionsDropdown(false);
    setEditShowSuggestions(false);

    try {
      const baseFormat = getCategoryTemplate(catName, cleanTitle);
      const foundSnippets: { title: string; snippet: string }[] = [];

      try {
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          cleanTitle
        )}&utf8=&format=json&origin=*&srlimit=3`;
        const res = await fetch(searchUrl);
        if (res.ok) {
          const data = await res.json();
          const list = data?.query?.search || [];
          list.forEach((item: any) => {
            const plainSnippet = String(item.snippet || '')
              .replace(/<[^>]+>/g, '')
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .trim();
            if (plainSnippet) {
              foundSnippets.push({
                title: item.title,
                snippet: plainSnippet
              });
            }
          });
        }
      } catch {}

      const webExtraPoints =
        foundSnippets.length > 0
          ? `\n\n🌐 Web / Online Specifications (${cleanTitle}):\n` +
            foundSnippets.map(s => `• ${s.title}: ${s.snippet}`).join('\n')
          : `\n\n🌐 Online Verified Details:\n• 100% Original ${cleanTitle} (${catName})\n• Quality Checked by Fixifiy (A Unit of Mahadev Enterprises)`;

      const combinedDescription = `${baseFormat}${webExtraPoints}`;

      if (isEditMode && editProduct) {
        setEditProduct((prev: any) => ({ ...prev, description: combinedDescription }));
      } else {
        setDescription(combinedDescription);
      }
    } finally {
      setIsSearchingWebDesc(false);
    }
  };

  // ==========================================================
  // 📸 CAMERA OCR SCANNER (SCAN PRODUCT BOX -> WRITE DETAILS)
  // ==========================================================
  const handleScanProductDetailsFromCamera = async (file: File, isEditMode = false) => {
    if (!file) return;
    setIsScanningLabel(true);
    setScanStatusText('🔍 कैमरा फोटो से प्रोडक्ट की जानकारी पढ़ी जा रही है...');

    let extractedText = '';

    try {
      if (typeof window !== 'undefined' && 'TextDetector' in window) {
        try {
          const bitmap = await createImageBitmap(file);
          // @ts-ignore
          const detector = new window.TextDetector();
          const detectedBlocks = await detector.detect(bitmap);
          if (Array.isArray(detectedBlocks) && detectedBlocks.length > 0) {
            extractedText = detectedBlocks.map((b: any) => b.rawValue).join('\n');
          }
        } catch {}
      }

      if (!extractedText.trim() && typeof window !== 'undefined') {
        setScanStatusText('🤖 AI OCR Vision से पैकेट/लेबल के अक्षर पढ़े जा रहे हैं...');
        if (!(window as any).Tesseract) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('OCR load failed'));
            document.head.appendChild(script);
          });
        }
        if ((window as any).Tesseract) {
          const result = await (window as any).Tesseract.recognize(file, 'eng');
          if (result?.data?.text) {
            extractedText = result.data.text;
          }
        }
      }
    } catch {}

    const cleanLines = (extractedText || '')
      .split('\n')
      .map(l => l.replace(/[^\w\s.,:/()-₹%]/g, '').trim())
      .filter(l => l.length > 2);

    const prodTitle = isEditMode ? editProduct?.name || 'Product' : name || 'Product';
    const prodCat = isEditMode ? editProduct?.category || category : category;

    const baseFormat = getCategoryTemplate(prodCat, prodTitle);
    const scannedBlock =
      cleanLines.length > 0
        ? `\n\n📸 बॉक्स/लेबल से स्कैन की गई जानकारी:\n` + cleanLines.map(line => `• ${line}`).join('\n')
        : '';

    const finalScannedDescription = `${baseFormat}${scannedBlock}`;

    if (isEditMode && editProduct) {
      setEditProduct({
        ...editProduct,
        description: finalScannedDescription
      });
    } else {
      setDescription(finalScannedDescription);
    }

    setIsScanningLabel(false);
    setScanStatusText('');
    alert('✅ कैमरा फोटो से प्रोडक्ट की डिटेल्स फॉर्मेट के साथ लिख दी गई हैं!');
  };

  const handleCreateQuickCategory = async () => {
    if (!quickNewCategoryName.trim()) return alert('कृपया नई कैटेगरी का नाम लिखें!');
    const cleanCat = standardizeCategory(quickNewCategoryName);

    const updated = Array.from(new Set([...customCategoriesList, cleanCat]));
    setCustomCategoriesList(updated);
    try {
      localStorage.setItem('fixifiy_custom_categories_v2', JSON.stringify(updated));
    } catch {}

    try {
      await supabase.from('category_commissions').insert({ category: cleanCat, commission: 20 });
    } catch {}

    setSelectedInvCategory(cleanCat);
    setCategory(cleanCat);
    setQuickNewCategoryName('');
    setShowNewCatModal(false);
    alert(`✅ नई कैटेगरी "${cleanCat}" सफलतापूर्वक बन गई है! (Default 20% Commission)`);
  };

  // ==========================================================
  // 🎨 CANVAS ENGINE: 5 BACKGROUNDS + OPTIONAL MARKA ON 1 PHOTO
  // ==========================================================
  const drawFlowerMotif = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    petalColor: string,
    centerColor: string
  ) => {
    ctx.save();
    const petals = 8;
    for (let i = 0; i < petals; i++) {
      const angle = (i * 2 * Math.PI) / petals;
      const px = cx + Math.cos(angle) * (radius * 0.85);
      const py = cy + Math.sin(angle) * (radius * 0.85);
      ctx.beginPath();
      ctx.arc(px, py, radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = petalColor;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = centerColor;
    ctx.fill();
    ctx.restore();
  };

  const paintStudioBackground = (ctx: CanvasRenderingContext2D, W: number, H: number, bgId: string) => {
    ctx.save();
    if (bgId === 'pure_white') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      const radGrad = ctx.createRadialGradient(W / 2, H * 0.76, 20, W / 2, H * 0.76, W * 0.42);
      radGrad.addColorStop(0, 'rgba(148, 163, 184, 0.35)');
      radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, W, H);
    } else if (bgId === 'white_floral') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#fff1f2');
      grad.addColorStop(1, '#fecdd3');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const flowerPositions = [
        [65, 95, 32],
        [145, 65, 22],
        [55, 175, 24],
        [W - 65, 95, 32],
        [W - 145, 65, 22],
        [W - 55, 175, 24],
        [70, H - 125, 30],
        [W - 70, H - 125, 30],
        [45, H / 2, 24],
        [W - 45, H / 2, 24]
      ];
      flowerPositions.forEach(([x, y, r]) => {
        drawFlowerMotif(ctx, x, y, r, 'rgba(244, 63, 94, 0.28)', 'rgba(251, 191, 36, 0.6)');
      });
    } else if (bgId === 'royal_marigold') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#fffbeb');
      grad.addColorStop(0.6, '#fef3c7');
      grad.addColorStop(1, '#fde68a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const flowerPositions = [
        [70, 95, 34],
        [150, 70, 22],
        [W - 70, 95, 34],
        [W - 150, 70, 22],
        [75, H - 125, 30],
        [W - 75, H - 125, 30],
        [50, H / 2, 24],
        [W - 50, H / 2, 24]
      ];
      flowerPositions.forEach(([x, y, r]) => {
        drawFlowerMotif(ctx, x, y, r, 'rgba(245, 158, 11, 0.32)', 'rgba(180, 83, 9, 0.65)');
      });

      ctx.strokeStyle = 'rgba(217, 119, 6, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(18, 60, W - 36, H - 140);
    } else if (bgId === 'lotus_mint') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#f0fdf4');
      grad.addColorStop(0.55, '#dcfce7');
      grad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const flowerPositions = [
        [70, 95, 32],
        [145, 68, 20],
        [W - 70, 95, 32],
        [W - 145, 68, 20],
        [70, H - 125, 30],
        [W - 70, H - 125, 30],
        [48, H / 2, 22],
        [W - 48, H / 2, 22]
      ];
      flowerPositions.forEach(([x, y, r]) => {
        drawFlowerMotif(ctx, x, y, r, 'rgba(16, 185, 129, 0.28)', 'rgba(2, 132, 199, 0.55)');
      });
    } else if (bgId === 'fixifiy_watermark') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#f8fafc');
      grad.addColorStop(0.5, '#f0f9ff');
      grad.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate((-26 * Math.PI) / 180);
      ctx.textAlign = 'center';

      for (let y = -H; y <= H; y += 95) {
        for (let x = -W; x <= W; x += 340) {
          ctx.font = '900 22px "Segoe UI", sans-serif';
          ctx.fillStyle = 'rgba(2, 132, 199, 0.13)';
          ctx.fillText('FIXIFIY • MAHADEV ENTERPRISES', x, y);

          ctx.font = 'bold 13px "Segoe UI", sans-serif';
          ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
          ctx.fillText('★ 100% VERIFIED ORIGINAL ★', x, y + 24);
        }
      }
      ctx.restore();

      ctx.strokeStyle = 'rgba(2, 132, 199, 0.3)';
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 14, W - 28, H - 28);
    }
    ctx.restore();
  };

  const removeOuterBackgroundFromImage = (img: HTMLImageElement): HTMLCanvasElement => {
    const tempCanvas = document.createElement('canvas');
    const w = Math.min(600, img.naturalWidth || img.width || 500);
    const h = Math.min(600, img.naturalHeight || img.height || 500);
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    if (!tCtx) return tempCanvas;

    tCtx.drawImage(img, 0, 0, w, h);
    try {
      const imgData = tCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      const samplePoints = [
        0,
        Math.floor(w / 2) * 4,
        (w - 1) * 4,
        Math.floor(h / 2) * w * 4,
        (Math.floor(h / 2) * w + (w - 1)) * 4,
        (h - 1) * w * 4,
        ((h - 1) * w + Math.floor(w / 2)) * 4,
        ((h - 1) * w + (w - 1)) * 4
      ];
      let rSum = 0,
        gSum = 0,
        bSum = 0;
      samplePoints.forEach(idx => {
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
      });
      const bgR = rSum / samplePoints.length;
      const bgG = gSum / samplePoints.length;
      const bgB = bSum / samplePoints.length;

      const visited = new Uint8Array(w * h);
      const queue: number[] = [];

      for (let x = 0; x < w; x++) {
        queue.push(x);
        queue.push((h - 1) * w + x);
      }
      for (let y = 0; y < h; y++) {
        queue.push(y * w);
        queue.push(y * w + (w - 1));
      }

      while (queue.length > 0) {
        const pos = queue.pop()!;
        if (pos < 0 || pos >= w * h || visited[pos]) continue;
        visited[pos] = 1;
        const idx = pos * 4;
        const r = data[idx],
          g = data[idx + 1],
          b = data[idx + 2];
        const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        if (diff < 120 || (r > 230 && g > 230 && b > 230)) {
          data[idx + 3] = 0;
          const x = pos % w,
            y = Math.floor(pos / w);
          if (x > 0 && !visited[pos - 1]) queue.push(pos - 1);
          if (x < w - 1 && !visited[pos + 1]) queue.push(pos + 1);
          if (y > 0 && !visited[pos - w]) queue.push(pos - w);
          if (y < h - 1 && !visited[pos + w]) queue.push(pos + w);
        }
      }
      tCtx.putImageData(imgData, 0, 0);
    } catch {}
    return tempCanvas;
  };

  const createFixifiyBrandedImage = async (
    source: File,
    bgThemeId: string,
    cutoutBg: boolean,
    applyMarkaOnThisPhoto: boolean
  ): Promise<{ file: File; previewUrl: string } | null> => {
    return new Promise(resolve => {
      const img = new Image();
      const objectUrlToRevoke = URL.createObjectURL(source);
      img.src = objectUrlToRevoke;

      img.onload = () => {
        const W = 800,
          H = 800;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrlToRevoke);
          return resolve(null);
        }

        paintStudioBackground(ctx, W, H, bgThemeId);

        const maxProdW = W * 0.72;
        const maxProdH = applyMarkaOnThisPhoto ? H * 0.65 : H * 0.76;
        const scale = Math.min(maxProdW / (img.width || 500), maxProdH / (img.height || 500));
        const drawW = (img.width || 500) * scale;
        const drawH = (img.height || 500) * scale;
        const drawX = (W - drawW) / 2;
        const drawY = applyMarkaOnThisPhoto ? (H - 58 - drawH) / 2 + 16 : (H - drawH) / 2;

        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
        ctx.shadowBlur = 26;
        ctx.shadowOffsetY = 12;

        if (cutoutBg) {
          const cutoutCanvas = removeOuterBackgroundFromImage(img);
          ctx.drawImage(cutoutCanvas, drawX, drawY, drawW, drawH);
        } else {
          ctx.beginPath();
          ctx.roundRect(drawX, drawY, drawW, drawH, 22);
          ctx.clip();
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        }
        ctx.restore();

        if (applyMarkaOnThisPhoto) {
          ctx.save();
          const badgeW = 215,
            badgeH = 38,
            badgeX = W - badgeW - 18,
            badgeY = 16;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 19);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fbbf24';
          ctx.stroke();
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('✨ Fixifiy Original', badgeX + badgeW / 2, badgeY + badgeH / 2);
          ctx.restore();

          ctx.save();
          const barH = 64,
            barY = H - barH;
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, barY, W, barH);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(0, barY, W, 4);
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 22px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('FIXIFIY  (A Unit of Mahadev Enterprises)', W / 2, barY + 26);
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 13px "Segoe UI", sans-serif';
          ctx.fillText('✔ 100% Quality Checked  •  Fast Local Delivery', W / 2, barY + 49);
          ctx.restore();
        }

        URL.revokeObjectURL(objectUrlToRevoke);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        canvas.toBlob(
          blob => {
            if (!blob) return resolve(null);
            const brandedFile = new File([blob], `fixifiy-product-${Date.now()}.jpg`, { type: 'image/jpeg' });
            resolve({ file: brandedFile, previewUrl: dataUrl });
          },
          'image/jpeg',
          0.92
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrlToRevoke);
        resolve(null);
      };
    });
  };

  useEffect(() => {
    let active = true;
    const reprocessAll = async () => {
      if (rawSourceImages.length === 0) {
        setProcessedPreviews([]);
        setImageFiles([]);
        return;
      }
      const safeMarkaIdx = markaPhotoIndex < rawSourceImages.length ? markaPhotoIndex : 0;
      setIsProcessingStudio(true);
      const newFiles: File[] = [];
      const newPreviews: string[] = [];

      for (let i = 0; i < rawSourceImages.length; i++) {
        const shouldPutMarkaOnThisPhoto = enableFixifiyMarka && i === safeMarkaIdx;
        const res = await createFixifiyBrandedImage(
          rawSourceImages[i],
          selectedBgTheme,
          autoRemoveBg,
          shouldPutMarkaOnThisPhoto
        );
        if (res) {
          newFiles.push(res.file);
          newPreviews.push(res.previewUrl);
        }
      }
      if (active) {
        setImageFiles(newFiles);
        setProcessedPreviews(newPreviews);
        setIsProcessingStudio(false);
      }
    };
    reprocessAll();
    return () => {
      active = false;
    };
  }, [rawSourceImages, selectedBgTheme, autoRemoveBg, enableFixifiyMarka, markaPhotoIndex]);

  useEffect(() => {
    let active = true;
    const reprocessEdit = async () => {
      if (editRawSources.length === 0) {
        setEditProcessedPreviews([]);
        setEditImageFiles([]);
        return;
      }
      const safeEditIdx = editMarkaPhotoIndex < editRawSources.length ? editMarkaPhotoIndex : 0;
      setIsProcessingStudio(true);
      const newFiles: File[] = [];
      const newPreviews: string[] = [];

      for (let i = 0; i < editRawSources.length; i++) {
        const shouldPutMarka = enableFixifiyMarka && i === safeEditIdx;
        const res = await createFixifiyBrandedImage(
          editRawSources[i],
          selectedBgTheme,
          autoRemoveBg,
          shouldPutMarka
        );
        if (res) {
          newFiles.push(res.file);
          newPreviews.push(res.previewUrl);
        }
      }
      if (active) {
        setEditImageFiles(newFiles);
        setEditProcessedPreviews(newPreviews);
        setIsProcessingStudio(false);
      }
    };
    reprocessEdit();
    return () => {
      active = false;
    };
  }, [editRawSources, selectedBgTheme, autoRemoveBg, enableFixifiyMarka, editMarkaPhotoIndex]);

  // ==========================================================
  // 📋 CLEANED PRODUCTS & DEDUPLICATED CATEGORY SELECTOR
  // ==========================================================
  const mergedRawProducts = useMemo(() => {
    const map = new Map<string, any>();
    tempDummyProducts.forEach(item => {
      if (!deletedIdsSet.has(item.id)) map.set(String(item.id), item);
    });
    (products || []).forEach((p: any) => {
      if (!deletedIdsSet.has(p.id)) map.set(String(p.id), p);
    });
    return Array.from(map.values());
  }, [products, tempDummyProducts, deletedIdsSet]);

  const myShopProducts = mergedRawProducts.filter(
    (p: any) => safeShopId && String(p.shop_id) === safeShopId && !/Model-\d+/i.test(String(p.name || ''))
  );
  const myProductNames = new Set(myShopProducts.map((p: any) => String(p.name || '').toLowerCase()));

  const shopProducts = mergedRawProducts.filter((p: any) => {
    if (!safeShopId) return true;
    if (String(p.shop_id) === safeShopId) return true;
    if (!p.shop_id) {
      return !myProductNames.has(String(p.name || '').toLowerCase());
    }
    return false;
  });

  const cleanedProducts = shopProducts.map((p: any) => ({
    ...p,
    category: standardizeCategory(p.category)
  }));

  const uniqueDbCategories = Array.from(
    new Set(cleanedProducts.map((p: any) => p.category).filter(Boolean))
  ) as string[];

  const dropdownCategories = Array.from(
    new Set([...defaultCategories, ...customCategoriesList, ...uniqueDbCategories].map(standardizeCategory))
  );

  const [selectedInvCategory, setSelectedInvCategory] = useState('All Categories');

  const handleSelectTopCategory = (catVal: string) => {
    if (catVal === '__CREATE_NEW__') {
      setShowNewCatModal(true);
      return;
    }
    setSelectedInvCategory(catVal);
    if (catVal !== 'All Categories') {
      setCategory(catVal);
      if (isAdding) {
        setDescription(getCategoryTemplate(catVal, name));
      }
    }
  };

  const filteredProducts = cleanedProducts.filter((p: any) => {
    const matchesSearch = (p?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedInvCategory === 'All Categories' || p.category === standardizeCategory(selectedInvCategory);
    return matchesSearch && matchesCategory;
  });

  // Count how many dummy/0-stock items are currently in the list
  const totalDummyCountInList = useMemo(() => {
    return cleanedProducts.filter(p => isDummyOrDraftProduct(p)).length;
  }, [cleanedProducts]);

  // ==========================================================
  // ☁️ ADD / EDIT / 20 TEMPORARY DUMMY GENERATE
  // ==========================================================
  const uploadImageToSupabase = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch {
      return null;
    }
  };

  const addProduct = async () => {
    const rawCat = category === 'Custom' ? newCustomCategory.trim() : category;
    const finalCategory = standardizeCategory(rawCat);

    if (!hasVariants && (!name || !price || !stock || !finalCategory)) {
      return alert('Kripya sabhi details bharein!');
    }
    if (hasVariants && !name) return alert('Product ka naam likhein!');

    setIsUploading(true);
    let finalImageUrlString = '';

    if (imageFiles.length > 0) {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const url = await uploadImageToSupabase(imageFiles[i]);
        if (url) uploadedUrls.push(url);
      }
      finalImageUrlString = uploadedUrls.length > 0 ? uploadedUrls.join(',') : processedPreviews[0] || '';
    }

    if (category === 'Custom' && finalCategory) {
      const updatedCustom = Array.from(new Set([...customCategoriesList, finalCategory]));
      setCustomCategoriesList(updatedCustom);
      try {
        localStorage.setItem('fixifiy_custom_categories_v2', JSON.stringify(updatedCustom));
      } catch {}
    }

    const finalName = condition === 'Used' ? `${name} (Used)` : name;

    let finalUnit = unit;
    if (finalCategory.toLowerCase().includes('iron') || finalCategory.toLowerCase().includes('steel')) finalUnit = 'Kg';
    else if (finalCategory.toLowerCase().includes('cement')) finalUnit = 'Bag';

    let finalPrice = Number(price);
    let finalStock = Number(stock);
    let finalVariantsJSON = null;

    if (hasVariants) {
      const validVariants = variants.filter(v => v.name && v.price && v.stock);
      if (validVariants.length === 0) {
        setIsUploading(false);
        return alert('Kripya kam se kam ek Size/Variant theek se bharein!');
      }
      finalStock = validVariants.reduce((sum, v) => sum + Number(v.stock), 0);
      finalPrice = Math.min(...validVariants.map(v => Number(v.price)));
      finalVariantsJSON = validVariants;
    }

    const { error } = await supabase.from('products').insert([
      {
        shop_id: safeShopId || null,
        name: finalName,
        category: finalCategory,
        price: finalPrice,
        total_stock: finalStock,
        sold_quantity: 0,
        unit: finalUnit,
        image_url: finalImageUrlString,
        is_heavy: isHeavy,
        return_policy: returnPolicy,
        is_cod_available: isCodAvailable,
        variants: finalVariantsJSON,
        description: description.trim()
      }
    ]);

    if (error) alert('Error adding product: ' + error.message);

    setIsUploading(false);
    setIsAdding(false);
    fetchProducts();
    setName('');
    setPrice('');
    setStock('');
    setUnit('Pc');
    setReturnPolicy('No Return');
    setIsCodAvailable(true);
    setCondition('New');
    setNewCustomCategory('');
    setImageFiles([]);
    setRawSourceImages([]);
    setProcessedPreviews([]);
    setMarkaPhotoIndex(0);
    setIsHeavy(false);
    setHasVariants(false);
    setVariants([{ name: '', price: '', stock: '' }]);
    setDescription('');
  };

  const saveEditedProduct = async () => {
    const rawCat =
      editProduct.category === 'Custom' ? editProduct.new_custom_category?.trim() : editProduct.category;
    const finalEditCategory = standardizeCategory(rawCat);
    if (!editProduct.name || !finalEditCategory) return alert('Naam aur category zaroori hai!');

    let finalPrice = Number(editProduct.price);
    let finalStock = Number(editProduct.total_stock);
    let finalVariantsJSON = null;

    if (editProduct.hasVariants) {
      const validVariants = (editProduct.variants || []).filter((v: any) => v.name && v.price && v.stock);
      if (validVariants.length > 0) {
        finalStock = validVariants.reduce((sum: number, v: any) => sum + Number(v.stock), 0);
        finalPrice = Math.min(...validVariants.map((v: any) => Number(v.price)));
        finalVariantsJSON = validVariants;
      }
    }

    if (isDummyOrDraftProduct(editProduct) && finalStock <= 0) {
      return alert('⚠️ ग्राहक को दिखाने और अपने स्टॉक में पक्का सेव करने के लिए कृपया Total Stock में 1 या उससे ज्यादा संख्या डालें!');
    }

    setIsUploading(true);
    let finalImageUrlString = editProduct.image_url || '';

    if (editImageFiles.length > 0) {
      const newUploadedUrls: string[] = [];
      for (let i = 0; i < editImageFiles.length; i++) {
        const url = await uploadImageToSupabase(editImageFiles[i]);
        if (url) newUploadedUrls.push(url);
      }
      if (newUploadedUrls.length > 0) finalImageUrlString = newUploadedUrls.join(',');
    }

    const exactShopId = currentShop?.id ? Number(currentShop.id) : null;
    let finalUnit = editProduct.unit || 'Pc';
    if (finalEditCategory.toLowerCase().includes('iron') || finalEditCategory.toLowerCase().includes('steel')) finalUnit = 'Kg';
    else if (finalEditCategory.toLowerCase().includes('cement')) finalUnit = 'Bag';

    const finalReturnPolicy = editProduct.return_policy || 'No Return';
    const finalCodStatus = editProduct.is_cod_available !== false;
    const finalEditDescription = editProduct.description ? editProduct.description.trim() : '';

    if (!editProduct.shop_id) {
      // Update this dummy row directly with shop_id & stock so it becomes permanent Shop Stock
      const { error: updateErr } = await supabase
        .from('products')
        .update({
          shop_id: exactShopId,
          name: editProduct.name,
          category: finalEditCategory,
          price: finalPrice,
          total_stock: finalStock,
          unit: finalUnit,
          image_url: finalImageUrlString,
          is_heavy: editProduct.is_heavy,
          return_policy: finalReturnPolicy,
          is_cod_available: finalCodStatus,
          variants: finalVariantsJSON,
          description: finalEditDescription
        })
        .eq('id', editProduct.id);

      if (updateErr) {
        alert('Stock save error: ' + updateErr.message);
        setIsUploading(false);
        return;
      }

      // Remove this ID from temporary dummy auto-delete queue since shop owner updated it!
      const remainingIds = tempDummyIdsRef.current.filter(id => id !== editProduct.id);
      tempDummyIdsRef.current = remainingIds;
      setTempDummyProducts(prev => prev.filter(item => item.id !== editProduct.id));
      try {
        localStorage.setItem(dummyStorageKey, JSON.stringify(remainingIds));
      } catch {}

      alert('✅ प्रोडक्ट आपके नाम, फोटो और स्टॉक के साथ पक्का सेव हो गया! अब यह डिलीट नहीं होगा और ग्राहक को दिखेगा।');
    } else {
      const { error } = await supabase
        .from('products')
        .update({
          shop_id: exactShopId,
          name: editProduct.name,
          category: finalEditCategory,
          price: finalPrice,
          total_stock: finalStock,
          unit: finalUnit,
          image_url: finalImageUrlString,
          is_heavy: editProduct.is_heavy,
          return_policy: finalReturnPolicy,
          is_cod_available: finalCodStatus,
          variants: finalVariantsJSON,
          description: finalEditDescription
        })
        .eq('id', editProduct.id);

      if (error) alert('Error updating product: ' + error.message);
      else alert('✅ आपका स्टॉक सफलतापूर्वक अपडेट हो गया!');
    }

    setIsUploading(false);
    setEditProduct(null);
    setEditRawSources([]);
    setEditProcessedPreviews([]);
    setEditImageFiles([]);
    setEditMarkaPhotoIndex(0);
    if (typeof fetchProducts === 'function') await fetchProducts();
  };

  // ==========================================================
  // ⚡ GENERATE 20 DUMMY ITEMS (STRICTLY STOCK = 0 & SHOP_ID = NULL)
  // ==========================================================
  const generateBulkDemoProducts = async () => {
    const targetCategory = standardizeCategory(
      selectedInvCategory === 'All Categories' ? category || 'Motor Parts' : selectedInvCategory
    );

    if (
      !window.confirm(
        `क्या आप "${targetCategory}" कैटेगरी में 20 डमी आइटम (Stock: 0) जनरेट करना चाहते हैं?`
      )
    ) {
      return;
    }

    setIsBulkAdding(true);
    const baseNames = ['Pro', 'Max', 'Ultra', 'Lite', 'Plus', 'Premium', 'Standard', 'Gold', 'Heavy Duty', 'Original'];
    const isTargetHeavy = heavyCategoriesList.includes(targetCategory);

    let genUnit = 'Pc';
    if (targetCategory.toLowerCase().includes('iron') || targetCategory.toLowerCase().includes('steel')) genUnit = 'Kg';
    else if (targetCategory.toLowerCase().includes('cement')) genUnit = 'Bag';

    const fullDemoItems = [];
    const safeMinimalItems = [];

    for (let i = 0; i < 20; i++) {
      const randSuffix = Math.floor(100 + Math.random() * 900);
      const itemTitle = `${targetCategory.split(' ')[0]} ${baseNames[i % baseNames.length]} Model-${randSuffix}`;
      const randPrice = Math.floor(Math.random() * 3500) + 150;

      // STRICT: shop_id: null AND total_stock: 0
      fullDemoItems.push({
        shop_id: null,
        name: itemTitle,
        category: targetCategory,
        price: randPrice,
        total_stock: 0,
        sold_quantity: 0,
        unit: genUnit,
        image_url: '',
        is_heavy: isTargetHeavy,
        return_policy: 'No Return',
        is_cod_available: true,
        description: getCategoryTemplate(targetCategory, itemTitle)
      });

      safeMinimalItems.push({
        shop_id: null,
        name: itemTitle,
        category: targetCategory,
        price: randPrice,
        total_stock: 0,
        unit: genUnit,
        image_url: ''
      });
    }

    try {
      let insertedRows: any[] | null = null;
      const { data, error } = await supabase.from('products').insert(fullDemoItems).select();

      if (error) {
        const { data: retryData, error: retryError } = await supabase
          .from('products')
          .insert(safeMinimalItems)
          .select();
        if (retryError) throw retryError;
        insertedRows = retryData;
      } else {
        insertedRows = data;
      }

      if (insertedRows && insertedRows.length > 0) {
        const newIds = insertedRows.map((r: any) => r.id);
        const combinedIds = Array.from(new Set([...tempDummyIdsRef.current, ...newIds]));
        tempDummyIdsRef.current = combinedIds;
        try {
          localStorage.setItem(dummyStorageKey, JSON.stringify(combinedIds));
        } catch {}
        setTempDummyProducts(prev => [...insertedRows!, ...prev]);
      }

      setSelectedInvCategory(targetCategory);
      if (typeof fetchProducts === 'function') {
        await fetchProducts();
      }
      alert(`✅ "${targetCategory}" में 20 डमी आइटम (Stock = 0) आ गए हैं!`);
    } catch (err: any) {
      alert('❌ Auto Generate Error: ' + err.message);
    } finally {
      setIsBulkAdding(false);
    }
  };

  // Active Commission Info for Add Form
  const activeFormCat = standardizeCategory(category === 'Custom' ? newCustomCategory.trim() || 'Custom' : category);
  const activeComm = getCategoryCommission(activeFormCat);
  const priceNum = Math.max(0, parseFloat(price) || 0);
  const adminCut = Math.round(((priceNum * activeComm.percent) / 100) * 100) / 100;
  const shopNet = Math.max(0, Math.round((priceNum - adminCut) * 100) / 100);

  return (
    <div>
      {/* 🔍 FULL-SCREEN IMAGE ZOOM LIGHTBOX MODAL */}
      {zoomedImageModal && (
        <div
          onClick={() => setZoomedImageModal(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.92)',
            zIndex: 3000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#0f172a',
              border: '2px solid #38bdf8',
              borderRadius: '16px',
              padding: '16px',
              maxWidth: '620px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 15px 40px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ color: '#38bdf8', fontSize: '15px' }}>🔍 {zoomedImageModal.title}</strong>
              <button
                onClick={() => setZoomedImageModal(null)}
                style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ✖ बंद करें
              </button>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', overflow: 'hidden', maxHeight: '70vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src={zoomedImageModal.url}
                alt="Zoomed Product"
                style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setZoomedImageModal(null)}
                style={{ ...greenBtn, backgroundColor: '#475569', padding: '10px 20px' }}
              >
                वापस जाएं
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 📂 TOP BAR: CATEGORY SELECT + DUMMY ZERO/DELETE CONTROLS   */}
      {/* ========================================================== */}
      <div
        style={{
          backgroundColor: '#0f172a',
          border: '2px solid #38bdf8',
          borderRadius: '12px',
          padding: '14px',
          marginBottom: '15px'
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1.5, minWidth: '250px' }}>
            <label style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
              📂 किस कैटेगरी में प्रोडक्ट जोड़ना / देखना है चुनें (Select Category):
            </label>
            <select
              value={selectedInvCategory}
              onChange={e => handleSelectTopCategory(e.target.value)}
              style={{
                ...inputStyle,
                margin: 0,
                border: '2px solid #10b981',
                backgroundColor: '#1e293b',
                color: '#4ade80',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="All Categories">🌈 All Categories (सभी कैटेगरी दिखाएं)</option>
              {dropdownCategories.map(cat => {
                const cRate = getCategoryCommission(cat as string).percent;
                return (
                  <option key={cat as string} value={cat as string}>
                    📦 {cat as string} — (Admin Commission: {cRate}%)
                  </option>
                );
              })}
              <option value="__CREATE_NEW__" style={{ color: '#fbbf24', fontWeight: 'bold' }}>
                ➕ Create New Category (नई कैटेगरी बनाएं)
              </option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignSelf: 'flex-end' }}>
            <button
              onClick={() => {
                const targetCat = selectedInvCategory !== 'All Categories' ? selectedInvCategory : category;
                setCategory(targetCat);
                if (!isAdding && (!description || description.trim() === '')) {
                  setDescription(getCategoryTemplate(targetCat, name));
                }
                setIsAdding(!isAdding);
              }}
              style={{ ...greenBtn, padding: '11px 15px' }}
            >
              {isAdding
                ? '✖ Close Form'
                : `+ Add Product in ${selectedInvCategory === 'All Categories' ? category : selectedInvCategory}`}
            </button>

            <button
              onClick={() => setShowNewCatModal(!showNewCatModal)}
              style={{ ...greenBtn, backgroundColor: '#0284c7', padding: '11px 14px' }}
            >
              ➕ New Category
            </button>

            <button
              onClick={generateBulkDemoProducts}
              disabled={isBulkAdding || isBulkDeleting}
              style={{
                ...greenBtn,
                backgroundColor: '#8b5cf6',
                padding: '11px 14px',
                opacity: isBulkAdding || isBulkDeleting ? 0.6 : 1
              }}
            >
              {isBulkAdding
                ? '⏳ Generating...'
                : `⚡ Auto Generate 20 (Stock 0)`}
            </button>
          </div>
        </div>

        {/* 🧹 ALWAYS-VISIBLE DUMMY MANAGEMENT BAR (ZERO STOCK OR DELETE ALL DUMMIES) */}
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            backgroundColor: '#1e293b',
            borderRadius: '8px',
            border: '1px solid #f59e0b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '12.5px', color: '#fbbf24', fontWeight: 'bold' }}>
            🛠️ डमी / 0-Stock आइटम कंट्रोल ({totalDummyCountInList} Dummy Items मिले):
          </span>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isBulkDeleting}
              onClick={zeroOutAllDummyStock}
              style={{
                backgroundColor: '#f59e0b',
                color: '#0f172a',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '6px',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📉 सभी डमी का Stock 0 करें (Hide from Customer)
            </button>

            <button
              type="button"
              disabled={isBulkDeleting}
              onClick={() => deleteAllDummyProductsFromDb(false)}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '6px',
                fontWeight: '900',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {isBulkDeleting ? '⏳ डिलीट हो रहा है...' : `🗑️ सभी सेव हुए Dummy Products डिलीट करें (${totalDummyCountInList})`}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '10px' }}>
          <input
            placeholder="🔍 लिस्ट में किसी भी प्रोडक्ट का नाम खोजें..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, margin: 0 }}
          />
        </div>
      </div>

      {/* ➕ QUICK CREATE NEW CATEGORY MODAL */}
      {showNewCatModal && (
        <div
          style={{
            backgroundColor: '#0f172a',
            border: '2px solid #10b981',
            padding: '14px',
            borderRadius: '10px',
            marginBottom: '15px',
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <strong style={{ color: '#4ade80', fontSize: '13px' }}>➕ नई कैटेगरी का नाम लिखें:</strong>
          <input
            placeholder="E.g. Motor Parts, Tyre & Tube, Bakery, Sports..."
            value={quickNewCategoryName}
            onChange={e => setQuickNewCategoryName(e.target.value)}
            style={{ ...inputStyle, margin: 0, flex: 1, minWidth: '200px' }}
          />
          <button onClick={handleCreateQuickCategory} style={greenBtn}>
            ✅ Save Category
          </button>
          <button onClick={() => setShowNewCatModal(false)} style={{ ...greenBtn, backgroundColor: '#475569' }}>
            Cancel
          </button>
        </div>
      )}

      {/* ========================================================== */}
      {/* 🔥 ADD PRODUCT FORM (MANUAL UPLOAD + BG CHANGER STUDIO) 🔥 */}
      {/* ========================================================== */}
      {isAdding && (
        <div
          style={{
            marginTop: '15px',
            border: '2px solid #38bdf8',
            padding: '20px',
            borderRadius: '12px',
            backgroundColor: '#0f172a',
            marginBottom: '20px'
          }}
        >
          <h3 style={{ color: '#38bdf8', marginTop: 0 }}>
            📦 Add Inventory Item in <span style={{ color: '#4ade80' }}>[{category}]</span>
          </h3>

          {/* 1️⃣ PRODUCT NAME WITH WORKING GOOGLE/WEB SEARCH SUGGESTIONS */}
          <div style={{ position: 'relative' }}>
            <label style={{ color: '#fbbf24', fontSize: '12.5px', fontWeight: 'bold' }}>
              1️⃣ Product Name Search (1-2 अक्षर लिखें जैसे "Rea", "Sam", "HP", "Spl" — Google/Web से नाम आएंगे):
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 2, minWidth: '240px', position: 'relative' }}>
                <input
                  placeholder="E.g. Realme 12 Pro, HP 15s Laptop, Splendor Clutch Plate..."
                  onChange={e => {
                    const val = e.target.value;
                    setName(val);
                    setShowSuggestionsDropdown(true);
                    runWebProductNameSearch(val, category, false);
                  }}
                  onFocus={() => {
                    if (name.trim().length >= 1) {
                      setShowSuggestionsDropdown(true);
                      runWebProductNameSearch(name, category, false);
                    }
                  }}
                  value={name}
                  style={{ ...inputStyle, margin: '6px 0', border: '2px solid #38bdf8', fontWeight: 'bold' }}
                />

                {showSuggestionsDropdown && (nameSuggestions.length > 0 || isSearchingNames) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#1e293b',
                      border: '2px solid #38bdf8',
                      borderRadius: '10px',
                      zIndex: 999,
                      maxHeight: '260px',
                      overflowY: 'auto',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.85)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: '#0f172a',
                        borderBottom: '1px solid #334155',
                        fontSize: '11.5px',
                        color: '#38bdf8',
                        fontWeight: 'bold'
                      }}
                    >
                      <span>🌐 Google / Web Search Suggestions (किसी भी नाम पर क्लिक करें):</span>
                      <button
                        type="button"
                        onClick={() => setShowSuggestionsDropdown(false)}
                        style={{ background: '#ef4444', border: 'none', color: 'white', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ✖ बंद करें
                      </button>
                    </div>
                    {isSearchingNames && (
                      <div style={{ padding: '8px 12px', fontSize: '12px', color: '#fbbf24' }}>
                        ⏳ वेब से मिलते-जुलते प्रोडक्ट खोजे जा रहे हैं...
                      </div>
                    )}
                    {nameSuggestions.map((sug, i) => (
                      <div
                        key={i}
                        onMouseDown={e => {
                          e.preventDefault();
                          setName(sug);
                          setShowSuggestionsDropdown(false);
                          searchWebForProductDescription(sug, category, false);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid #334155',
                          cursor: 'pointer',
                          fontSize: '13.5px',
                          color: '#ffffff',
                          fontWeight: 'bold',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>🔍 {sug}</span>
                        <span style={{ fontSize: '11px', color: '#4ade80', background: '#064e3b', padding: '2px 8px', borderRadius: '4px' }}>
                          + नाम व Specs चुनें
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isSearchingWebDesc}
                onClick={() => searchWebForProductDescription(name, category, false)}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
                  color: '#0f172a',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  fontWeight: '900',
                  cursor: 'pointer'
                }}
              >
                {isSearchingWebDesc ? '⏳ Searching...' : '🤖 Auto Search Product Specs'}
              </button>

              <select
                onChange={e => setCondition(e.target.value)}
                value={condition}
                style={{ ...inputStyle, flex: 0.8, minWidth: '140px' }}
              >
                <option value="New">✨ Brand New</option>
                <option value="Used">♻️ Second Hand</option>
              </select>
            </div>
          </div>

          {/* CATEGORY SELECTOR IN FORM */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
            <select
              onChange={e => {
                const newCat = e.target.value;
                setCategory(newCat);
                if (newCat !== 'Custom') {
                  setSelectedInvCategory(newCat);
                  setDescription(getCategoryTemplate(newCat, name));
                }
              }}
              value={category}
              style={{ ...inputStyle, flex: 1, minWidth: '220px', border: '1px solid #10b981', fontWeight: 'bold' }}
            >
              {dropdownCategories.map(c => {
                const commInfo = getCategoryCommission(c as string);
                return (
                  <option key={c as string} value={c as string}>
                    {c as string} — (Admin Commission: {commInfo.percent}%)
                  </option>
                );
              })}
              <option value="Custom" style={{ fontWeight: 'bold', color: '#10b981' }}>
                + Create New Category (20% Commission)
              </option>
            </select>

            {category === 'Custom' && (
              <input
                placeholder="Enter new category name..."
                value={newCustomCategory}
                onChange={e => setNewCustomCategory(e.target.value)}
                style={{ ...inputStyle, flex: 1, border: '1px solid #10b981', minWidth: '200px' }}
              />
            )}

            <div
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid #f59e0b',
                padding: '10px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#fbbf24'
              }}
            >
              💼 {activeFormCat} Commission: <strong>{activeComm.percent}%</strong>{' '}
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                {activeComm.isFromDb ? '(Supabase)' : '(Default 20%)'}
              </span>
            </div>
          </div>

          {/* 2️⃣ PRODUCT DESCRIPTION SEARCH + FORMAT + CAMERA OCR */}
          <div
            style={{
              marginTop: '15px',
              padding: '15px',
              backgroundColor: '#1e293b',
              borderRadius: '10px',
              border: '2px solid #0284c7'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <label style={{ color: '#38bdf8', fontSize: '13.5px', fontWeight: '900' }}>
                2️⃣ 📋 Product Description Search & Format (RAM/ROM, CPU, Model - एडिट करें):
              </label>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={isSearchingWebDesc}
                  onClick={() => searchWebForProductDescription(name || category, category, false)}
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: 'white',
                    border: '1px solid #60a5fa',
                    padding: '8px 13px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '900'
                  }}
                >
                  {isSearchingWebDesc ? '⏳ Searching Web...' : '🌐 Web से Description खोजें (Search Description)'}
                </button>

                <button
                  type="button"
                  onClick={() => applyAutoTemplate(false)}
                  style={{
                    background: '#0284c7',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                >
                  ⚡ Format Template ({category})
                </button>

                <label
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    padding: '8px 13px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '900',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  📸 {isScanningLabel ? 'स्कैन हो रहा है...' : 'कैमरा से बॉक्स स्कैन करें'}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    value=""
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        handleScanProductDetailsFromCamera(e.target.files[0], false);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {isScanningLabel && (
              <div
                style={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #38bdf8',
                  color: '#4ade80',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginBottom: '8px'
                }}
              >
                ⏳ {scanStatusText}
              </div>
            )}

            <textarea
              rows={7}
              placeholder={`• Model Name: \n• RAM / ROM: \n• Camera: \n• Battery: \n• Processor & Display: \n• In The Box: Handset, Charger, Cable\n• Warranty: 1 Year Manufacturer Warranty`}
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'inherit', lineHeight: '1.6', resize: 'vertical' }}
            />
          </div>

          {/* 3️⃣ MANUAL PHOTO UPLOAD + MARKA TICK BOX + 1-OF-4 SELECTOR */}
          <div
            style={{
              marginTop: '16px',
              border: '2px solid #f59e0b',
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: '#1e293b'
            }}
          >
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#fbbf24', fontSize: '15px' }}>
                3️⃣ 📸 Upload Product Photo & Background / Fixifiy Marka Studio
              </h4>
              <span style={{ fontSize: '11.5px', color: '#cbd5e1' }}>
                अपने मोबाइल कैमरे या गैलरी से फोटो अपलोड करें (अधिकतम 4 फोटो)। आप चुन सकते हैं कि Fixifiy का मार्का लगाना है या नहीं, और 4 में से किस 1 फोटो पर लगाना है!
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <label
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontWeight: '900',
                  fontSize: '13px',
                  border: '1px solid #60a5fa'
                }}
              >
                📸 मोबाइल कैमरा से फोटो खींचें (Max 4)
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  value=""
                  onChange={e => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      setRawSourceImages(prev => [...prev, ...newFiles].slice(0, 4));
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </label>

              <label
                style={{
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontWeight: '900',
                  fontSize: '13px',
                  border: '1px solid #34d399'
                }}
              >
                🖼️ गैलरी से फोटो अपलोड करें (Max 4 Photos)
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  value=""
                  onChange={e => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      setRawSourceImages(prev => [...prev, ...newFiles].slice(0, 4));
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '10px', border: '2px solid #38bdf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <span style={{ color: '#38bdf8', fontWeight: '900', fontSize: '13.5px' }}>
                  🎨 बैकग्राउंड और Fixifiy मार्का सेटिंग (Select Background & Marka):
                </span>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <label
                    style={{
                      background: enableFixifiyMarka ? '#78350f' : '#1e293b',
                      border: enableFixifiyMarka ? '2px solid #f59e0b' : '1px solid #475569',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: enableFixifiyMarka ? '#fbbf24' : '#94a3b8',
                      fontWeight: '900',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={enableFixifiyMarka}
                      onChange={e => setEnableFixifiyMarka(e.target.checked)}
                      style={{ transform: 'scale(1.25)', accentColor: '#f59e0b' }}
                    />
                    🏷️ Fixifiy का मार्का (Label) लगाएं (4 में से सिर्फ 1 फोटो पर)
                  </label>

                  <label
                    style={{
                      background: autoRemoveBg ? '#065f46' : '#1e293b',
                      border: '1px solid #10b981',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#4ade80',
                      fontWeight: '900',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={autoRemoveBg}
                      onChange={e => setAutoRemoveBg(e.target.checked)}
                      style={{ transform: 'scale(1.2)', accentColor: '#10b981' }}
                    />
                    ✂️ पुराना बैकग्राउंड हटाएं (Auto Cutout)
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                {STUDIO_BACKGROUNDS.map(bg => {
                  const isSel = selectedBgTheme === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => setSelectedBgTheme(bg.id)}
                      style={{
                        background: bg.previewBg,
                        color: '#0f172a',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isSel ? '3px solid #2563eb' : `1px solid ${bg.borderColor}`,
                        fontWeight: '900',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: isSel ? '0 0 12px rgba(56, 189, 248, 0.7)' : 'none'
                      }}
                    >
                      <span>{bg.label}</span>
                      {isSel && (
                        <span style={{ background: '#2563eb', color: 'white', padding: '2px 6px', borderRadius: '50%', fontSize: '10px' }}>
                          ✔
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isProcessingStudio && (
                <div style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                  ⏳ फोटो तैयार की जा रही है...
                </div>
              )}

              {processedPreviews.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12.5px', color: '#4ade80', fontWeight: '900' }}>
                      ✅ तैयार फोटो ({processedPreviews.length}/4) —{' '}
                      {enableFixifiyMarka
                        ? `फोटो #${(markaPhotoIndex < processedPreviews.length ? markaPhotoIndex : 0) + 1} पर Fixifiy मार्का लगा है:`
                        : 'बिना Fixifiy मार्का के (No Label):'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRawSourceImages([]);
                        setProcessedPreviews([]);
                        setImageFiles([]);
                        setMarkaPhotoIndex(0);
                      }}
                      style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      🗑️ सभी फोटो हटाएं
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    {processedPreviews.map((url, idx) => {
                      const safeActiveIdx = markaPhotoIndex < processedPreviews.length ? markaPhotoIndex : 0;
                      const hasMarkaOnThis = enableFixifiyMarka && idx === safeActiveIdx;
                      return (
                        <div
                          key={idx}
                          style={{
                            width: '160px',
                            borderRadius: '10px',
                            border: hasMarkaOnThis ? '3px solid #f59e0b' : '2px solid #4ade80',
                            overflow: 'hidden',
                            background: '#1e293b',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
                          }}
                        >
                          <div style={{ position: 'relative', width: '160px', height: '145px' }}>
                            <img
                              src={url}
                              alt="Branded Preview"
                              onClick={() =>
                                setZoomedImageModal({
                                  url,
                                  title: `Product Photo #${idx + 1}`
                                })
                              }
                              style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setRawSourceImages(prev => prev.filter((_, i) => i !== idx));
                                if (markaPhotoIndex === idx) setMarkaPhotoIndex(0);
                              }}
                              style={{
                                position: 'absolute',
                                top: '4px',
                                left: '4px',
                                background: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '22px',
                                height: '22px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              ✖
                            </button>
                            <span
                              onClick={() =>
                                setZoomedImageModal({
                                  url,
                                  title: `Product Photo #${idx + 1}`
                                })
                              }
                              style={{
                                position: 'absolute',
                                bottom: '4px',
                                right: '4px',
                                background: 'rgba(15,23,42,0.85)',
                                color: '#fbbf24',
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                cursor: 'zoom-in'
                              }}
                            >
                              🔍 Zoom
                            </span>
                          </div>

                          {enableFixifiyMarka && (
                            <button
                              type="button"
                              onClick={() => setMarkaPhotoIndex(idx)}
                              style={{
                                width: '100%',
                                border: 'none',
                                padding: '6px 4px',
                                background: hasMarkaOnThis ? '#f59e0b' : '#334155',
                                color: hasMarkaOnThis ? '#0f172a' : '#e2e8f0',
                                fontSize: '11px',
                                fontWeight: '900',
                                cursor: 'pointer'
                              }}
                            >
                              {hasMarkaOnThis ? '🏷️ ✔ इस पर मार्का लगा है' : '🏷️ इस फोटो पर मार्का लगाएं'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '14px', color: '#94a3b8', fontSize: '12px', border: '1px dashed #475569', borderRadius: '8px' }}>
                  📷 ऊपर <strong>"मोबाइल कैमरा"</strong> या <strong>"गैलरी से फोटो अपलोड करें"</strong> पर क्लिक करके फोटो चुनें!
                </div>
              )}
            </div>
          </div>

          {/* MULTIPLE SIZES TOGGLE */}
          <div
            style={{
              marginTop: '15px',
              marginBottom: '10px',
              padding: '12px',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #334155'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38bdf8', fontWeight: 'bold', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasVariants}
                onChange={e => setHasVariants(e.target.checked)}
                style={{ transform: 'scale(1.3)', accentColor: '#38bdf8' }}
              />
              👕 Is Product ke Alag-Alag Sizes/Variants hain? (e.g. M, L, XL, 8GB/128GB)
            </label>
          </div>

          {hasVariants ? (
            <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px dashed #38bdf8' }}>
              <h4 style={{ color: '#e2e8f0', marginTop: 0 }}>Define Sizes & Prices</h4>
              {variants.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <input
                    placeholder="Size (XL, 8GB/128GB, 10mm)"
                    value={v.name}
                    onChange={e => {
                      const newV = [...variants];
                      newV[i].name = e.target.value;
                      setVariants(newV);
                    }}
                    style={{ ...inputStyle, flex: 2, margin: 0 }}
                  />
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    value={v.price}
                    onChange={e => {
                      const newV = [...variants];
                      newV[i].price = e.target.value;
                      setVariants(newV);
                    }}
                    style={{ ...inputStyle, flex: 1, margin: 0 }}
                  />
                  <input
                    type="number"
                    placeholder="Stock"
                    value={v.stock}
                    onChange={e => {
                      const newV = [...variants];
                      newV[i].stock = e.target.value;
                      setVariants(newV);
                    }}
                    style={{ ...inputStyle, flex: 1, margin: 0 }}
                  />
                  <button
                    onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
                    style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer' }}
                  >
                    ✖
                  </button>
                </div>
              ))}
              <button
                onClick={() => setVariants([...variants, { name: '', price: '', stock: '' }])}
                style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}
              >
                + Add More Size
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                <input
                  type="number"
                  placeholder="Single Price (₹)"
                  onChange={e => setPrice(e.target.value)}
                  value={price}
                  style={{ ...inputStyle, flex: 1, minWidth: '120px' }}
                />

                {category.toLowerCase().includes('iron') || category.toLowerCase().includes('steel') ? (
                  <div style={{ ...inputStyle, flex: 1, minWidth: '80px', display: 'flex', alignItems: 'center', backgroundColor: '#334155', color: '#facc15', border: '1px solid #facc15', fontWeight: 'bold' }}>
                    Kg
                  </div>
                ) : category.toLowerCase().includes('cement') ? (
                  <div style={{ ...inputStyle, flex: 1, minWidth: '80px', display: 'flex', alignItems: 'center', backgroundColor: '#334155', color: '#facc15', border: '1px solid #facc15', fontWeight: 'bold' }}>
                    Bag
                  </div>
                ) : (
                  <select onChange={e => setUnit(e.target.value)} value={unit} style={{ ...inputStyle, flex: 1, minWidth: '80px' }}>
                    <option value="Pc">Pc</option>
                    <option value="Bag">Bag</option>
                    <option value="Box">Box</option>
                    <option value="Mtr">Mtr</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Kg">Kg</option>
                  </select>
                )}

                <input
                  type="number"
                  placeholder="Total Stock Qty"
                  onChange={e => setStock(e.target.value)}
                  value={stock}
                  style={{ ...inputStyle, flex: 1, minWidth: '120px' }}
                />
              </div>

              {priceNum > 0 && (
                <div
                  style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #10b981',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginTop: '6px',
                    fontSize: '13px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <span>🏷️ Selling Price: <strong>₹{priceNum}</strong></span>
                  <span style={{ color: '#f87171' }}>📉 Admin Commission ({activeComm.percent}%): <strong>-₹{adminCut}</strong></span>
                  <span style={{ color: '#4ade80' }}>🏦 Shop Owner Net Earning: <strong>₹{shopNet}</strong></span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>Return Policy</label>
              <select onChange={e => setReturnPolicy(e.target.value)} value={returnPolicy} style={{ ...inputStyle, border: '1px solid #3b82f6' }}>
                <option value="No Return">🚫 No Return</option>
                <option value="24 Hours Return">⏱️ 24 Hours Return</option>
                <option value="7 Days Return">📅 7 Days Return</option>
              </select>
            </div>
            <div style={{ flex: 2, minWidth: '220px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold' }}>Payment Mode</label>
              <div style={{ display: 'flex', gap: '15px', marginTop: '10px', backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
                <label style={{ cursor: 'pointer', color: isCodAvailable ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
                  <input type="radio" checked={isCodAvailable} onChange={() => setIsCodAvailable(true)} style={{ accentColor: '#10b981' }} /> 💵 COD
                </label>
                <label style={{ cursor: 'pointer', color: !isCodAvailable ? '#38bdf8' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
                  <input type="radio" checked={!isCodAvailable} onChange={() => setIsCodAvailable(false)} style={{ accentColor: '#38bdf8' }} /> 💳 Online Only
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: isHeavy ? 'rgba(245, 158, 11, 0.1)' : '#1e293b', border: `1px solid ${isHeavy ? '#f59e0b' : '#334155'}`, borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: isHeavy ? '#fbbf24' : '#cbd5e1', fontWeight: 'bold' }}>
              <input type="checkbox" checked={isHeavy} onChange={e => setIsHeavy(e.target.checked)} style={{ transform: 'scale(1.3)', accentColor: '#f59e0b' }} />
              🚛 High Weight / Heavy Item
            </label>
          </div>

          <button
            onClick={addProduct}
            disabled={isUploading}
            style={{ ...greenBtn, width: '100%', marginTop: '20px', padding: '14px', fontSize: '15px', opacity: isUploading ? 0.5 : 1 }}
          >
            {isUploading ? '⏳ Uploading...' : '💾 Save Product'}
          </button>
        </div>
      )}

      {/* ========================================================== */}
      {/* 🔥 EDIT / ADD STOCK POPUP (WITH MARKA TOGGLE & 1-OF-4) 🔥   */}
      {/* ========================================================== */}
      {editProduct && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            style={{
              backgroundColor: '#0f172a',
              padding: '22px',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '580px',
              border: '2px solid #38bdf8',
              maxHeight: '92vh',
              overflowY: 'auto'
            }}
          >
            <h3 style={{ color: '#10b981', marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
              {editProduct.shop_id ? '✏️ Edit Stock / Photo & Description Studio' : '📥 नाम, फोटो व स्टॉक डालकर पक्का सेव करें (Add to My Shop Stock)'}
            </h3>

            <label style={{ color: '#94a3b8', fontSize: '12px' }}>Product Name (Web Search Enabled)</label>
            <div style={{ position: 'relative' }}>
              <input
                value={editProduct.name}
                onChange={e => {
                  const val = e.target.value;
                  setEditProduct({ ...editProduct, name: val });
                  setEditShowSuggestions(true);
                  runWebProductNameSearch(val, editProduct.category, true);
                }}
                onFocus={() => {
                  if ((editProduct.name || '').trim().length >= 1) {
                    setEditShowSuggestions(true);
                    runWebProductNameSearch(editProduct.name, editProduct.category, true);
                  }
                }}
                style={inputStyle}
                placeholder="Product Name"
              />
              {editShowSuggestions && editNameSuggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#1e293b',
                    border: '2px solid #38bdf8',
                    borderRadius: '8px',
                    zIndex: 1200,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#0f172a', fontSize: '11px', color: '#38bdf8' }}>
                    <span>🌐 Matching Product Names:</span>
                    <button type="button" onClick={() => setEditShowSuggestions(false)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✖</button>
                  </div>
                  {editNameSuggestions.map((s, idx) => (
                    <div
                      key={idx}
                      onMouseDown={e => {
                        e.preventDefault();
                        setEditProduct({
                          ...editProduct,
                          name: s,
                          description: getCategoryTemplate(editProduct.category, s)
                        });
                        setEditShowSuggestions(false);
                      }}
                      style={{ padding: '8px 10px', borderBottom: '1px solid #334155', cursor: 'pointer', fontSize: '12.5px', color: 'white', fontWeight: 'bold' }}
                    >
                      🔍 {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label style={{ color: '#94a3b8', fontSize: '12px', marginTop: '10px', display: 'block' }}>Category</label>
            <select
              value={standardizeCategory(editProduct.category)}
              onChange={e => setEditProduct({ ...editProduct, category: e.target.value })}
              style={inputStyle}
            >
              {dropdownCategories.map(c => {
                const ci = getCategoryCommission(c as string);
                return (
                  <option key={c as string} value={c as string}>
                    {c as string} ({ci.percent}% Commission)
                  </option>
                );
              })}
            </select>

            <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                <label style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 'bold' }}>
                  📋 Product Details (Search Web / Format / Camera Scan):
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => searchWebForProductDescription(editProduct.name, editProduct.category, true)}
                    style={{ background: '#2563eb', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                  >
                    🌐 Search Web Description
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAutoTemplate(true)}
                    style={{ background: '#0284c7', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                  >
                    ⚡ Fill Format
                  </button>
                  <label
                    style={{
                      background: '#10b981',
                      color: 'white',
                      padding: '5px 9px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    📸 कैमरा स्कैन
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      value=""
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          handleScanProductDetailsFromCamera(e.target.files[0], true);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>
              <textarea
                rows={5}
                value={editProduct.description || ''}
                onChange={e => setEditProduct({ ...editProduct, description: e.target.value })}
                style={{ ...inputStyle, fontFamily: 'inherit', lineHeight: '1.5', margin: 0, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: '#94a3b8', fontSize: '12px' }}>Price (₹)</label>
                <input
                  type="number"
                  value={editProduct.price}
                  onChange={e => setEditProduct({ ...editProduct, price: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}>Total Stock (1+ डालने पर ग्राहक को दिखेगा)</label>
                <input
                  type="number"
                  value={editProduct.total_stock}
                  onChange={e => setEditProduct({ ...editProduct, total_stock: e.target.value })}
                  style={{ ...inputStyle, border: '2px solid #10b981', fontWeight: 'bold' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '14px', border: '1px solid #f59e0b', padding: '12px', borderRadius: '8px', backgroundColor: '#1e293b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 'bold' }}>
                  📸 नई फोटो अपलोड करें व बैकग्राउंड / मार्का चुनें:
                </span>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '11.5px', color: '#fbbf24', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={enableFixifiyMarka}
                      onChange={e => setEnableFixifiyMarka(e.target.checked)}
                    />{' '}
                    🏷️ Fixifiy मार्का लगाएं (सिर्फ 1 फोटो पर)
                  </label>
                  <label style={{ fontSize: '11.5px', color: '#4ade80', fontWeight: 'bold', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={autoRemoveBg}
                      onChange={e => setAutoRemoveBg(e.target.checked)}
                    />{' '}
                    ✂️ Auto Cutout
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                {STUDIO_BACKGROUNDS.map(bg => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setSelectedBgTheme(bg.id)}
                    style={{
                      background: bg.previewBg,
                      color: '#0f172a',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: selectedBgTheme === bg.id ? '2px solid #2563eb' : '1px solid #94a3b8',
                      fontSize: '10.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ flex: 1, backgroundColor: '#3b82f6', color: 'white', padding: '9px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                  📸 Camera Upload
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={e => {
                      if (e.target.files) setEditRawSources(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 4));
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
                <label style={{ flex: 1, backgroundColor: '#6366f1', color: 'white', padding: '9px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                  🖼️ Gallery Upload
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={e => {
                      if (e.target.files) setEditRawSources(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 4));
                    }}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {editProcessedPreviews.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px', overflowX: 'auto' }}>
                  {editProcessedPreviews.map((u, i) => {
                    const safeEditIdx = editMarkaPhotoIndex < editProcessedPreviews.length ? editMarkaPhotoIndex : 0;
                    const isMarked = enableFixifiyMarka && i === safeEditIdx;
                    return (
                      <div key={i} style={{ minWidth: '110px', textAlign: 'center', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', border: isMarked ? '2px solid #f59e0b' : '1px solid #4ade80' }}>
                        <img
                          src={u}
                          alt="Preview"
                          onClick={() => setZoomedImageModal({ url: u, title: editProduct.name })}
                          style={{ width: '110px', height: '95px', objectFit: 'cover', cursor: 'zoom-in', display: 'block' }}
                        />
                        {enableFixifiyMarka && (
                          <button
                            type="button"
                            onClick={() => setEditMarkaPhotoIndex(i)}
                            style={{
                              width: '100%',
                              border: 'none',
                              padding: '4px',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              background: isMarked ? '#f59e0b' : '#334155',
                              color: isMarked ? '#0f172a' : 'white',
                              cursor: 'pointer'
                            }}
                          >
                            {isMarked ? '🏷️ ✔ मार्का लगा है' : '🏷️ इस पर लगाएं'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button
                onClick={() => {
                  setEditProduct(null);
                  setEditRawSources([]);
                  setEditProcessedPreviews([]);
                  setEditImageFiles([]);
                  setEditMarkaPhotoIndex(0);
                }}
                style={{ ...editBtn, flex: 1, backgroundColor: '#475569' }}
              >
                Cancel
              </button>
              <button
                onClick={saveEditedProduct}
                disabled={isUploading}
                style={{ ...greenBtn, flex: 2, opacity: isUploading ? 0.7 : 1 }}
              >
                {isUploading ? 'Saving...' : '💾 Save & Update to My Shop Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 🔥 PRODUCT LIST DISPLAY (WITH DIRECT DELETE BUTTON) 🔥      */}
      {/* ========================================================== */}
      <div>
        {filteredProducts.map((p: any) => {
          const isDummyItem = isDummyOrDraftProduct(p);
          const isOwnedByShop = Boolean(p.shop_id) && String(p.shop_id) === safeShopId;
          const hasStock = isOwnedByShop && Number(p.total_stock) > 0 && !/Model-\d+/i.test(String(p.name || ''));
          const itemUnit = p.unit || 'Pc';
          const parsedVariants = p.variants
            ? typeof p.variants === 'string'
              ? JSON.parse(p.variants)
              : p.variants
            : [];
          const isMultiSize = parsedVariants && parsedVariants.length > 0;
          const commRate = getCategoryCommission(p.category).percent;
          const firstImg = p.image_url ? p.image_url.split(',')[0] : '';

          return (
            <div key={p.id} style={{ ...cardStyle, borderLeft: hasStock ? '4px solid #10b981' : '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div
                  onClick={() => {
                    if (firstImg) setZoomedImageModal({ url: firstImg, title: p.name });
                  }}
                  title="फोटो बड़ा देखने के लिए क्लिक करें"
                  style={{
                    width: '62px',
                    height: '62px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#334155',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: firstImg ? 'zoom-in' : 'default',
                    position: 'relative',
                    border: '1px solid #38bdf8'
                  }}
                >
                  {firstImg ? (
                    <img src={firstImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={p.name} />
                  ) : (
                    <span style={{ fontSize: '24px' }}>📦</span>
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#38bdf8', fontSize: '15px' }}>
                      {p.name} {p.is_heavy && <span title="Heavy Delivery Item" style={{ fontSize: '14px' }}>🚛</span>}
                    </strong>
                    {hasStock ? (
                      <span style={{ background: '#065f46', color: '#4ade80', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 'bold' }}>
                        ✔ ग्राहक को दिख रहा है (In Stock)
                      </span>
                    ) : (
                      <span style={{ background: '#78350f', color: '#fbbf24', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', fontWeight: 'bold' }}>
                        🔒 डमी / 0-Stock (ग्राहक को नहीं दिखेगा)
                      </span>
                    )}
                  </div>

                  <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                    {p.category} <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>({commRate}% Comm)</span> |{' '}
                    <span style={{ color: p.return_policy === 'No Return' ? '#ef4444' : '#10b981' }}>
                      {p.return_policy || 'No Return'}
                    </span>{' '}
                    |
                    <span style={{ color: p.is_cod_available === false ? '#38bdf8' : '#10b981', fontWeight: 'bold' }}>
                      {p.is_cod_available === false ? ' 💳 Online Only' : ' 💵 COD'}
                    </span>
                  </div>

                  {isMultiSize && (
                    <div style={{ color: '#facc15', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                      📏 Sizes: {parsedVariants.map((v: any) => v.name).join(', ')}
                    </div>
                  )}

                  {p.description && (
                    <div
                      style={{
                        color: '#64748b',
                        fontSize: '11px',
                        marginTop: '3px',
                        fontStyle: 'italic',
                        maxWidth: '350px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      📝 {p.description}
                    </div>
                  )}

                  <div style={{ color: '#e2e8f0', fontWeight: 'bold', marginTop: '4px', fontSize: '13px' }}>
                    {isMultiSize ? 'Starts from ' : ''}₹{p.price} <span style={{ color: '#facc15' }}>/ {itemUnit}</span> | Stock:{' '}
                    <span style={{ color: hasStock ? '#4ade80' : '#f87171' }}>{isDummyItem && !hasStock ? 0 : p.total_stock || 0}</span>
                  </div>
                </div>
              </div>

              {/* EDIT / ADD STOCK + DIRECT DELETE BUTTON ON EVERY ROW */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const cleanCat = standardizeCategory(p.category);
                    setEditProduct({
                      ...p,
                      category: cleanCat,
                      total_stock: hasStock ? p.total_stock : 0,
                      hasVariants: isMultiSize,
                      variants: isMultiSize ? parsedVariants : [],
                      description: p.description || getCategoryTemplate(cleanCat, p.name)
                    });
                    setEditRawSources([]);
                    setEditProcessedPreviews([]);
                    setEditImageFiles([]);
                    setEditMarkaPhotoIndex(0);
                  }}
                  style={{ ...editBtn, backgroundColor: hasStock ? '#3b82f6' : '#10b981', padding: '10px 14px' }}
                >
                  {hasStock ? '✏️ Edit Stock' : '➕ Add to Stock'}
                </button>

                <button
                  onClick={() => deleteSingleProduct(p)}
                  style={{ ...editBtn, backgroundColor: '#ef4444', padding: '10px 12px' }}
                  title="इस प्रोडक्ट को डिलीट करें"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '12px',
  margin: '8px 0',
  borderRadius: '6px',
  border: '1px solid #334155',
  backgroundColor: '#1e293b',
  color: 'white',
  fontSize: '14px',
  boxSizing: 'border-box'
};
const greenBtn: React.CSSProperties = {
  padding: '10px 15px',
  backgroundColor: '#10b981',
  border: 'none',
  borderRadius: '6px',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: '0.2s'
};
const editBtn: React.CSSProperties = {
  border: 'none',
  borderRadius: '6px',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '13px'
};
const cardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '15px',
  borderBottom: '1px solid #334155',
  backgroundColor: '#0f172a',
  margin: '10px 0',
  borderRadius: '12px',
  flexWrap: 'wrap',
  gap: '10px'
};