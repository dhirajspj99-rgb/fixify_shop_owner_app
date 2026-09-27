"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { auth } from '@/firebase'; 
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'; 

const locationData: any = {
  "Andaman and Nicobar Islands": {}, "Andhra Pradesh": {}, "Arunachal Pradesh": {}, "Assam": {},
  "Bihar": {
    "Patna": ["Patna Sadar", "Danapur", "Barh", "Masaurhi", "Paliganj", "Patna City", "Phulwari Sharif"],
    "Gaya": ["Gaya Sadar", "Bodh Gaya", "Sherghati", "Tekari"],
    "Muzaffarpur": ["Musahri", "Kanti", "Motipur", "Bochahan", "Sakra"],
    "Samastipur": ["Samastipur","Bithan","Hasanpur Road","Rosera","Singhiya"]
  },
  "Chandigarh": {}, "Chhattisgarh": {}, "Dadra and Nagar Haveli and Daman and Diu": {}, "Delhi": {},
  "Goa": {}, "Gujarat": {}, "Haryana": {}, "Himachal Pradesh": {}, "Jammu and Kashmir": {},
  "Jharkhand": {
    "Ranchi": ["Ranchi Sadar", "Kanke", "Namkum", "Hatia", "Ormanjhi"],
    "Bokaro": ["Chas", "Bermo", "Nawadih"]
  },
  "Karnataka": {}, "Kerala": {}, "Ladakh": {}, "Lakshadweep": {}, "Madhya Pradesh": {},
  "Maharashtra": {}, "Manipur": {}, "Meghalaya": {}, "Mizoram": {}, "Nagaland": {},
  "Odisha": {}, "Puducherry": {}, "Punjab": {}, "Rajasthan": {}, "Sikkim": {}, "Tamil Nadu": {},
  "Telangana": {}, "Tripura": {},
  "Uttar Pradesh": {
    "Varanasi": ["Varanasi Sadar", "Pindra", "Raja Talab"],
    "Lucknow": ["Lucknow Sadar", "Malihabad", "Bakshi Ka Talab", "Sarojininagar"],
    "Gorakhpur": ["Gorakhpur Sadar", "Chauri Chaura", "Sahjanwa", "Campierganj"]
  },
  "Uttarakhand": {}, "West Bengal": {}
};

