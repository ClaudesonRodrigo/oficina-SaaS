"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  collection,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Componentes Shadcn UI
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner"; // Usando sonner para feedbacks mais elegantes

// --- Tipos e Schema ---
interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
}

const formSchema = z.object({
  nome: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  role: z.enum(["admin", "operador"]),
});

export default function UsuariosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<UserData[]>([]);
  
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // UID do Super Admin (Sabio dos 6 Caninos)
  const superAdminUID = "kJ4iOKdHmbgr4mWms34rp24w9413";

  // --- 1. Guardião de Rota ---
  useEffect(() => {
    if (!authLoading) {
      const isAuthorized = userData?.role === 'admin' || auth.currentUser?.uid === superAdminUID;
      if (!isAuthorized) {
        toast.error("Acesso negado. Redirecionando...");
        router.push('/');
      }
    }
  }, [userData, authLoading, router]);

  // --- 2. Carregar Usuários (Listener em Tempo Real) ---
  useEffect(() => {
    const isAuthorized = userData?.role === 'admin' || auth.currentUser?.uid === superAdminUID;
    if (!isAuthorized) return;

    const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const lista: UserData[] = [];
      snapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() } as UserData);
      });
      setUsuarios(lista);
    }, (error) => {
      console.error("Erro ao buscar usuários:", error);
      toast.error("Erro ao carregar lista de usuários.");
    });

    return () => unsub();
  }, [userData]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      email: "",
      password: "",
      role: "operador",
    },
  });

  // --- 3. Função de Criar ---
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        toast.error("Erro de autenticação. Tente fazer login novamente.");
        return;
      }

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao criar usuário");
      }

      toast.success(`Usuário ${values.nome} criado com sucesso!`);
      form.reset();
      setIsModalOpen(false);
      
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message);
    }
  }

  if (authLoading) return <div className="p-8">Carregando permissões...</div>;

  const isAuthorized = userData?.role === 'admin' || auth.currentUser?.uid === superAdminUID;
  if (!isAuthorized) return null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Gerenciar Usuários</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Adicionar Novo Usuário</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Usuário</DialogTitle>
              <DialogDescription>
                Crie um novo login para o sistema (Admin ou Operador).
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do funcionário" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail (Login)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@oficina.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="******" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nível de Acesso</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="operador">Operador (Caixa/Mecânico)</SelectItem>
                          <SelectItem value="admin">Administrador (Dono)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Criando..." : "Criar Usuário"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.nome}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    u.role === 'admin' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {u.role.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={async () => {
                      if (confirm(`Deseja excluir ${u.nome}? O acesso será removido apenas do banco.`)) {
                        try {
                          await deleteDoc(doc(db, "usuarios", u.id));
                          toast.success("Usuário removido da listagem.");
                        } catch (e) {
                          toast.error("Erro ao excluir usuário.");
                        }
                      }
                    }}
                  >
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {usuarios.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}