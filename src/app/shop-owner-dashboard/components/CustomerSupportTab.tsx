"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/supabase'; // 👈 अपने सही पाथ के अनुसार इसे सेट करें

export default function CustomerSupportTab({ currentShop }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🤖 एडमिन का वेलकम मैसेज
  const botGreeting = "नमस्ते! मैं Fixifiy Admin Support हूँ। आपकी शॉप या ऑर्डर्स से जुड़ी कोई भी समस्या या सवाल हो, तो आप सीधे मुझे यहाँ मैसेज कर सकते हैं।";

  // 🔥 1. पुराने मैसेजेस Fetch करना (helpdesk_chats टेबल से)
  useEffect(() => {
    if (!currentShop?.id) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('helpdesk_chats') // 👈 नई टेबल का नाम
        .select('*')
        .eq('shop_id', currentShop.id)
        .order('created_at', { ascending: true });

      if (data && data.length > 0) {
        setMessages(data);
      }
    };

    fetchMessages();
  }, [currentShop?.id]);

  // 🔥 2. REAL-TIME CONNECTION (Admin Dashboard से लाइव रिप्लाई)
  useEffect(() => {
    if (!currentShop?.id) return;

    const channel = supabase
      .channel(`shop-helpdesk-${currentShop.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'helpdesk_chats', // 👈 नई टेबल
        filter: `shop_id=eq.${currentShop.id}` 
      }, (payload) => {
        const newMsg = payload.new;
        // अगर मैसेज एडमिन ने भेजा है, तो तुरंत स्क्रीन पर दिखाओ
        if (newMsg.sender === 'admin') {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentShop?.id]);

  // चैट को हमेशा नीचे स्क्रॉल करके रखना
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 🔥 3. शॉप ओनर का मैसेज एडमिन को भेजना (Database Insert)
  const handleSend = async () => {
    if (!input.trim() || isSending || !currentShop?.id) return;
    
    const userMessage = input;
    setInput('');
    setIsSending(true);

    const newMsgObj = {
      shop_id: currentShop.id,
      message: userMessage,
      sender: 'shop' // 👈 शॉप ओनर मैसेज भेज रहा है
    };

    // स्क्रीन पर तुरंत दिखाना
    setMessages(prev => [...prev, newMsgObj]);

    try {
      // Supabase में सेव करना
      const { error } = await supabase.from('helpdesk_chats').insert([newMsgObj]);
      if (error) throw error;
    } catch (error: any) {
      console.error("Chat send error:", error.message);
      alert("❌ मैसेज नहीं जा सका। कृपया दोबारा प्रयास करें।");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '80vh', backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #38bdf8', overflow: 'hidden' }}>
      
      {/* HEADER */}
      <div style={{ backgroundColor: '#0284c7', padding: '15px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '24px' }}>🎧</span>
        <div>
          <h2 style={{ margin: '0', color: 'white', fontSize: '18px' }}>Fixifiy Admin Support</h2>
          <p style={{ margin: '2px 0 0 0', color: '#bae6fd', fontSize: '12px' }}>शॉप ID: {currentShop?.id || 'Loading...'}</p>
        </div>
      </div>

      {/* CHAT AREA */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#1e293b' }}>
        
        {/* Welcome Bot Message */}
        <div style={{ alignSelf: 'flex-start', background: '#334155', color: 'white', padding: '12px 16px', borderRadius: '12px 12px 12px 4px', maxWidth: '80%', fontSize: '14px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          <div style={{fontSize: '11px', fontWeight: 'bold', color: '#93c5fd', marginBottom: '4px'}}>🛠️ Admin Support</div>
          {botGreeting}
        </div>

        {/* Live Messages */}
        {messages.map((msg, idx) => {
          const isMe = msg.sender === 'shop';
          return (
            <div key={idx} style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              background: isMe ? '#10b981' : '#334155', 
              color: 'white',
              padding: '12px 16px', 
              borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px', 
              maxWidth: '80%', 
              fontSize: '14px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
              <div style={{fontSize: '11px', fontWeight: 'bold', color: isMe ? '#d1fae5' : '#93c5fd', marginBottom: '4px'}}>
                {isMe ? '🏪 You (Shop)' : '🛠️ Fixifiy Admin'}
              </div>
              {msg.message}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      {/* INPUT AREA */}
      <div style={{ padding: '15px', borderTop: '1px solid #334155', display: 'flex', gap: '10px', backgroundColor: '#0f172a' }}>
        <input 
          type="text" 
          placeholder="एडमिन को अपना मैसेज लिखें..." 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
          disabled={isSending || !currentShop?.id}
          style={{ flex: 1, padding: '15px', borderRadius: '8px', border: '1px solid #475569', outline: 'none', fontSize: '14px', backgroundColor: '#1e293b', color: 'white' }} 
        />
        <button 
          onClick={handleSend} 
          disabled={isSending || !currentShop?.id}
          style={{ background: isSending ? '#475569' : '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '0 25px', cursor: isSending ? 'not-allowed' : 'pointer', fontSize: '16px', fontWeight: 'bold', transition: '0.2s' }}
        >
          {isSending ? '⏳' : 'Send'}
        </button>
      </div>
    </div>
  );
}