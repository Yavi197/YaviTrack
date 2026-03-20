
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription as AlertDescriptionComponent, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';

const formSchema = z.object({
    creatinine: z.coerce.number().min(0.1, "El valor debe ser mayor a 0."),
});

type CreatinineFormData = z.infer<typeof formSchema>;

interface CreatininePromptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (creatinine: number) => void;
    onCancel: () => void;
}

export function CreatininePromptDialog({ open, onOpenChange, onConfirm, onCancel }: CreatininePromptDialogProps) {
    const [loading, setLoading] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [creatinineValue, setCreatinineValue] = useState<number | null>(null);

    const form = useForm<CreatinineFormData>({
        resolver: zodResolver(formSchema),
        defaultValues: { creatinine: '' as any },
    });

    const onSubmit = (data: CreatinineFormData) => {
        setLoading(true);
        if (data.creatinine > 1.6) {
            setCreatinineValue(data.creatinine);
            setShowWarning(true);
            setLoading(false);
        } else {
            handleConfirm(data.creatinine);
        }
    };
    
    const handleConfirm = (creatinine: number) => {
        onConfirm(creatinine);
        form.reset();
        setLoading(false);
        setShowWarning(false);
        onOpenChange(false);
    }

    const handleCancel = () => {
        onCancel();
        onOpenChange(false);
        form.reset();
    };
    
    const handleWarningCancel = () => {
        setCreatinineValue(null);
        setShowWarning(false);
    }

    return (
        <>
            <Dialog open={open && !showWarning} onOpenChange={onOpenChange}>
                <DialogContent onEscapeKeyDown={handleCancel} onPointerDownOutside={handleCancel} className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="font-headline text-lg">Valor de Creatinina</DialogTitle>
                        <DialogDescription className="text-sm">
                            Requerido para estudios con contraste IV.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <Alert variant="destructive" className="mt-2 py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-sm">Contraste IV</AlertTitle>
                        <AlertDescriptionComponent className="text-xs">
                            Se asignará automáticamente estado de contraste.
                        </AlertDescriptionComponent>
                    </Alert>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                            <FormField
                                control={form.control}
                                name="creatinine"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-sm">Creatinina (mg/dL)</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="number" 
                                                step="0.01"
                                                placeholder="0.9" 
                                                autoFocus
                                                className="text-sm"
                                                {...field} />
                                        </FormControl>
                                        <FormMessage className="text-xs" />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter className="pt-2 flex gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                                    Cancelar
                                </Button>
                                <Button type="submit" size="sm" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : "Confirmar"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
                <AlertDialogContent className="sm:max-w-[350px]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Creatinina Elevada
                        </AlertDialogTitle>
                        <AlertDialogDescription className="pt-2 text-sm">
                            Valor {creatinineValue} mg/dL. Alto riesgo de nefropatía. ¿Continuar?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel onClick={handleWarningCancel} className="text-sm">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => {
                            if (creatinineValue !== null) {
                                handleConfirm(creatinineValue);
                            }
                        }} className="text-sm">
                            Continuar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
