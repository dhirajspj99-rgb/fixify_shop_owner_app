"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const ProfileField = ({ label, value, isEditing, onChange, type="text", placeholder="" }: any) => (
  <div style={{ marginBottom: '15px' }}>
    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>{label}</label>
    {isEditing ? (
      type === 'textarea' ? (
        <textarea value={value} onChange={onChange} style={{...inputStyle, height: '80px', resize: 'none'}} placeholder={placeholder} />
      ) : (
        <input type={type} value={value} onChange={onChange} style={inputStyle} placeholder={placeholder} />
      )
    ) : (
      <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: 'bold', padding: '8px 0', borderBottom: '1px dashed #334155' }}>
        {value || <span style={{ color: '#64748b', fontStyle: 'italic', fontWeight: 'normal' }}>Not Provided</span>}
      </div>
    )}
  </div>
);

export default function ShopProfile({ currentShop, setCurrentShop, onClose, fetchAuthAndData }: any) {
  
  // 🔥 FETCH DYNAMIC APP SETTINGS (UPI, QR & Charges) 🔥
  const [appSettings, setAppSettings] = useState<any>({});
  
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('app_settings').select('*').single();
      if (data) setAppSettings(data);
    };
    fetchSettings();
  }, []);

  // 🔥 View / Edit States 🔥
  const [isEditing, setIsEditing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Editable States
  const [editShopName, setEditShopName] = useState(currentShop?.name || '');
  const [editGstNumber, setEditGstNumber] = useState(currentShop?.gst_number || ''); 
  const [editUpiId, setEditUpiId] = useState(currentShop?.upi_id || '');
  const [editBankAccount, setEditBankAccount] = useState(currentShop?.bank_account || '');
  
  // Location States
  const [editState, setEditState] = useState(currentShop?.state || '');
  const [editDistrict, setEditDistrict] = useState(currentShop?.district || '');
  const [editBlock, setEditBlock] = useState(currentShop?.block || '');
  const [editPincode, setEditPincode] = useState(currentShop?.pincode || '');
  const [editAddress, setEditAddress] = useState(currentShop?.address || '');

  // Photo & Upload States
  const [profilePic, setProfilePic] = useState(currentShop?.profile_pic || '');
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [referralCode, setReferralCode] = useState(''); 
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  
  // 🔥 CERTIFICATE & UPI STATES 🔥
  const [isCertPaymentModalOpen, setIsCertPaymentModalOpen] = useState(false); 
  const [isRequestingCert, setIsRequestingCert] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');

  // 🔥 PREMIUM SUBSCRIPTION STATES 🔥
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [premiumUtr, setPremiumUtr] = useState('');
  const [isRequestingPremium, setIsRequestingPremium] = useState(false);

  // PASSWORD CHANGE STATES
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  // 1. SECURE EDIT VERIFICATION
  const handleEditClick = () => setShowAuthModal(true);

  const verifyPassword = async () => {
    if (!authPassword) return alert("❌ Kripya password dalein.");
    setIsVerifying(true);
    try {
      if (authPassword === currentShop.password) {
        setIsEditing(true);
        setShowAuthModal(false);
        setAuthPassword('');
      } else {
        alert("❌ Galat Password! Dobara koshish karein.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setIsVerifying(false);
  };

  const handlePasswordChange = async () => {
    if (!oldPass || !newPass || !confirmPass) return alert("❌ Sabhi fields bharein.");
    if (newPass !== confirmPass) return alert("❌ Naye password match nahi ho rahe.");
    if (oldPass !== currentShop.password) return alert("❌ Purana password galat hai.");

    setIsUpdatingPass(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({ password: newPass })
        .eq('id', currentShop.id);

      if (error) throw error;
      alert("✅ Password safaltapurvak badal gaya!");
      setCurrentShop((prev: any) => ({ ...prev, password: newPass }));
      setShowPasswordSection(false);
      setOldPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setIsUpdatingPass(false);
  };

  const handlePhotoUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'fixifiy_unsigned'); 

      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dt7x5t89l'}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        setProfilePic(data.secure_url);
        await supabase.from('shops').update({ profile_pic: data.secure_url }).eq('id', currentShop.id);
        setCurrentShop((prev: any) => ({ ...prev, profile_pic: data.secure_url }));
        alert("✅ Profile Photo Update Ho Gayi!");
      }
    } catch (err: any) {
      alert("Photo Upload Failed: " + err.message);
    }
    setIsUploadingPic(false);
  };

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    try {
      const updatedData = {
        name: editShopName,
        gst_number: editGstNumber,
        upi_id: editUpiId,
        bank_account: editBankAccount,
        state: editState,
        district: editDistrict,
        block: editBlock,
        pincode: editPincode,
        address: editAddress
      };

      const { error } = await supabase
        .from('shops')
        .update(updatedData)
        .eq('id', currentShop.id);

      if (error) throw error;

      setCurrentShop((prev: any) => ({ ...prev, ...updatedData }));
      setIsEditing(false);
      alert("✅ Profile safaltapurvak update ho gayi!");
    } catch (err: any) {
      alert("Error saving profile: " + err.message);
    }
    setIsSaving(false);
  };

  const handleApplyReferral = () => {
    if (!referralCode.trim()) return alert("❌ Kripya valid referral code dalein.");
    alert(`✅ Referral code '${referralCode}' successfully applied!`);
    setReferralCode('');
  };

  const handleDocUpload = async (e: any, field: string) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(field);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'fixifiy_unsigned');

      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dt7x5t89l'}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.secure_url) {
        await supabase.from('shops').update({ [field]: data.secure_url }).eq('id', currentShop.id);
        setCurrentShop((prev: any) => ({ ...prev, [field]: data.secure_url }));
        alert("✅ Document Upload Ho Gaya!");
      }
    } catch (err: any) {
      alert("Upload Failed: " + err.message);
    }
    setUploadingDoc(null);
  };

  // 🔥 5. LINKED WITH app_settings.idCardUpi & id_card_charge 🔥
  const idCardCharge = Number(appSettings?.id_card_charge) || 200;

  const handleUpiPaymentClick = () => {
    const targetUpi = appSettings?.idCardUpi || appSettings?.wallet_upi || 'admin@upi';
    const upiLink = `upi://pay?pa=${targetUpi}&pn=Fixifiy%20Technology&am=${idCardCharge}&cu=INR&tn=Certificate_Payment_${currentShop.phone}`;
    window.location.href = upiLink;
  };

  const handleUtrSubmit = async () => {
    if (!utrNumber.trim() || utrNumber.length < 10) {
      return alert("❌ Kripya sahi aur pura UTR / Reference Number dalein (Kam se kam 10-12 digits).");
    }

    setIsRequestingCert(true);
    try {
      // 1. Update Shop Table
      const { error } = await supabase
        .from('shops')
        .update({ 
          certificate_status: 'requested',
          certificate_utr: utrNumber 
        })
        .eq('id', currentShop.id);

      if (error) throw error;

      // 2. Insert into Wallet Transactions for Admin Action Center
      const { error: txError } = await supabase.from('wallet_transactions').insert({
        shop_id: currentShop.id,
        user_type: 'shop',
        amount: idCardCharge,
        type: 'add',
        status: 'pending',
        token_no: utrNumber,
        reason: `ID Card / Certificate Payment (UTR: ${utrNumber})`
      });

      if (txError) throw txError;

      alert("✅ UTR Submit ho gaya hai! Admin dwara payment verify hone ke baad Certificate download ka option aa jayega.");
      setCurrentShop((prev: any) => ({ ...prev, certificate_status: 'requested', certificate_utr: utrNumber }));
      setIsCertPaymentModalOpen(false);

    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setIsRequestingCert(false);
  };

  // 🔥 6. PREMIUM SUBSCRIPTION PAYMENT (DYNAMIC) 🔥
  const premiumPlans = appSettings?.premium_plans || { '1_month': 199, '3_months': 499, '9_months': 1299, '1_year': 1499 };
  
  const openPremiumModal = (planId: string) => {
    setSelectedPlan(planId);
    setIsPremiumModalOpen(true);
  };

  const handlePremiumUpiClick = () => {
    const planPrice = premiumPlans[selectedPlan] || 0;
    const targetUpi = appSettings?.premiumUpi || appSettings?.wallet_upi || 'admin@upi';
    const upiLink = `upi://pay?pa=${targetUpi}&pn=Fixifiy%20Technology&am=${planPrice}&cu=INR&tn=Premium_${selectedPlan}_${currentShop.phone}`;
    window.location.href = upiLink;
  };

  const handlePremiumUtrSubmit = async () => {
    if (!premiumUtr.trim() || premiumUtr.length < 10) return alert("❌ Kripya sahi 12-digit UTR Number dalein.");

    setIsRequestingPremium(true);
    try {
      const planPrice = premiumPlans[selectedPlan] || 0;

      const { error } = await supabase.from('shops').update({ 
        premium_status: 'requested', 
        premium_plan_selected: selectedPlan,
        premium_utr: premiumUtr 
      }).eq('id', currentShop.id);

      if (error) throw error;

      const { error: txError } = await supabase.from('wallet_transactions').insert({
        shop_id: currentShop.id,
        user_type: 'shop',
        amount: planPrice,
        type: 'add',
        status: 'pending',
        token_no: premiumUtr,
        reason: `Premium Membership Payment - ${selectedPlan.replace('_', ' ')} (UTR: ${premiumUtr})`
      });

      if (txError) throw txError;

      alert("✅ Premium Subscription ki request bhej di gayi hai. Admin jald verify karenge.");
      setCurrentShop((prev: any) => ({ ...prev, premium_status: 'requested', premium_plan_selected: selectedPlan, premium_utr: premiumUtr }));
      setIsPremiumModalOpen(false);
    } catch (err: any) { alert("Error: " + err.message); }
    setIsRequestingPremium(false);
  };

  // 🔥 7. PDF DOWNLOAD IN SEPARATE TAB 🔥
  const handleDownloadCertificate = async () => {
    const element = document.getElementById('print-certificate-container');
    if (!element) return;
    
    alert("⏳ Generating PDF... Naye tab mein khul raha hai.");
    
    const html2pdf = (await import('html2pdf.js')).default;
    const opt = { 
        margin: 0, 
        filename: `Fixifiy_Certificate_${currentShop.phone}.pdf`, 
        image: { type: 'jpeg', quality: 1.0 }, 
        html2canvas: { scale: 3, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };

    html2pdf().set(opt).from(element).outputPdf('bloburl').then((pdfUrl: string) => {
        window.open(pdfUrl, '_blank'); 
        
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = opt.filename;
        link.click();
    });
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={{...modalContentStyle, maxWidth: '600px'}}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #334155', paddingBottom: '15px', marginBottom: '20px' }}>
          <h2 style={{ color: '#38bdf8', margin: 0 }}>
            {isEditing ? '✏️ Edit Shop Profile' : '🏪 Shop Profile'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '24px', cursor: 'pointer' }}>✖</button>
        </div>

        {/* PROFILE PICTURE & BASIC INFO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '25px', background: '#0f172a', padding: '15px', borderRadius: '12px', border: '1px solid #334155' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #38bdf8', flexShrink: 0 }}>
            <img src={profilePic || "https://via.placeholder.com/150"} alt="Shop Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {isEditing && (
              <label style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '10px', textAlign: 'center', cursor: 'pointer', padding: '2px 0' }}>
                {isUploadingPic ? 'Uploading...' : 'Change'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
            )}
          </div>
          <div>
            <h3 style={{ color: '#f8fafc', margin: '0 0 5px 0', fontSize: '18px' }}>
              {currentShop?.name || 'My Shop'}
              {currentShop?.premium_status === 'active' && <span title="Premium Member" style={{marginLeft: '8px'}}>👑</span>}
            </h3>
            <p style={{ color: '#94a3b8', margin: '0 0 5px 0', fontSize: '13px' }}>📞 {currentShop?.phone}</p>
            <span style={{ background: '#0284c7', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Shop Owner</span>
          </div>
        </div>

        {/* BUSINESS DETAILS SECTION */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '15px' }}>📋 Business Information</h4>
          <ProfileField label="Shop Name" value={editShopName} isEditing={isEditing} onChange={(e: any) => setEditShopName(e.target.value)} placeholder="Enter shop name" />
          <ProfileField label="GST Number" value={editGstNumber} isEditing={isEditing} onChange={(e: any) => setEditGstNumber(e.target.value)} placeholder="Enter GSTIN (Optional)" />
          <ProfileField label="UPI ID (For Payments)" value={editUpiId} isEditing={isEditing} onChange={(e: any) => setEditUpiId(e.target.value)} placeholder="e.g. yourname@paytm" />
          <ProfileField label="Bank Account Details" value={editBankAccount} isEditing={isEditing} onChange={(e: any) => setEditBankAccount(e.target.value)} placeholder="A/C No & IFSC Code" />
        </div>

        {/* LOCATION DETAILS SECTION */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '15px' }}>📍 Location & Address</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <ProfileField label="State" value={editState} isEditing={isEditing} onChange={(e: any) => setEditState(e.target.value)} placeholder="State" />
            <ProfileField label="District" value={editDistrict} isEditing={isEditing} onChange={(e: any) => setEditDistrict(e.target.value)} placeholder="District" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <ProfileField label="Block / Tehsil" value={editBlock} isEditing={isEditing} onChange={(e: any) => setEditBlock(e.target.value)} placeholder="Block" />
            <ProfileField label="Pincode" value={editPincode} isEditing={isEditing} onChange={(e: any) => setEditPincode(e.target.value)} placeholder="Pincode" type="number" />
          </div>
          <ProfileField label="Full Address" value={editAddress} isEditing={isEditing} onChange={(e: any) => setEditAddress(e.target.value)} placeholder="Complete street address" type="textarea" />
        </div>

        {/* 🔥 ACTION BUTTONS (EDIT / SAVE / CANCEL) 🔥 */}
        <div style={{ display: 'flex', gap: '15px', marginTop: '20px', marginBottom: '20px' }}>
          {!isEditing ? (
            <button 
              onClick={handleEditClick} 
              style={{ flex: 1, background: '#3b82f6', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}
            >
              ✏️ Edit Profile
            </button>
          ) : (
            <>
              <button 
                onClick={() => setIsEditing(false)} 
                style={{ flex: 1, background: '#475569', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}
              >
                ❌ Cancel
              </button>
              <button 
                onClick={handleUpdateProfile} 
                disabled={isSaving} 
                style={{ flex: 1, background: '#10b981', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '15px' }}
              >
                {isSaving ? '⏳ Saving...' : '✅ Save Changes'}
              </button>
            </>
          )}
        </div>

        {/* 🔥 NEW: PREMIUM SUBSCRIPTION SECTION 🔥 */}
        <div style={{ borderTop: '2px dashed #eab308', paddingTop: '20px', marginTop: '10px' }}>
          <h3 style={{ color: '#eab308', fontSize: '18px', marginBottom: '5px', textAlign: 'center' }}>👑 Premium Membership</h3>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '15px', textAlign: 'center' }}>Get priority orders, lower commissions, and exclusive benefits.</p>

          {currentShop?.premium_status === 'active' ? (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
              <p style={{ color: '#eab308', fontWeight: 'bold', fontSize: '16px', margin: '0 0 5px 0' }}>✅ You are a Premium Member</p>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Valid till: {new Date(currentShop?.premium_end_date).toLocaleDateString('en-IN')}</p>
            </div>
          ) : currentShop?.premium_status === 'requested' ? (
             <div style={{ background: '#1e293b', border: '1px solid #f59e0b', padding: '15px', borderRadius: '10px', textAlign: 'center' }}>
               <p style={{ color: '#f59e0b', fontWeight: 'bold', margin: '0 0 5px 0' }}>⏳ Premium Request Pending</p>
               <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Admin is verifying your UTR ({currentShop?.premium_utr}).</p>
             </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <button onClick={() => openPremiumModal('1_month')} style={premiumBtnStyle}>1 Month<br/><span style={{fontSize:'16px'}}>₹{premiumPlans['1_month']}</span></button>
              <button onClick={() => openPremiumModal('3_months')} style={premiumBtnStyle}>3 Months<br/><span style={{fontSize:'16px'}}>₹{premiumPlans['3_months']}</span></button>
              <button onClick={() => openPremiumModal('9_months')} style={premiumBtnStyle}>9 Months<br/><span style={{fontSize:'16px'}}>₹{premiumPlans['9_months']}</span></button>
              <button onClick={() => openPremiumModal('1_year')} style={{...premiumBtnStyle, background: 'linear-gradient(135deg, #eab308, #b45309)'}}>1 Year<br/><span style={{fontSize:'16px'}}>₹{premiumPlans['1_year']}</span></button>
            </div>
          )}
        </div>

        {/* 🔥 NEW CERTIFICATE PREVIEW AND DOWNLOAD SECTION 🔥 */}
        {currentShop?.id && (
          <div style={{ borderTop: '2px dashed #334155', paddingTop: '20px', marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{ color: '#facc15', fontSize: '18px', marginBottom: '5px', textAlign: 'center' }}>📜 Certified Partner Document</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>Aapki Dukan ka Verified Certificate aur Terms & Conditions</p>
            
            {currentShop?.certificate_status === 'approved' ? (
              <button onClick={handleDownloadCertificate} style={{ background: '#10b981', color: 'white', padding: '15px 25px', border: 'none', borderRadius: '10px', marginBottom: '20px', fontWeight: '900', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', width: '100%' }}>
                ⬇️ Download Certificate (PDF)
              </button>
            ) : currentShop?.certificate_status === 'requested' ? (
              <div style={{ background: '#1e293b', border: '1px solid #f59e0b', padding: '15px', borderRadius: '10px', width: '100%', textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ color: '#f59e0b', fontWeight: 'bold', margin: '0 0 5px 0' }}>⏳ Verification Pending</p>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Admin aapka UTR ({currentShop?.certificate_utr}) verify kar rahe hain.</p>
              </div>
            ) : (
              <button onClick={() => setIsCertPaymentModalOpen(true)} style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)', color: 'white', padding: '15px 25px', border: 'none', borderRadius: '10px', marginBottom: '20px', fontWeight: '900', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)', width: '100%' }}>
                💳 Pay ₹{idCardCharge} via UPI & Get Certificate
              </button>
            )}
          </div>
        )}

      </div>

      {/* 🔥 PASSWORD VERIFICATION MODAL FOR EDITING 🔥 */}
      {showAuthModal && (
        <div style={{...modalOverlayStyle, zIndex: 10005}}>
          <div style={{...modalContentStyle, maxWidth: '380px', textAlign: 'center'}}>
            <h3 style={{ color: '#38bdf8', marginBottom: '10px' }}>🔒 Enter Password</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>Security ke liye apna account password enter karein.</p>
            
            <input 
              type="password" 
              placeholder="Enter current password" 
              value={authPassword} 
              onChange={(e) => setAuthPassword(e.target.value)} 
              style={{ ...inputStyle, marginBottom: '20px', textAlign: 'center' }} 
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowAuthModal(false)} style={{ flex: 1, padding: '10px', background: '#334155', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
              <button onClick={verifyPassword} disabled={isVerifying} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                {isVerifying ? 'Checking...' : 'Verify & Edit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 UPI PAYMENT & UTR SUBMIT MODAL (For ID Card) 🔥 */}
      {isCertPaymentModalOpen && (
        <div style={{...modalOverlayStyle, zIndex: 10005}}>
          <div style={{...modalContentStyle, textAlign: 'center', border: '2px solid #38bdf8', maxWidth: '400px'}}>
            <h2 style={{color: '#38bdf8', margin: '0 0 10px 0'}}>Pay ₹{idCardCharge} via UPI</h2>
            {appSettings?.idCardQr ? (
              <img src={appSettings.idCardQr} alt="QR Code" style={{ width: '150px', height: '150px', borderRadius: '8px', marginBottom: '15px' }} />
            ) : appSettings?.wallet_upi && (
              <p style={{color: '#38bdf8', fontSize: '12px', margin: '0 0 10px 0'}}>UPI: {appSettings.idCardUpi || appSettings.wallet_upi}</p>
            )}
            <p style={{color: '#cbd5e1', fontSize: '14px', marginBottom: '20px'}}>
              Niche diye button par click karein apna GPay, PhonePe ya Paytm kholne ke liye. Payment ke baad UTR number yahan dalein.
            </p>
            
            <button 
              onClick={handleUpiPaymentClick}
              style={{ background: '#10b981', color: 'white', padding: '15px', width: '100%', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginBottom: '25px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              📱 Click here to Pay ₹{idCardCharge}
            </button>

            <div style={{ textAlign: 'left', background: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Step 2: Enter 12-Digit UTR / Ref. Number</label>
              <input 
                type="text" 
                placeholder="e.g. 312345678901" 
                value={utrNumber} 
                onChange={(e) => setUtrNumber(e.target.value)} 
                style={{ ...inputStyle, fontSize: '16px', letterSpacing: '1px', textAlign: 'center' }} 
              />
              <p style={{ fontSize: '11px', color: '#f87171', marginTop: '8px', margin: '8px 0 0 0' }}>*Payment verify ki jayegi. Galat UTR dalne par reject ho jayega.</p>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsCertPaymentModalOpen(false)} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#334155', color: 'white', flex: 1, fontWeight: 'bold', cursor: 'pointer' }}>❌ Cancel</button>
              <button 
                onClick={handleUtrSubmit} 
                disabled={isRequestingCert} 
                style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', flex: 1, fontWeight: 'bold', cursor: isRequestingCert ? 'not-allowed' : 'pointer' }}
              >
                {isRequestingCert ? '⏳ Submitting...' : '✅ Submit UTR'}
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* 🔥 UPI PAYMENT MODAL (For Premium) 🔥 */}
      {isPremiumModalOpen && (
        <div style={{...modalOverlayStyle, zIndex: 10005}}>
          <div style={{...modalContentStyle, textAlign: 'center', border: '2px solid #eab308', maxWidth: '400px'}}>
            <h2 style={{color: '#eab308', margin: '0 0 10px 0'}}>Premium Plan ({selectedPlan.replace('_', ' ')})</h2>
            <h3 style={{color: '#fff', margin: '0 0 15px 0'}}>Amount: ₹{premiumPlans[selectedPlan]}</h3>
            
            {appSettings?.premiumQr ? (
              <img src={appSettings.premiumQr} alt="QR Code" style={{ width: '150px', height: '150px', borderRadius: '8px', marginBottom: '15px', border: '2px solid #eab308' }} />
            ) : appSettings?.wallet_upi && (
              <p style={{color: '#eab308', fontSize: '12px', margin: '0 0 10px 0'}}>UPI: {appSettings.premiumUpi || appSettings.wallet_upi}</p>
            )}
            
            <button onClick={handlePremiumUpiClick} style={{ background: '#10b981', color: 'white', padding: '15px', width: '100%', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', marginBottom: '20px' }}>
              📱 Open UPI App to Pay
            </button>

            <div style={{ textAlign: 'left', background: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Enter 12-Digit UTR / Ref. Number</label>
              <input type="text" placeholder="e.g. 312345678901" value={premiumUtr} onChange={(e) => setPremiumUtr(e.target.value)} style={{ ...inputStyle, textAlign: 'center' }} />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setIsPremiumModalOpen(false)} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#334155', color: 'white', flex: 1, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handlePremiumUtrSubmit} disabled={isRequestingPremium} style={{ padding: '12px', borderRadius: '8px', border: 'none', background: '#eab308', color: 'black', fontWeight:'bold', flex: 1, cursor: 'pointer' }}>{isRequestingPremium ? 'Wait...' : 'Submit UTR'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 HIDDEN A4 CERTIFICATE (FOR PDF EXPORT) 🔥 */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px' }}>
        <div id="print-certificate-container" style={{ width: '210mm', backgroundColor: '#fff', color: '#000', boxSizing: 'border-box', fontFamily: 'Arial, sans-serif', padding: '20mm' }}>
          <div style={{ border: '10px solid #1e293b', padding: '20mm', textAlign: 'center', height: '257mm', boxSizing: 'border-box' }}>
            <h1 style={{ color: '#0284c7', fontSize: '32px', marginBottom: '5px' }}>FIXIFIY TECHNOLOGY</h1>
            <p style={{ fontSize: '14px', color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '30px' }}>Verified Partner Certificate</p>
            <p style={{ fontSize: '16px', color: '#334155', marginBottom: '20px' }}>This is certified that</p>
            <h2 style={{ fontSize: '28px', color: '#0f172a', borderBottom: '2px solid #cbd5e1', display: 'inline-block', paddingBottom: '5px', marginBottom: '20px' }}>{currentShop?.name}</h2>
            <p style={{ fontSize: '15px', color: '#334155', lineHeight: '1.6', maxWidth: '400px', margin: '0 auto 40px auto' }}>
              is a verified and trusted partner shop offering hardware, building materials, and fabrication services under Fixifiy ecosystem.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px' }}>
              <div>
                <p style={{ borderTop: '1px solid #000', paddingTop: '5px', fontWeight: 'bold', fontSize: '14px' }}>Authorized Signatory</p>
              </div>
              <div>
                <p style={{ borderTop: '1px solid #000', paddingTop: '5px', fontWeight: 'bold', fontSize: '14px' }}>Fixifiy Admin</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

const inputStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '12px', margin: '0', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', boxSizing: 'border-box', outline: 'none', transition: '0.3s' };
const modalOverlayStyle: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px', overflowY: 'auto' };
const modalContentStyle: React.CSSProperties = { backgroundColor: '#1e293b', padding: '30px', borderRadius: '16px', width: '100%', border: '1px solid #38bdf8', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', margin: 'auto', overflowY: 'auto', maxHeight: '90vh' };
const premiumBtnStyle: React.CSSProperties = { background: '#334155', color: '#fff', border: '1px solid #eab308', borderRadius: '8px', padding: '12px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center' };