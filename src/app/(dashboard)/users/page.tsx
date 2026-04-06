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
import { X, Plus, Loader2, Users, UserCheck, UserX, Search, Phone, Contact, UserCog, Save, ChevronRight, Stethoscope } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { addOperatorAction, removeOperatorAction, toggleUserStatusAction, updateUserAction, createUserProfileAction } from '@/app/actions';
import { UserRoles, GeneralServices, Modalities, SubServiceAreas } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const rolColors: Record<string, string> = {
  administrador: "bg-purple-100 text-purple-700",
  tecnologo:     "bg-blue-100 text-blue-700",
  transcriptora: "bg-sky-100 text-sky-700",
  enfermero:     "bg-emerald-100 text-emerald-700",
  admisionista:  "bg-orange-100 text-orange-700",
};

const userRoles = ["administrador", "enfermero", "tecnologo", "transcriptora", "admisionista"];
const modalities = ["TAC", "RX", "ECO", "MAMO", "DENSITOMETRIA", "RMN"];
const generalServices = ["URG", "HOSP", "UCI", "C.EXT", "General"];

function EditUserDialog({ user }: { user: UserProfile }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: user.nombre,
    documento: user.documento || '',
    telefono: user.telefono || '',
    rol: user.rol,
    servicioAsignado: user.servicioAsignado || '',
    subServicioAsignado: user.subServicioAsignado || '',
  });

  const handleUpdate = async () => {
    setLoading(true);
    const result = await updateUserAction(user.uid, formData as any);
    if (result.success) {
      toast({ title: 'Usuario Actualizado' });
      setOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setLoading(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-all">
          <UserCog className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="p-0 overflow-hidden bg-white border-2 border-zinc-200 shadow-2xl max-w-md">
        <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 p-5 text-white relative">
          <div className="absolute top-0 right-0 p-5 opacity-10 scale-150 pointer-events-none">
            <UserCog className="h-16 w-16" />
          </div>
          <AlertDialogHeader className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/10 rounded-full border border-white/10 mb-2 backdrop-blur-md w-fit">
              <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/80">Configuración de Perfil</span>
            </div>
            <AlertDialogTitle className="text-xl font-black tracking-tight leading-none">
              Editar Usuario
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60 font-medium text-[10px] mt-1">
              Actualice la información profesional y de contacto del usuario.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nombre Completo</Label>
              <div className="relative group">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-300 transition-colors group-focus-within:text-zinc-600" />
                <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="pl-9 h-10 bg-zinc-50 border-zinc-100 focus:bg-white transition-all rounded-xl text-xs font-bold" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Cédula / ID</Label>
              <div className="relative group">
                <Contact className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-300 transition-colors group-focus-within:text-zinc-600" />
                <Input value={formData.documento} onChange={e => setFormData({...formData, documento: e.target.value})}
                  className="pl-9 h-10 bg-zinc-50 border-zinc-100 focus:bg-white transition-all rounded-xl text-xs font-bold" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Teléfono</Label>
              <div className="relative group">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-300 transition-colors group-focus-within:text-zinc-600" />
                <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})}
                  className="pl-9 h-10 bg-zinc-50 border-zinc-100 focus:bg-white transition-all rounded-xl text-xs font-bold" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Rol de Usuario</Label>
              <Select value={formData.rol} onValueChange={val => setFormData({...formData, rol: val as any})}>
                <SelectTrigger className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-zinc-100 shadow-xl">
                  {userRoles.map(role => (
                    <SelectItem key={role} value={role} className="capitalize text-xs font-bold py-2.5">{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Servicio</Label>
              <Select value={formData.servicioAsignado} onValueChange={val => setFormData({...formData, servicioAsignado: val as any, subServicioAsignado: ''})}>
                <SelectTrigger className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-zinc-100 shadow-xl max-h-48">
                  {[...Modalities, ...GeneralServices].map(serv => (
                    <SelectItem key={serv} value={serv} className="text-xs font-bold py-2.5">{serv}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {SubServiceAreas[formData.servicioAsignado as any] && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Sub-Servicio</Label>
                <Select value={formData.subServicioAsignado} onValueChange={val => setFormData({...formData, subServicioAsignado: val})}>
                  <SelectTrigger className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold">
                    <SelectValue placeholder="Especifique área..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-zinc-100 shadow-xl">
                    {SubServiceAreas[formData.servicioAsignado as any].map(sub => (
                      <SelectItem key={sub} value={sub} className="text-xs font-bold py-2.5">{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end gap-2.5">
          <AlertDialogCancel className="h-9 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition-all mt-0 shadow-none">
            Cancelar
          </AlertDialogCancel>
          <Button 
            disabled={loading}
            onClick={handleUpdate}
            className="h-9 bg-zinc-900 hover:bg-zinc-950 text-white rounded-xl font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-zinc-200 hover:shadow-zinc-300 transition-all flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar Cambios
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateUserDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    uid: '',
    email: '',
    nombre: '',
    documento: '',
    telefono: '',
    rol: 'tecnologo',
    servicioAsignado: 'RX',
    subServicioAsignado: ''
  });

  const handleCreate = async () => {
    if (!formData.uid || !formData.email || !formData.nombre) {
      toast({ variant: 'destructive', title: 'Faltan campos', description: 'Por favor complete UID, Email y Nombre.' });
      return;
    }
    setLoading(true);
    const result = await createUserProfileAction(formData as any);
    if (result.success) {
      toast({ title: 'Usuario creado', description: 'Perfil de Firestore creado correctamente.' });
      setOpen(false);
      setFormData({ uid: '', email: '', nombre: '', documento: '', telefono: '', rol: 'tecnologo', servicioAsignado: 'RX', subServicioAsignado: '' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setLoading(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="rounded-2xl h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 active:scale-95 gap-2">
          <Plus className="h-4 w-4" /> Nuevo Usuario
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-0 overflow-hidden max-w-xl">
        <div className="bg-emerald-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Users className="h-24 w-24" />
            </div>
          <AlertDialogHeader className="relative z-10">
            <AlertDialogTitle className="text-3xl font-black uppercase italic tracking-tighter">Crear Nuevo Perfil</AlertDialogTitle>
            <AlertDialogDescription className="text-emerald-50/80 font-bold text-xs uppercase tracking-widest">
              Vincula un usuario de Auth con su perfil operativo de Firestore
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        
        <div className="p-8 grid grid-cols-2 gap-4">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">UID de Firebase Auth</Label>
            <Input value={formData.uid} onChange={e => setFormData({...formData, uid: e.target.value.trim()})}
              placeholder="Pegue el UID de la consola..." className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Email</Label>
            <Input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value.trim()})}
              className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Nombre Completo</Label>
            <Input value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value.toUpperCase()})}
              className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Cédula / Documento</Label>
            <Input value={formData.documento} onChange={e => setFormData({...formData, documento: e.target.value})}
              className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Teléfono</Label>
            <Input value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})}
              className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Rol</Label>
            <Select value={formData.rol} onValueChange={(val: any) => setFormData({...formData, rol: val})}>
              <SelectTrigger className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {UserRoles.map(role => (
                  <SelectItem key={role} value={role} className="text-xs font-bold uppercase">{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Servicio Asignado</Label>
            <Select value={formData.servicioAsignado} onValueChange={val => setFormData({...formData, servicioAsignado: val as any, subServicioAsignado: ''})}>
              <SelectTrigger className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl max-h-48">
                {[...Modalities, ...GeneralServices].map(serv => (
                  <SelectItem key={serv} value={serv} className="text-xs font-bold">{serv}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {SubServiceAreas[formData.servicioAsignado as any] && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Sub-Servicio</Label>
              <Select value={formData.subServicioAsignado} onValueChange={val => setFormData({...formData, subServicioAsignado: val})}>
                <SelectTrigger className="h-10 bg-zinc-50 border-zinc-100 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {SubServiceAreas[formData.servicioAsignado as any].map(sub => (
                    <SelectItem key={sub} value={sub} className="text-xs font-bold">{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="p-4 bg-zinc-50 flex items-center justify-end gap-3 border-t border-zinc-100">
          <AlertDialogCancel className="rounded-xl h-11 text-[10px] font-black uppercase tracking-widest border-none hover:bg-zinc-200" disabled={loading}>
            Cancelar
          </AlertDialogCancel>
          <Button onClick={handleCreate} disabled={loading}
            className="rounded-xl h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Crear Perfil
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
          <span key={op} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-black uppercase group">
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
          placeholder="Nuevo..." className="h-8 text-[10px] font-bold bg-zinc-50 border-zinc-100 rounded-lg placeholder:text-zinc-300"
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
        <button className="relative flex items-center" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : (
            <Switch checked={user.activo} className="data-[state=checked]:bg-emerald-500 scale-90" onClick={(e) => e.preventDefault()} />
          )}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl border-0 shadow-2xl p-0 overflow-hidden max-w-sm">
        <div className="p-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black text-lg">¿Cambiar estado?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-500 font-medium text-sm">
                {user.activo ? "Esto desactivará al usuario y no podrá iniciar sesión." : "Esto reactivará al usuario y podrá iniciar sesión de nuevo."}
              </AlertDialogDescription>
            </AlertDialogHeader>
        </div>
        <div className="p-4 bg-zinc-50 flex items-center justify-end gap-2.5 border-t border-zinc-100">
          <AlertDialogCancel className="rounded-xl h-9 text-[10px] font-black uppercase tracking-widest border-none hover:bg-zinc-200">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggle} className="rounded-xl h-9 px-6 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-black uppercase tracking-widest">Confirmar</AlertDialogAction>
        </div>
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
    users.filter(u => u.nombre?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()) || u.documento?.includes(search)),
    [users, search]
  );

  const activeCount = useMemo(() => users.filter(u => u.activo).length, [users]);

  if (authLoading || loading || userProfile?.rol !== 'administrador') {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-300" /></div>;
  }

  return (
    <div className="py-8 space-y-6 max-w-7xl mx-auto px-4 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-100 rounded-lg"><Users className="h-4 w-4 text-blue-600" /></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Administración</span>
          </div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Gestión de Usuarios</h1>
          <p className="text-zinc-500 font-medium mt-1">Administra permisos, operadores y perfiles de cada cuenta.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Usuarios", value: users.length, icon: Users, accent: "bg-zinc-100 text-zinc-600" },
          { label: "Activos", value: activeCount, icon: UserCheck, accent: "bg-emerald-100 text-emerald-600" },
          { label: "Inactivos", value: users.length - activeCount, icon: UserX, accent: "bg-red-100 text-red-500" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
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
        <div className="px-8 pb-8 pt-4 flex items-center gap-4">
          <CreateUserDialog />
          <div className="relative group w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300 group-focus-within:text-emerald-500 transition-colors" />
            <Input placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-zinc-50 border-0 focus:ring-2 focus:ring-emerald-500/20 transition-all rounded-2xl text-xs font-bold shadow-sm" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100 text-left">
                {["Usuario", "Cédula / Tel", "Rol", "Servicio", "Operadores", "Status", ""].map(h => (
                  <th key={h} className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredUsers.map((user) => (
                <tr key={user.uid} className="hover:bg-zinc-50/50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-bold text-zinc-900">{user.nombre}</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">{user.email}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            <Contact className="h-3 w-3 text-zinc-300" />
                            <span className="text-xs font-black text-zinc-600">{user.documento || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-zinc-300" />
                            <span className="text-[10px] font-bold text-zinc-400">{user.telefono || '—'}</span>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider", rolColors[user.rol] || "bg-zinc-100 text-zinc-600")}>
                      {user.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-zinc-600 uppercase tracking-tight">{user.servicioAsignado || '—'}</td>
                  <td className="px-6 py-4 min-w-[200px]"><ManageOperators user={user} /></td>
                  <td className="px-6 py-4"><ToggleStatus user={user} /></td>
                  <td className="px-6 py-4 text-right">
                    <EditUserDialog user={user} />
                  </td>
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
