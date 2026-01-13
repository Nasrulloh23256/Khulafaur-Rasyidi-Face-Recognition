import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion, type Variants } from "framer-motion";
import ShinyText from "@/components/ShinyText";
import MagicBentoCard from "@/components/MagicBentoCard";
import {
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Mail,
  Phone,
  Shield,
  Sparkles,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Face Recognition Presisi",
    description: "Deteksi wajah cepat dengan kualitas gambar yang stabil untuk absensi akurat setiap hari.",
  },
  {
    icon: Users,
    title: "Manajemen Kelas dan Siswa",
    description: "Kelola data siswa, wali kelas, dan pembagian kelas secara terstruktur di satu tempat.",
  },
  {
    icon: ClipboardCheck,
    title: "Absensi Otomatis",
    description: "Siswa datang, kamera mendeteksi, status hadir tercatat otomatis tanpa antrian panjang.",
  },
  {
    icon: BarChart3,
    title: "Laporan Real-time",
    description: "Rekap harian, bulanan, hingga semester siap diunduh dengan tampilan yang rapi.",
  },
];

const stats = [
  { value: "99%", label: "Akurasi Deteksi" },
  { value: "1-2s", label: "Waktu Verifikasi" },
  { value: "24/7", label: "Sistem Aktif" },
  { value: "100%", label: "Data Aman" },
];

const steps = [
  {
    icon: UserPlus,
    title: "Daftarkan Guru",
    description: "Buat akun guru dan lengkapi informasi dasar kelas.",
  },
  {
    icon: Camera,
    title: "Enroll Wajah",
    description: "Rekam beberapa sampel wajah siswa agar terdeteksi stabil.",
  },
  {
    icon: ClipboardCheck,
    title: "Scan Otomatis",
    description: "Siswa hadir cukup menghadap kamera untuk tercatat.",
  },
  {
    icon: BarChart3,
    title: "Unduh Laporan",
    description: "Rekap kehadiran langsung tersedia dalam format yang rapi.",
  },
];

const trustItems = [
  {
    icon: Shield,
    title: "Keamanan Data",
    description: "Data tersimpan rapi dan hanya dapat diakses oleh admin yang berwenang.",
  },
  {
    icon: Clock,
    title: "Rekap Harian Otomatis",
    description: "Setiap absensi langsung masuk laporan tanpa input ulang.",
  },
  {
    icon: Zap,
    title: "Cepat dan Ringan",
    description: "Antarmuka ringan untuk perangkat sekolah dengan respon cepat.",
  },
];

