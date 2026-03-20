

'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Study, UserProfile } from '@/lib/types';
import { AppLogoIcon } from '@/components/icons/app-logo-icon';
import { useInterval } from '@/hooks/use-interval';
import { cn } from '@/lib/utils';
import Head from 'next/head';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Loader2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateSilenceRequestAudioAction, generateTurnCallAudioAction } from '@/app/actions';


type Turn = {
  id: string;
  display: string;
  modality: 'ECO' | 'RX' | 'TAC';
  timestamp: number;
};

type TurnoState = {
  current: Turn | null;
  next: Turn | null;
  upcoming: Turn | null;
};

type AudioEvent = {
    type: 'call';
    turn: Turn;
} | {
    type: 'silence';
};

const modalityConfig = {
    ECO: {
        color: 'bg-red-500',
        name: 'Ecografía'
    },
    RX: {
        color: 'bg-blue-500',
        name: 'Rayos X'
    },
    TAC: {
        color: 'bg-green-500',
        name: 'Tomografía'
    }
}

function TurnCard({ modality, state, isCalling }: { modality: 'ECO' | 'RX' | 'TAC', state: TurnoState, isCalling: boolean }) {
    const config = modalityConfig[modality];
    const noTurns = !state.current && !state.next && !state.upcoming;

    const renderTurn = (turn: Turn | null, defaultText: string = '-') => {
        return turn?.display || defaultText;
    };
    
    return (
        <div className="bg-card/50 dark:bg-slate-800/20 rounded-xl p-6 shadow-sm">
            <h3 className={`text-3xl font-bold mb-6 text-center text-${modality.toLowerCase()}`}>{config.name}</h3>
            <div className="space-y-4">
                <div 
                    id={`turno-${modality.toLowerCase()}`}
                    className={cn(
                        "text-white rounded-lg p-6 text-center transition-all duration-300 flex items-center justify-center min-h-[148px]",
                        config.color,
                         isCalling && `animate-pulse-turn`
                    )}
                >
                     <div className="flex flex-col items-center justify-center min-h-[92px]">
                         <p className="text-lg font-medium opacity-80 mb-2">Actual</p>
                        <div className={cn("text-8xl font-black tracking-wider transition-transform duration-300", isCalling && "scale-110")}>
                           {noTurns ? <p className="text-4xl font-bold tracking-normal">Esperando</p> : renderTurn(state.current, '-')}
                        </div>
                    </div>
                </div>
                <div className="bg-slate-200 dark:bg-slate-700 rounded-lg p-4 text-center">
                    <p className="text-base font-medium text-slate-500 dark:text-slate-400">Siguiente</p>
                    <p className="text-6xl font-black text-slate-800 dark:text-slate-200 tracking-wider">{noTurns ? '-' : renderTurn(state.next)}</p>
                </div>
                 <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-4 text-center">
                    <p className="text-base font-medium text-slate-500 dark:text-slate-400">Próximo</p>
                    <p className="text-6xl font-black text-slate-600 dark:text-slate-300 tracking-wider">{noTurns ? '-' : renderTurn(state.upcoming)}</p>
                </div>
            </div>
        </div>
    )
}

function SilenceRequestButton() {
    const { toast } = useToast();
    const { addAudioEvent } = useTurneroContext();

    const handleRequestSilence = () => {
        addAudioEvent({ type: 'silence' });
        toast({ title: "Solicitud en Cola", description: "El mensaje de silencio se reproducirá pronto." });
    };

    return (
        <Button size="lg" onClick={handleRequestSilence} className="rounded-full shadow-lg">
            <VolumeX className="mr-2 h-5 w-5" />
            Solicitar Silencio
        </Button>
    );
}

// Context to manage audio queue
const TurneroContext = React.createContext<{ addAudioEvent: (event: AudioEvent) => void } | undefined>(undefined);

const useTurneroContext = () => {
    const context = React.useContext(TurneroContext);
    if (!context) {
        throw new Error('useTurneroContext must be used within a TurneroProvider');
    }
    return context;
};

const playAudio = (audioUri: string) => {
    return new Promise<void>((resolve) => {
        const audio = new Audio(audioUri);
        audio.onended = () => resolve();
        audio.play().catch(err => {
            console.error("Audio playback failed:", err);
            resolve(); // Resolve even if playback fails to not block the queue
        });
    });
};


