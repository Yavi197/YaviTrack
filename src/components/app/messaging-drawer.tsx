
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { sendMessageAction, sendGeneralAlarmAction, markMessagesAsReadAction } from '@/app/actions';
import { collection, query, onSnapshot, orderBy, where, Timestamp, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type Message, type UserProfile, UserRoles } from '@/lib/types';
import { MessageSquare, Send, Loader2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';


export function MessagingDrawer() {
    const { currentProfile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alarmLoading, setAlarmLoading] = useState(false);
    const { toast } = useToast();

    const recipientRoles: ('tecnologo' | 'transcriptora')[] = ['tecnologo', 'transcriptora'];
    
    const senderRoles = useMemo(() => {
       return UserRoles.filter(role => ['enfermero', 'administrador', 'adminisonista', 'tecnologo', 'transcriptora'].includes(role));
    }, []);

    const receiverRoles = useMemo(() => {
        return UserRoles.filter(role => ['tecnologo', 'transcriptora'].includes(role));
    }, []);
    
    const canSendMessage = useMemo(() => {
        if (!currentProfile) return false;
        return senderRoles.includes(currentProfile.rol);
    }, [currentProfile, senderRoles]);
    
    const canTriggerAlarm = useMemo(() => {
        if (!currentProfile) return false;
        const alarmRoles: UserProfile['rol'][] = ['enfermero', 'administrador', 'tecnologo'];
        return alarmRoles.includes(currentProfile.rol);
    }, [currentProfile]);

    const canReceiveMessages = useMemo(() => {
        if (!currentProfile) return false;
        return receiverRoles.includes(currentProfile.rol);
    }, [currentProfile, receiverRoles]);
    
    const unreadMessagesCount = useMemo(() => {
        if (!canReceiveMessages) return 0;
        return messages.filter(m => !m.read).length;
    }, [messages, canReceiveMessages]);

    useEffect(() => {
        if (!currentProfile || !canReceiveMessages) {
            setMessages([]);
            return;
        };

        const q = query(
            collection(db, "messages"),
            where("recipientRole", "==", currentProfile.rol),
            orderBy("createdAt", "desc"),
            limit(50) 
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const msgs: Message[] = [];
            querySnapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() } as Message);
            });
            setMessages(msgs);
        }, (error) => {
            if (error.code !== 'permission-denied') {
              console.error("Firestore snapshot error in messaging drawer: ", error);
              toast({
                  variant: 'destructive',
                  title: 'Error de Conexión',
                  description: 'No se pudieron cargar los mensajes. Revisa tu conexión y vuelve a intentarlo.'
              });
            }
        });

        return () => unsubscribe();
    }, [currentProfile, canReceiveMessages, toast]);
    
    useEffect(() => {
        if (open && unreadMessagesCount > 0) {
            const unreadIds = messages.filter(m => !m.read).map(m => m.id);
            markMessagesAsReadAction(unreadIds).catch(err => console.error("Failed to mark messages as read:", err));
        }
    }, [open, unreadMessagesCount, messages]);


    const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formElement = event.currentTarget;
        if (!currentProfile) return;
        setLoading(true);
        const formData = new FormData(formElement);
        const recipientRole = formData.get('recipientRole') as 'tecnologo' | 'transcriptora';
        const content = formData.get('content') as string;

        const result = await sendMessageAction(currentProfile, recipientRole, content);
        
        if (result.success) {
            toast({ title: 'Mensaje Enviado' });
            formElement.reset();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setLoading(false);
    };
    
    const handleSendAlarm = async () => {
        if (!currentProfile) return;
        setAlarmLoading(true);
        const result = await sendGeneralAlarmAction(currentProfile);
        if (result.success) {
            toast({ title: "Alarma General Enviada", description: "Todos los enfermeros han sido notificados."});
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
        setAlarmLoading(false);
    };

    if (!canSendMessage && !canReceiveMessages) {
        return null;
    }

    return (
        <div onClick={() => setOpen(true)} className="flex items-center gap-2 cursor-pointer w-full">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Centro de Mensajes</span>
            {unreadMessagesCount > 0 && (
                <span className="relative flex h-2 w-2 ml-auto">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
            )}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
                    <SheetHeader>
                        <SheetTitle>Centro de Mensajes</SheetTitle>
                        <SheetDescription>
                            {canSendMessage && "Envía un mensaje rápido o una alarma general al personal de enfermería."}
                            {canReceiveMessages && !canSendMessage && "Aquí recibirás mensajes importantes."}
                        </SheetDescription>
                    </SheetHeader>

                    {canSendMessage && (
                        <form onSubmit={handleSendMessage} className="p-4 border-b">
                            <div className="grid gap-4">
                                <Select name="recipientRole" required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar destinatario..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {recipientRoles.map(role => (
                                            <SelectItem key={role} value={role}>
                                                {role === 'tecnologo' ? 'Tecnólogo (Rayos X)' : 'Transcriptor/a (Ecografía)'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Textarea
                                    name="content"
                                    placeholder="Escribe tu mensaje aquí..."
                                    className="min-h-[100px]"
                                    required
                                />
                                <div className="flex gap-2">
                                    <Button type="submit" disabled={loading} className="w-full">
                                        {loading ? <Loader2 className="animate-spin" /> : <Send />}
                                        Enviar Mensaje
                                    </Button>
                                    {canTriggerAlarm && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button type="button" variant="destructive" className="w-full">
                                                    {alarmLoading ? <Loader2 className="animate-spin" /> : <AlertTriangle />}
                                                    Enviar Alarma
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Confirmar Alarma General?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta acción enviará una notificación de alta prioridad a TODOS los enfermeros conectados. Úsala solo en emergencias reales.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleSendAlarm}>Confirmar y Enviar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </div>
                        </form>
                    )}
                    
                    {canReceiveMessages && (
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-4">
                                {messages.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-10">No hay mensajes.</p>
                                ) : (
                                    messages.map(msg => (
                                        <div key={msg.id} className={cn("p-3 rounded-lg border", !msg.read && "bg-primary/5 border-primary/20")}>
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-semibold">{msg.senderName}</p>
                                                <Badge variant={!msg.read ? 'default' : 'secondary'} className={cn(!msg.read && 'bg-primary/80')}>
                                                    {msg.createdAt ? formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true, locale: es }) : ''}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-foreground/80 mt-1">{msg.content}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
