
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import type { UserProfile } from '@/lib/types';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, UserX, UserCheck, Loader2, ArrowLeft } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { addOperatorAction, removeOperatorAction, toggleUserStatusAction } from '@/app/actions';


function ManageOperators({ user }: { user: UserProfile }) {
    const { toast } = useToast();
    const [newOperator, setNewOperator] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAddOperator = async () => {
        if (!newOperator.trim()) return;
        setLoading(true);
        const result = await addOperatorAction(user.uid, newOperator.trim());
        if (result.success) {
            toast({ title: 'Operador Agregado' });
            setNewOperator('');
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setLoading(false);
    };

    const handleRemoveOperator = async (operator: string) => {
        setLoading(true);
        const result = await removeOperatorAction(user.uid, operator);
        if (result.success) {
            toast({ title: 'Operador Eliminado' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setLoading(false);
    };
    
    const canAddOperator = useMemo(() => {
       return user.rol === 'tecnologo' || user.rol === 'transcriptora';
    }, [user.rol]);

    if(!canAddOperator) return <TableCell className="text-muted-foreground">N/A</TableCell>;

    return (
        <TableCell>
            <div className="flex flex-wrap gap-2 max-w-xs">
                {(user.operadores || []).map(op => (
                    <Badge key={op} variant="secondary" className="relative pr-6 group">
                        {op}
                        <button 
                            onClick={() => handleRemoveOperator(op)}
                            disabled={loading}
                            className="absolute top-1/2 -translate-y-1/2 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
                <Input 
                    value={newOperator}
                    onChange={(e) => setNewOperator(e.target.value)}
                    placeholder="Nuevo operador..."
                    className="h-8"
                    onKeyDown={(e) => { if(e.key === 'Enter') handleAddOperator()}}
                />
                <Button size="icon" className="h-8 w-8" onClick={handleAddOperator} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : <Plus />}
                </Button>
            </div>
        </TableCell>
    )
}

function ToggleStatus({ user }: { user: UserProfile }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        setLoading(true);
        const result = await toggleUserStatusAction(user.uid, user.activo);
        if (!result.success) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setLoading(false);
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Switch
                    checked={user.activo}
                    className="cursor-pointer"
                    // The onCheckedChange is handled by the dialog confirmation
                    onClick={(e) => e.preventDefault()}
                />
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Cambiar estado del usuario?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {user.activo 
                            ? "Esto desactivará al usuario y no podrá iniciar sesión."
                            : "Esto reactivará al usuario y podrá iniciar sesión de nuevo."
                        }
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggle}>
                        {loading ? <Loader2 className="animate-spin" /> : "Confirmar"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}


export default function UsersPage() {
    const { userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && userProfile?.rol !== 'administrador') {
            router.push('/');
        }
    }, [userProfile, authLoading, router]);

    useEffect(() => {
        if (!userProfile || userProfile.rol !== 'administrador') {
            setUsers([]);
            setLoading(false);
            return;
        }

        const q = query(collection(db, "users"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const usersData: UserProfile[] = [];
            querySnapshot.forEach((doc) => {
                usersData.push({ uid: doc.id, ...doc.data() } as UserProfile);
            });
            setUsers(usersData);
            setLoading(false);
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error("Error fetching users: ", error);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile]);

    if (authLoading || loading || userProfile?.rol !== 'administrador') {
        return (
             <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>Añade, elimina o modifica los operadores y el estado de los usuarios.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Servicio/Modalidad</TableHead>
                                <TableHead>Operadores</TableHead>
                                <TableHead>Activo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.uid}>
                                    <TableCell className="font-medium">{user.nombre}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell><Badge variant="outline">{user.rol}</Badge></TableCell>
                                    <TableCell>{user.servicioAsignado}</TableCell>
                                    <ManageOperators user={user} />
                                    <TableCell>
                                        <ToggleStatus user={user} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

    
