
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { createInventoryItemAction } from '@/app/actions';
import { InventoryCategories } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus } from 'lucide-react';

const newItemSchema = z.object({
    name: z.string().min(3, "El nombre es muy corto."),
    category: z.enum(InventoryCategories),
    presentation: z.enum(['Caja', 'Frasco', 'Unidad']),
    content: z.coerce.number().min(1, "El contenido debe ser mayor a 0."),
    contentUnit: z.enum(['unidades', 'ml', 'g']),
    specification: z.string().optional(),
    stock: z.coerce.number().min(0, "El stock no puede ser negativo."),
    price: z.coerce.number().optional(),
    isContrast: z.boolean().default(false),
});

type NewItemFormData = z.infer<typeof newItemSchema>;

interface NewItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function NewItemDialog({ open, onOpenChange }: NewItemDialogProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const form = useForm<NewItemFormData>({
        resolver: zodResolver(newItemSchema),
        defaultValues: {
            name: '',
            category: 'insumo',
            presentation: 'Unidad',
            content: 1,
            contentUnit: 'unidades',
            specification: '',
            stock: 0,
            price: 0,
            isContrast: false,
        },
    });

    const onSubmit = async (data: NewItemFormData) => {
        setLoading(true);
        // Force isContrast to true if category is 'contraste'
        const finalData = {
            ...data,
            isContrast: data.category === 'contraste',
        };
        const result = await createInventoryItemAction(finalData);
        if (result.success) {
            toast({ title: 'Insumo Creado', description: `${data.name} ha sido añadido al inventario.` });
            onOpenChange(false);
            form.reset();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setLoading(false);
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Insumo</DialogTitle>
                    <DialogDescription>
                        Define un nuevo artículo para el catálogo de inventario.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nombre del Insumo</FormLabel><FormControl><Input autoFocus placeholder="Ej: Xenetix 300" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoría</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="insumo">Insumo General</SelectItem>
                                            <SelectItem value="contraste">Medio de Contraste</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                             <FormField control={form.control} name="presentation" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Presentación</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="Caja">Caja</SelectItem>
                                            <SelectItem value="Frasco">Frasco</SelectItem>
                                            <SelectItem value="Unidad">Unidad</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="content" render={({ field }) => ( <FormItem><FormLabel>Contenido</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                             <FormField control={form.control} name="contentUnit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unidad Cont.</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="unidades">unidades</SelectItem>
                                            <SelectItem value="ml">ml</SelectItem>
                                            <SelectItem value="g">g</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <div className="grid grid-cols-3 gap-4">
                           <FormField control={form.control} name="specification" render={({ field }) => ( <FormItem><FormLabel>Especificación</FormLabel><FormControl><Input placeholder="Ej: 100ml, #22" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                           <FormField control={form.control} name="stock" render={({ field }) => ( <FormItem><FormLabel>Stock Inicial</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                           <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Precio Compra</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                Crear Insumo
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
