"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShopOwnerGuestHomePage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [lang, setLang] = useState<'EN' | 'HI'>('EN');

  useEffect(() => {
    setIsMounted(true);
    
    const shopData = localStorage.getItem('fixifiy_shop');
    const loginTime = localStorage.getItem('shop_login_time'); 

    if (shopData) {
      if (loginTime && !isNaN(parseInt(loginTime))) {
        const currentTime = new Date().getTime();
        const timePassed = currentTime - parseInt(loginTime);
        const hours24 = 24 * 60 * 60 * 1000;

        if (timePassed > hours24) {
          localStorage.removeItem('fixifiy_shop');
          localStorage.removeItem('shop_login_time');
        } else {
          router.replace('/shop-owner-dashboard');
        }
      } else {
        localStorage.setItem('shop_login_time', new Date().getTime().toString());
        router.replace('/shop-owner-dashboard');
      }
    }
  }, [router]);

  const t = (enText: string, hiText: string) => lang === 'EN' ? enText : hiText;

  const sharedStyles = `
    .main-bg { background: #f8fafc; min-height: 100vh; font-family: system-ui, sans-serif; color: #0f172a; display: flex; flex-direction: column; }
    .hero-banner { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white; padding: 50px 16px; text-align: center; border-bottom-left-radius: 40px; border-bottom-right-radius: 40px; box-shadow: 0 10px 40px rgba(15,23,42,0.2); margin-bottom: 30px; box-sizing: border-box; width: 100%; }
    .brand-logo-card { background: #ffffff; padding: 12px 25px; border-radius: 12px; display: inline-flex; flex-direction: column; align-items: center; box-shadow: 0 8px 25px rgba(0,0,0,0.2); border-bottom: 4px solid #fb641b; margin-bottom: 15px; position: relative; }
    .brand-text-logo { font-size: clamp(28px, 6vw, 48px); font-weight: 900; font-style: italic; font-family: 'Arial Black', Impact, sans-serif; letter-spacing: -1.5px; line-height: 1; display: flex; align-items: center; cursor: pointer; }
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; width: 100%; box-sizing: border-box; }
    .feature-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 25px 20px; text-align: center; transition: 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.05); box-sizing: border-box; }
    .feature-card:hover { transform: translateY(-5px); border-color: #38bdf8; box-shadow: 0 10px 25px rgba(40,116,240,0.15); }
  `;

  if (!isMounted) return null;

  return (
    <div className="main-bg">
      <style>{sharedStyles}</style>
      
      {/* HEADER */}
      <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(15px)', position: 'sticky', top: 0, zIndex: 100, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 🔥 Logo click par Home Page */}
          <div onClick={() => router.push('/')} style={{ cursor: 'pointer', fontSize: '24px', fontWeight: '900', fontStyle: 'italic', color: '#0f172a', letterSpacing: '-1px' }}>
            F<span style={{color: '#fb641b'}}>i</span>x<span style={{color: '#2874f0'}}>i</span>fiy <span style={{ color: '#475569', fontWeight: '600', fontSize: '13px', fontStyle: 'normal' }}>Partner</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div onClick={() => setLang(lang === 'EN' ? 'HI' : 'EN')} style={{ cursor: 'pointer', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
            🌐 {lang === 'EN' ? 'English' : 'हिंदी'}
          </div>
          <button type="button" onClick={() => router.push('/login')} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.15)', fontSize: '12px' }}>
            {t('Login / Register', 'लॉगिन / रजिस्टर')}
          </button>
        </div>
      </div>

      {/* HERO BANNER (Colorful) */}
      <div className="hero-banner">
        <div style={{ display: 'inline-block', background: 'rgba(255, 255, 255, 0.15)', padding: '6px 16px', borderRadius: '25px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px', marginBottom: '15px', color: '#fbbf24', border: '1px solid rgba(255, 255, 255, 0.2)', textTransform: 'uppercase' }}>
          🇮🇳 {t("India's No. 1 Digital Byapar Manch for Shop Owners", "दुकानदारों के लिए भारत का नंबर 1 डिजिटल व्यापार मंच")}
        </div>
        <br/>
        <div className="brand-logo-card">
          {/* 🔥 Logo click par Home Page */}
          <div onClick={() => router.push('/')} className="brand-text-logo" style={{ cursor: 'pointer' }}>
            <span style={{ color: '#0a192f' }}>F</span><span style={{ color: '#0a192f' }}>i</span>
            <span style={{ color: '#fb641b', position: 'relative' }}>x<span style={{ position: 'absolute', top: '-10px', right: '-12px', fontSize: 'clamp(16px, 3vw, 24px)' }}>🏬</span></span>
            <span style={{ color: '#0a192f' }}>i</span><span style={{ color: '#0a192f' }}>f</span><span style={{ color: '#0a192f' }}>i</span><span style={{ color: '#0a192f' }}>y</span>
          </div>
        </div>
        <h1 style={{ fontSize: 'clamp(20px, 4vw, 30px)', fontWeight: 800, margin: '10px 0 12px 0', lineHeight: 1.3, color: '#f8fafc', padding: '0 10px' }}>
          {t("Apni Dukaan Ko Digital Banayein, Products Add Karein aur Orders Accept Karein! ✨", "अपनी दुकान को डिजिटल बनाएं, प्रोडक्ट्स ऐड करें और ऑर्डर्स एक्सेप्ट करें! ✨")}
        </h1>
        <p style={{ fontSize: 'clamp(13px, 2.5vw, 15px)', opacity: 0.9, maxWidth: '750px', margin: '0 auto 25px auto', color: '#cbd5e1', lineHeight: '1.6', padding: '0 10px' }}>
          {t("Login karke apni inventory manage karein, naye items joden aur apne kshetra ke hazaron gahakon tak aasani se pahuchein.", "लॉगिन करके अपनी इन्वेंटरी मैनेज करें, नए आइटम्स जोड़ें और अपने क्षेत्र के हजारों ग्राहकों तक आसानी से पहुंचें।")}
        </p>
        <button 
          type="button"
          onClick={() => router.push('/login')}
          style={{ background: '#fb641b', color: 'white', border: 'none', padding: '14px 35px', borderRadius: '30px', fontWeight: '900', fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 25px rgba(251,100,27,0.4)' }}
        >
          {t('🚀 Shop Owner Login / Signup', '🚀 शॉप ओनर लॉगिन / साइनअप')}
        </button>
      </div>

      {/* HOW IT WORKS SECTION (White Cards) */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px 40px 20px', width: '100%', boxSizing: 'border-box' }}>
        <h3 style={{ fontSize: '22px', fontWeight: '900', textAlign: 'center', marginBottom: '25px', color: '#0f172a' }}>
          🛠️ {t("How It Works for Shop Owners", "दुकानदारों के लिए यह कैसे काम करता है")}
        </h3>

        <div className="features-grid">
          <div className="feature-card">
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>📦</div>
            <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#2874f0', marginBottom: '10px' }}>
              {t("1. Instant Product Addition", "1. तुरंत प्रोडक्ट जोड़ें")}
            </h4>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
              {t("Login karne ke baad apne stock mein naye products, price, stock aur detailed specifications aasaani se add karein.", "लॉगिन करने के बाद अपने स्टॉक में नए प्रोडक्ट्स, प्राइस, स्टॉक और डिटेल्ड स्पेसिफिकेशन्स आसानी से ऐड करें।")}
            </p>
          </div>

          <div className="feature-card">
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>🔔</div>
            <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#16a34a', marginBottom: '10px' }}>
              {t("2. Accept & Manage Orders", "2. ऑर्डर्स स्वीकार करें और मैनेज करें")}
            </h4>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
              {t("Gahakon dwara diye gaye naye orders ko dashboard par dekhein aur ek click mein accept karke delivery ke liye tayar karein.", "ग्राहकों द्वारा दिए गए नए ऑर्डर्स को डैशबोर्ड पर देखें और एक क्लिक में एक्सेप्ट करके डिलीवरी के लिए तैयार करें।")}
            </p>
          </div>

          <div className="feature-card">
            <div style={{ fontSize: '40px', marginBottom: '15px' }}>💰</div>
            <h4 style={{ fontSize: '18px', fontWeight: '900', color: '#fb641b', marginBottom: '10px' }}>
              {t("3. Grow Your Local Business", "3. अपने स्थानीय व्यापार को बढ़ाएं")}
            </h4>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: 0 }}>
              {t("Fixifiy platform ke zariye bina kisi extra cost ke apne local area mein apni dukan ki bikri ko kai guna badhayein.", "फिक्सिफ़ाई प्लेटफॉर्म के ज़रिए बिना किसी एक्स्ट्रा कॉस्ट के अपने लोकल एरिया में अपनी दुकान की बिक्री को कई गुना बढ़ाएं।")}
            </p>
          </div>
        </div>
      </div>

      {/* 🔥 FULLY TRANSLATED FOOTER WITH WORKING LEGAL LINKS 🔥 */}
      <footer className="no-print" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#cbd5e1', padding: '50px 20px 30px 20px', marginTop: 'auto', borderTop: '4px solid #fb641b', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '30px' }}>
          <div>
            {/* 🔥 Footer Logo click par Home Page */}
            <div onClick={() => router.push('/')} style={{ cursor: 'pointer', fontSize: '30px', fontWeight: '900', fontStyle: 'italic', fontFamily: 'Arial Black, Impact, sans-serif', color: 'white', marginBottom: '15px', letterSpacing: '-1px' }}>
              F<span style={{ color: 'white' }}>i</span><span style={{ color: '#fb641b' }}>x</span><span style={{ color: 'white' }}>i</span>fiy <span style={{ fontSize: '14px', fontStyle: 'normal', color: '#fb641b' }}>Partner</span>
            </div>
            <p style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '15px', color: '#94a3b8' }}>
              <strong>Fixifiy Technology</strong> {t("(A unit of Mahadev Enterprises). India's leading Digital Byapar Manch for local retail shop owners.", "(महादेव एंटरप्राइजेज की इकाई)। स्थानीय खुदरा दुकानदारों के लिए भारत का अग्रणी डिजिटल व्यापार मंच।")}
            </p>
          </div>
          <div>
            <h4 style={{ color: 'white', fontSize: '16px', fontWeight: '800', margin: '0 0 15px 0', borderBottom: '3px solid #2874f0', paddingBottom: '6px', display: 'inline-block' }}>
              {t("Quick Links", "क्विक लिंक्स")}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', lineHeight: '2.2', color: '#94a3b8' }}>
              <li style={{cursor: 'pointer'}} onClick={() => router.push('/login')}>➔ {t("Partner Login / Register", "पार्टनर लॉगिन / रजिस्टर")}</li>
              <li style={{cursor: 'pointer'}} onClick={() => router.push('/legal?tab=about')}>➔ {t("About Fixifiy", "फिक्सिफ़ाई के बारे में")}</li>
              <li style={{cursor: 'pointer'}} onClick={() => router.push('/legal?tab=privacy')}>➔ {t("Privacy Policy", "गोपनीयता नीति")}</li>
              <li style={{cursor: 'pointer'}} onClick={() => router.push('/legal?tab=terms')}>➔ {t("Terms & Conditions", "नियम और शर्तें")}</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: 'white', fontSize: '16px', fontWeight: '800', margin: '0 0 15px 0', borderBottom: '3px solid #16a34a', paddingBottom: '6px', display: 'inline-block' }}>
              {t("Corporate Office", "कॉर्पोरेट कार्यालय")}
            </h4>
            <div style={{ fontSize: '13px', lineHeight: '1.8', color: '#94a3b8' }}>
              <div>📍 {t("Plot No. 271, Narpa, Hasanpur Main Road, Samastipur, Bihar - 848207", "प्लॉट नंबर 271, नरपा, हसनपुर मेन रोड, समस्तीपुर, बिहार - 848207")}</div>
              <div>📞 {t("Helpline:", "हेल्पलाइन:")} +91 9709740882</div>
              {/* 🔥 New Email Added */}
              <div>✉️ {t("Email:", "ईमेल:")} support@fixifiy.in, fixifiyindia@gmail.com</div>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: '1100px', margin: '30px auto 0 auto', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '20px', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
          © {new Date().getFullYear()} Fixifiy Partner {t("(A unit of Mahadev Enterprises). All Rights Reserved.", "(महादेव एंटरप्राइजेज की एक इकाई)। सर्वाधिकार सुरक्षित।")}
        </div>
      </footer>

    </div>
  );
}