"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import type { UserProfile } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, Loader2, Users, UserCheck, UserX, Search } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { addOperatorAction, removeOperatorAction, toggleUserStatusAction } from '@/app/actions';
import { cn } from '@/lib/utils';

const rolColors: Record<string, string> = {
  administrador: "bg-purple-100 text-purple-700",
  tecnologo:     "bg-blue-100 text-blue-700",
  transcriptora: "bg-sky-100 text-sky-700",
  enfermero:     "bg-emerald-100 text-emerald-700",
  admisionista:  "bg-orange-100 text-orange-700",
};

function ManageOperators({ user }: { user: UserProfile }) {
  const { toast } = useToast();
  const [newOperator, setNewOperator] = useState('');
  const [loading, setLoading] = useState(false);

  const canManage = user.rol === 'tecnologo' || user.rol === 'transcriptora';
  if (!canManage) return <p className="text-xs text-zinc-400 font-medium">N/A</p>;

  const handleAdd = async () => {
    if (!newOperator.trim()) return;
    setLoading(true);
    const result = await addOperatorAction(user.uid, newOperator.trim());
    if (result.success) { toast({ title: 'Operador Agregado' }); setNewOperator(''); }
    else toast({ variant: 'destructive', title: 'Error', description: result.error });
    setLoading(false);
  };

  const handleRemove = async (op: string) => {
    setLoading(true);
    const result = await removeOperatorAction(user.uid, op);
    if (result.success) toast({ title: 'Operador Eliminado' });
    else toast({ variant: 'destructive', title: 'Error', description: result.error });
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(user.operadores || []).map(op => (
          <span key={op} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-bold group">
            {op}
            <button onClick={() => handleRemove(op)} disabled={loading}
              className="h-3.5 w-3.5 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input value={newOperator} onChange={(e) => setNewOperator(e.target.value)}
          placeholder="Nuevo operador..." className="h-8 text-xs bg-zinc-50 border-zinc-200 rounded-lg"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} />
        <Button size="icon" className="h-8 w-8 rounded-lg bg-zinc-900 hover:bg-zinc-800" onClick={handleAdd} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}

function ToggleStatus({ user }: { user: UserProfile }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const result = await toggleUserStatusAction(user.uid, user.activo);
    if (!result.success) toast({ variant: 'destructive', title: 'Error', description: result.error });
    setLoading(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="relative" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : (
            <Switch checked={user.activo} className="cursor-pointer" onClick={(e) => e.preventDefault()} />
          )}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl border-0 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-black">¿Cambiar estado del usuario?</AlertDialogTitle>
          <AlertDialogDescription>
            {user.activo ? "Esto desactivará al usuario y no podrá iniciar sesión." : "Esto reactivará al usuario y podrá iniciar sesión de nuevo."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggle} className="rounded-xl bg-zinc-900 hover:bg-zinc-800">Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function UsersPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && userProfile?.rol !== 'administrador') router.push('/');
  }, [userProfile, authLoading, router]);

  useEffect(() => {
    if (!userProfile || userProfile.rol !== 'administrador') { setUsers([]); setLoading(false); return; }
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [userProfile]);

  const filteredUsers = useMemo(() =>
    users.filter(u => u.nombre?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  );

  const activeCount = useMemo(() => users.filter(u => u.activo).length, [users]);

  if (authLoading || loading || userProfile?.rol !== 'administrador') {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300" /></div>;
  }

  return (
    <div className="py-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-100 rounded-lg"><Users className="h-4 w-4 text-blue-600" /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Administración</span>
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-zinc-500 font-medium mt-1">Administra permisos, operadores y estados de cada cuenta.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Usuarios", value: users.length, icon: Users, accent: "bg-zinc-100 text-zinc-600" },
          { label: "Activos", value: activeCount, icon: UserCheck, accent: "bg-emerald-100 text-emerald-600" },
          { label: "Inactivos", value: users.length - activeCount, icon: UserX, accent: "bg-red-100 text-red-500" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
              <div className={cn("p-1.5 rounded-lg", accent)}><Icon className="h-3.5 w-3.5" /></div>
            </div>
            <p className="text-3xl font-black text-zinc-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Search + Table */}
      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-50 flex items-center gap-3">
          <Search className="h-4 w-4 text-zinc-300" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o correo..." className="h-9 border-0 bg-transparent p-0 focus-visible:ring-0 font-medium text-zinc-700 placeholder:text-zinc-300" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {["Usuario", "Rol", "Servicio", "Operadores", "Estado"].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-[9px] font-black uppercase tracking-widest text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-zinc-900">{user.nombre}</p>
                    <p className="text-xs text-zinc-400 font-medium">{user.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", rolColors[user.rol] || "bg-zinc-100 text-zinc-600")}>
                      {user.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-zinc-600">{user.servicioAsignado || '—'}</td>
                  <td className="px-6 py-4"><ManageOperators user={user} /></td>
                  <td className="px-6 py-4"><ToggleStatus user={user} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-zinc-400 font-medium">No se encontraron usuarios.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
