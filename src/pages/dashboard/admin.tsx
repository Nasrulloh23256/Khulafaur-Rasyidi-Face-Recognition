import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Eye, EyeOff, LogIn, Mail, Plus, Shield, User, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN";
  createdAt: string;
};

type TeacherAccount = {
  id: string;
  userId: string | null;
  fullName: string;
  phone: string | null;
  createdAt: string;
  classes: { id: string; name: string }[];
  user: { id: string; name: string; email: string } | null;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

const AdminPage = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTeacherLoginOpen, setIsTeacherLoginOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTeacherLoading, setIsTeacherLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTeacherLoggingIn, setIsTeacherLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [teacherLogin, setTeacherLogin] = useState({
    email: "",
    password: "",
  });

  const teacherStats = useMemo(() => {
    const total = teachers.length;
    const withAccount = teachers.filter((teacher) => !!teacher.userId).length;
    return {
      total,
      withAccount,
      withoutAccount: total - withAccount,
    };
  }, [teachers]);

  const loadAdmins = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admins");
      const data = await response.json();
      if (response.ok) {
        setAdmins(data);
      }
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: "Tidak bisa mengambil data admin",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTeachers = async () => {
    setIsTeacherLoading(true);
    try {
      const response = await fetch("/api/teachers");
      const data = await response.json();
      if (response.ok) {
        setTeachers(data);
      }
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: "Tidak bisa mengambil data guru",
        variant: "destructive",
      });
    } finally {
      setIsTeacherLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
    loadTeachers();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name || !form.email || !form.password) {
      toast({
        title: "Data belum lengkap",
        description: "Nama, email, dan password wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast({
          title: "Gagal menyimpan",
          description: payload?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Akun super admin berhasil ditambahkan",
      });

      setForm({ name: "", email: "", password: "" });
      setShowPassword(false);
      setIsDialogOpen(false);
      loadAdmins();
    } catch (error) {
      toast({
        title: "Gagal menyimpan",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openTeacherLogin = (email?: string) => {
    setTeacherLogin({ email: email ?? "", password: "" });
    setShowTeacherPassword(false);
    setIsTeacherLoginOpen(true);
  };

  const handleTeacherLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teacherLogin.email || !teacherLogin.password) {
      toast({
        title: "Data belum lengkap",
        description: "Email dan password wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsTeacherLoggingIn(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: teacherLogin.email,
          password: teacherLogin.password,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({
          title: "Login Gagal",
          description: payload?.error ?? "Email atau password tidak valid",
          variant: "destructive",
        });
        return;
      }

      if (payload?.role !== "TEACHER") {
        toast({
          title: "Akun bukan guru",
          description: "Gunakan akun guru untuk login dari halaman ini.",
          variant: "destructive",
        });
        return;
      }

      localStorage.setItem("auth_user", JSON.stringify(payload));
      toast({
        title: "Login berhasil",
        description: `Masuk sebagai ${payload?.name ?? "Guru"}`,
      });
      setIsTeacherLoginOpen(false);
      router.push("/dashboard/kehadiran");
    } catch (error) {
      toast({
        title: "Login gagal",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsTeacherLoggingIn(false);
    }
  };

  return (
    <DashboardLayout title="Super Admin" subtitle="Kelola akun super admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Super Admin</p>
              <p className="text-2xl font-bold text-foreground">{admins.length}</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4" />
                Tambah Super Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Super Admin</DialogTitle>
                <DialogDescription>Buat akun super admin baru.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Nama lengkap"
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@email.com"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimal 8 karakter"
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="gradient" disabled={isSaving}>
                    {isSaving ? "Menyimpan..." : "Simpan"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Daftar Super Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Dibuat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && admins.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Belum ada super admin.
                    </TableCell>
                  </TableRow>
                )}
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-semibold text-foreground">{admin.name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <Badge className="border-transparent bg-primary/10 text-primary">Super Admin</Badge>
                    </TableCell>
                    <TableCell>{formatDate(admin.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Users className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Guru</p>
                <p className="text-xl font-bold text-foreground">{teacherStats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Sudah Punya Akun</p>
              <p className="text-xl font-bold text-foreground">{teacherStats.withAccount}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Belum Punya Akun</p>
              <p className="text-xl font-bold text-foreground">{teacherStats.withoutAccount}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Daftar Guru</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nomor HP</TableHead>
                  <TableHead>Status Akun</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isTeacherLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                )}
                {!isTeacherLoading && teachers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Belum ada guru.
                    </TableCell>
                  </TableRow>
                )}
                {teachers.map((teacher) => {
                  const hasAccount = !!teacher.userId;
                  return (
                    <TableRow key={teacher.id}>
                      <TableCell className="font-semibold text-foreground">{teacher.fullName}</TableCell>
                      <TableCell>{teacher.user?.email ?? "-"}</TableCell>
                      <TableCell>{teacher.phone || "-"}</TableCell>
                      <TableCell>
                        {hasAccount ? (
                          <Badge className="border-transparent bg-success/10 text-success">Akun Aktif</Badge>
                        ) : (
                          <Badge className="border-transparent bg-muted text-muted-foreground">Belum Ada Akun</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {teacher.classes.length > 0
                          ? teacher.classes.map((item) => item.name).join(", ")
                          : "-"}
                      </TableCell>
                      <TableCell>{formatDate(teacher.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={!hasAccount}
                          onClick={() => openTeacherLogin(teacher.user?.email)}
                        >
                          <LogIn className="w-4 h-4" />
                          Login
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isTeacherLoginOpen} onOpenChange={setIsTeacherLoginOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login Guru</DialogTitle>
            <DialogDescription>
              Masukkan email dan password guru. Login ini akan menggantikan sesi super admin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTeacherLogin} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="teacher-login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="teacher-login-email"
                  type="email"
                  placeholder="guru@email.com"
                  value={teacherLogin.email}
                  onChange={(event) =>
                    setTeacherLogin((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-login-password">Password</Label>
              <div className="relative">
                <Input
                  id="teacher-login-password"
                  type={showTeacherPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={teacherLogin.password}
                  onChange={(event) =>
                    setTeacherLogin((prev) => ({ ...prev, password: event.target.value }))
                  }
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showTeacherPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTeacherLoginOpen(false)}>
                Batal
              </Button>
              <Button type="submit" variant="gradient" disabled={isTeacherLoggingIn}>
                {isTeacherLoggingIn ? "Masuk..." : "Login Guru"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminPage;