const TurneroProvider = ({ children }: { children: React.ReactNode }) => {
    const [audioQueue, setAudioQueue] = useState<AudioEvent[]>([]);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const { toast } = useToast();
    const { setCallingTurn } = useTurneroPageContext();

    const addAudioEvent = (event: AudioEvent) => {
        setAudioQueue(prev => [...prev, event]);
    };

    const processQueue = useCallback(async () => {
        if (isAudioPlaying || audioQueue.length === 0) return;

        setIsAudioPlaying(true);
        const eventToProcess = audioQueue[0];

        try {
            if (eventToProcess.type === 'silence') {
                const result = await generateSilenceRequestAudioAction();
                if (result.success && result.audioDataUri) {
                    await playAudio(result.audioDataUri);
                } else {
                    throw new Error(result.error || "Failed to generate silence audio.");
                }
            } else if (eventToProcess.type === 'call') {
                const { turn } = eventToProcess;
                setCallingTurn(turn);
                const modalityName = modalityConfig[turn.modality].name;
                const result = await generateTurnCallAudioAction(turn.display, modalityName);

                if (result.success && result.audioDataUri) {
                    await playAudio(result.audioDataUri);
                    await new Promise(resolve => setTimeout(resolve, 3500));
                    await playAudio(result.audioDataUri);
                } else {
                    throw new Error(result.error || "Failed to generate turn call audio.");
                }
            }
        } catch (error: any) {
            console.error("Error processing audio queue:", error);
            toast({ variant: 'destructive', title: 'Error de Audio', description: error.message });
        } finally {
            setCallingTurn(null);
            setIsAudioPlaying(false);
            setAudioQueue(prev => prev.slice(1)); // Remove processed event
        }
    }, [audioQueue, isAudioPlaying, toast, setCallingTurn]);
    
     useEffect(() => {
        processQueue();
    }, [processQueue]);

    return (
        <TurneroContext.Provider value={{ addAudioEvent }}>
            {children}
        </TurneroContext.Provider>
    );
};

// Context for the page state itself
const TurneroPageContext = React.createContext<{
    callingTurn: Turn | null;
    setCallingTurn: React.Dispatch<React.SetStateAction<Turn | null>>;
} | undefined>(undefined);

const useTurneroPageContext = () => {
    const context = React.useContext(TurneroPageContext);
    if (!context) {
        throw new Error('useTurneroPageContext must be used within a TurneroPageProvider');
    }
    return context;
};

const TurneroPageProvider = ({ children }: { children: React.ReactNode }) => {
    const [callingTurn, setCallingTurn] = useState<Turn | null>(null);
    return (
        <TurneroPageContext.Provider value={{ callingTurn, setCallingTurn }}>
            <TurneroProvider>
                {children}
            </TurneroProvider>
        </TurneroPageContext.Provider>
    );
};