const logo = "/Rasyidin%20Logo.jpeg";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const slowStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
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
              <a href="#workflow" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                Alur
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

      <main>
        <section className="relative pt-36 pb-24 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute -top-28 -right-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.16),rgba(255,255,255,0))]" />
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
              <motion.div variants={stagger} initial="hidden" animate="visible">
                <motion.div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
                  variants={fadeUp}
                >
                  <Sparkles className="w-4 h-4" />
                  Absensi digital berbasis face recognition
                </motion.div>
                <motion.h1
                  className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight"
                  variants={fadeUp}
                >
                  Absensi{" "}
                  <ShinyText
                    text="Digital"
                    className="inline-block"
                    color="#00c468"
                    shineColor="#d6ffe8"
                    speed={2.6}
                  />{" "}
                  yang rapi dan cepat untuk TK Khulafaur Arrasyidin
                </motion.h1>
                <motion.p className="mt-6 text-lg text-muted-foreground max-w-2xl" variants={fadeUp}>
                  Sistem absensi modern yang fokus pada kecepatan, akurasi, dan kemudahan. Guru tinggal arahkan kamera,
                  laporan langsung tersusun otomatis.
                </motion.p>
                <motion.div className="mt-8 flex flex-col sm:flex-row items-center gap-4" variants={fadeUp}>
                  <Button asChild variant="hero" size="xl" className="group">
                    <Link href="/login">
                      Mulai Sekarang
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                  <a href="#daftar-guru">
                    <Button variant="outline" size="xl">
                      Daftar Guru
                    </Button>
                  </a>
                </motion.div>
              </motion.div>

              <motion.div className="relative" variants={fadeIn} initial="hidden" animate="visible">
                <div className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.35),rgba(255,255,255,0))] blur-2xl" />
                <div className="relative rounded-3xl border border-white/60 bg-white/85 p-6 shadow-soft backdrop-blur">
                  <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                    <span>Live Face Scan</span>
                    <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">Aktif</span>
                  </div>
                  <div className="mt-6 grid gap-4">
                    <MagicBentoCard className="rounded-2xl bg-muted/60 p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl gradient-primary flex items-center justify-center">
                          <Camera className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Deteksi wajah berjalan</p>
                          <p className="text-xs text-muted-foreground">Kelas TK A1 - 24 siswa terdaftar</p>
                        </div>
                      </div>
                    </MagicBentoCard>
                    <MagicBentoCard className="rounded-2xl border border-border/60 bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Hadir hari ini</p>
                          <p className="text-2xl font-bold text-foreground">92%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Jam puncak</p>
                          <p className="text-sm font-semibold text-foreground">07:10 - 07:30</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-muted">
                        <div className="h-full w-[92%] rounded-full gradient-primary" />
                      </div>
                    </MagicBentoCard>
                    <MagicBentoCard className="rounded-2xl bg-primary/10 p-4">
                      <p className="text-xs uppercase tracking-widest text-primary">Notifikasi</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        Absensi otomatis tersinkron ke laporan harian.
                      </p>
                    </MagicBentoCard>
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl"
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {stats.map((stat) => (
                <motion.div key={stat.label} variants={fadeUp}>
                  <MagicBentoCard className="h-full rounded-2xl bg-card/80 border border-border/60 p-5 shadow-card">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                  </MagicBentoCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="features" className="py-20 bg-muted/40">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center max-w-3xl mx-auto"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <motion.h2 className="text-3xl md:text-4xl font-bold text-foreground" variants={fadeUp}>
                Fitur{" "}
                <ShinyText
                  text="Unggulan"
                  className="inline-block"
                  color="#00c468"
                  shineColor="#d6ffe8"
                  speed={3}
                  delay={0.4}
                />
              </motion.h2>
              <motion.p className="mt-4 text-muted-foreground" variants={fadeUp}>
                Semua fitur dirancang untuk mempercepat absensi tanpa kehilangan detail penting.
              </motion.p>
            </motion.div>

            <motion.div
              className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              {features.map((feature) => (
                <motion.div key={feature.title} variants={fadeUp}>
                  <MagicBentoCard className="group h-full rounded-3xl bg-card border border-border/60 p-6 shadow-card hover:shadow-soft transition-all">
                    <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4">
                      <feature.icon className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2">{feature.description}</p>
                  </MagicBentoCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="workflow" className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
              >
                <motion.h2 className="text-3xl md:text-4xl font-bold text-foreground" variants={fadeUp}>
                  Alur kerja yang{" "}
                <ShinyText
                  text="jelas"
                  className="inline-block"
                  color="#00c468"
                  shineColor="#d6ffe8"
                  speed={3.2}
                  delay={0.6}
                />{" "}
                  untuk guru
                </motion.h2>
                <motion.p className="mt-4 text-muted-foreground" variants={fadeUp}>
                  Dari daftar guru sampai laporan hadir, semua langkah dibuat sederhana agar staf sekolah tidak perlu
                  mengulang proses yang rumit.
                </motion.p>
                <motion.div className="mt-10 grid sm:grid-cols-2 gap-6" variants={slowStagger}>
                  {steps.map((step, index) => (
                    <motion.div key={step.title} variants={fadeUp}>
                      <MagicBentoCard className="h-full rounded-2xl border border-border/60 p-5 bg-card">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <step.icon className="w-5 h-5 text-primary" />
                          </div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            Langkah {index + 1}
                          </span>
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-foreground">{step.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                      </MagicBentoCard>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div
                variants={fadeIn}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
              >
                <MagicBentoCard className="rounded-3xl border border-border/60 bg-gradient-to-br from-white via-white to-muted/60 p-8 shadow-soft">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center">
                      <Shield className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Kepercayaan Sekolah</h3>
                      <p className="text-sm text-muted-foreground">Data hadir otomatis, laporan selalu siap.</p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-4">
                    {trustItems.map((item) => (
                      <div key={item.title} className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                          <item.icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 rounded-2xl bg-primary/10 p-4">
                    <p className="text-sm font-semibold text-foreground">Monitoring Harian</p>
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>Siswa terdaftar</span>
                      <span className="font-semibold text-foreground">240</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>Hadir hari ini</span>
                      <span className="font-semibold text-foreground">219</span>
                    </div>
                  </div>
                </MagicBentoCard>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="daftar-guru" className="py-20 bg-muted/40">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
              <motion.div
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.3 }}
              >
                <motion.h2 className="text-3xl md:text-4xl font-bold text-foreground" variants={fadeUp}>
                  Daftar akun{" "}
                <ShinyText
                  text="guru"
                  className="inline-block"
                  color="#00c468"
                  shineColor="#d6ffe8"
                  speed={3}
                  delay={0.3}
                />{" "}
                  dalam hitungan menit
                </motion.h2>
                <motion.p className="mt-4 text-muted-foreground" variants={fadeUp}>
                  Setelah akun aktif, guru bisa langsung mengelola kelas, siswa, serta absensi otomatis dari dashboard.
                </motion.p>
                <motion.div className="mt-8 space-y-4" variants={slowStagger}>
                  {[
                    "Akses dashboard guru dan kelas secara real-time",
                    "Enroll wajah siswa langsung dari kamera",
                    "Riwayat absensi tersimpan otomatis",
                  ].map((item) => (
                    <motion.div key={item} className="flex items-center gap-3" variants={fadeUp}>
                      <div className="w-6 h-6 rounded-full gradient-primary flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <span className="text-foreground">{item}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div
                variants={fadeIn}
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

        <section className="py-20">
          <div className="container mx-auto px-4">
            <motion.div
              className="gradient-primary rounded-3xl p-12 text-center relative overflow-hidden"
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.35),rgba(255,255,255,0))]" />
              <div className="relative z-10">
                <Sparkles className="w-16 h-16 text-primary-foreground/80 mx-auto mb-6" />
                <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                  Siap menggunakan sistem absensi modern?
                </h2>
                <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
                  Login sekarang untuk mengakses dashboard dan mulai mengelola absensi siswa dengan lebih efisien.
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
      </main>

      <footer className="py-10 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-10 w-10 object-contain" />
              <span className="text-sm text-muted-foreground">
                Ac 2026 TK Khulafaur Arrasyidin. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-primary transition-colors">Fitur</a>
              <a href="#workflow" className="hover:text-primary transition-colors">Alur</a>
              <a href="#daftar-guru" className="hover:text-primary transition-colors">Daftar Guru</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
