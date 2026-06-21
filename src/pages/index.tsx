import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import BrandMark from "@/components/BrandMark";
import ShinyText from "@/components/ShinyText";
import MagicBentoCard from "@/components/MagicBentoCard";
import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Mail,
  Phone,
  Shield,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";

const brandName = "Ohm Study Club Attendance";

const features = [
  {
    icon: Camera,
    title: "Absensi Wajah",
    description: "Pencatatan hadir siswa lebih cepat dengan verifikasi wajah di dashboard.",
  },
  {
    icon: Users,
    title: "Data Terpusat",
    description: "Siswa, kelas, dan pengajar tersusun rapi tanpa membuka informasi internal bimbel.",
  },
  {
    icon: ClipboardCheck,
    title: "Rekap Siap Pakai",
    description: "Ringkasan hadir, izin, sakit, dan alfa tersedia untuk kebutuhan operasional.",
  },
  {
    icon: Shield,
    title: "Akses Terbatas",
    description: "Guru hanya masuk ke area kerja absensi sesuai akun dan kebutuhan kelas.",
  },
];

const stats = [
  { value: "500+", label: "Siswa Terpantau" },
  { value: "15+", label: "Pengajar Aktif" },
  { value: "98%", label: "Kepuasan Admin" },
];

const privacyNotes = [
  "Guru fokus pada absensi dan kelas yang ditugaskan.",
  "Menu publik fokus pada absensi dan login.",
  "Admin tetap dapat mengelola data dari dashboard utama.",
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger: Variants = {
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
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <BrandMark className="h-12 w-12" textClassName="text-xl" />
              <div>
                <h1 className="text-lg font-extrabold leading-tight text-foreground">{brandName}</h1>
                <p className="text-xs font-medium text-muted-foreground">Attendance Portal</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-7 md:flex">
              <a href="#beranda" className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary">
                Beranda
              </a>
              <a href="#tentang" className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary">
                Tentang
              </a>
              <a href="#absensi" className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary">
                Absensi
              </a>
              <a href="#daftar-guru" className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary">
                Daftar Guru
              </a>
              <Button asChild variant="gradient">
                <Link href="/login">Masuk</Link>
              </Button>
            </nav>

            <Button asChild variant="gradient" size="sm" className="md:hidden">
              <Link href="/login">Masuk</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section id="beranda" className="relative overflow-hidden pt-32">
          <div className="absolute inset-0 gradient-hero" />
          <div className="container relative mx-auto px-4 pb-16 lg:pb-20">
            <div className="grid min-h-[calc(100vh-8rem)] items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
              <motion.div variants={stagger} initial="hidden" animate="visible">
                <motion.div
                  className="mb-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-primary shadow-card"
                  variants={fadeUp}
                >
                  <Sparkles className="h-4 w-4" />
                  <ShinyText
                    text="Absensi digital berbasis face recognition"
                    className="text-sm font-medium"
                    color="currentColor"
                    shineColor="rgba(226, 232, 240, 0.95)"
                    keepTextColor
                    speed={2.4}
                  />
                </motion.div>

                <motion.h2
                  className="max-w-2xl text-4xl font-extrabold leading-tight text-foreground md:text-5xl lg:text-6xl"
                  variants={fadeUp}
                >
                  Ohm Study Club <span className="relative inline-block text-primary">Attendance</span>
                </motion.h2>

                <motion.p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg" variants={fadeUp}>
                  Sistem khusus absensi {brandName} untuk mencatat kehadiran siswa, memantau kelas,
                  dan menjaga akses pengajar tetap fokus pada operasional harian.
                </motion.p>

                <motion.div className="mt-9 flex flex-col gap-4 sm:flex-row" variants={fadeUp}>
                  <Button asChild variant="hero" size="xl" className="group">
                    <Link href="/login">
                      Masuk Dashboard
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="xl" className="bg-white/70">
                    <a href="#daftar-guru">Daftar Guru</a>
                  </Button>
                </motion.div>

                <motion.div className="mt-12 grid max-w-lg grid-cols-3 gap-5" variants={stagger}>
                  {stats.map((stat) => (
                    <motion.div key={stat.label} variants={fadeUp}>
                      <p className="text-2xl font-extrabold text-primary md:text-3xl">{stat.value}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground md:text-sm">{stat.label}</p>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div
                className="relative min-h-[420px]"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                <div className="absolute inset-x-6 top-6 h-[380px] rounded-[42px] bg-primary" />
                <div className="absolute right-0 top-2 hidden h-32 w-32 rounded-lg bg-accent/80 lg:block" />
                <div className="absolute bottom-2 left-4 hidden h-24 w-24 rounded-lg bg-secondary/30 lg:block" />

                <div className="relative mx-auto flex min-h-[420px] max-w-xl items-center justify-center">
                  <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-muted-foreground">Absensi Hari Ini</p>
                        <h3 className="text-2xl font-extrabold text-foreground">Kelas Aktif</h3>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CalendarCheck className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[
                        { name: "Alya Putri", time: "15:28", status: "Hadir" },
                        { name: "Rafi Maulana", time: "15:31", status: "Hadir" },
                        { name: "Nadira Salsabila", time: "-", status: "Izin" },
                      ].map((item) => (
                        <div key={item.name} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg gradient-primary text-sm font-bold text-primary-foreground">
                              {item.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{item.name}</p>
                              <p className="text-xs font-medium text-muted-foreground">Sesi sore</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`rounded-md px-2 py-1 text-xs font-bold ${
                              item.status === "Hadir" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                            }`}>
                              {item.status}
                            </span>
                            <p className="mt-1 text-xs text-muted-foreground">{item.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-primary/10 p-3 text-center">
                        <p className="text-xl font-extrabold text-primary">86%</p>
                        <p className="text-xs font-medium text-muted-foreground">Hadir</p>
                      </div>
                      <div className="rounded-lg bg-accent/40 p-3 text-center">
                        <p className="text-xl font-extrabold text-accent-foreground">12</p>
                        <p className="text-xs font-medium text-muted-foreground">Kelas</p>
                      </div>
                      <div className="rounded-lg bg-secondary/10 p-3 text-center">
                        <p className="text-xl font-extrabold text-secondary">3</p>
                        <p className="text-xs font-medium text-muted-foreground">Izin</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="tentang" className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
                <motion.p className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-primary" variants={fadeUp}>
                  Portal Internal
                </motion.p>
                <motion.h2 className="text-3xl font-extrabold leading-tight text-foreground md:text-4xl" variants={fadeUp}>
                  Absensi bimbel tanpa membuka informasi yang tidak perlu.
                </motion.h2>
                <motion.p className="mt-5 text-base leading-8 text-muted-foreground" variants={fadeUp}>
                  Halaman ini diarahkan sebagai pintu masuk absensi, bukan website profil. Pengajar dapat login,
                  melakukan absensi, dan mengelola data yang relevan tanpa membuka area internal lain.
                </motion.p>
              </motion.div>

              <motion.div
                className="grid gap-4 md:grid-cols-3"
                variants={stagger}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
              >
                {privacyNotes.map((item) => (
                  <motion.div key={item} className="rounded-lg border border-border bg-card p-5 shadow-card" variants={fadeUp}>
                    <CheckCircle2 className="mb-4 h-6 w-6 text-primary" />
                    <p className="text-sm font-semibold leading-6 text-foreground">{item}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        <section id="absensi" className="bg-muted/50 py-20">
          <div className="container mx-auto px-4">
            <motion.div
              className="mx-auto mb-12 max-w-2xl text-center"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <motion.h2 className="text-3xl font-extrabold text-foreground md:text-4xl" variants={fadeUp}>
                Fitur Utama Absensi
              </motion.h2>
              <motion.p className="mt-4 text-muted-foreground" variants={fadeUp}>
                Dibuat untuk kebutuhan harian admin dan pengajar tanpa membuka area internal lain.
              </motion.p>
            </motion.div>

            <motion.div
              className="grid gap-5 md:grid-cols-2 lg:grid-cols-4"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
            >
              {features.map((feature) => (
                <motion.div key={feature.title} variants={fadeUp}>
                  <MagicBentoCard
                    variant="feature"
                    className="group h-full rounded-3xl p-6 transition-all"
                  >
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

        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid items-center gap-10 rounded-lg border border-border bg-card p-6 shadow-soft lg:grid-cols-[1fr_0.9fr] lg:p-10">
              <div>
                <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-primary">Alur Kerja</p>
                <h2 className="text-3xl font-extrabold text-foreground md:text-4xl">Masuk, pilih kelas, catat kehadiran.</h2>
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {[
                    { icon: UserCheck, title: "Login Guru", text: "Gunakan akun yang sudah terdaftar." },
                    { icon: Clock, title: "Sesi Aktif", text: "Pilih kelas dan waktu absensi." },
                    { icon: BarChart3, title: "Rekap", text: "Admin melihat ringkasan kehadiran." },
                  ].map((item) => (
                    <div key={item.title} className="rounded-lg bg-muted/60 p-4">
                      <item.icon className="mb-4 h-6 w-6 text-primary" />
                      <h3 className="font-bold text-foreground">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg bg-primary p-6 text-primary-foreground">
                <Shield className="mb-6 h-10 w-10 opacity-90" />
                <h3 className="text-2xl font-extrabold">Akses dibuat ringkas untuk pengajar.</h3>
                <p className="mt-4 leading-7 text-primary-foreground/80">
                  Dashboard guru diarahkan ke kehadiran, kelas, siswa, dan enroll wajah. Area admin tetap terpisah
                  untuk pengelolaan data lengkap.
                </p>
                <Button asChild variant="accent" size="lg" className="mt-7">
                  <Link href="/login">
                    Login Absensi
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="daftar-guru" className="bg-muted/45 py-20">
          <div className="container mx-auto px-4">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
              <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
                <motion.p className="mb-3 text-sm font-extrabold uppercase tracking-[0.18em] text-primary" variants={fadeUp}>
                  Akses Pengajar
                </motion.p>
                <motion.h2 className="text-3xl font-extrabold leading-tight text-foreground md:text-4xl" variants={fadeUp}>
                  Daftar akun guru baru tetap tersedia.
                </motion.h2>
                <motion.p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground" variants={fadeUp}>
                  Gunakan form ini untuk membuat akun guru. Setelah aktif, guru bisa masuk ke dashboard absensi
                  tanpa melihat informasi internal lain.
                </motion.p>
                <motion.div className="mt-7 space-y-4" variants={stagger}>
                  {[
                    "Akun digunakan untuk login absensi.",
                    "Data guru tersimpan di sistem yang sama.",
                    "Akses diarahkan ke halaman kerja yang relevan.",
                  ].map((item) => (
                    <motion.div key={item} className="flex items-center gap-3" variants={fadeUp}>
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg gradient-primary">
                        <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <span className="font-semibold text-foreground">{item}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

              <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }}>
                <Card className="border-0 bg-card/95 shadow-soft">
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
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                      <p className="text-center text-xs text-muted-foreground">
                        Sudah punya akun?{" "}
                        <Link href="/login" className="font-semibold text-primary hover:underline">
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
      </main>

      <footer className="border-t border-border bg-background py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10 flex-shrink-0" textClassName="text-lg" />
            <span className="text-sm font-medium text-muted-foreground">&copy; 2026 {brandName}. Attendance Portal.</span>
          </div>
          <div className="flex items-center gap-6 text-sm font-semibold text-muted-foreground">
            <a href="#beranda" className="transition-colors hover:text-primary">
              Beranda
            </a>
            <a href="#absensi" className="transition-colors hover:text-primary">
              Absensi
            </a>
            <Link href="/login" className="transition-colors hover:text-primary">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
