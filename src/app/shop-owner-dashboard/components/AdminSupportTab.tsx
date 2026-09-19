"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/supabase'; // 👈 अपने सही पाथ के अनुसार इसे सेट करें

export default function AdminSupportTab({ currentShop }: any) {
  // 1. UI States (Open/Close & Draggable)
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragDistance = useRef(0);

  // 2. Chat States
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const botGreeting = "नमस्ते! मैं Fixifiy Admin हूँ। आपको कोई भी मदद चाहिए, तो मुझे यहाँ मैसेज करें।";

  // ==========================================
  // 🔥 1. DRAG & DROP LOGIC (तैरने वाला लोगो) 🔥
  // ==========================================
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    dragDistance.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      dragDistance.current += Math.abs(newX - position.x) + Math.abs(newY - position.y);
      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    // अगर 10px से कम हिला है, मतलब यूज़र ने 'क्लिक' किया है
    if (dragDistance.current < 10) {
      setIsOpen(true);
    }
  };

  // ==========================================
  // 🔥 2. REAL-TIME DATA (helpdesk_chats) 🔥
  // ==========================================
  useEffect(() => {
    if (!currentShop?.id || !isOpen) return;

    // पुरानी चैट लोड करना
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('helpdesk_chats')
        .select('*')
        .eq('shop_id', currentShop.id)
        .order('created_at', { ascending: true });

      if (data && data.length > 0) setMessages(data);
    };

    fetchMessages();

    // लाइव अपडेट के लिए चैनल बनाना
    const channel = supabase
      .channel(`shop-helpdesk-${currentShop.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'helpdesk_chats',
        filter: `shop_id=eq.${currentShop.id}` 
      }, (payload) => {
        const newMsg = payload.new;
        if (newMsg.sender === 'admin') {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentShop?.id, isOpen]);

  // जब भी नया मैसेज आए, तो सबसे नीचे स्क्रॉल करें
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // ==========================================
  // 🔥 3. SEND MESSAGE 🔥
  // ==========================================
  const handleSend = async () => {
    if (!input.trim() || isSending || !currentShop?.id) return;
    
    const userMessage = input;
    setInput('');
    setIsSending(true);

    const newMsgObj = {
      shop_id: currentShop.id,
      message: userMessage,
      sender: 'shop'
    };

    setMessages(prev => [...prev, newMsgObj]);

    try {
      const { error } = await supabase.from('helpdesk_chats').insert([newMsgObj]);
      if (error) throw error;
    } catch (error: any) {
      console.error("Chat send error:", error.message);
      alert("❌ मैसेज नहीं जा सका। इंटरनेट चेक करें।");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* 🟢 FLOATING DRAGGABLE LOGO 🟢 */}
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: '60px',
          height: '60px',
          backgroundColor: '#38bdf8',
          borderRadius: '50%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          cursor: 'grab',
          zIndex: 999999, // हमेशा सबसे ऊपर रहेगा
          touchAction: 'none' // मोबाइल पर ड्रैग करने में आसानी होगी
        }}
      >
        <span style={{ fontSize: '30px' }}>🎧</span>
        {/* Unread dot (Optional notification dot) */}
        <div style={{ position: 'absolute', top: 2, right: 2, width: 12, height: 12, backgroundColor: '#ef4444', borderRadius: '50%', border: '2px solid #0f172a' }} />
      </div>

      {/* 🟢 CHAT WINDOW (क्लिक करने पर खुलेगा) 🟢 */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '100px', // फ्लोटिंग लोगो के थोड़ा ऊपर खुलेगा
          right: '30px',
          width: '350px',
          height: '500px',
          backgroundColor: '#0f172a',
          borderRadius: '16px',
          border: '1px solid #38bdf8',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999999,
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          
          {/* CHAT HEADER */}
          <div style={{ backgroundColor: '#0284c7', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>🎧</span>
              <div>
                <h3 style={{ margin: '0', color: 'white', fontSize: '16px' }}>Fixifiy Admin Support</h3>
                <p style={{ margin: '2px 0 0 0', color: '#bae6fd', fontSize: '12px' }}>Shop ID: {currentShop?.id}</p>
              </div>
            </div>
            {/* CLOSE BUTTON */}
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✖
            </button>
          </div>

          {/* CHAT MESSAGES AREA */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#1e293b' }}>
            
            {/* Bot Welcome Message */}
            <div style={{ alignSelf: 'flex-start', background: '#334155', color: 'white', padding: '12px 16px', borderRadius: '12px 12px 12px 4px', maxWidth: '85%', fontSize: '13px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
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
                  maxWidth: '85%', 
                  fontSize: '13px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}>
                  <div style={{fontSize: '11px', fontWeight: 'bold', color: isMe ? '#d1fae5' : '#93c5fd', marginBottom: '4px'}}>
                    {isMe ? '🏪 You' : '🛠️ Admin'}
                  </div>
                  {msg.message}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          
          {/* CHAT INPUT AREA */}
          <div style={{ padding: '10px 15px', borderTop: '1px solid #334155', display: 'flex', gap: '10px', backgroundColor: '#0f172a' }}>
            <input 
              type="text" 
              placeholder="Type message to admin..." 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
              disabled={isSending || !currentShop?.id}
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #475569', outline: 'none', fontSize: '14px', backgroundColor: '#1e293b', color: 'white' }} 
            />
            <button 
              onClick={handleSend} 
              disabled={isSending || !currentShop?.id}
              style={{ background: isSending ? '#475569' : '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '8px', padding: '0 20px', cursor: isSending ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold', transition: '0.2s' }}
            >
              {isSending ? '⏳' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}