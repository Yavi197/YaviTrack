
"use client";

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModalityIcon } from '../icons/modality-icon';

type ViewMode = 'imaging' | 'consultations';

interface ViewModeSwitchProps {
    activeView: ViewMode;
}

export function ViewModeSwitch({ activeView }: ViewModeSwitchProps) {
    const router = useRouter();

    const handleSwitch = (newView: ViewMode) => {
        if (newView !== activeView) {
            router.push(`/${newView}`);
        }
    };

    return (
        <div className="flex items-center gap-1 rounded-full bg-muted p-1" role="group" aria-label="Cambiar modo de vista">
            <Button 
                size="icon" 
                variant={activeView === 'imaging' ? 'default' : 'ghost'}
                className={cn("rounded-full h-8 w-8 focus:outline focus:outline-2 focus:outline-primary", activeView === 'imaging' && "shadow-md")}
                onClick={() => handleSwitch('imaging')}
                aria-label="Vista de imágenes"
                aria-pressed={activeView === 'imaging'}
            >
                <ModalityIcon className="h-5 w-5" />
            </Button>
            <Button 
                size="icon" 
                variant={activeView === 'consultations' ? 'default' : 'ghost'}
                className={cn("rounded-full h-8 w-8 focus:outline focus:outline-2 focus:outline-primary", activeView === 'consultations' && "shadow-md")}
                onClick={() => handleSwitch('consultations')}
                aria-label="Vista de consultas"
                aria-pressed={activeView === 'consultations'}
            >
                <Stethoscope className="h-5 w-5" />
            </Button>
        </div>
    );
}
