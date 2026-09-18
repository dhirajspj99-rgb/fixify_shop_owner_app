'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 

export default function AcceptOrderButton({ 
  orderId, 
  currentStatus, 
  paymentMethod, 
  paymentStatus, 
  onStatusChange 
}: any) {
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false); // 🔥 कैलेंडर दिखाने के लिए
  const [selectedDate, setSelectedDate] = useState(''); // 🔥 सेलेक्ट की गई तारीख स्टोर करने के लिए

  // 🔥 आज की तारीख निकाल रहे हैं ताकि पुरानी तारीख (Back Date) सेलेक्ट ना हो सके
  const today = new Date().toISOString().split('T')[0];

  const handleInitialClick = () => {
    // Safety check
    if (paymentMethod === 'UPI' && paymentStatus === 'pending') {
      alert("Admin dwara payment verify hone ka intezar karein.");
      return;
    }
    // अगर सब सही है, तो कैलेंडर दिखाओ
    setShowDatePicker(true);
  };

  const confirmAcceptOrder = async () => {
    if (!selectedDate) {
      alert("Kripya delivery/processing ki date select karein!");
      return;
    }

    setLoading(true);
    
    // 🔥 डेटाबेस अपडेट: स्टेटस 'accepted' और साथ में डेट भी सेव होगी
    // (ध्यान दें: आपके Supabase table 'orders' में 'expected_delivery_date' नाम का कॉलम होना चाहिए, अगर कॉलम का नाम अलग है तो यहाँ बदल लें)
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'accepted',
        expected_delivery_date: selectedDate // 🔥 यहाँ तारीख सेव हो रही है
      }) 
      .eq('id', orderId);

    setLoading(false);

    if (error) {
      console.error("Order accept error:", error.message);
      alert("Kuch galat ho gaya.");
    } else {
      alert("✅ Order Successfully Accept Kar Liya Gaya!");
      setShowDatePicker(false);
      if (onStatusChange) onStatusChange(); 
    }
  };

  if (['accepted', 'processing', 'completed', 'delivered'].includes(currentStatus)) {
    return <span style={{ color: '#10b981', fontWeight: 'bold' }}>Accepted ✅</span>;
  }

  // 🔥 UPI Payment Verification Logic 🔥
  if (paymentMethod === 'UPI') {
    if (paymentStatus === 'pending' || !paymentStatus) {
      return (
        <button 
          disabled
          style={{ padding: '8px 16px', backgroundColor: '#475569', color: '#cbd5e1', border: '1px solid #94a3b8', borderRadius: '5px', cursor: 'not-allowed', fontWeight: 'bold' }}
        >
          🔒 Waiting for Admin
        </button>
      );
    }
    
    if (paymentStatus === 'failed') {
      return (
        <button 
          disabled
          style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'not-allowed', fontWeight: 'bold' }}
        >
          ❌ Fake Payment
        </button>
      );
    }
  }

  // 🔥 अगर कैलेंडर ओपन है (जब दुकानदार ने Accept पर क्लिक किया) 🔥
  if (showDatePicker) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', border: '1px solid #3b82f6' }}>
        <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>Select Expected Date:</label>
        <input 
          type="date" 
          min={today} // 🔥 इससे पुरानी तारीख डिसेबल हो जाएगी
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: '8px', borderRadius: '5px', border: '1px solid #94a3b8', backgroundColor: '#0f172a', color: 'white' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowDatePicker(false)} 
            disabled={loading}
            style={{ flex: 1, padding: '8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Cancel
          </button>
          <button 
            onClick={confirmAcceptOrder} 
            disabled={loading}
            style={{ flex: 1, padding: '8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
          >
            {loading ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    );
  }

  // 🔥 Default (COD ya UPI Verified) Button 🔥
  return (
    <button 
      onClick={handleInitialClick} 
      style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
    >
      {paymentMethod === 'UPI' ? "✅ Payment Secured (Accept)" : "✅ Accept Order (COD)"}
    </button>
  );
}