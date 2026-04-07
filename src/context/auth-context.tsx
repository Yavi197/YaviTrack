
"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { UserProfile, InventoryItem } from '@/lib/types';
import { AppLogoIcon } from '@/components/icons/app-logo-icon';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const FirebaseErrorListener = dynamic(() => 
  import('@/components/app/FirebaseErrorListener').then(mod => mod.FirebaseErrorListener),
  { ssr: false }
);


type Theme = 'dark' | 'light';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  loading: boolean;
  currentProfile: UserProfile | null;
  isImpersonating: boolean;
  startImpersonating: (profile: Omit<UserProfile, 'uid' | 'email' | 'nombre' | 'activo' | 'operadores' | 'operadorActivo'>) => void;
  stopImpersonating: () => void;
  operatorSelectionRequired: boolean;
  selectedOperator: string | null;
  selectOperator: (operator: string | null) => void;
  signOut: () => Promise<void>;
  inventoryItems: InventoryItem[];
  inventoryLoading: boolean;
  theme: Theme | undefined;
  setTheme: (theme: Theme) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [viewAsProfile, setViewAsProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [theme, setThemeState] = useState<Theme | undefined>(undefined);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  // Check if running in preview mode
  const isPreview = typeof window !== 'undefined' && window.location.hostname.includes('9002');

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    const initialTheme = storedTheme || 'light';
    setThemeState(initialTheme);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    if (theme) {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  useEffect(() => {

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setLoading(true);
      if (user) {
        setUser(user);
        // Store UID in localStorage for handover filtering
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('uid', user.uid);
        }
        console.log('[Auth] User logged in:', user.uid, user.email);
        const userDocRef = doc(db, 'users', user.uid);
        let unsubInventory: (() => void) | null = null;

        const unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const profileData = { uid: user.uid, ...doc.data() } as UserProfile;
            console.log('[Auth] User profile loaded:', profileData);
            setUserProfile(profileData);
             if (profileData.operadorActivo) {
              setSelectedOperator(profileData.operadorActivo);
            } else {
              setSelectedOperator(null);
            }

            // Only subscribe to inventory for admin
            if (!unsubInventory) {
              if (profileData.rol === 'administrador') {
                const invQuery = query(collection(db, "inventoryItems"), orderBy("name"));
                unsubInventory = onSnapshot(invQuery, (snapshot) => {
                    const itemsData: InventoryItem[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
                    setInventoryItems(itemsData);
                    setInventoryLoading(false);
                }, (error) => {
                    if (error.code !== 'permission-denied') console.error("Error fetching inventory items: ", error);
                    setInventoryLoading(false);
                });
              } else {
                setInventoryItems([]);
                setInventoryLoading(false);
              }
            }
          } else {
            console.warn('[Auth] User document does not exist in Firestore:', user.uid);
            setUserProfile(null);
            setSelectedOperator(null);
          }
          setLoading(false);
        }, (error) => {
            console.error("[Auth] Error fetching user profile:", error.code, error.message);
            if(error.code === 'permission-denied') {
              console.error('[Auth] Permission denied - logging out');
              firebaseSignOut(auth).finally(() => router.push('/login'));
            }
            setUser(null);
            setUserProfile(null);
            setSelectedOperator(null);
            setLoading(false);
        });

        return () => {
          unsubscribeProfile();
          if (unsubInventory) unsubInventory();
        };
      } else {
        setUser(null);
        setUserProfile(null);
        setViewAsProfile(null);
        setSelectedOperator(null);
        setInventoryItems([]);
        setLoading(false);
        setInventoryLoading(false);
        setIsLoggingOut(false);
      }
    });

    return () => unsubscribeAuth();
  }, [router, isPreview]);
  
  const startImpersonating = (profile: Omit<UserProfile, 'uid' | 'email' | 'nombre' | 'activo' | 'operadores' | 'operadorActivo'>) => {
    if (userProfile && userProfile.rol === 'administrador') {
      const impersonatedProfile: UserProfile = {
        ...userProfile,
        ...profile,
      };
      setViewAsProfile(impersonatedProfile);
    }
  };

  const stopImpersonating = () => {
    setViewAsProfile(null);
  };
  
  const selectOperator = useCallback(async (operator: string | null) => {
    setSelectedOperator(operator);
    if(user) {
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, { operadorActivo: operator });
    }
  }, [user]);

  const signOut = useCallback(async () => {
    setIsLoggingOut(true);
    if (user && userProfile?.operadorActivo) {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { operadorActivo: null });
    }
    await firebaseSignOut(auth);
  }, [user, userProfile]);

  const currentProfile = viewAsProfile || userProfile;
  const isImpersonating = !!viewAsProfile;

  const operatorSelectionRequired = 
    !isLoggingOut &&
    !isImpersonating && 
    (currentProfile?.rol === 'tecnologo' || currentProfile?.rol === 'transcriptora') &&
    (currentProfile?.operadores?.length ?? 0) > 0 && 
    !selectedOperator;

  return (
    <AuthContext.Provider value={{ 
        user, 
        userProfile, 
        setUserProfile, 
        loading, 
        currentProfile,
        isImpersonating,
        startImpersonating,
        stopImpersonating,
        operatorSelectionRequired,
        selectedOperator,
        selectOperator,
        signOut,
        inventoryItems,
        inventoryLoading,
        theme,
        setTheme,
    }}>
      {children}
      <FirebaseErrorListener />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthLoader = ({ children }: { children: ReactNode }) => {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="relative flex flex-col items-center justify-center px-16 py-12 rounded-[2.5rem] bg-white/60 dark:bg-black/60 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-white/50 dark:border-zinc-800/50 backdrop-blur-2xl overflow-hidden">
             
           {/* Animated Background Gradients / Glows */}
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/20 rounded-full blur-[40px] opacity-60 animate-pulse [animation-duration:3000ms]" />
           <div className="absolute bottom-[-20%] right-[-10%] w-32 h-32 bg-sky-400/20 rounded-full blur-[30px] opacity-40 animate-pulse [animation-duration:4000ms]" />

           {/* Logo Area */}
           <div className="relative flex items-center justify-center mb-8">
               <div className="absolute inset-0 bg-amber-300 dark:bg-amber-900 rounded-full blur-2xl opacity-20 animate-[spin_4s_linear_infinite]" />
               <AppLogoIcon className="relative h-24 w-24 text-zinc-900 dark:text-white drop-shadow-2xl animate-[bounce_2s_infinite]" />
           </div>
           
           {/* Typography Area */}
           <div className="flex flex-col items-center space-y-3 relative z-10">
                <h2 className="text-3xl font-black tracking-normal dark:text-white text-zinc-900">
                   Med-<span className="text-amber-500 lowercase mr-[0.05em]">i</span>Track
                </h2>
               <div className="flex items-center gap-2.5 bg-zinc-100/50 dark:bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-200/50 dark:border-zinc-800/50">
                   <div className="flex gap-1 items-center">
                       <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-[bounce_1s_infinite]" style={{ animationDelay: '0ms' }} />
                       <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-[bounce_1s_infinite]" style={{ animationDelay: '150ms' }} />
                       <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-[bounce_1s_infinite]" style={{ animationDelay: '300ms' }} />
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400 ml-1">
                     Cargando
                   </span>
               </div>
           </div>

           {/* Progress Line Sweep Effect */}
           <div className="absolute bottom-0 left-0 h-1.5 w-full overflow-hidden bg-zinc-200/20 dark:bg-zinc-800/20">
              <div className="h-full bg-gradient-to-r from-transparent via-amber-400 to-transparent w-1/2 animate-[pulse_2s_ease-in-out_infinite] translate-x-[-100%]" style={{ animationName: 'slide' }} />
           </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}} />
      </div>
    );
  }
  return <>{children}</>;
};
