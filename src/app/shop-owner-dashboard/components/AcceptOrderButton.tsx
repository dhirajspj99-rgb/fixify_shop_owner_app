'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 

export default function AcceptOrderButton({ 
  orderId, 
  currentStatus, 
  paymentMethod, 
  paymentStatus, 
  isPaymentVerified, 
  onStatusChange 
}: any) {
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');

  // 🔥 Aaj ki date aur time nikal rahe hain taki purana (back) time select na ho
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const minDateTime = now.toISOString().slice(0, 16);

  // Check UPI/Online payment
  const isUpiOrder = String(paymentMethod || '').toUpperCase().includes('UPI') || 
                     String(paymentMethod || '').toUpperCase().includes('UTR') || 
                     String(paymentMethod || '').toUpperCase().includes('WALLET');

  const handleInitialClick = () => {
    setShowDatePicker(true);
  };

  const confirmAcceptOrder = async () => {
    if (!selectedDate) {
      alert("Kripya delivery/processing ki Date aur Time select karein!");
      return;
    }

    setLoading(true);
    
    // 🔥 Date ko sundar format mein badalna (e.g. 12 Oct 2024, 02:30 PM)
    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });

    // 🔥 Sirf 'orders' table update hogi (Labour yahan se hata diya gaya hai)
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'accepted',
        estimated_delivery: formattedDate 
      }) 
      .eq('id', orderId);

    setLoading(false);

    if (error) {
      console.error("Order accept error:", error.message);
      alert("Kuch galat ho gaya: " + error.message);
    } else {
      alert("✅ Order Successfully Accept Kar Liya Gaya!");
      setShowDatePicker(false);
      if (onStatusChange) onStatusChange(); 
    }
  };

  // Agar pehle se accepted ya aage ke process me hai
  if (['accepted', 'processing', 'completed', 'delivered'].includes((currentStatus || '').toLowerCase().trim())) {
    return <span style={{ color: '#10b981', fontWeight: 'bold', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', border: '1px solid #10b981' }}>Accepted ✅</span>;
  }

  // 🔥 UPI Verification Logic (HIDE BUTTON) 🔥
  if (isUpiOrder) {
    // Agar Payment Fake ya Reject ho chuki hai
    if (paymentStatus?.toLowerCase() === 'failed' || paymentStatus?.toLowerCase() === 'rejected') {
      return (
        <span style={{ padding: '8px 16px', backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', display: 'inline-block' }}>
          ❌ Failed Payment
        </span>
      );
    }

    // 🔥 Agar Admin ne verify NAHI kiya hai, toh button puri tarah HIDE (Gayab) rahega
    if (!isPaymentVerified) {
      return null; // Return null ka matlab hai UI mein kuch render nahi hoga
    }
  }

  // 🔥 Calendar Modal View (Date + Time) 🔥
  if (showDatePicker) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #3b82f6', minWidth: '220px' }}>
        <label style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 'bold', margin: 0 }}>📅 Expected Delivery Time:</label>
        <input 
          type="datetime-local" 
          min={minDateTime} 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', outline: 'none', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setShowDatePicker(false)} 
            disabled={loading}
            style={{ flex: 1, padding: '10px', backgroundColor: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            Cancel
          </button>
          <button 
            onClick={confirmAcceptOrder} 
            disabled={loading}
            style={{ flex: 1, padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            {loading ? "⏳ Saving" : "✅ Confirm"}
          </button>
        </div>
      </div>
    );
  }

  // 🔥 Default Action Button (Tab dikhega jab COD ho, ya UPI verified ho) 🔥
  return (
    <button 
      onClick={handleInitialClick} 
      style={{ padding: '10px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: '0.2s', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}
    >
      {isUpiOrder ? "✅ Verification Done (Accept)" : "✅ Accept Order (COD)"}
    </button>
  );
}