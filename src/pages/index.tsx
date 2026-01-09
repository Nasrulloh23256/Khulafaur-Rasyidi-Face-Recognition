import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { 
  Users, 
  BookOpen, 
  ClipboardCheck, 
  Shield, 
  Camera, 
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Mail,
  Lock,
  Phone
} from "lucide-react";
const features = [
  {
    icon: Camera,
    title: "Face Recognition",
    description: "Sistem absensi otomatis dengan teknologi pengenalan wajah yang akurat dan cepat"
  },
  {
    icon: Users,
    title: "Manajemen Siswa",
    description: "Kelola data siswa, kelas, dan wali kelas dengan mudah dalam satu platform"
  },
  {
    icon: ClipboardCheck,
    title: "Rekap Absensi",
    description: "Rekap kehadiran otomatis per bulan, semester, dan tahun ajaran"
  },
  {
    icon: BarChart3,
    title: "Laporan & Grafik",
    description: "Visualisasi data kehadiran dengan grafik interaktif dan laporan lengkap"
  }
];

const stats = [
  { value: "99%", label: "Akurasi Deteksi" },
  { value: "<1s", label: "Waktu Proses" },
  { value: "24/7", label: "Sistem Aktif" },
  { value: "100%", label: "Data Aman" },
];

const logo = "/logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const Index = () => {
  const { toast } = useToast();
  const [teacherForm, setTeacherForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);

  const handleTeacherRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!teacherForm.fullName || !teacherForm.email || !teacherForm.password || !teacherForm.confirmPassword) {
      toast({
        title: "Data belum lengkap",
        description: "Nama, email, dan password wajib diisi",
        variant: "destructive",
      });
      return;
    }

    if (teacherForm.password.length < 6) {
      toast({
        title: "Password terlalu pendek",
        description: "Minimal 6 karakter.",
        variant: "destructive",
      });
      return;
    }

    if (teacherForm.password !== teacherForm.confirmPassword) {
      toast({
        title: "Password tidak sama",
        description: "Pastikan konfirmasi password sesuai.",
        variant: "destructive",
      });
      return;
    }

    setIsRegistering(true);
    try {
      const response = await fetch("/api/auth/register-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: teacherForm.fullName,
          email: teacherForm.email,
          phone: teacherForm.phone,
          password: teacherForm.password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast({
          title: "Gagal membuat akun",
          description: payload?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Akun guru berhasil dibuat",
        description: "Silakan login menggunakan email dan password yang didaftarkan.",
      });
      setTeacherForm({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
      });
    } catch (error) {
      toast({
        title: "Gagal membuat akun",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-effect">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo TK Khulafaur Arrasyidin" className="h-12 w-12 object-contain" />
              <div>
                <h1 className="font-bold text-lg text-foreground">TK Khulafaur Arrasyidin</h1>
                <p className="text-xs text-muted-foreground">Sistem Absensi Digital</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Fitur
              </a>
              <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Tentang
              </a>
              <a href="#daftar-guru" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Daftar Guru
              </a>
              <Button asChild variant="gradient" size="default">
                <Link href="/login">Login</Link>
              </Button>
            </nav>
            <Button asChild variant="gradient" size="sm" className="md:hidden">
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 gradient-hero opacity-5" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            className="max-w-4xl mx-auto text-center"
            variants={stagger}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
              variants={fadeUp}
            >
              <Sparkles className="w-4 h-4" />
              Sistem Absensi Modern dengan Face Recognition
            </motion.div>
            
            <motion.h1
              className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 leading-tight"
              variants={fadeUp}
            >
              Absensi{" "}
              <span className="text-gradient">Digital</span>{" "}
              untuk TK Khulafaur Arrasyidin
            </motion.h1>
            
            <motion.p
              className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto"
              variants={fadeUp}
            >
              Platform absensi berbasis face recognition yang modern, cepat, dan akurat. 
              Kelola kehadiran siswa dengan mudah dalam satu sistem terintegrasi.
            </motion.p>
            
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              variants={fadeUp}
            >
              <Button asChild variant="hero" size="xl" className="group">
                <Link href="/login">
                  Mulai Sekarang
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <a href="#features">
                <Button variant="outline" size="xl">
                  Lihat Fitur
                </Button>
              </a>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            {stats.map((stat) => (
              <motion.div 
                key={stat.label}
                className="text-center p-6 rounded-2xl bg-card shadow-card"
                variants={fadeUp}
              >
                <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <motion.h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" variants={fadeUp}>
              Fitur <span className="text-gradient">Unggulan</span>
            </motion.h2>
            <motion.p className="text-muted-foreground max-w-2xl mx-auto" variants={fadeUp}>
              Dilengkapi dengan berbagai fitur canggih untuk memudahkan pengelolaan absensi sekolah
            </motion.p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {features.map((feature) => (
              <motion.div 
                key={feature.title}
                className="group p-6 rounded-2xl bg-card shadow-card hover:shadow-soft transition-all duration-300 hover:-translate-y-1"
                variants={fadeUp}
              >
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <motion.h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6" variants={fadeUp}>
                Mengapa Memilih <span className="text-gradient">Sistem Kami?</span>
              </motion.h2>
              <motion.p className="text-muted-foreground mb-8" variants={fadeUp}>
                Sistem absensi TK Khulafaur Arrasyidin dirancang khusus untuk kebutuhan 
                pendidikan anak usia dini dengan antarmuka yang mudah digunakan dan 
                fitur yang lengkap.
              </motion.p>
              
              <motion.div className="space-y-4" variants={stagger}>
                {[
                  "Teknologi face recognition akurat dan cepat",
                  "Laporan kehadiran real-time untuk orang tua",
                  "Dashboard admin yang komprehensif",
                  "Data terenkripsi dan aman",
                  "Integrasi dengan sistem akademik sekolah"
                ].map((item, index) => (
                  <motion.div key={index} className="flex items-center gap-3" variants={fadeUp}>
                    <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div className="inline-block mt-8" variants={fadeUp}>
                <Button asChild variant="gradient" size="lg">
                  <Link href="/login">
                    Akses Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              className="relative"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <div className="absolute inset-0 gradient-primary rounded-3xl blur-3xl opacity-20" />
              <div className="relative bg-card rounded-3xl p-8 shadow-soft">
                <div className="flex items-center gap-4 mb-6">
                  <img src={logo} alt="Logo" className="w-16 h-16 object-contain" />
                  <div>
                    <h3 className="font-bold text-xl text-foreground">TK Khulafaur Arrasyidin</h3>
                    <p className="text-sm text-muted-foreground">Mencetak Generasi Qurani</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Kehadiran Hari Ini</span>
                      <span className="text-sm font-semibold text-success">95%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-[95%] gradient-primary rounded-full" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-xl bg-primary/10">
                      <div className="text-2xl font-bold text-primary">12</div>
                      <div className="text-xs text-muted-foreground">Kelas</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-secondary/10">
                      <div className="text-2xl font-bold text-secondary">240</div>
                      <div className="text-xs text-muted-foreground">Siswa</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-accent/30">
                      <div className="text-2xl font-bold text-accent-foreground">24</div>
                      <div className="text-xs text-muted-foreground">Guru</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Register Teacher Section */}
      <section id="daftar-guru" className="py-20 bg-muted/40">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <motion.h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4" variants={fadeUp}>
                Daftar Akun <span className="text-gradient">Guru</span>
              </motion.h2>
              <motion.p className="text-muted-foreground mb-6" variants={fadeUp}>
                Buat akun guru untuk mengelola kelas, siswa, dan absensi. Pastikan menggunakan email aktif.
              </motion.p>
              <motion.div className="space-y-4" variants={stagger}>
                {[
                  "Akses kelas dan absensi langsung dari dashboard guru",
                  "Enroll wajah siswa untuk absensi yang akurat",
                  "Kelola daftar siswa di kelas",
                ].map((item) => (
                  <motion.div key={item} className="flex items-center gap-3" variants={fadeUp}>
                    <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <Card className="border-0 shadow-soft bg-card/95">
                <CardHeader>
                  <CardTitle>Buat Akun Guru</CardTitle>
                  <CardDescription>Isi data berikut untuk mendaftar.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTeacherRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="teacher-name">Nama Lengkap</Label>
                      <Input
                        id="teacher-name"
                        placeholder="Nama guru"
                        value={teacherForm.fullName}
                        onChange={(event) =>
                          setTeacherForm((prev) => ({ ...prev, fullName: event.target.value }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teacher-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="teacher-email"
                          type="email"
                          placeholder="nama@email.com"
                          value={teacherForm.email}
                          onChange={(event) =>
                            setTeacherForm((prev) => ({ ...prev, email: event.target.value }))
                          }
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teacher-phone">Nomor HP (opsional)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="teacher-phone"
                          placeholder="08xxxxxxxxxx"
                          value={teacherForm.phone}
                          onChange={(event) =>
                            setTeacherForm((prev) => ({ ...prev, phone: event.target.value }))
                          }
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teacher-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="teacher-password"
                          type="password"
                          placeholder="Minimal 6 karakter"
                          value={teacherForm.password}
                          onChange={(event) =>
                            setTeacherForm((prev) => ({ ...prev, password: event.target.value }))
                          }
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teacher-confirm">Konfirmasi Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="teacher-confirm"
                          type="password"
                          placeholder="Ulangi password"
                          value={teacherForm.confirmPassword}
                          onChange={(event) =>
                            setTeacherForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                          }
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" variant="gradient" className="w-full" disabled={isRegistering}>
                      {isRegistering ? "Mendaftarkan..." : "Daftar Sekarang"}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Sudah punya akun?{" "}
                      <Link href="/login" className="text-primary font-medium hover:underline">
                        Login di sini
                      </Link>
                    </p>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            className="gradient-primary rounded-3xl p-12 text-center relative overflow-hidden"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBzdHJva2Utb3BhY2l0eT0iMC4xIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
            <div className="relative z-10">
              <Shield className="w-16 h-16 text-primary-foreground/80 mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Siap Menggunakan Sistem Absensi Digital?
              </h2>
              <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
                Login sekarang untuk mengakses dashboard dan mulai mengelola absensi siswa 
                dengan lebih efisien dan modern.
              </p>
              <Button asChild variant="accent" size="xl" className="shadow-lg">
                <Link href="/login">
                  Login ke Dashboard
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-sm text-muted-foreground">
                © 2026 TK Khulafaur Arrasyidin. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">Bantuan</a>
              <a href="#" className="hover:text-primary transition-colors">Kontak</a>
              <a href="#" className="hover:text-primary transition-colors">Kebijakan Privasi</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
