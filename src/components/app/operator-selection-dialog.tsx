
"use client";

import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { LogOut } from "lucide-react";

export function OperatorSelectionDialog() {
  const { 
    currentProfile, 
    operatorSelectionRequired, 
    selectOperator,
    signOut,
  } = useAuth();
  
  const [localSelection, setLocalSelection] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleConfirm = () => {
    if (localSelection) {
      selectOperator(localSelection);
    }
  };

  const handleLogout = async () => {
    setIsSigningOut(true);
    await signOut();
  };

  return (
    <Dialog open={operatorSelectionRequired} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Seleccionar Operador</DialogTitle>
          <DialogDescription>
            Para continuar, por favor selecciona el operador que está utilizando esta sesión.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup 
            value={localSelection ?? undefined}
            onValueChange={setLocalSelection} 
            className="flex flex-col gap-3"
          >
            {(currentProfile?.operadores || []).map((op) => (
              <div key={op} className="flex items-center space-x-3 p-3 border rounded-md has-[:checked]:bg-accent has-[:checked]:border-primary">
                <RadioGroupItem value={op} id={`op-${op}`} />
                <Label htmlFor={`op-${op}`} className="text-base font-medium w-full cursor-pointer">
                  {op}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex-col-reverse">
          <Button variant="outline" onClick={handleLogout} disabled={isSigningOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {isSigningOut ? "Cerrando..." : "Cerrar Sesión"}
          </Button>
          <Button onClick={handleConfirm} disabled={!localSelection || isSigningOut}>
            Confirmar y Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
