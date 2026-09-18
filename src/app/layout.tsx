"use client";

import React, { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 🔥 Toast dikhane ke liye naya state
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let lastBackPressTime = 0;

      const backListener = CapacitorApp.addListener('backButton', async () => {
        const path = window.location.pathname;
        
        // 🔥 Check karein ki user logged in hai ya nahi
        const isLoggedIn = !!localStorage.getItem('fixifiy_shop');
        
        // Agar logged in hai, toh uska aakhri page '/shop-owner-dashboard' hai
        // Agar logged in nahi hai, toh uska aakhri page '/' ya '/login' hai
        const isMainPage = (isLoggedIn && path === '/shop-owner-dashboard') || (!isLoggedIn && (path === '/' || path === '/login'));

        if (isMainPage) {
          const currentTime = new Date().getTime();
          // Agar 2 second ke andar dobara back dabaya, toh Exit kar do
          if (currentTime - lastBackPressTime < 2000) {
            CapacitorApp.exitApp();
          } else {
            lastBackPressTime = currentTime;
            
            // 🔥 Screen par message dikhao
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000); // 2 second baad message hata do
          }
        } 
        else {
          // Baki kisi bhi page par hone par normal ek page peeche jayega
          window.history.back();
        }
      });

      return () => {
        backListener.then(listener => listener.remove());
      };
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" 
        />
        {/* 🔥 Icon update code added here */}
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <link rel="shortcut icon" href="/icon.png" />
      </head>
      <body style={{ 
        margin: 0, 
        padding: 0, 
        backgroundColor: '#020617', 
        fontFamily: 'sans-serif',
        minHeight: '100vh',
        width: '100vw',
        overflowX: 'hidden',
        boxSizing: 'border-box'
      }}>
        
        {/* 🔥 NAYA TOAST MESSAGE UI 🔥 */}
        {showToast && (
          <div style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            color: '#0f172a',
            padding: '12px 24px',
            borderRadius: '30px',
            zIndex: 999999,
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.3s ease-in-out'
          }}>
            ⏳ Exit karne ke liye ek baar aur Back dabayein
          </div>
        )}

        <main style={{ minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
          {children}
        </main>
      </body>
    </html>
  );
}