"use client";

import React, { useEffect, useState, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const backPressCount = useRef(0);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const actionTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backListener = CapacitorApp.addListener('backButton', async () => {
      const path = window.location.pathname;
      const isLoggedIn = !!localStorage.getItem('fixifiy_shop');
      
      const isMainPage = (isLoggedIn && path === '/shop-owner-dashboard') || (!isLoggedIn && (path === '/' || path === '/login'));

      if (!isMainPage) {
        // Normal page par ek step peeche
        window.history.back();
        return;
      }

      backPressCount.current += 1;

      if (backPressCount.current === 1) {
        // 1 Baar dabane par warning
        setToastMessage("Logout ke liye 1 baar aur dabayein. App close ke liye 2 baar.");
        setShowToast(true);

        pressTimer.current = setTimeout(() => {
          backPressCount.current = 0;
          setShowToast(false);
        }, 3000);
      } 
      else if (backPressCount.current === 2) {
        // 2 Baar dabane par thoda wait karenge 3rd click ke liye
        actionTimer.current = setTimeout(() => {
          if (backPressCount.current === 2) {
            // Logout Logic
            localStorage.removeItem('fixifiy_shop');
            localStorage.removeItem('shop_login_time');
            
            setToastMessage("Logging out...");
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2000);
            
            backPressCount.current = 0;
            router.replace('/login');
          }
        }, 400); // 400ms ka wait teesre press ke liye
      } 
      else if (backPressCount.current >= 3) {
        // 3 Baar dabane par direct Exit (Bina logout)
        if (actionTimer.current) clearTimeout(actionTimer.current);
        if (pressTimer.current) clearTimeout(pressTimer.current);
        
        backPressCount.current = 0;
        setShowToast(false);
        CapacitorApp.exitApp();
      }
    });

    return () => {
      backListener.then(listener => listener.remove());
    };
  }, [router]);

  return (
    <html lang="en">
      <head>
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" 
        />
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
        
        {/* 🔥 TOAST MESSAGE UI */}
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
            ⏳ {toastMessage}
          </div>
        )}

        <main style={{ minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
          {children}
        </main>
      </body>
    </html>
  );
}