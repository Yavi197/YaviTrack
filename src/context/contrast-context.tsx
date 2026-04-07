
"use client";

/**
 * ContrastContext
 * ───────────────
 * Single source of truth for contrast-related inventory data.
 * Replaces 3 separate onSnapshot calls previously duplicated between
 * app-header (HeaderContrastIndicator) and contrast-stock-dialog.
 *
 * Both components now read from this context instead of creating
 * their own Firebase listeners. This cuts 3 listeners to 0 for the
 * dialog and keeps the header listeners in one well-defined place.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import type { InventoryStockEntry, InventoryConsumption } from '@/lib/types';

interface ContrastContextValue {
  entries: InventoryStockEntry[];
  consumptions: InventoryConsumption[];
  offsetMl: number;
  netTotalMl: number;
  loading: boolean;
}

const ContrastContext = createContext<ContrastContextValue>({
  entries: [],
  consumptions: [],
  offsetMl: 0,
  netTotalMl: 0,
  loading: true,
});

export function ContrastProvider({ children }: { children: React.ReactNode }) {
  const { inventoryItems, inventoryLoading, userProfile } = useAuth();
  const [entries, setEntries] = useState<InventoryStockEntry[]>([]);
  const [consumptions, setConsumptions] = useState<InventoryConsumption[]>([]);
  const [offsetMl, setOffsetMl] = useState(0);
  const [loading, setLoading] = useState(true);

  // Only admin has access to inventory and contrast data
  const needsContrast = userProfile?.rol === 'administrador';

  useEffect(() => {
    if (inventoryLoading || !needsContrast) {
      setLoading(false);
      return;
    }

    const contrastItems = inventoryItems.filter(item => item.isContrast);
    if (contrastItems.length === 0) {
      setEntries([]);
      setConsumptions([]);
      setLoading(false);
      return;
    }

    const ids = contrastItems.map(i => i.id);

    const unsub1 = onSnapshot(
      query(collection(db, 'inventoryEntries'), where('itemId', 'in', ids)),
      (snap) => {
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryStockEntry)));
        setLoading(false);
      },
      (err) => { if (err.code !== 'permission-denied') console.error('[ContrastContext] entries error:', err); setLoading(false); }
    );

    const unsub2 = onSnapshot(
      query(collection(db, 'inventoryConsumptions'), where('itemId', 'in', ids)),
      (snap) => setConsumptions(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryConsumption))),
      (err) => { if (err.code !== 'permission-denied') console.error('[ContrastContext] consumptions error:', err); }
    );

    const unsub3 = onSnapshot(
      doc(db, 'inventorySettings', 'contrastStock'),
      (snap) => { const d = snap.data(); setOffsetMl(typeof d?.offsetMl === 'number' ? d.offsetMl : 0); },
      (err) => { if (err.code !== 'permission-denied') console.error('[ContrastContext] settings error:', err); }
    );

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [inventoryItems, inventoryLoading, needsContrast]);

  const netTotalMl = useMemo(() => {
    const itemsMap = new Map(inventoryItems.map(i => [i.id, i]));
    const entered = entries.reduce((sum, e) => {
      const item = itemsMap.get(e.itemId);
      return sum + (item ? e.amountAdded * item.content : 0);
    }, 0);
    const consumed = consumptions.reduce((sum, c) => sum + c.amountConsumed, 0);
    return entered - consumed - offsetMl;
  }, [entries, consumptions, offsetMl, inventoryItems]);

  return (
    <ContrastContext.Provider value={{ entries, consumptions, offsetMl, netTotalMl, loading }}>
      {children}
    </ContrastContext.Provider>
  );
}

export const useContrast = () => useContext(ContrastContext);