function TurneroPageContent() {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [studies, setStudies] = useState<Study[]>([]);
    const { callingTurn, setCallingTurn } = useTurneroPageContext();
    const { addAudioEvent } = useTurneroContext();
    const { currentProfile } = useAuth();
    const lastCalledIdRef = useRef<Record<'ECO' | 'RX' | 'TAC', string | null>>({ ECO: null, RX: null, TAC: null });
    
    const canRequestSilence = useMemo(() => {
        if (!currentProfile) return false;
        return ['administrador', 'adminisonista'].includes(currentProfile.rol);
    }, [currentProfile]);

    useEffect(() => {
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        audio.preload = 'auto';
    }, []);

    useInterval(() => {
        setCurrentTime(new Date());
    }, 60000);
    
    useEffect(() => {
        const q = query(
            collection(db, "studies"),
            where("service", "==", "C.EXT"),
            where("status", "==", "Pendiente")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newStudies = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Study))
                .filter(study => 
                    study.turnNumber && 
                    ['ECO', 'RX', 'TAC'].includes(study.studies[0]?.modality)
                )
                .sort((a, b) => (a.turnNumber || '').localeCompare(b.turnNumber || ''));
            setStudies(newStudies);
        }, (error) => {
            console.error("Firestore snapshot error:", error);
        });

        return () => unsubscribe();
    }, []);


    const turnLists = useMemo<{ [key in 'ECO' | 'RX' | 'TAC']: Turn[] }>(() => {
        const lists: { [key in 'ECO' | 'RX' | 'TAC']: Study[] } = { ECO: [], RX: [], TAC: [] };
        
        studies.forEach(study => {
            const modality = study.studies[0]?.modality as 'ECO' | 'RX' | 'TAC';
            if (lists[modality]) {
                lists[modality].push(study);
            }
        });

        const createTurn = (study: Study): Turn => ({
            id: study.id,
            display: `${study.studies[0].modality.charAt(0)}${study.turnNumber}`,
            modality: study.studies[0].modality as 'ECO' | 'RX' | 'TAC',
            timestamp: study.requestDate.toMillis()
        });

        return {
            ECO: lists.ECO.map(createTurn),
            RX: lists.RX.map(createTurn),
            TAC: lists.TAC.map(createTurn),
        };
    }, [studies]);
    
    const [activeTurnIndices, setActiveTurnIndices] = useState<{ [key in 'ECO' | 'RX' | 'TAC']: number }>({ ECO: -1, RX: -1, TAC: -1 });

    useEffect(() => {
        const modalities: ('ECO' | 'RX' | 'TAC')[] = ['ECO', 'RX', 'TAC'];
        const unsubscribers = modalities.map(modality => {
            const turneroDocRef = doc(db, 'turnero', modality);
            return onSnapshot(turneroDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const newCalledId = data.lastCalledStudyId;

                    if (newCalledId && newCalledId !== lastCalledIdRef.current[modality]) {
                        lastCalledIdRef.current[modality] = newCalledId;
                        const list = turnLists[modality];
                        const calledIndex = list.findIndex(turn => turn.id === newCalledId);
                        
                        if (calledIndex !== -1) {
                            const calledTurn = list[calledIndex];
                            addAudioEvent({ type: 'call', turn: calledTurn });
                            setActiveTurnIndices(prev => ({ ...prev, [modality]: calledIndex }));
                        }
                    }
                }
            });
        });

        return () => unsubscribers.forEach(unsub => unsub());
    }, [turnLists, addAudioEvent]);


    const getTurnoState = useCallback((modality: 'ECO' | 'RX' | 'TAC'): TurnoState => {
        const list = turnLists[modality];
        const currentIndex = activeTurnIndices[modality];
        
        if (list.length === 0) {
            return { current: null, next: null, upcoming: null };
        }
        
        if (currentIndex === -1) {
             return { current: list[0] || null, next: list[1] || null, upcoming: list[2] || null };
        }

        return {
            current: list[currentIndex] || null,
            next: list[currentIndex + 1] || null,
            upcoming: list[currentIndex + 2] || null
        }
    }, [turnLists, activeTurnIndices]);

    return (
        <>
        <Head>
            <title>Sala de Espera - Med-iTrack</title>
        </Head>
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <header className="bg-background/80 backdrop-blur-sm sticky top-0 z-10 border-b">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <div className="flex items-center gap-4">
                            <AppLogoIcon className="h-10 w-10 text-primary" />
                            <h1 className="text-2xl font-bold font-headline">Med-iTrack</h1>
                        </div>
                        <div className="text-2xl font-semibold">
                            <time dateTime={currentTime.toISOString()}>
                                {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </time>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                <div className="text-center mb-12">
                    <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight">Sala de Espera</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <TurnCard modality="ECO" state={getTurnoState('ECO')} isCalling={callingTurn?.modality === 'ECO'} />
                   <TurnCard modality="RX" state={getTurnoState('RX')} isCalling={callingTurn?.modality === 'RX'} />
                   <TurnCard modality="TAC" state={getTurnoState('TAC')} isCalling={callingTurn?.modality === 'TAC'} />
                </div>
            </main>
            <footer className="border-t">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Med-iTrack. Todos los derechos reservados.</p>
                    {canRequestSilence && <SilenceRequestButton />}
                </div>
            </footer>
        </div>
        </>
    );
}

export default function TurneroPage() {
    return (
        <TurneroPageProvider>
            <TurneroPageContent />
        </TurneroPageProvider>
    );
}
