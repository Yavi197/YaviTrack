"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, ArrowLeft, Loader2, ShieldCheck, Mail, Lock } from "lucide-react";
import { AppLogoIcon } from "@/components/icons/app-logo-icon";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (error: any) {
      console.error("Login error:", error.code, error.message);
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "Credenciales inválidas.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden selection:bg-blue-100">
      {/* Background Aesthetic Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-50 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-50 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10 -mt-8 md:-mt-12">
        {/* Back Link */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="fixed top-8 left-8 z-50 lg:static lg:mb-6"
        >
          <Link href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-900 font-bold uppercase tracking-widest text-[10px] transition-colors group">
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Volver
          </Link>
        </motion.div>

        <motion.div
           initial={{ opacity: 0, scale: 0.98 }}
           animate={{ opacity: 1, scale: 1 }}
           className="bg-white border border-zinc-100 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] overflow-hidden"
        >
          <div className="p-8 md:p-10 text-center">
            <div className="flex flex-col items-center mb-8">
               <div className="p-3 bg-zinc-50 rounded-2xl mb-6 border border-zinc-100 shadow-sm">
                 <AppLogoIcon className="h-10 w-10" />
               </div>
               
               <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full mb-3 border border-blue-100 scale-90">
                  <ShieldCheck className="h-3 w-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Portal Seguro</span>
               </div>

               <h1 className="text-3xl md:text-4xl font-black text-zinc-900">
                Med-<span className="text-amber-500 lowercase mr-[0.05em]">i</span>Track
               </h1>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Correo</Label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-blue-500 transition-colors">
                    <Mail className="h-4 w-4" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ejemplo@meditrack.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-13 pl-11 pr-5 bg-zinc-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl font-medium text-sm text-zinc-900 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                   <Label htmlFor="password" className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Clave</Label>
                   <Link href="#" className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700">Olvidaste?</Link>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-blue-500 transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-13 pl-11 pr-5 bg-zinc-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl font-medium text-sm text-zinc-900 transition-all"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading}
                className={cn(
                  "w-full h-14 rounded-xl text-md font-black tracking-tight uppercase shadow-xl transition-all duration-300 active:scale-95 mt-4",
                  loading ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 hover:bg-zinc-800 text-white"
                )}
              >
                {loading ? (
                   <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    Continuar <LogIn className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>
          </div>
          
          <div className="bg-zinc-50/50 p-6 border-t border-zinc-50 text-center">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-[0.2em]">
              Personal Autorizado
            </p>
          </div>
        </motion.div>

        {/* Brand Footer */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8 text-[9px] font-black uppercase tracking-[0.3em] text-zinc-300"
        >
          © 2026 Med-iTrack Systems
        </motion.p>
      </div>
    </main>
  );
}
