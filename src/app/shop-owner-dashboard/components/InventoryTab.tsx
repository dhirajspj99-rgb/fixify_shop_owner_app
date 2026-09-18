"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; 

export default function InventoryTab({ products, fetchProducts, currentShop }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
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
  
  // 🔥 डिस्क्रिप्शन / स्पेसिफिकेशन स्टेट
  const [description, setDescription] = useState('');

  // 🔥 NEW STATES FOR MULTIPLE SIZES/VARIANTS 🔥
  const [hasVariants, setHasVariants] = useState(false);
  const [variants, setVariants] = useState([{ name: '', price: '', stock: '' }]);

  const [imageFiles, setImageFiles] = useState<File[]>([]); 
  const [isUploading, setIsUploading] = useState(false);

  const [editProduct, setEditProduct] = useState<any>(null);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [isBulkAdding, setIsBulkAdding] = useState(false); 
  const [isBulkDeleting, setIsBulkDeleting] = useState(false); 

  const safeShopId = currentShop?.id ? String(currentShop.id) : null;
  const heavyCategoriesList = ['Iron', 'Cement', 'Hardware', 'Aluminium & Steel', 'UPVC Windows'];

  useEffect(() => {
      if (heavyCategoriesList.includes(category)) setIsHeavy(true);
      else if (category !== 'Custom') setIsHeavy(false);

      const catLower = category.toLowerCase();
      if (catLower.includes('iron') || catLower.includes('steel')) {
         setUnit('Kg');
      } else if (catLower.includes('cement')) {
         setUnit('Bag');
      } else {
         setUnit('Pc'); 
      }
  }, [category]);

  // कैटेगरी के अनुसार ऑटोमैटिक स्पेसिफिकेशन टेम्पलेट तैयार करने का फंक्शन
  const getCategoryTemplate = (cat: string) => {
    const c = (cat || '').toLowerCase();
    if (c.includes('mobile') || c.includes('camera')) {
      return `• Model Name: \n• RAM / ROM: \n• Camera: \n• Battery: \n• Processor & Display: \n• In The Box: Handset, Charger, Cable\n• Warranty: 1 Year Manufacturer Warranty`;
    }
    if (c.includes('laptop') || c.includes('printer')) {
      return `• Brand & Model: \n• Processor (CPU): \n• RAM & SSD/HDD: \n• Graphics & OS: \n• Screen Size & Display: \n• Battery Backup: \n• Warranty: 1 Year Warranty`;
    }
    if (c.includes('fashion') || c.includes('cloth') || c.includes('design')) {
      return `• Fabric / Material: Pure Cotton\n• Saree / Cloth Length: 5.5 Mtr (+ 0.8 Mtr Blouse Piece)\n• Pattern / Print: \n• Occasion: Casual / Party Wear\n• Wash Care: Hand Wash / Machine Wash\n• Package Contains: 1 Piece`;
    }
    if (c.includes('iron') || c.includes('steel') || c.includes('aluminium')) {
      return `• Brand / Make: \n• Gauge / Thickness: \n• Length & Dimensions: \n• Weight / Unit: \n• Corrosion Resistance: Yes\n• Application: Building & Construction`;
    }
    if (c.includes('cement')) {
      return `• Brand Name: \n• Grade (OPC / PPC): \n• Packaging: 50 Kg Moisture Proof Bag\n• Setting Time: Fast Setting\n• Best For: Slabs, Pillars & Foundation`;
    }
    if (c.includes('vehicle')) {
      return `• Model & Year: \n• Fuel Type: Petrol / Diesel\n• KM Driven: \n• Ownership: 1st Owner\n• Insurance Valid Till: \n• Condition: Excellent Engine & Body`;
    }
    return `• Brand / Manufacturer: \n• Key Features: \n• Material / Quality: \n• Net Quantity: \n• Usage & Storage: \n• Guarantee / Warranty: `;
  };

  const applyAutoTemplate = (isEdit: boolean = false) => {
    const cat = isEdit ? editProduct.category : category;
    const template = getCategoryTemplate(cat);
    if (isEdit) {
      setEditProduct({ ...editProduct, description: template });
    } else {
      setDescription(template);
    }
  };

  const myShopProducts = (products || []).filter((p: any) => safeShopId && String(p.shop_id) === safeShopId);
  const myProductNames = new Set(myShopProducts.map((p: any) => p.name.toLowerCase()));

  const shopProducts = (products || []).filter((p: any) => {
      if (!safeShopId) return true; 
      if (String(p.shop_id) === safeShopId) return true; 
      if (!p.shop_id) {
          return !myProductNames.has(p.name.toLowerCase());
      }
      return false;
  });

  const defaultCategories = [
    'Mobiles & Accessories', 'Laptops & Printers', 'Fashion & Design', 'Cosmetic Items',
    'Book & Diary', 'Old Vehicles (Sell/Buy)', 'Iron', 'Cement', 'Hardware', 'Electric', 
    'UPVC Windows', 'Aluminium & Steel', 'Furniture', 'General Store', 'Paints'
  ];
  
  const standardizeCategory = (catStr: string) => {
    if (!catStr) return 'General Store';
    return catStr; 
  };

  const cleanedProducts = shopProducts.map((p: any) => ({
    ...p, category: standardizeCategory(p.category)
  }));

  const uniqueDbCategories = Array.from(new Set(cleanedProducts.map((p: any) => p.category).filter(Boolean)));
  const allCategories = ['All Categories', ...Array.from(new Set([...defaultCategories, ...uniqueDbCategories]))];
  
  const [selectedInvCategory, setSelectedInvCategory] = useState(allCategories[0]);

  const filteredProducts = cleanedProducts.filter((p: any) => {
    const matchesSearch = (p?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedInvCategory === 'All Categories' || p.category === selectedInvCategory;
    return matchesSearch && matchesCategory;
  });

  const uploadImageToSupabase = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error: any) {
      return null;
    }
  };

  const getAutoImagesArray = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('mobile')) return ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400'];
    if (c.includes('laptop')) return ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400'];
    if (c.includes('cement')) return ['https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400'];
    if (c.includes('iron') || c.includes('steel')) return ['https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400'];
    return ['https://images.unsplash.com/photo-1586816879360-004f5b0c51e3?w=400']; 
  };

  const addProduct = async () => {
    const finalCategory = category === 'Custom' ? newCustomCategory.trim() : category;
    
    if (!hasVariants && (!name || !price || !stock || !finalCategory)) return alert("Kripya sabhi details bharein!");
    if (hasVariants && !name) return alert("Product ka naam likhein!");

    setIsUploading(true);
    let finalImageUrlString = "";

    if (imageFiles.length > 0) {
      let uploadedUrls: string[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const url = await uploadImageToSupabase(imageFiles[i]);
        if (url) uploadedUrls.push(url);
      }
      finalImageUrlString = uploadedUrls.join(',');
    } else {
      finalImageUrlString = getAutoImagesArray(finalCategory).join(',');
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
        return alert("Kripya kam se kam ek Size/Variant theek se bharein!");
      }
      
      finalStock = validVariants.reduce((sum, v) => sum + Number(v.stock), 0);
      finalPrice = Math.min(...validVariants.map(v => Number(v.price)));
      finalVariantsJSON = validVariants; 
    }

    const { error } = await supabase.from('products').insert([{ 
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
      description: description.trim() // 🔥 5-10 लाइन की पूरी डिटेल्स
    }]);

    if (error) alert("Error adding product: " + error.message);
    
    setIsUploading(false); setIsAdding(false); fetchProducts(); 
    setName(''); setPrice(''); setStock(''); setUnit('Pc'); 
    setReturnPolicy('No Return'); setIsCodAvailable(true);
    setCondition('New'); setNewCustomCategory(''); setImageFiles([]); setIsHeavy(false);
    setHasVariants(false); setVariants([{ name: '', price: '', stock: '' }]);
    setDescription('');
  };

  const saveEditedProduct = async () => {
    const finalEditCategory = editProduct.category === 'Custom' ? editProduct.new_custom_category?.trim() : editProduct.category;
    if (!editProduct.name || !finalEditCategory) return alert("Naam aur category zaroori hai!");
    
    setIsUploading(true);
    let finalImageUrlString = editProduct.image_url;

    if (editImageFiles.length > 0) {
      let newUploadedUrls: string[] = [];
      for (let i = 0; i < editImageFiles.length; i++) {
        const url = await uploadImageToSupabase(editImageFiles[i]);
        if (url) newUploadedUrls.push(url);
      }
      if (newUploadedUrls.length > 0) finalImageUrlString = newUploadedUrls.join(',');
    } else if (!finalImageUrlString || finalImageUrlString.trim() === '') {
      finalImageUrlString = getAutoImagesArray(finalEditCategory).join(',');
    }

    const exactShopId = currentShop?.id ? Number(currentShop.id) : null;
    let finalUnit = editProduct.unit || 'Pc';
    if (finalEditCategory.toLowerCase().includes('iron') || finalEditCategory.toLowerCase().includes('steel')) finalUnit = 'Kg';
    else if (finalEditCategory.toLowerCase().includes('cement')) finalUnit = 'Bag';

    const finalReturnPolicy = editProduct.return_policy || 'No Return';
    const finalCodStatus = editProduct.is_cod_available !== false; 

    let finalPrice = Number(editProduct.price);
    let finalStock = Number(editProduct.total_stock);
    let finalVariantsJSON = null;

    if (editProduct.hasVariants) {
      const validVariants = (editProduct.variants || []).filter((v:any) => v.name && v.price && v.stock);
      if (validVariants.length > 0) {
        finalStock = validVariants.reduce((sum: number, v:any) => sum + Number(v.stock), 0);
        finalPrice = Math.min(...validVariants.map((v:any) => Number(v.price)));
        finalVariantsJSON = validVariants;
      }
    }

    const finalEditDescription = editProduct.description ? editProduct.description.trim() : '';

    if (!editProduct.shop_id) {
       const { error: masterError } = await supabase.from('products').update({ 
         name: editProduct.name, category: finalEditCategory, 
         price: finalPrice, 
         image_url: finalImageUrlString,
         unit: finalUnit, is_heavy: editProduct.is_heavy, return_policy: finalReturnPolicy,
         is_cod_available: finalCodStatus, variants: finalVariantsJSON,
         description: finalEditDescription
       }).eq('id', editProduct.id);

       if (masterError) {
         alert("Master update fail: " + masterError.message);
         setIsUploading(false); return;
       }

       if(finalStock > 0) {
           const { error: shopError } = await supabase.from('products').insert([{ 
             shop_id: exactShopId,  
             name: editProduct.name, category: finalEditCategory, 
             price: finalPrice, total_stock: finalStock, sold_quantity: 0, 
             unit: finalUnit, image_url: finalImageUrlString,
             is_heavy: editProduct.is_heavy, return_policy: finalReturnPolicy,
             is_cod_available: finalCodStatus, variants: finalVariantsJSON,
             description: finalEditDescription
           }]);
           if (shopError) alert("Stock save error: " + shopError.message);
           else alert("✅ Product aapke Stock Room me Add ho gaya!");
       } else {
           alert("✅ Master update! (Stock 0 hone se aapke room mein nahi aaya)");
       }

    } else {
       const { error } = await supabase.from('products').update({ 
         name: editProduct.name, category: finalEditCategory, 
         price: finalPrice, total_stock: finalStock, 
         unit: finalUnit, image_url: finalImageUrlString,
         is_heavy: editProduct.is_heavy, return_policy: finalReturnPolicy,
         is_cod_available: finalCodStatus, variants: finalVariantsJSON,
         description: finalEditDescription
       }).eq('id', editProduct.id);
       
       if (error) alert("Error updating product: " + error.message);
       else alert("✅ Aapka Stock successfully update ho gaya!");
    }

    setIsUploading(false); 
    setEditProduct(null); 
    setEditImageFiles([]); 
    if (typeof fetchProducts === 'function') await fetchProducts(); 
  };

  const deleteProduct = async (id: number) => {
    if (!window.confirm("Kya aap sach mein is product ko delete karna chahte hain?")) return;
    await supabase.from('products').delete().eq('id', id);
    fetchProducts();
  };

  const deleteHeavyItems = async () => {
    if (!window.confirm("🚨 WARNING: Kya aap sach mein sabhi HEAVY ITEMS ko database se delete karna chahte hain?")) return;

    setIsBulkDeleting(true);
    try {
      let query = supabase.from('products').delete().in('category', heavyCategoriesList);
      if (safeShopId) {
          query = query.eq('shop_id', safeShopId);
      }
      const { error } = await query;
      if (error) throw error;
      
      alert("✅ Sabhi Heavy Items database se delete ho gaye!");
      fetchProducts(); 
    } catch (err: any) {
      alert("Delete error: " + err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const generateBulkDemoProducts = async () => {
    const targetCategory = selectedInvCategory === 'All Categories' ? 'General Store' : selectedInvCategory;
    if (!window.confirm(`Kya aap ${targetCategory} category mein demo items generate karna chahte hain?`)) return;

    setIsBulkAdding(true);
    const demoItems = [];
    const baseNames = ['Pro', 'Max', 'Ultra', 'Lite', 'Plus', 'Premium', 'Standard', 'Basic'];
    const isTargetHeavy = heavyCategoriesList.includes(targetCategory);
    
    let genUnit = 'Pc';
    if (targetCategory.toLowerCase().includes('iron') || targetCategory.toLowerCase().includes('steel')) genUnit = 'Kg';
    else if (targetCategory.toLowerCase().includes('cement')) genUnit = 'Bag';

    for (let i = 0; i < 20; i++) {
        demoItems.push({
            shop_id: null, 
            name: `${targetCategory.split(' ')[0]} ${baseNames[Math.floor(Math.random() * baseNames.length)]} Model-${Math.floor(Math.random() * 1000)}`,
            category: targetCategory,
            price: Math.floor(Math.random() * 5000) + 100,
            total_stock: 0, 
            sold_quantity: 0,
            unit: genUnit,
            image_url: getAutoImagesArray(targetCategory).join(','),
            is_heavy: isTargetHeavy,
            return_policy: 'No Return',
            is_cod_available: true,
            description: `Official ${targetCategory} standard item. High durability and certified quality for home and industrial use.`
        });
    }

    try {
        const { error } = await supabase.from('products').insert(demoItems);
        if (error) throw error;
        alert(`✅ 20 Master Inventory Products generate ho gaye!`);
        fetchProducts();
    } catch (err: any) {}
    setIsBulkAdding(false);
  };

  const dropdownCategories = Array.from(new Set([...defaultCategories, ...uniqueDbCategories as string[]]));

  return (
    <div>
      <div style={{display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap'}}>
         <button onClick={() => setIsAdding(!isAdding)} style={greenBtn}>{isAdding ? '✖ Close Form' : '+ Add New Product'}</button>
         <input placeholder="🔍 Kisi bhi product ka naam search karein..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{...inputStyle, margin: 0, minWidth: '250px', flex: 1}} />
         
         <button 
           onClick={generateBulkDemoProducts} 
           disabled={isBulkAdding || isBulkDeleting} 
           style={{...greenBtn, backgroundColor: '#8b5cf6', opacity: (isBulkAdding || isBulkDeleting) ? 0.6 : 1}}
         >
           {isBulkAdding ? '⏳ Generating...' : `⚡ Auto Generate`}
         </button>

         <button 
           onClick={deleteHeavyItems} 
           disabled={isBulkAdding || isBulkDeleting} 
           style={{...greenBtn, backgroundColor: '#ef4444', opacity: (isBulkAdding || isBulkDeleting) ? 0.6 : 1}}
         >
           {isBulkDeleting ? '⏳ Deleting...' : '🗑️ Wipe Heavy Items'}
         </button>
      </div>

      <div className="hide-scrollbar" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '15px' }}>
         {allCategories.map(cat => (
            <button key={cat as string} onClick={() => setSelectedInvCategory(cat as string)} style={{
                padding: '8px 16px', borderRadius: '20px', border: '1px solid #38bdf8', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.2s',
                backgroundColor: selectedInvCategory === cat ? '#38bdf8' : 'transparent', color: selectedInvCategory === cat ? '#0f172a' : '#38bdf8', fontWeight: 'bold'
            }}>{cat as string}</button>
         ))}
      </div>

      {/* 🔥 ADD PRODUCT FORM 🔥 */}
      {isAdding && (
        <div style={{marginTop:'15px', border:'1px solid #38bdf8', padding:'20px', borderRadius:'12px', backgroundColor: '#0f172a', marginBottom: '20px'}}>
          <h3 style={{ color: '#38bdf8', marginTop: 0 }}>📦 Add Inventory Item</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input placeholder="Product Name (E.g. Kurti, Iron Pipe, Realme 12 Pro)" onChange={e => setName(e.target.value)} value={name} style={{...inputStyle, flex: 2, minWidth: '200px'}} />
            <select onChange={e => setCondition(e.target.value)} value={condition} style={{...inputStyle, flex: 1, minWidth: '150px'}}><option value="New">✨ Brand New</option><option value="Used">♻️ Second Hand</option></select>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select onChange={e => setCategory(e.target.value)} value={category} style={{...inputStyle, flex: 1, minWidth: '200px'}}>
              {dropdownCategories.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
              <option value="Custom" style={{fontWeight: 'bold', color: '#10b981'}}>+ Create New Category</option>
            </select>
            {category === 'Custom' && <input placeholder="Enter new category name..." value={newCustomCategory} onChange={e => setNewCustomCategory(e.target.value)} style={{...inputStyle, flex: 1, border: '1px solid #10b981', minWidth: '200px'}} />}
          </div>

          {/* 🔥 PRODUCT DESCRIPTION & AUTO-SPECS BUILDER 🔥 */}
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
              <label style={{ color: '#38bdf8', fontSize: '13px', fontWeight: 'bold' }}>
                📋 Product Description & Details (5-10 Lines)
              </label>
              <button 
                type="button" 
                onClick={() => applyAutoTemplate(false)}
                style={{ background: '#0284c7', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                ⚡ Auto-Fill Specs Template ({category})
              </button>
            </div>
            
            <textarea 
              rows={7} 
              placeholder={`Product ki poori khasiyat likhein jaise:\n- RAM, Storage, Battery, Camera (Mobiles ke liye)\n- Fabric, Length, Occasion (Kapde / Sari ke liye)\n- Gauge, Quality, Weight (Building material ke liye)...`} 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              style={{ ...inputStyle, fontFamily: 'inherit', lineHeight: '1.6', resize: 'vertical' }}
            />
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              💡 Tip: ग्राहक को प्रोडक्ट की पूरी जानकारी मिलने पर बिक्री 3 गुना बढ़ जाती है।
            </p>
          </div>

          {/* 🔥 MULTIPLE SIZES TOGGLE 🔥 */}
          <div style={{ marginTop: '15px', marginBottom: '10px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38bdf8', fontWeight: 'bold', cursor: 'pointer' }}>
              <input type="checkbox" checked={hasVariants} onChange={(e) => setHasVariants(e.target.checked)} style={{ transform: 'scale(1.3)', accentColor: '#38bdf8' }} />
              👕 Is Product ke Alag-Alag Sizes/Variants hain? (e.g. M, L, XL)
            </label>
          </div>

          {hasVariants ? (
            <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', border: '1px dashed #38bdf8' }}>
              <h4 style={{ color: '#e2e8f0', marginTop: 0 }}>Define Sizes & Prices</h4>
              {variants.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <input placeholder="Size (XL, 32, 10mm)" value={v.name} onChange={(e) => { const newV = [...variants]; newV[i].name = e.target.value; setVariants(newV); }} style={{...inputStyle, flex: 2, margin: 0}} />
                  <input type="number" placeholder="Price (₹)" value={v.price} onChange={(e) => { const newV = [...variants]; newV[i].price = e.target.value; setVariants(newV); }} style={{...inputStyle, flex: 1, margin: 0}} />
                  <input type="number" placeholder="Stock" value={v.stock} onChange={(e) => { const newV = [...variants]; newV[i].stock = e.target.value; setVariants(newV); }} style={{...inputStyle, flex: 1, margin: 0}} />
                  <button onClick={() => setVariants(variants.filter((_, idx) => idx !== i))} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer' }}>✖</button>
                </div>
              ))}
              <button onClick={() => setVariants([...variants, { name: '', price: '', stock: '' }])} style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '5px' }}>+ Add More Size</button>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px' }}>* Total stock apne aap calculate ho jayega.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
              <input type="number" placeholder="Single Price (₹)" onChange={e => setPrice(e.target.value)} value={price} style={{...inputStyle, flex: 1, minWidth: '120px'}} />
              
              {(category.toLowerCase().includes('iron') || category.toLowerCase().includes('steel')) ? (
                <div style={{...inputStyle, flex: 1, minWidth: '80px', display: 'flex', alignItems: 'center', backgroundColor: '#334155', color: '#facc15', border: '1px solid #facc15', fontWeight: 'bold'}}>Kg</div>
              ) : category.toLowerCase().includes('cement') ? (
                <div style={{...inputStyle, flex: 1, minWidth: '80px', display: 'flex', alignItems: 'center', backgroundColor: '#334155', color: '#facc15', border: '1px solid #facc15', fontWeight: 'bold'}}>Bag</div>
              ) : (
                <select onChange={e => setUnit(e.target.value)} value={unit} style={{...inputStyle, flex: 1, minWidth: '80px'}}>
                  <option value="Pc">Pc</option>
                  <option value="Bag">Bag</option>
                  <option value="Box">Box</option>
                  <option value="Mtr">Mtr</option>
                  <option value="Ltr">Ltr</option>
                  <option value="Kg">Kg</option>
                </select>
              )}

              <input type="number" placeholder="Total Stock Qty" onChange={e => setStock(e.target.value)} value={stock} style={{...inputStyle, flex: 1, minWidth: '120px'}} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
             <div style={{ flex: 1, minWidth: '180px' }}>
               <label style={{color: '#94a3b8', fontSize: '12px', fontWeight: 'bold'}}>Return Policy</label>
               <select onChange={e => setReturnPolicy(e.target.value)} value={returnPolicy} style={{...inputStyle, border: '1px solid #3b82f6'}}>
                 <option value="No Return">🚫 No Return</option>
                 <option value="24 Hours Return">⏱️ 24 Hours Return</option>
                 <option value="7 Days Return">📅 7 Days Return</option>
               </select>
             </div>
             <div style={{ flex: 2, minWidth: '220px' }}>
                <label style={{color: '#94a3b8', fontSize: '12px', fontWeight: 'bold'}}>Payment Mode</label>
                <div style={{ display: 'flex', gap: '15px', marginTop: '10px', backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
                  <label style={{ cursor: 'pointer', color: isCodAvailable ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
                    <input type="radio" checked={isCodAvailable} onChange={() => setIsCodAvailable(true)} style={{accentColor: '#10b981'}} /> 💵 COD 
                  </label>
                  <label style={{ cursor: 'pointer', color: !isCodAvailable ? '#38bdf8' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
                    <input type="radio" checked={!isCodAvailable} onChange={() => setIsCodAvailable(false)} style={{accentColor: '#38bdf8'}} /> 💳 Online Only
                  </label>
                </div>
             </div>
          </div>

          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: isHeavy ? 'rgba(245, 158, 11, 0.1)' : '#1e293b', border: `1px solid ${isHeavy ? '#f59e0b' : '#334155'}`, borderRadius: '6px' }}>
             <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: isHeavy ? '#fbbf24' : '#cbd5e1', fontWeight: 'bold' }}>
               <input type="checkbox" checked={isHeavy} onChange={(e) => setIsHeavy(e.target.checked)} style={{ transform: 'scale(1.3)', accentColor: '#f59e0b' }} />
               🚛 High Weight / Heavy Item
             </label>
          </div>

          <div style={{ marginTop: '15px', border: '2px dashed #38bdf8', padding: '15px', borderRadius: '8px', textAlign: 'center', backgroundColor: '#1e293b' }}>
             <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '30px' }}>📸</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                  {imageFiles.length >= 4 ? 'Maximum 4 Photos Selected' : `Custom Photos Dalien`}
                </span>
                <input type="file" multiple accept="image/*" value="" onChange={(e) => {
                    if(e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      setImageFiles((prev: File[]) => [...prev, ...newFiles].slice(0, 4));
                    }
                  }} style={{ display: 'none' }} />
             </label>

             {imageFiles.length > 0 && (
               <div style={{marginTop: '10px', fontSize: '14px', color: '#10b981'}}>
                 ✅ {imageFiles.length} Photos Selected! 
                 <button onClick={(e) => { e.preventDefault(); setImageFiles([]); }} style={{marginLeft:'10px', background:'none', border:'none', color:'#ef4444', cursor:'pointer', textDecoration:'underline'}}>🗑️ Clear</button>
               </div>
             )}
          </div>

          <button onClick={addProduct} disabled={isUploading} style={{...greenBtn, width: '100%', marginTop: '20px', opacity: isUploading ? 0.5 : 1}}>
            {isUploading ? '⏳ Uploading...' : '💾 Save Product'}
          </button>
        </div>
      )}

      {/* 🔥 EDIT/ADD STOCK POPUP 🔥 */}
      {editProduct && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '25px', borderRadius: '12px', width: '100%', maxWidth: '500px', border: '1px solid #38bdf8', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ color: '#10b981', marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
              {editProduct.shop_id ? '✏️ Edit Stock / Details' : '📥 Edit Master & Add'}
            </h3>
            
            <label style={{color: '#94a3b8', fontSize: '12px'}}>Product Name</label>
            <input value={editProduct.name} onChange={e => setEditProduct({...editProduct, name: e.target.value})} style={inputStyle} placeholder="Product Name" />
            
            <label style={{color: '#94a3b8', fontSize: '12px', marginTop: '10px', display: 'block'}}>Category</label>
            <select value={editProduct.category} onChange={e => setEditProduct({...editProduct, category: e.target.value})} style={inputStyle}>
              {allCategories.filter(c => c !== 'All Categories').map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
            </select>

            {/* EDIT DESCRIPTION SECTION */}
            <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 'bold' }}>
                  📋 Product Details (5-10 Lines)
                </label>
                <button 
                  type="button" 
                  onClick={() => applyAutoTemplate(true)}
                  style={{ background: '#0284c7', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                >
                  ⚡ Fill Specs Template
                </button>
              </div>
              <textarea 
                rows={6}
                value={editProduct.description || ''} 
                onChange={e => setEditProduct({ ...editProduct, description: e.target.value })} 
                placeholder="Product specifications, RAM, size, fabric, etc..."
                style={{ ...inputStyle, fontFamily: 'inherit', lineHeight: '1.5', margin: 0, resize: 'vertical' }}
              />
            </div>

            {/* SIZES IN EDIT MODE */}
            <div style={{ marginTop: '15px', marginBottom: '10px', padding: '10px', backgroundColor: '#1e293b', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38bdf8', fontWeight: 'bold', cursor: 'pointer' }}>
                <input type="checkbox" checked={editProduct.hasVariants || false} 
                  onChange={(e) => {
                    const checked = e.target.checked;
                    let initVariants = [{name: '', price: editProduct.price || '', stock: editProduct.total_stock || ''}];
                    if (checked && editProduct.variants && editProduct.variants.length > 0) initVariants = editProduct.variants;
                    setEditProduct({...editProduct, hasVariants: checked, variants: initVariants});
                  }} 
                style={{ transform: 'scale(1.2)' }} />
                Manage Multiple Sizes (Variants)
              </label>
            </div>

            {editProduct.hasVariants ? (
              <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', border: '1px solid #334155' }}>
                {(editProduct.variants || []).map((v:any, i:number) => (
                  <div key={i} style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                    <input placeholder="Size" value={v.name} onChange={(e) => { const newV = [...editProduct.variants]; newV[i].name = e.target.value; setEditProduct({...editProduct, variants: newV}); }} style={{...inputStyle, flex: 2, margin: 0, padding: '8px'}} />
                    <input type="number" placeholder="Price" value={v.price} onChange={(e) => { const newV = [...editProduct.variants]; newV[i].price = e.target.value; setEditProduct({...editProduct, variants: newV}); }} style={{...inputStyle, flex: 1, margin: 0, padding: '8px'}} />
                    <input type="number" placeholder="Stock" value={v.stock} onChange={(e) => { const newV = [...editProduct.variants]; newV[i].stock = e.target.value; setEditProduct({...editProduct, variants: newV}); }} style={{...inputStyle, flex: 1, margin: 0, padding: '8px'}} />
                    <button onClick={() => { const newV = editProduct.variants.filter((_:any, idx:number) => idx !== i); setEditProduct({...editProduct, variants: newV}); }} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '8px' }}>✖</button>
                  </div>
                ))}
                <button onClick={() => setEditProduct({...editProduct, variants: [...(editProduct.variants || []), { name: '', price: '', stock: '' }]})} style={{ backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', padding: '6px 12px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>+ Add Size</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <div style={{flex: 1}}>
                   <label style={{color: '#94a3b8', fontSize: '12px'}}>Price (₹)</label>
                   <input type="number" value={editProduct.price} onChange={e => setEditProduct({...editProduct, price: e.target.value})} style={inputStyle} />
                </div>
                
                <div style={{flex: 1}}>
                   <label style={{color: '#94a3b8', fontSize: '12px'}}>Sale Unit</label>
                   {(editProduct.category.toLowerCase().includes('iron') || editProduct.category.toLowerCase().includes('steel')) ? (
                     <div style={{...inputStyle, display: 'flex', alignItems: 'center', backgroundColor: '#334155', color: '#facc15', border: '1px solid #facc15', fontWeight: 'bold'}}>Kg</div>
                   ) : editProduct.category.toLowerCase().includes('cement') ? (
                     <div style={{...inputStyle, display: 'flex', alignItems: 'center', backgroundColor: '#334155', color: '#facc15', border: '1px solid #facc15', fontWeight: 'bold'}}>Bag</div>
                   ) : (
                     <select value={editProduct.unit || 'Pc'} onChange={e => setEditProduct({...editProduct, unit: e.target.value})} style={inputStyle}>
                       <option value="Pc">Pc</option>
                       <option value="Bag">Bag</option>
                       <option value="Box">Box</option>
                       <option value="Kg">Kg</option>
                       <option value="Mtr">Mtr</option>
                       <option value="Ltr">Ltr</option>
                     </select>
                   )}
                </div>

                <div style={{flex: 1}}>
                   <label style={{color: '#10b981', fontSize: '12px'}}>Total Stock</label>
                   <input type="number" value={editProduct.total_stock} onChange={e => setEditProduct({...editProduct, total_stock: e.target.value})} style={inputStyle} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{color: '#94a3b8', fontSize: '12px', fontWeight: 'bold'}}>Return Policy</label>
                <select value={editProduct.return_policy || 'No Return'} onChange={e => setEditProduct({...editProduct, return_policy: e.target.value})} style={{...inputStyle, border: '1px solid #3b82f6'}}>
                  <option value="No Return">🚫 No Return</option>
                  <option value="24 Hours Return">⏱️ 24 Hours Return</option>
                  <option value="7 Days Return">📅 7 Days Return</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <label style={{color: '#94a3b8', fontSize: '12px', fontWeight: 'bold'}}>Payment Mode</label>
              <div style={{ display: 'flex', gap: '15px', marginTop: '5px', backgroundColor: '#1e293b', padding: '12px', borderRadius: '6px', border: '1px solid #334155' }}>
                <label style={{ cursor: 'pointer', color: editProduct.is_cod_available !== false ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                  <input type="radio" checked={editProduct.is_cod_available !== false} onChange={() => setEditProduct({...editProduct, is_cod_available: true})} style={{accentColor: '#10b981'}} />
                  💵 COD Available
                </label>
                <label style={{ cursor: 'pointer', color: editProduct.is_cod_available === false ? '#38bdf8' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                  <input type="radio" checked={editProduct.is_cod_available === false} onChange={() => setEditProduct({...editProduct, is_cod_available: false})} style={{accentColor: '#38bdf8'}} />
                  💳 Online Only
                </label>
              </div>
            </div>

            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: editProduct.is_heavy ? 'rgba(245, 158, 11, 0.1)' : '#1e293b', border: `1px solid ${editProduct.is_heavy ? '#f59e0b' : '#334155'}`, borderRadius: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', color: editProduct.is_heavy ? '#fbbf24' : '#cbd5e1', fontWeight: 'bold', fontSize: '13px' }}>
                <input type="checkbox" checked={editProduct.is_heavy || false} onChange={(e) => setEditProduct({...editProduct, is_heavy: e.target.checked})} style={{ transform: 'scale(1.2)', accentColor: '#f59e0b' }} />
                🚛 High Weight / Heavy Item
              </label>
            </div>

            <div style={{ marginTop: '15px', border: '1px dashed #64748b', padding: '15px', borderRadius: '8px', backgroundColor: '#1e293b' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ flex: 1, backgroundColor: '#3b82f6', color: 'white', padding: '10px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  📸 Camera
                  <input type="file" accept="image/*" capture="environment" multiple onChange={(e) => { 
                    if(e.target.files) setEditImageFiles((prev: File[]) => [...prev, ...Array.from(e.target.files)].slice(0, 4));
                  }} style={{ display: 'none' }} />
                </label>
                <label style={{ flex: 1, backgroundColor: '#6366f1', color: 'white', padding: '10px', borderRadius: '6px', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  🖼️ Gallery
                  <input type="file" accept="image/*" multiple onChange={(e) => { 
                    if(e.target.files) setEditImageFiles((prev: File[]) => [...prev, ...Array.from(e.target.files)].slice(0, 4));
                  }} style={{ display: 'none' }} />
                </label>
              </div>
              {editImageFiles.length > 0 && (
               <div style={{marginTop: '10px', fontSize: '13px', color: '#10b981', textAlign: 'center'}}>
                 ✅ {editImageFiles.length} Photos! <button onClick={(e) => { e.preventDefault(); setEditImageFiles([]); }} style={{marginLeft:'10px', background:'none', border:'none', color:'#ef4444', cursor:'pointer', textDecoration:'underline'}}>🗑️ Clear</button>
               </div>
             )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => { setEditProduct(null); setEditImageFiles([]); }} style={{...editBtn, flex: 1, backgroundColor: '#475569'}}>Cancel</button>
              <button onClick={saveEditedProduct} disabled={isUploading} style={{...greenBtn, flex: 2, opacity: isUploading ? 0.7 : 1}}>
                {isUploading ? 'Saving...' : '💾 Save & Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 PRODUCT LIST DISPLAY 🔥 */}
      <div>
        {filteredProducts.map((p: any) => {
            const hasStock = p.shop_id === safeShopId && p.total_stock > 0;
            const itemUnit = p.unit || 'Pc'; 
            
            const parsedVariants = p.variants ? (typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants) : [];
            const isMultiSize = parsedVariants && parsedVariants.length > 0;

            return (
            <div key={p.id} style={{ ...cardStyle, borderLeft: hasStock ? '4px solid #10b981' : '1px solid #334155' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', background: '#334155', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {p.image_url ? <img src={p.image_url.split(',')[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={p.name} /> : <span style={{ fontSize: '24px' }}>📦</span>}
                </div>
                <div>
                  <strong style={{color: '#38bdf8', fontSize: '15px'}}>{p.name} {p.is_heavy && <span title="Heavy Delivery Item" style={{fontSize: '14px'}}>🚛</span>}</strong>
                  
                  <div style={{color: '#94a3b8', fontSize: '12px', marginTop: '4px'}}>
                    {p.category} | <span style={{color: p.return_policy === 'No Return' ? '#ef4444' : '#10b981'}}>{p.return_policy || 'No Return'}</span> | 
                    <span style={{color: p.is_cod_available === false ? '#38bdf8' : '#10b981', fontWeight: 'bold'}}>
                      {p.is_cod_available === false ? ' 💳 Online Only' : ' 💵 COD'}
                    </span>
                  </div>

                  {/* MULTI SIZE DISPLAY */}
                  {isMultiSize && (
                    <div style={{ color: '#facc15', fontSize: '11px', marginTop: '4px', fontWeight: 'bold' }}>
                      📏 Sizes: {parsedVariants.map((v:any) => v.name).join(', ')}
                    </div>
                  )}

                  {/* DESCRIPTION PREVIEW SNIPPET */}
                  {p.description && (
                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '3px', fontStyle: 'italic', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      📝 {p.description}
                    </div>
                  )}

                  <div style={{color: '#e2e8f0', fontWeight: 'bold', marginTop: '4px', fontSize: '13px'}}>
                      {isMultiSize ? 'Starts from ' : ''}₹{p.price} <span style={{color:'#facc15'}}>/ {itemUnit}</span> | Stock: <span style={{color: hasStock ? '#4ade80' : '#f87171'}}>{p.total_stock || 0}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '80px' }}>
                <button onClick={() => {
                   setEditProduct({
                     ...p, 
                     hasVariants: isMultiSize, 
                     variants: isMultiSize ? parsedVariants : [],
                     description: p.description || ''
                   });
                }} style={{...editBtn, backgroundColor: hasStock ? '#3b82f6' : '#10b981', padding: '10px 15px'}}>
                   {hasStock ? '✏️ Edit Stock' : '➕ Add to Stock'}
                </button>
              </div>
            </div>
          )})
        }
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '12px', margin: '8px 0', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', fontSize: '14px', boxSizing: 'border-box' };
const greenBtn: React.CSSProperties = { padding: '10px 15px', backgroundColor: '#10b981', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 'bold', transition: '0.2s' };
const editBtn: React.CSSProperties = { border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' };
const cardStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid #334155', backgroundColor: '#0f172a', margin: '10px 0', borderRadius: '12px' };