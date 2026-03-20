"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { OrderData } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  selectedStudies: z.array(z.string()).refine(value => value.some(item => item), {
    message: "Debes seleccionar al menos un estudio.",
  }),
});

type FormData = z.infer<typeof formSchema>;

interface SelectStudiesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderData: OrderData | null;
  onConfirm: (selectedStudies: OrderData['studies']) => void;
  onCancel: () => void;
}

export function SelectStudiesDialog({ open, onOpenChange, orderData, onConfirm, onCancel }: SelectStudiesDialogProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedStudies: [],
    },
  });

  useEffect(() => {
    if (orderData?.studies) {
      // Pre-select all studies by default
      form.setValue('selectedStudies', orderData.studies.map(s => s.cups));
    }
  }, [orderData, form]);

  const onSubmit = (data: FormData) => {
    setLoading(true);
    const selected = orderData?.studies.filter(s => data.selectedStudies.includes(s.cups)) || [];
    onConfirm(selected);
    setLoading(false);
  };
  
  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleCancel(); }}>
      <DialogContent onEscapeKeyDown={handleCancel} onPointerDownOutside={handleCancel}>
        <DialogHeader>
          <DialogTitle>Múltiples Estudios Encontrados</DialogTitle>
          <DialogDescription>
            La IA detectó varios estudios en la orden. Por favor, selecciona los que deseas registrar.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="max-h-80 w-full rounded-md border p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
              <FormField
                control={form.control}
                name="selectedStudies"
                render={() => (
                  <FormItem className="space-y-3">
                    {orderData?.studies.map((study) => (
                      <FormField
                        key={study.cups}
                        control={form.control}
                        name="selectedStudies"
                        render={({ field }) => {
                          return (
                            <FormItem key={study.cups} className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(study.cups)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, study.cups])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== study.cups
                                          )
                                        )
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer w-full">
                                <p className="font-semibold">{study.nombre}</p>
                                <p className="text-xs text-muted-foreground">CUPS: {study.cups} - {study.modality}</p>
                              </FormLabel>
                            </FormItem>
                          )
                        }}
                      />
                    ))}
                  </FormItem>
                )}
              />
            </ScrollArea>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancelar Orden Completa
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Crear ${form.watch('selectedStudies').length} Solicitud(es)`}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
