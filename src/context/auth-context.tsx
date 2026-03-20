
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
        
        const invQuery = query(collection(db, "inventoryItems"), orderBy("name"));
        const unsubscribeInventory = onSnapshot(invQuery, (snapshot) => {
            const itemsData: InventoryItem[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
            setInventoryItems(itemsData);
            setInventoryLoading(false);
        }, (error) => {
            if (error.code !== 'permission-denied') {
              console.error("Error fetching inventory items: ", error);
            }
            setInventoryLoading(false);
        });

        return () => {
          unsubscribeProfile();
          unsubscribeInventory();
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
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
            <AppLogoIcon className="h-16 w-16 text-primary animate-pulse" />
            <p className="text-muted-foreground">Cargando Med-iTrack...</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};
