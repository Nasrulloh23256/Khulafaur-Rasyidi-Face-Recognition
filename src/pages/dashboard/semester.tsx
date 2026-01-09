import { useEffect, useState } from "react";
import { Plus, CalendarClock } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type AcademicYear = {
  id: string;
  name: string;
};

type Semester = {
  id: string;
  name: "GANJIL" | "GENAP";
  startDate: string;
  endDate: string;
  isActive: boolean;
  academicYearId: string;
  academicYear?: AcademicYear;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

const SemesterPage = () => {
  const { toast } = useToast();
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    academicYearId: "",
    name: "GANJIL",
    startDate: "",
    endDate: "",
    isActive: false,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [semesterRes, yearRes] = await Promise.all([
        fetch("/api/semesters"),
        fetch("/api/academic-years"),
      ]);

      const semesterData = await semesterRes.json();
      const yearData = await yearRes.json();

      if (semesterRes.ok) {
        setSemesters(semesterData);
      }
      if (yearRes.ok) {
        setYears(yearData);
        if (!form.academicYearId && yearData.length > 0) {
          setForm((prev) => ({ ...prev, academicYearId: yearData[0].id }));
        }
      }
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: "Tidak bisa mengambil data semester",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.academicYearId || !form.startDate || !form.endDate) {
      toast({
        title: "Data belum lengkap",
        description: "Tahun ajaran dan tanggal wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/semesters", {
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
        description: "Semester berhasil ditambahkan",
      });

      setForm((prev) => ({
        ...prev,
        name: "GANJIL",
        startDate: "",
        endDate: "",
        isActive: false,
      }));
      setIsDialogOpen(false);
      loadData();
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

  return (
    <DashboardLayout title="Semester" subtitle="Kelola semester untuk setiap tahun ajaran">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Semester</p>
              <p className="text-2xl font-bold text-foreground">{semesters.length}</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4" />
                Tambah Semester
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Semester</DialogTitle>
                <DialogDescription>Lengkapi data semester baru.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Tahun Ajaran</Label>
                  <Select
                    value={form.academicYearId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, academicYearId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tahun ajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nama Semester</Label>
                  <Select
                    value={form.name}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, name: value as "GANJIL" | "GENAP" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih semester" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GANJIL">Ganjil</SelectItem>
                      <SelectItem value="GENAP">Genap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Tanggal Mulai</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={form.startDate}
                      onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Tanggal Akhir</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={form.endDate}
                      onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Jadikan Aktif</p>
                    <p className="text-xs text-muted-foreground">Hanya satu semester aktif per tahun ajaran</p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
                  />
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
            <CardTitle>Daftar Semester</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tahun Ajaran</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead>Selesai</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && semesters.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Belum ada semester.
                    </TableCell>
                  </TableRow>
                )}
                {semesters.map((semester) => (
                  <TableRow key={semester.id}>
                    <TableCell className="font-semibold text-foreground">
                      {semester.academicYear?.name ?? "-"}
                    </TableCell>
                    <TableCell>{semester.name === "GANJIL" ? "Ganjil" : "Genap"}</TableCell>
                    <TableCell>{formatDate(semester.startDate)}</TableCell>
                    <TableCell>{formatDate(semester.endDate)}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          semester.isActive
                            ? "border-transparent bg-success/10 text-success"
                            : "border-transparent bg-muted text-muted-foreground"
                        }
                      >
                        {semester.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SemesterPage;
