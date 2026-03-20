"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { addMultipleInventoryEntriesAction } from '@/app/actions';
import type { InventoryItem } from '@/lib/types';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, Search, Package, Server, Tag, CalendarClock, History } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Badge } from '../ui/badge';

const entrySchema = z.object({
    itemId: z.string().min(1, "Debes seleccionar un insumo."),
    itemName: z.string(),
    presentation: z.string(),
    service: z.enum(['RX', 'TAC', 'ECO', 'General'], { required_error: "Selecciona un servicio."}),
    quantity: z.coerce.number().min(1, "Cantidad > 0."),
    lote: z.string().optional(),
    price: z.coerce.number().optional(),
    unidad: z.string().optional(),
    fechaVencimiento: z.string().optional(),
    proveedor: z.string().optional(),
    observaciones: z.string().optional(),
});

const formSchema = z.object({
  entries: z.array(entrySchema).min(1, "Debes añadir al menos un insumo."),
});

type FormData = z.infer<typeof formSchema>;

interface AddSupplyEntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddSupplyEntryDialog({ open, onOpenChange }: AddSupplyEntryDialogProps) {
    const { userProfile } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(-1);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

    useEffect(() => {
        if (!open) return;
        const q = query(collection(db, "inventoryItems"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const itemsData: InventoryItem[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
            setInventoryItems(itemsData);
        });
        return () => unsubscribe();
    }, [open]);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            entries: [{ itemId: '', itemName: '', presentation: '', service: 'General', quantity: 1, lote: '', price: 0, unidad: '', fechaVencimiento: '', proveedor: '', observaciones: '' }],
        },
    });

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "entries",
    });

    useEffect(() => {
        if (!open) {
            form.reset({ entries: [{ itemId: '', itemName: '', presentation: '', service: 'General', quantity: 1, lote: '', price: 0, unidad: '', fechaVencimiento: '', proveedor: '', observaciones: '' }] });
        }
    }, [open, form]);

    const handleItemSelect = (index: number, item: InventoryItem) => {
        const displayName = item.specification ? `${item.name} ${item.specification}` : item.name;
        update(index, {
            ...form.getValues(`entries.${index}`),
            itemId: item.id,
            itemName: displayName,
            presentation: item.presentation,
            price: item.price || 0,
            unidad: item.presentation, // Autofill
        });
        setPopoverOpen(-1);
    };

    const onSubmit = async (data: FormData) => {
        if (!userProfile) return;
        setLoading(true);

        const result = await addMultipleInventoryEntriesAction({
            entries: data.entries,
            userProfile,
        });

        if (result.success) {
            toast({ title: 'Entradas Registradas', description: 'Se han añadido los nuevos insumos al historial.' });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden border-none shadow-2xl">
                <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 text-white">
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/10 rounded-lg">
                                <Package className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-bold tracking-tight">Registrar Pedido</DialogTitle>
                                <DialogDescription className="text-zinc-400">
                                    Añade los insumos recibidos para actualizar el stock global.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-6 bg-zinc-50/50">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-3 px-3 mb-2 text-[11px] font-extrabold uppercase tracking-widest text-zinc-500">
                                <div className="col-span-4 flex items-center gap-2"><Tag className="h-3 w-3" /> Insumo</div>
                                <div className="col-span-3 flex items-center gap-2"><Server className="h-3 w-3" /> Servicio</div>
                                <div className="col-span-2 flex items-center gap-2"><History className="h-3 w-3" /> Cant.</div>
                                <div className="col-span-2 flex items-center gap-2"><CalendarClock className="h-3 w-3" /> Vence</div>
                                <div className="col-span-1"></div>
                            </div>

                            <ScrollArea className="h-[350px] pr-4">
                                <div className="space-y-3">
                                    {fields.map((field, index) => (
                                        <div key={field.id} className="grid grid-cols-12 gap-3 items-start p-2 bg-white border border-zinc-200 rounded-xl shadow-sm transition-all hover:border-emerald-200">
                                            {/* Item Selector */}
                                            <div className="col-span-4 space-y-1">
                                                <Popover open={popoverOpen === index} onOpenChange={(isOpen) => setPopoverOpen(isOpen ? index : -1)}>
                                                    <PopoverTrigger asChild>
                                                        <FormControl>
                                                            <Button 
                                                                variant="outline" 
                                                                className={cn(
                                                                    "w-full h-10 justify-start font-bold text-xs bg-zinc-50/50 hover:bg-zinc-100 border-zinc-200 transition-all", 
                                                                    !form.getValues(`entries.${index}.itemName`) && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <Search className="mr-2 h-4 w-4 shrink-0" />
                                                                <span className="truncate">{form.getValues(`entries.${index}.itemName`) || "Seleccionar..."}</span>
                                                            </Button>
                                                        </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[380px] p-0 shadow-2xl border-zinc-200" align="start">
                                                        <Command className="rounded-lg">
                                                            <CommandInput placeholder="Buscar insumo..." className="h-10 text-xs" />
                                                            <CommandList>
                                                                <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">Insumo no encontrado.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {inventoryItems.map((item) => {
                                                                        const displayName = item.specification ? `${item.name} ${item.specification}` : item.name;
                                                                        return (
                                                                            <CommandItem
                                                                                key={item.id}
                                                                                value={displayName}
                                                                                onSelect={() => handleItemSelect(index, item)}
                                                                                className="text-xs py-2 px-3 data-[selected=true]:bg-emerald-50 data-[selected=true]:text-emerald-900 cursor-pointer"
                                                                            >
                                                                                <div className="flex items-center justify-between w-full">
                                                                                    <span className="font-semibold">{displayName}</span>
                                                                                    <Badge variant="outline" className="text-[9px] font-bold opacity-80">{item.presentation}</Badge>
                                                                                </div>
                                                                            </CommandItem>
                                                                        )
                                                                    })}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                                <div className="flex items-center gap-2 px-1">
                                                     <Input 
                                                        placeholder="Lote" 
                                                        className="h-7 text-[10px] border-none bg-zinc-100/50 focus-visible:ring-0 px-2 py-0"
                                                        {...form.register(`entries.${index}.lote`)}
                                                     />
                                                     <Input 
                                                        placeholder="Proveedor" 
                                                        className="h-7 text-[10px] border-none bg-zinc-100/50 focus-visible:ring-0 px-2 py-0"
                                                        {...form.register(`entries.${index}.proveedor`)}
                                                     />
                                                </div>
                                            </div>

                                            {/* Service Select */}
                                            <FormField control={form.control} name={`entries.${index}.service`} render={({ field: serviceField }) => (
                                                <FormItem className="col-span-3">
                                                    <Select onValueChange={serviceField.onChange} defaultValue={serviceField.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="h-10 bg-zinc-50/50 border-zinc-200 font-bold text-xs ring-0">
                                                                <SelectValue placeholder="Servicio" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="border-zinc-200 shadow-xl">
                                                            <SelectItem value="General" className="text-xs font-bold">GENERAL</SelectItem>
                                                            <SelectItem value="RX" className="text-xs font-bold">RAYOS X (RX)</SelectItem>
                                                            <SelectItem value="TAC" className="text-xs font-bold">TOMOGRAFÍA (TAC)</SelectItem>
                                                            <SelectItem value="ECO" className="text-xs font-bold">ECOGRAFÍA (ECO)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />

                                            {/* Quantity */}
                                            <FormField control={form.control} name={`entries.${index}.quantity`} render={({ field: qtyField }) => (
                                                <FormItem className="col-span-2">
                                                    <FormControl>
                                                        <div className="relative group">
                                                            <Input 
                                                                type="number" 
                                                                className="h-10 text-center font-black text-emerald-600 bg-emerald-50/30 border-emerald-100 focus:border-emerald-300 focus:ring-emerald-200 transition-all text-sm" 
                                                                {...qtyField} 
                                                            />
                                                            <span className="absolute -bottom-4 left-0 w-full text-center text-[8px] font-bold text-zinc-400 uppercase">
                                                                {form.getValues(`entries.${index}.presentation`) || '---'}
                                                            </span>
                                                        </div>
                                                    </FormControl>
                                                </FormItem>
                                            )} />

                                            {/* Expirancy date */}
                                            <FormField control={form.control} name={`entries.${index}.fechaVencimiento`} render={({ field: fechaVencField }) => (
                                                <FormItem className="col-span-2">
                                                    <FormControl>
                                                        <Input 
                                                            type="date" 
                                                            className="h-10 text-[10px] border-zinc-200 bg-zinc-50/50 font-bold uppercase transition-all focus:bg-white" 
                                                            {...fechaVencField} 
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )} />

                                            {/* Actions */}
                                            <div className="col-span-1 flex items-center justify-center h-10 px-1">
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => remove(index)}
                                                    className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors text-zinc-400"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-12 border-dashed border-2 border-zinc-200 text-zinc-500 font-bold hover:bg-zinc-50 hover:border-emerald-300 hover:text-emerald-700 transition-all group"
                                onClick={() => append({ itemId: '', itemName: '', presentation: '', service: 'General', quantity: 1, lote: '', price: 0, unidad: '', fechaVencimiento: '', proveedor: '', observaciones: '' })}
                            >
                                <Plus className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                                Añadir otro insumo al pedido
                            </Button>
                            <FormMessage>{form.formState.errors.entries?.root?.message}</FormMessage>

                            <DialogFooter className="pt-6 border-t border-zinc-100 gap-3">
                                <Button type="button" variant="ghost" className="font-bold text-zinc-500" onClick={() => onOpenChange(false)}>
                                    Cerrar
                                </Button>
                                <Button 
                                    type="submit" 
                                    disabled={loading}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-200 active:scale-95 transition-all h-11"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <Package className="mr-2 h-4 w-4" />
                                            Sincronizar Inventario
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