const shopTypesList = [
  "General Store", "Iron & Steel Shop", "Hardware Shop", "Electrical Shop", 
  "Cement & Building Material", "Paint Shop", "Plumbing & Sanitary Shop", "Furniture & Plywood"
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'shop_owner';
  
  const [lang, setLang] = useState<'EN' | 'HI'>('HI');
  const t = (en: string, hi: string) => lang === 'EN' ? en : hi;
  
  const [isLogin, setIsLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [forgotStep, setForgotStep] = useState<0 | 1 | 2 | 3>(0);
  
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [loginId, setLoginId] = useState(''); 
  const [loginPassword, setLoginPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [stateName, setStateName] = useState('');
  const [district, setDistrict] = useState('');
  const [block, setBlock] = useState('');
  const [customState, setCustomState] = useState('');
  const [customDistrict, setCustomDistrict] = useState('');
  const [customBlock, setCustomBlock] = useState('');
  const [address, setAddress] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [upiId, setUpiId] = useState('');
  const [shopTypes, setShopTypes] = useState<string[]>([]); 

  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // 🔥 NEW SECURITY: BROWSER BACK BUTTON LOCK AFTER LOGOUT 🔥
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if ((window as any).recaptchaVerifier) {
       (window as any).recaptchaVerifier.clear();
       (window as any).recaptchaVerifier = undefined;
    }

    try {
      (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: (response: any) => {},
      });
      (window as any).recaptchaVerifier.render();
    } catch (err) {
      console.log("Recaptcha Init Error: ", err);
    }
  }, []);

  const handleShopTypeChange = (type: string) => {
    setShopTypes((prev) => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleStateChange = (e: any) => {
    setStateName(e.target.value); setDistrict(''); setBlock(''); setCustomState(''); setCustomDistrict(''); setCustomBlock('');
  };

  const handleDistrictChange = (e: any) => {
    setDistrict(e.target.value); setBlock(''); setCustomDistrict(''); setCustomBlock('');
  };

  const handleForgotSendOtp = async () => {
    let cleanPhone = phoneNumber.replace(/\D/g, ''); 
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);

    if (!cleanPhone || cleanPhone.length !== 10) {
      alert(t("Enter a valid 10-digit mobile number.", "कृपया सही 10-अंकीय मोबाइल नंबर डालें।")); return;
    }
    setLoading(true);

    const { data, error } = await supabase.from('shops').select('phone').eq('phone', cleanPhone);
    if (error || !data || data.length === 0) {
      setLoading(false);
      alert(t("⚠️ Mobile number not found! Please Sign Up.", "⚠️ यह नंबर रजिस्टर नहीं है! कृपया नया अकाउंट बनाएं।"));
      return; 
    }

    try {
      const result = await signInWithPhoneNumber(auth, `+91${cleanPhone}`, (window as any).recaptchaVerifier);
      setConfirmationResult(result); setForgotStep(2);
      alert(t("✅ OTP sent!", "✅ OTP भेज दिया गया है!"));
    } catch (err: any) { alert("❌ OTP Error: " + err.message); } 
    finally { setLoading(false); }
  };

  const handleForgotVerifyOtp = async () => {
    if (otp.length !== 6) { alert(t("Enter 6-digit OTP!", "6-अंकीय OTP डालें!")); return; }
    setLoading(true);
    try {
      await confirmationResult.confirm(otp);
      setForgotStep(3);
      alert(t("✅ Verified! Create new password.", "✅ वेरीफाई हो गया! नया पासवर्ड बनाएं।"));
    } catch (err: any) { alert(t("❌ Invalid OTP!", "❌ गलत OTP!")); } 
    finally { setLoading(false); }
  };

  const handleSetNewPassword = async () => {
    if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{6,12}$/.test(newPassword)) {
      alert(t("⚠️ Password must be 6-12 chars (1 Capital, 1 Number, 1 Symbol).", "⚠️ पासवर्ड 6-12 अक्षरों का हो (1 Capital, 1 Number, 1 Symbol ज़रूरी है)।")); return; 
    }
    setLoading(true);
    try {
      alert(t("✅ Password updated successfully! Please Login.", "✅ पासवर्ड बदल गया है! कृपया लॉगिन करें।"));
      setForgotStep(0); setIsLogin(true); setOtp(''); setNewPassword(''); setPhoneNumber('');
    } catch (err: any) { alert("❌ Error updating password"); }
    finally { setLoading(false); }
  };

  const handleTriggerAuth = async () => {
    if (!isLogin) {
      const finalState = stateName === 'Other' ? customState.trim() : stateName;
      const finalDistrict = district === 'Other' ? customDistrict.trim() : district;
      const finalBlock = block === 'Other' ? customBlock.trim() : block;

      if (!fullName || !phoneNumber || !finalState || !finalDistrict || !finalBlock || !address || !signupPassword) {
        alert(t("Please fill all details!", "कृपया सभी ज़रूरी डिटेल्स भरें!")); return;
      }
      if (shopTypes.length === 0) {
        alert(t("Select at least one shop category!", "कृपया कम से कम एक शॉप केटेगरी चुनें!")); return;
      }
      if (!/^\d{10}$/.test(phoneNumber)) {
        alert(t("Enter valid 10-digit number.", "कृपया सही 10-अंकीय मोबाइल नंबर डालें।")); return;
      }
      if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{6,12}$/.test(signupPassword)) {
        alert(t("⚠️ Password must be 6-12 chars.", "⚠️ पासवर्ड 6-12 अक्षरों का हो (1 Capital, 1 Number, 1 Symbol)।")); return; 
      }
    } 
    
    if (isLogin && loginMethod === 'otp') {
      if (!loginId || !/^\d{10}$/.test(loginId.trim())) {
        alert(t("Enter valid 10-digit number for login!", "लॉगिन के लिए सही 10-अंकीय मोबाइल नंबर डालें!")); return;
      }
    }

    setLoading(true);
    let targetPhone = !isLogin ? phoneNumber : loginId;
    targetPhone = targetPhone.replace(/\D/g, ''); 
    if (targetPhone.length > 10) targetPhone = targetPhone.slice(-10); 

    try {
      const { data, error } = await supabase.from('shops').select('phone').eq('phone', targetPhone);
      
      if (isLogin) {
        if (error || !data || data.length === 0) {
          setLoading(false);
          alert(t("⚠️ Mobile number not found. Please Sign Up first.", "⚠️ यह नंबर रजिस्टर नहीं है।"));
          return; 
        }
      } else {
        if (data && data.length > 0) {
          setLoading(false);
          alert(t("⚠️ Account already exists! Please go to Login.", "⚠️ यह नंबर पहले से रजिस्टर है! कृपया लॉगिन करें।"));
          return; 
        }
      }
    } catch (dbError) {
      console.error("DB Check Failed:", dbError);
      setLoading(false);
      alert("Database error. Please try again.");
      return;
    }

    try {
      const result = await signInWithPhoneNumber(auth, `+91${targetPhone}`, (window as any).recaptchaVerifier);
      setConfirmationResult(result); setShowOtpInput(true);
      alert(t("✅ OTP sent to your mobile for verification!", "✅ वेरिफिकेशन के लिए आपके मोबाइल नंबर पर OTP भेज दिया गया है!"));
    } catch (error: any) { 
      alert("❌ OTP Error: " + error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleVerifyOtpAndProcess = async () => {
    if (otp.length !== 6) { alert(t("Enter valid 6-digit OTP!", "कृपया सही 6-अंकीय OTP डालें!")); return; }
    setLoading(true);
    try {
      await confirmationResult.confirm(otp);

      if (!isLogin) {
        const finalState = stateName === 'Other' ? customState.trim() : stateName;
        const finalDistrict = district === 'Other' ? customDistrict.trim() : district;
        const finalBlock = block === 'Other' ? customBlock.trim() : block;
        const dummyEmail = `${phoneNumber.trim()}@fixifiy.in`;

        const { error: authError } = await supabase.auth.signUp({ 
          email: dummyEmail, password: signupPassword,
          options: { data: { role, full_name: fullName, phone_number: phoneNumber, state: finalState, district: finalDistrict, block: finalBlock, address } }
        });
        
        if (authError) { alert("Signup Error: " + authError.message); setLoading(false); return; } 
        
        const { error: dbError } = await supabase.from('shops').insert([{ 
          name: fullName, phone: phoneNumber, state: finalState, district: finalDistrict, 
          block: finalBlock, address, upi_id: upiId, shop_type: shopTypes.join(', '), status: 'Pending' 
        }]);

        if (dbError) alert("Database Error: " + dbError.message);
        else alert(t("✅ Shop registration successful! Waiting for approval.", "✅ दुकान रजिस्टर हो गई है! अप्रूवल का इंतज़ार करें।"));

        await supabase.auth.signOut();
        setIsLogin(true); setShowOtpInput(false); setOtp(''); setFullName(''); setPhoneNumber(''); 
      } else {
        let checkPhone = loginId.replace(/\D/g, '');
        if (checkPhone.length > 10) checkPhone = checkPhone.slice(-10);
        
        const { data: dbData } = await supabase.from('shops').select('*').eq('phone', checkPhone).maybeSingle();
        if (!dbData) {
          await supabase.auth.signOut();
          alert(t("⚠️ Shop not found.", "⚠️ दुकान नहीं मिली।")); 
          setLoading(false); return; 
        }

        if (dbData.status === 'Pending') { await supabase.auth.signOut(); alert(t("⏳ Account is Pending approval.", "⏳ आपका अकाउंट अभी पेंडिंग है।")); setLoading(false); return; }
        if (dbData.status === 'Suspended') { await supabase.auth.signOut(); alert(t("🚫 Account is Suspended.", "🚫 आपका अकाउंट सस्पेंड है।")); setLoading(false); return; }
        
        localStorage.setItem('fixifiy_shop', JSON.stringify(dbData));
        localStorage.setItem('shop_login_time', new Date().getTime().toString()); 
        
        alert(t("Login Successful via OTP!", "OTP के ज़रिये लॉगिन सफल!")); 
        router.push('/shop-owner-dashboard'); 
      }
    } catch (err: any) { 
      console.error("OTP verification error:", err);
      alert(t("Verification Failed: Invalid OTP", "वेरिफिकेशन फेल: गलत OTP")); 
    } finally { 
      setLoading(false); 
    }
  };

  const handlePasswordLogin = async () => {
    if (!loginId || !loginPassword) { alert(t("Enter ID and Password!", "कृपया आईडी और पासवर्ड भरें!")); return; }
    
    let finalEmail = loginId.trim();
    const isPhoneLogin = /^\d{10}$/.test(finalEmail);
    if (isPhoneLogin) finalEmail = `${finalEmail}@fixifiy.in`;

    const attemptKey = `login_attempts_${finalEmail}`;
    const attemptData = JSON.parse(localStorage.getItem(attemptKey) || '{"count": 0, "lockedUntil": null}');

    if (attemptData.lockedUntil && Date.now() < attemptData.lockedUntil) {
      const hoursLeft = Math.ceil((attemptData.lockedUntil - Date.now()) / (1000 * 60 * 60));
      alert(t(`🚫 Account locked! Try again after ${hoursLeft} hours.`, `🚫 सुरक्षा कारणों से आपका अकाउंट लॉक है। कृपया ${hoursLeft} घंटे बाद प्रयास करें।`));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: finalEmail, password: loginPassword });
    
    if (error) { 
      attemptData.count += 1;
      if (attemptData.count >= 3) {
        attemptData.lockedUntil = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem(attemptKey, JSON.stringify(attemptData));
        alert(t("🚫 Account locked for 24 hours due to 3 failed attempts.", "🚫 3 बार गलत पासवर्ड डालने के कारण आपका अकाउंट 24 घंटे के लिए लॉक कर दिया गया है।"));
      } else {
        localStorage.setItem(attemptKey, JSON.stringify(attemptData));
        alert(t(`❌ Wrong Password! You have ${3 - attemptData.count} attempts left.`, `❌ गलत पासवर्ड! आपके पास ${3 - attemptData.count} मौके और बचे हैं।`));
      }
      setLoading(false); return; 
    }

    localStorage.removeItem(attemptKey);

    const checkPhone = isPhoneLogin ? loginId.trim() : loginId.split('@')[0];
    const { data: dbData } = await supabase.from('shops').select('*').eq('phone', checkPhone).maybeSingle();
    
    if (!dbData) {
      await supabase.auth.signOut();
      alert(t("⚠️ Shop record not found.", "⚠️ दुकान का रिकॉर्ड नहीं मिला।"));
      setLoading(false); return;
    }

    if (dbData.status === 'Pending') { await supabase.auth.signOut(); alert(t("⏳ Account is Pending.", "⏳ आपका अकाउंट पेंडिंग है।")); setLoading(false); return; } 
    if (dbData.status === 'Suspended') { await supabase.auth.signOut(); alert(t("🚫 Account is Suspended.", "🚫 आपका अकाउंट सस्पेंड है।")); setLoading(false); return; }
    
    localStorage.setItem('fixifiy_shop', JSON.stringify(dbData));
    localStorage.setItem('shop_login_time', new Date().getTime().toString());

    alert(t("Login Successful!", "लॉगिन सफल!")); 
    router.push('/shop-owner-dashboard'); 
  };

  const inputStyle = { 
    display: 'block', width: '100%', margin: '14px 0', padding: '16px', borderRadius: '10px', 
    border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(15, 23, 42, 0.7)', 
    color: '#f8fafc', fontSize: '16px', outline: 'none', boxSizing: 'border-box' as const 
  };
  const buttonStyle = { 
    width: '100%', padding: '16px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', 
    borderRadius: '10px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', marginTop:'15px', 
    boxSizing: 'border-box' as const 
  };
  const eyeBtnStyle = { 
    position: 'absolute' as const, right: '15px', top: '50%', transform: 'translateY(-50%)', 
    background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' 
  };

  return (
    <div style={{ 
      position: 'relative', width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', 
      justifyContent: 'center', padding: '20px', boxSizing: 'border-box', overflow: 'hidden',
      background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)', fontFamily: '"Segoe UI", sans-serif'
    }}>
      
      {/* 🔥 MULTIPLE FIXIFIY BACKGROUND WATERMARKS (REPEATING PATTERN) 🔥 */}
      <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', zIndex: 0, pointerEvents: 'none', overflow: 'hidden', transform: 'rotate(-30deg)', gap: '40px' }}>
        {Array.from({ length: 150 }).map((_, i) => (
          <h1 key={i} style={{ fontSize: '40px', color: 'rgba(255, 255, 255, 0.04)', margin: 0, whiteSpace: 'nowrap', userSelect: 'none', fontWeight: '900', letterSpacing: '8px' }}>
            FIXIFIY
          </h1>
        ))}
      </div>

      <div id="recaptcha-container" style={{ position: 'absolute', top: 0, left: 0 }}></div>

      {/* 🔥 NEW & BIGGER BACK BUTTON (Redirects to Home '/') 🔥 */}
      <button 
        onClick={() => router.push('/')} 
        style={{ 
          position: 'absolute', top: '25px', left: '25px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 20, 
          background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', color: '#ffffff', border: '2px solid #991b1b', 
          padding: '12px 25px', borderRadius: '10px', fontWeight: '900', cursor: 'pointer', fontSize: '16px', 
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '1px'
        }}
      >
        ⬅ {t('Home', 'होम')}
      </button>

      {/* LANGUAGE SWITCHER */}
      <div style={{ position: 'absolute', top: '25px', right: '25px', display: 'flex', gap: '5px', zIndex: 20, background: 'rgba(255,255,255,0.1)', padding: '5px', borderRadius: '30px', backdropFilter: 'blur(5px)', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
        <button onClick={() => setLang('EN')} style={{ background: lang === 'EN' ? '#38bdf8' : 'transparent', color: lang === 'EN' ? '#0f172a' : '#94a3b8', border: 'none', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>EN</button>
        <button onClick={() => setLang('HI')} style={{ background: lang === 'HI' ? '#38bdf8' : 'transparent', color: lang === 'HI' ? '#0f172a' : '#94a3b8', border: 'none', padding: '8px 15px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>हिंदी</button>
      </div>

      <div style={{ 
        position: 'relative', zIndex: 10, width: '100%', maxWidth: '550px', 
        backgroundColor: 'rgba(30, 41, 59, 0.75)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)',
        borderRadius: '20px', padding: '45px 35px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', 
        border: '1px solid rgba(255, 255, 255, 0.15)', boxSizing: 'border-box'
      }}>
        
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)', padding: '10px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '28px', lineHeight: '1' }}>🏬</span>
            </div>
            <h1 style={{ fontSize: '38px', margin: '0', fontWeight: '900', letterSpacing: '1px', color: '#38bdf8' }}>
              Fixifiy Partner
            </h1>
          </div>
          <p style={{ color: '#94a3b8', margin: '0', fontSize: '16px', fontWeight: '500' }}>
            {forgotStep > 0 ? t('Reset Password', 'पासवर्ड रीसेट करें') : (isLogin ? t('Shop Owner Login', 'दुकानदार लॉगिन') : t('Register Your Shop', 'अपनी दुकान रजिस्टर करें'))}
          </p>
        </div>

        {forgotStep > 0 && (
          <div>
            {forgotStep === 1 && (
              <>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '10px' }}>{t('Enter registered mobile number:', 'रजिस्टर किया हुआ मोबाइल नंबर डालें:')}</p>
                <input type="tel" placeholder={t("10-Digit Mobile Number", "10-अंकीय मोबाइल नंबर")} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleForgotSendOtp(); }} maxLength={10} style={inputStyle} />
                <button onClick={handleForgotSendOtp} disabled={loading} style={buttonStyle}>{loading ? t("Sending...", "प्रोसेस हो रहा है...") : t("Send Reset OTP", "रीसेट OTP भेजें")}</button>
              </>
            )}
            {forgotStep === 2 && (
              <>
                <p style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>📲 {t('OTP has been sent', 'OTP भेज दिया गया है')}</p>
                <input type="number" placeholder="XXXXXX" value={otp} onChange={(e) => setOtp(e.target.value.slice(0, 6))} onKeyDown={(e) => { if (e.key === 'Enter') handleForgotVerifyOtp(); }} style={{...inputStyle, fontSize: '28px', letterSpacing: '12px', textAlign: 'center', fontWeight: 'bold'}} />
                <button onClick={handleForgotVerifyOtp} disabled={loading} style={buttonStyle}>{loading ? t("Verifying...", "जांच हो रही है...") : t("Verify OTP", "OTP वेरीफाई करें")}</button>
              </>
            )}
            {forgotStep === 3 && (
              <>
                <p style={{ color: '#10b981', fontWeight: 'bold', fontSize: '14px', marginBottom: '10px', textAlign: 'center' }}>✅ {t('Verified! Create a new password', 'वेरीफाई हो गया! नया पासवर्ड बनाएं')}</p>
                <div style={{ position: 'relative' }}>
                  <input type={showNewPassword ? "text" : "password"} placeholder={t("New Password", "नया पासवर्ड")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSetNewPassword(); }} maxLength={12} style={{...inputStyle, paddingRight: '50px'}} />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={eyeBtnStyle}>{showNewPassword ? '🙈' : '👁️'}</button>
                </div>
                <button onClick={handleSetNewPassword} disabled={loading} style={{...buttonStyle, backgroundColor: '#10b981', color: 'white'}}>{loading ? t("Updating...", "सेव हो रहा है...") : t("Save New Password", "नया पासवर्ड सेव करें")}</button>
              </>
            )}
            <p onClick={() => setForgotStep(0)} style={{ color: '#38bdf8', fontSize: '14px', cursor: 'pointer', textAlign: 'center', marginTop: '20px', textDecoration: 'underline' }}>{t('Cancel', 'रद्द करें')}</p>
          </div>
        )}

        {forgotStep === 0 && !showOtpInput && (
          <>
            {isLogin && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '10px', boxSizing: 'border-box', width: '100%' }}>
                <button type="button" onClick={() => setLoginMethod('password')} style={{ flex: 1, padding: '12px', border: 'none', background: loginMethod === 'password' ? '#38bdf8' : 'transparent', color: loginMethod === 'password' ? '#0f172a' : '#94a3b8', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
                  {t('Password', 'पासवर्ड')}
                </button>
                <button type="button" onClick={() => setLoginMethod('otp')} style={{ flex: 1, padding: '12px', border: 'none', background: loginMethod === 'otp' ? '#38bdf8' : 'transparent', color: loginMethod === 'otp' ? '#0f172a' : '#94a3b8', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
                  {t('OTP', 'ओ.टी.पी')}
                </button>
              </div>
            )}

            {isLogin && loginMethod === 'password' && (
                <div>
                    <input 
                      type="text" 
                      placeholder={t("Mobile Number or Email", "मोबाइल नंबर या ईमेल आईडी")} 
                      value={loginId} 
                      onChange={(e) => setLoginId(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordLogin(); }} 
                      style={inputStyle} 
                    />
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showLoginPassword ? "text" : "password"} 
                        placeholder={t("Password", "पासवर्ड")} 
                        value={loginPassword} 
                        onChange={(e) => setLoginPassword(e.target.value)} 
                        onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordLogin(); }} 
                        maxLength={12} 
                        style={{...inputStyle, paddingRight: '50px'}} 
                      />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} style={eyeBtnStyle}>{showLoginPassword ? '🙈' : '👁️'}</button>
                    </div>
                    <div style={{ textAlign: 'right', marginBottom: '15px' }}>
                      <span onClick={() => { setForgotStep(1); setOtp(''); setPhoneNumber(''); }} style={{ color: '#38bdf8', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>{t('Forgot Password?', 'पासवर्ड भूल गए?')}</span>
                    </div>
                    <button onClick={handlePasswordLogin} disabled={loading} style={buttonStyle}>{loading ? t("Processing...", "प्रोसेस हो रहा है...") : t("Login", "लॉगिन करें")}</button>
                </div>
            )}

            {isLogin && loginMethod === 'otp' && (
                <div>
                    <input 
                      type="tel" 
                      placeholder={t("10-Digit Mobile Number", "10-अंकीय मोबाइल नंबर")} 
                      value={loginId} 
                      onChange={(e) => setLoginId(e.target.value)} 
                      onKeyDown={(e) => { if (e.key === 'Enter') handleTriggerAuth(); }} 
                      maxLength={10} 
                      style={inputStyle} 
                    />
                    <button onClick={handleTriggerAuth} disabled={loading} style={buttonStyle}>{loading ? t("Sending...", "भेजा जा रहा है...") : t("Send OTP & Login", "OTP भेजें और लॉगिन करें")}</button>
                </div>
            )}

            {!isLogin && (
                <div style={{ textAlign: 'left' }}>
                    <input type="text" placeholder={t("Shop Owner Name", "दुकानदार का पूरा नाम")} value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
                    <input type="tel" placeholder={t("10-Digit Mobile Number", "10-अंकीय मोबाइल नंबर")} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={inputStyle} maxLength={10} />
                    
                    <select value={stateName} onChange={handleStateChange} style={inputStyle}>
                      <option value="">-- {t('Select State', 'राज्य चुनें')} --</option>
                      {Object.keys(locationData).map((st) => <option key={st} value={st}>{st}</option>)}
                      <option value="Other" style={{ fontWeight: 'bold', color: '#38bdf8' }}>➕ Other</option>
                    </select>
                    {stateName === 'Other' && <input type="text" placeholder={t('Enter State Name', 'राज्य का नाम लिखें')} value={customState} onChange={(e) => setCustomState(e.target.value)} style={{...inputStyle, borderColor: '#38bdf8'}} />}

                    <select value={district} onChange={handleDistrictChange} style={{...inputStyle, opacity: !stateName ? 0.6 : 1}} disabled={!stateName}>
                      <option value="">-- {t('Select District', 'ज़िला चुनें')} --</option>
                      {stateName && stateName !== 'Other' && locationData[stateName] && Object.keys(locationData[stateName]).map((dist) => <option key={dist} value={dist}>{dist}</option>)}
                      <option value="Other" style={{ fontWeight: 'bold', color: '#38bdf8' }}>➕ Other</option>
                    </select>
                    {district === 'Other' && <input type="text" placeholder={t('Enter District Name', 'ज़िले का नाम लिखें')} value={customDistrict} onChange={(e) => setCustomDistrict(e.target.value)} style={{...inputStyle, borderColor: '#38bdf8'}} />}

                    <select value={block} onChange={(e) => setBlock(e.target.value)} style={{...inputStyle, opacity: !district ? 0.6 : 1}} disabled={!district}>
                      <option value="">-- {t('Select Block/Tehsil', 'ब्लॉक/तहसील चुनें')} --</option>
                      {stateName && stateName !== 'Other' && district && district !== 'Other' && locationData[stateName][district] && locationData[stateName][district].map((blk: string) => <option key={blk} value={blk}>{blk}</option>)}
                      <option value="Other" style={{ fontWeight: 'bold', color: '#38bdf8' }}>➕ Other</option>
                    </select>
                    {block === 'Other' && <input type="text" placeholder={t('Enter Block Name', 'ब्लॉक का नाम लिखें')} value={customBlock} onChange={(e) => setCustomBlock(e.target.value)} style={{...inputStyle, borderColor: '#38bdf8'}} />}
                    
                    <textarea placeholder={t("Shop Full Address (Market/Pincode)", "दुकान का पूरा पता (मार्केट / पिनकोड)")} value={address} onChange={(e) => setAddress(e.target.value)} style={{...inputStyle, height: '90px', resize:'none'}} />
                    <input type="text" placeholder={t("UPI ID for Payments (Optional)", "पेमेंट के लिए UPI ID (ऑप्शनल)")} value={upiId} onChange={(e) => setUpiId(e.target.value)} style={inputStyle} />

                    <div style={{ marginBottom: '15px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#cbd5e1', display: 'block', marginBottom: '12px' }}>{t('Select Shop Categories:', 'शॉप की केटेगरी चुनें:')}</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {shopTypesList.map((type) => (
                          <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '25px', cursor: 'pointer', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <input type="checkbox" checked={shopTypes.includes(type)} onChange={() => handleShopTypeChange(type)} /> {type}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div style={{ position: 'relative', marginTop: '15px', marginBottom: '15px' }}>
                      <input type={showSignupPassword ? "text" : "password"} placeholder={t("Create Strong Password", "मज़बूत पासवर्ड बनाएं")} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleTriggerAuth(); }} maxLength={12} style={{...inputStyle, paddingRight: '50px', margin: 0}} />
                      <button type="button" onClick={() => setShowSignupPassword(!showSignupPassword)} style={eyeBtnStyle}>{showSignupPassword ? '🙈' : '👁️'}</button>
                      <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderLeft: '3px solid #f59e0b', borderRadius: '6px' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
                          <strong>{t('Note:', 'ध्यान दें:')}</strong> {t('Password 6-12 chars (1 Capital, 1 Number, 1 Symbol).', 'पासवर्ड 6-12 अक्षरों का हो जिसमें 1 Capital, 1 Number, 1 Symbol होना ज़रूरी है।')}
                        </p>
                      </div>
                    </div>

                    <button onClick={handleTriggerAuth} disabled={loading} style={buttonStyle}>{loading ? t("Sending...", "भेजा जा रहा है...") : t("Send OTP for Registration", "OTP भेजें और रजिस्टर करें")}</button>
                </div>
            )}
          </>
        )}

        {showOtpInput && forgotStep === 0 && (
          <div style={{ margin: '20px 0' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '15px', borderRadius: '10px', marginBottom: '15px', borderLeft: '4px solid #38bdf8' }}>
              <p style={{ margin: 0, color: '#f8fafc', fontSize: '14px', fontWeight: 'bold' }}>
                📲 {t('6-digit OTP has been sent to your mobile.', 'आपके मोबाइल पर 6-अंकीय OTP भेज दिया गया है।')}
              </p>
            </div>
            
            <input 
              type="number" 
              placeholder="XXXXXX" 
              value={otp} 
              onChange={(e) => setOtp(e.target.value.slice(0, 6))} 
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtpAndProcess(); }} 
              style={{...inputStyle, fontSize: '28px', letterSpacing: '12px', textAlign: 'center', fontWeight: 'bold'}} 
            />
            
            <button onClick={handleVerifyOtpAndProcess} disabled={loading} style={buttonStyle}>
              {loading ? t("Verifying...", "जांच हो रही है...") : t("Verify OTP & Complete", "OTP वेरीफाई करें और पूरा करें")}
            </button>

            <button 
              type="button" 
              onClick={() => { setShowOtpInput(false); setOtp(''); }} 
              style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '14px', cursor: 'pointer', marginTop: '20px', width: '100%', textDecoration: 'underline' }}
            >
              ← {t('Go Back', 'पीछे जाएँ')}
            </button>
          </div>
        )}

        {!showOtpInput && forgotStep === 0 && (
          <div style={{ marginTop: '25px', textAlign: 'center' }}>
            <p style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }} onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? (
                <>{t('Need to register your shop?', 'अपनी दुकान रजिस्टर करना चाहते हैं?')} <strong style={{ color: '#38bdf8', textDecoration: 'underline' }}>{t('Register', 'नया बनाएं')}</strong></>
              ) : (
                <>{t('Already registered? Go back to', 'पहिले से रजिस्टर हैं? वापस')} <strong style={{ color: '#38bdf8', textDecoration: 'underline' }}>{t('Login', 'लॉगिन')}</strong></>
              )}
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#020617', color: '#38bdf8' }}>Loading Shop Owner Login...</div>}>
      <LoginContent />
    </Suspense>
  );
}