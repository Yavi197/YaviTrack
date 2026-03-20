'use client';

import { useEffect } from 'react';

export function ServiceWorkerReset() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        navigator.serviceWorker
            .getRegistrations()
            .then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister().catch(() => {
                        /* noop: best effort cleanup */
                    });
                }
            })
            .catch(() => {
                /* noop */
            });
    }, []);

    return null;
}
