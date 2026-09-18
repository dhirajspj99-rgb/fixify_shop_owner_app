"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LegalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const defaultTab = searchParams.get('tab') || 'about';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [lang, setLang] = useState<'EN' | 'HI'>('EN'); // 🔥 Language State Added

  useEffect(() => {
    if (searchParams.get('tab')) {
      setActiveTab(searchParams.get('tab') as string);
    }
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.replace(`/legal?tab=${tab}`);
  };

  const t = (enText: string, hiText: string) => lang === 'EN' ? enText : hiText;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', color: '#0f172a' }}>
      
      {/* HEADER */}
      <div style={{ background: 'white', padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button onClick={() => router.push('/')} style={{ background: '#f1f5f9', border: 'none', padding: '8px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginRight: '15px' }}>
            ← {t('Back', 'वापस')}
          </button>
          
          {/* 🔥 Clickable Fixifiy Logo */}
          <div onClick={() => router.push('/')} style={{ fontSize: '24px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '-1px', cursor: 'pointer' }}>
            F<span style={{ color: '#fb641b' }}>i</span>x<span style={{ color: '#2874f0' }}>i</span>fiy
          </div>
        </div>

        {/* 🔥 Language Toggle */}
        <div onClick={() => setLang(lang === 'EN' ? 'HI' : 'EN')} style={{ cursor: 'pointer', background: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', color: '#0f172a', border: '1px solid #e2e8f0' }}>
          🌐 {lang === 'EN' ? 'English' : 'हिंदी'}
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '20px' }}>
          {t('Legal & Policies', 'कानूनी और नीतियां')}
        </h1>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', overflowX: 'auto', paddingBottom: '5px' }}>
          <button onClick={() => handleTabChange('about')} style={{ padding: '10px 20px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'about' ? '#2874f0' : '#e2e8f0', color: activeTab === 'about' ? 'white' : '#475569', whiteSpace: 'nowrap' }}>
            {t('About Us', 'हमारे बारे में')}
          </button>
          <button onClick={() => handleTabChange('privacy')} style={{ padding: '10px 20px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'privacy' ? '#2874f0' : '#e2e8f0', color: activeTab === 'privacy' ? 'white' : '#475569', whiteSpace: 'nowrap' }}>
            {t('Privacy Policy', 'गोपनीयता नीति')}
          </button>
          <button onClick={() => handleTabChange('terms')} style={{ padding: '10px 20px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTab === 'terms' ? '#2874f0' : '#e2e8f0', color: activeTab === 'terms' ? 'white' : '#475569', whiteSpace: 'nowrap' }}>
            {t('Terms & Conditions', 'नियम और शर्तें')}
          </button>
        </div>

        {/* CONTENT AREA */}
        <div style={{ background: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', lineHeight: '1.7' }}>
          
          {activeTab === 'about' && (
            <div>
              <h2 style={{ color: '#0f172a', borderBottom: '2px solid #2874f0', paddingBottom: '10px', display: 'inline-block' }}>{t('About Fixifiy', 'फिक्सिफ़ाई के बारे में')}</h2>
              <p>{t("Welcome to ", "फिक्सिफ़ाई (महादेव एंटरप्राइजेज की एक इकाई) में आपका ")}<strong>Fixifiy</strong>{t(" (A unit of Mahadev Enterprises). We are India's leading Digital Byapar Manch and E-Commerce platform, committed to bringing local shops, mechanics, and services online.", " स्वागत है। हम भारत के अग्रणी डिजिटल व्यापार मंच और ई-कॉमर्स प्लेटफॉर्म हैं, जो स्थानीय दुकानों, मिस्त्रियों और सेवाओं को ऑनलाइन लाने के लिए प्रतिबद्ध हैं।")}</p>
              <p>{t("Our mission is to empower local businesses by providing them with a robust digital inventory system, order management, and a massive customer reach. Whether you are a general store owner, a hardware merchant, or a verified service provider, Fixifiy is your trusted growth partner.", "हमारा मिशन स्थानीय व्यवसायों को मजबूत डिजिटल इन्वेंट्री, ऑर्डर प्रबंधन और बड़े ग्राहक आधार से जोड़कर सशक्त बनाना है। चाहे आप जनरल स्टोर के मालिक हों या हार्डवेयर मर्चेंट, फिक्सिफ़ाई आपका भरोसेमंद पार्टनर है।")}</p>
              <h3>{t('Contact Details', 'सम्पर्क जानकारी')}</h3>
              <ul style={{ color: '#475569' }}>
                <li><strong>{t('Office:', 'कार्यालय:')}</strong> Plot No. 271, Narpa, Samastipur, Bihar - 848207</li>
                <li><strong>{t('Phone:', 'फ़ोन:')}</strong> +91 9709740882</li>
                {/* 🔥 New Email Added */}
                <li><strong>{t('Email:', 'ईमेल:')}</strong> support@fixifiy.in, fixifiyindia@gmail.com</li>
              </ul>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              <h2 style={{ color: '#0f172a', borderBottom: '2px solid #16a34a', paddingBottom: '10px', display: 'inline-block' }}>{t('Privacy Policy', 'गोपनीयता नीति')}</h2>
              <p>{t("Your privacy is important to us. This policy explains how we collect, use, and protect your data.", "आपकी गोपनीयता हमारे लिए महत्वपूर्ण है। यह नीति बताती है कि हम आपका डेटा कैसे एकत्र, उपयोग और सुरक्षित करते हैं।")}</p>
              <h3>{t('1. Data Collection', '1. डेटा संग्रह')}</h3>
              <p>{t("We collect essential details such as your phone number (via OTP authentication), shop details, inventory data, and location to provide seamless services.", "हम निर्बाध सेवाएं प्रदान करने के लिए आपका फोन नंबर, दुकान विवरण, इन्वेंट्री डेटा और लोकेशन जैसी आवश्यक जानकारी एकत्र करते हैं।")}</p>
              <h3>{t('2. Data Security', '2. डेटा सुरक्षा')}</h3>
              <p>{t("We use industry-standard encryption and secure databases (like Supabase and Firebase) to ensure your data is safe and is not shared with unauthorized third parties.", "हम यह सुनिश्चित करने के लिए उद्योग-मानक एन्क्रिप्शन और सुरक्षित डेटाबेस (जैसे Supabase और Firebase) का उपयोग करते हैं कि आपका डेटा सुरक्षित रहे।")}</p>
              <h3>{t('3. User Rights', '3. उपयोगकर्ता के अधिकार')}</h3>
              <p>{t("You can request to delete your account or inventory data at any time by contacting our support team.", "आप हमारी सहायता टीम से संपर्क करके किसी भी समय अपना खाता या डेटा हटाने का अनुरोध कर सकते हैं।")}</p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div>
              <h2 style={{ color: '#0f172a', borderBottom: '2px solid #fb641b', paddingBottom: '10px', display: 'inline-block' }}>{t('Terms & Conditions', 'नियम और शर्तें')}</h2>
              <p>{t("By using the Fixifiy Partner or Customer applications, you agree to the following terms:", "फिक्सिफ़ाई पार्टनर या ग्राहक ऐप का उपयोग करके, आप निम्नलिखित शर्तों से सहमत होते हैं:")}</p>
              <h3>{t('1. Platform Usage', '1. मंच का उपयोग')}</h3>
              <p>{t("Fixifiy acts as a bridge between shop owners and customers. Shop owners are responsible for the accuracy of their inventory, pricing, and product quality.", "फिक्सिफ़ाई दुकानदारों और ग्राहकों के बीच एक पुल के रूप में कार्य करता है। दुकानदार अपनी इन्वेंट्री और मूल्य निर्धारण की सटीकता के लिए जिम्मेदार हैं।")}</p>
              <h3>{t('2. Payments & Delivery', '2. भुगतान और डिलीवरी')}</h3>
              <p>{t("For Cash on Delivery (COD) orders, shop owners must ensure proper delivery and collection. Fixifiy is not liable for customer defaults on COD.", "कैश ऑन डिलीवरी (COD) ऑर्डर्स के लिए, दुकानदारों को डिलीवरी और भुगतान सुनिश्चित करना होगा। ग्राहक द्वारा डिफ़ॉल्ट करने पर फिक्सिफ़ाई उत्तरदायी नहीं है।")}</p>
              <h3>{t('3. Account Suspension', '3. खाता निलंबन')}</h3>
              <p>{t("Fixifiy reserves the right to suspend any partner account that violates local laws, sells prohibited items, or receives consistent negative feedback.", "फिक्सिफ़ाई के पास ऐसे किसी भी पार्टनर खाते को निलंबित करने का अधिकार है जो नियमों का उल्लंघन करता है या निषिद्ध वस्तुएं बेचता है।")}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function LegalPage() {
  return (
    <Suspense fallback={<div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading Policies...</div>}>
      <LegalContent />
    </Suspense>
  );
}