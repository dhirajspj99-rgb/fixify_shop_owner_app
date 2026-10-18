"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { App } from "@capacitor/app";
import { Toast } from "@capacitor/toast";
import { Capacitor } from "@capacitor/core";

export default function ClientAppWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const backPressCount = useRef(0);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const actionTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 🔥 YEH LINE SABSE ZAROORI HAI: Yeh check karega ki app mobile me chal raha hai ya website par.
    // Agar website par hai, to Capacitor ka code nahi chalega aur App CRASH nahi hoga!
    if (!Capacitor.isNativePlatform()) {
      return; 
    }

    const handleBackButton = async () => {
      // 1. अगर यूज़र मेन डैशबोर्ड पर नहीं है, तो नॉर्मल बैक (पीछे) जाएगा
      if (pathname !== "/shop-owner-dashboard" && pathname !== "/") {
        router.back();
        return;
      }

      // 2. अगर यूज़र मेन पेज पर है
      backPressCount.current += 1;

      if (backPressCount.current === 1) {
        await Toast.show({
          text: "Logout के लिए 1 बार और दबाएं। App बंद करने के लिए 2 बार और दबाएं।",
          duration: "long",
        });

        pressTimer.current = setTimeout(() => {
          backPressCount.current = 0;
        }, 3000);
      } 
      else if (backPressCount.current === 2) {
        actionTimer.current = setTimeout(async () => {
          if (backPressCount.current === 2) {
            // Logout Logic
            localStorage.removeItem("fixifiy_shop");
            localStorage.removeItem("shop_login_time");
            
            await Toast.show({ text: "Logging out..." });
            backPressCount.current = 0;
            router.replace("/login"); 
          }
        }, 400); 
      } 
      else if (backPressCount.current === 3) {
        // App Close Logic
        if (actionTimer.current) clearTimeout(actionTimer.current);
        if (pressTimer.current) clearTimeout(pressTimer.current);
        
        backPressCount.current = 0;
        App.exitApp(); 
      }
    };

    App.addListener("backButton", handleBackButton);

    return () => {
      App.removeAllListeners();
    };
  }, [router, pathname]);

  // Yeh baki ka pura app render karega
  return <>{children}</>;
}