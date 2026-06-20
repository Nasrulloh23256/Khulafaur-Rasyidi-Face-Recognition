import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Lock, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const logo = "/logo.png";
const brandName = "\u03A9hm Study Club";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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

      if (payload?.role) {
        localStorage.setItem("auth_user", JSON.stringify(payload));
      }

      toast({
        title: "Login Berhasil!",
        description: `Selamat datang di portal absensi, ${payload?.name ?? "Admin"}`,
      });
      router.push(payload?.role === "TEACHER" ? "/dashboard/kehadiran" : "/dashboard");
    } catch (error) {
      toast({
        title: "Login Gagal",
        description: "Terjadi kesalahan saat menghubungkan server",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      <div className="absolute inset-0 gradient-hero" />
      
      {/* Back to home */}
      <Link 
        href="/" 
        className="absolute left-6 top-6 z-20 flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Beranda
      </Link>

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-8 px-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="hidden rounded-lg bg-primary p-8 text-primary-foreground shadow-soft lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 text-xl font-extrabold">
              {"\u03A9"}
            </div>
            <div>
              <h1 className="text-xl font-extrabold">{brandName}</h1>
              <p className="text-sm text-primary-foreground/75">Portal Absensi Bimbel</p>
            </div>
          </div>
          <h2 className="text-3xl font-extrabold leading-tight">Masuk untuk mencatat dan memantau kehadiran.</h2>
          <p className="mt-5 leading-7 text-primary-foreground/80">
            Akses guru diarahkan ke pekerjaan absensi, kelas, siswa, dan enroll wajah. Informasi internal lain
            tetap tidak ditampilkan di area guru.
          </p>
        </div>

        <div>
          <Card className="border-0 bg-card/95 shadow-soft backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4">
                <img
                  src={logo}
                  alt={`Logo ${brandName}`}
                  className="mx-auto h-20 w-20 object-contain"
                />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Login Absensi
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Masuk ke portal absensi {brandName}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Masukkan email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-muted/50 border-border focus:border-primary focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 bg-muted/50 border-border focus:border-primary focus:ring-primary"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-border text-primary focus:ring-primary" />
                    <span className="text-muted-foreground">Ingat saya</span>
                  </label>
                  <a href="#" className="text-primary hover:underline font-medium">
                    Lupa password?
                  </a>
                </div>

                <Button
                  type="submit"
                  variant="gradient"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Memproses...
                    </span>
                  ) : (
                    "Log In"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Belum punya akun?{" "}
                  <Link href="/#daftar-guru" className="text-primary font-medium hover:underline">
                    Daftar guru baru
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            &copy; 2026 {brandName}. Portal Absensi Bimbel
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
