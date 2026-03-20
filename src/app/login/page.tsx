
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn } from "lucide-react";
import { AppLogoIcon } from "@/components/icons/app-logo-icon";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful:", result.user.uid);
      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido a Med-iTrack.",
      });
      router.push("/");
    } catch (error: any) {
      console.error("Login error:", error.code, error.message);
      let description = "Credenciales inválidas. Por favor, inténtelo de nuevo.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
          description = "El correo electrónico proporcionado no se encuentra registrado.";
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          description = "La contraseña es incorrecta. Por favor, verifique sus datos.";
      }
      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: description,
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
            <Link href="/" className="flex justify-center items-center mb-4">
                <AppLogoIcon className="h-12 w-12 text-primary" />
            </Link>
          <CardTitle className="text-3xl font-headline">Acceder a Med-iTrack</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para gestionar las solicitudes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@dominio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando..." : <> <LogIn className="mr-2 h-4 w-4"/> Ingresar </>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
