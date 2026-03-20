
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { tutorialData } from '@/lib/tutorial-data';
import type { UserRole } from '@/lib/types';
import { Button } from '../ui/button';

interface HelpTutorialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: UserRole;
}

export function HelpTutorialDialog({ open, onOpenChange, role }: HelpTutorialDialogProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  const tutorial = tutorialData[role] || [];

  useEffect(() => {
    if (!api) {
      return;
    }
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  if (tutorial.length === 0) {
    return null; // Don't render the dialog if there's no tutorial for the role
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">
            Tutorial de Ayuda para {role.charAt(0).toUpperCase() + role.slice(1)}
          </DialogTitle>
          <DialogDescription>
            Usa las flechas para navegar por los pasos y aprender las funciones clave de tu perfil.
          </DialogDescription>
        </DialogHeader>
        
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent>
            {tutorial.map((step, index) => (
              <CarouselItem key={index}>
                <div className="p-1">
                  <Card>
                    <CardContent className="flex flex-col lg:flex-row items-center justify-center p-6 gap-6">
                        <div className="w-full lg:w-1/2 aspect-video relative rounded-lg overflow-hidden">
                           <Image 
                                src={step.image} 
                                alt={step.title} 
                                fill
                                style={{ objectFit: 'cover' }}
                                data-ai-hint={step.imageHint}
                            />
                        </div>
                        <div className="w-full lg:w-1/2 space-y-2">
                            <h3 className="text-xl font-bold font-headline">{step.title}</h3>
                            <p className="text-muted-foreground">{step.description}</p>
                        </div>
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>

        <DialogFooter className="flex-row justify-between items-center w-full">
            <div className="text-center text-sm text-muted-foreground">
                Paso {current} de {count}
            </div>
            <Button onClick={() => onOpenChange(false)}>
                Entendido
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
