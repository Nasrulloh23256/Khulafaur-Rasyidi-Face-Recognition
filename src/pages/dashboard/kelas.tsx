import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { formatClassSchedules, scheduleDays, type ClassScheduleInput } from "@/lib/class-schedule";

type Teacher = {
  id: string;
  fullName: string;
};

type Student = {
  id: string;
  fullName: string;
  studentNumber: string | null;
  gender: "MALE" | "FEMALE";
};

type ClassItem = {
  id: string;
  name: string;
  homeroomTeacher: Teacher | null;
  schedules: (Omit<ClassScheduleInput, "teacherId"> & { teacherId: string | null; teacher: { fullName: string } | null })[];
  _count: { students: number };
};

const hasValidSchedules = (schedules: ClassScheduleInput[]) =>
  schedules.length > 0 &&
  schedules.every(
    (schedule) => schedule.teacherId.trim() !== "" && schedule.startTime < schedule.endTime,
  );

const ScheduleFields = ({
  schedules,
  onChange,
  idPrefix,
  teachers,
}: {
  schedules: ClassScheduleInput[];
  onChange: (schedules: ClassScheduleInput[]) => void;
  idPrefix: string;
  teachers: Teacher[];
}) => {
  const addSession = (dayOfWeek: number) =>
    onChange(
      [...schedules, { dayOfWeek, startTime: "15:00", endTime: "17:00", teacherId: teachers[0]?.id ?? "" }].sort(
        (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
      ),
    );

  const updateSession = (index: number, field: keyof Pick<ClassScheduleInput, "teacherId" | "startTime" | "endTime">, value: string) =>
    onChange(schedules.map((schedule, scheduleIndex) => (scheduleIndex === index ? { ...schedule, [field]: value } : schedule)));

  const removeSession = (index: number) => onChange(schedules.filter((_, scheduleIndex) => scheduleIndex !== index));

  return (
    <div className="space-y-2">
      <div>
        <Label>Jadwal Bimbel</Label>
        <p className="mt-1 text-xs text-muted-foreground">Tambahkan satu atau beberapa sesi beserta pengajarnya.</p>
      </div>
      <div className="space-y-2 rounded-lg border p-3">
        {scheduleDays.map((day) => {
          const daySchedules = schedules
            .map((schedule, index) => ({ schedule, index }))
            .filter((item) => item.schedule.dayOfWeek === day.value);
          return (
            <div key={day.value} className="rounded-md border border-dashed p-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">{day.label}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => addSession(day.value)} disabled={teachers.length === 0}>
                  <Plus className="h-3.5 w-3.5" /> Tambah sesi
                </Button>
              </div>
              {daySchedules.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Tidak ada sesi.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {daySchedules.map(({ schedule, index }) => (
                    <div key={`${idPrefix}-${day.value}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
                      <Select value={schedule.teacherId} onValueChange={(value) => updateSession(index, "teacherId", value)}>
                        <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Pilih pengajar" /></SelectTrigger>
                        <SelectContent>
                          {teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.fullName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input aria-label={`Jam mulai ${day.label}`} type="time" className="h-9 w-28" value={schedule.startTime} onChange={(event) => updateSession(index, "startTime", event.target.value)} />
                      <span className="text-xs text-muted-foreground">sampai</span>
                      <Input aria-label={`Jam selesai ${day.label}`} type="time" className="h-9 w-28" value={schedule.endTime} onChange={(event) => updateSession(index, "endTime", event.target.value)} />
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeSession(index)} aria-label="Hapus sesi"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Kelas = () => {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassItem | null>(null);
  const [editTarget, setEditTarget] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    homeroomTeacherId: "none",
    schedules: [] as ClassScheduleInput[],
  });
  const [editForm, setEditForm] = useState({
    homeroomTeacherId: "none",
    studentIds: [] as string[],
    schedules: [] as ClassScheduleInput[],
  });

  const filteredClasses = useMemo(() => {
    if (!searchQuery) return classes;
    const query = searchQuery.toLowerCase();
    return classes.filter((item) => {
      const teacherName = item.homeroomTeacher?.fullName?.toLowerCase() ?? "";
      return item.name.toLowerCase().includes(query) || teacherName.includes(query);
    });
  }, [classes, searchQuery]);

  const sortedTeachers = useMemo(
    () => [...teachers].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [teachers],
  );

  const stats = useMemo(() => {
    const totalStudents = classes.reduce((acc, item) => acc + (item._count?.students ?? 0), 0);
    const average = classes.length > 0 ? Math.round(totalStudents / classes.length) : 0;
    return {
      totalClasses: classes.length,
      totalStudents,
      average,
    };
  }, [classes]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [classRes, teacherRes] = await Promise.all([
        fetch("/api/classes"),
        fetch("/api/teachers"),
      ]);

      const classData = await classRes.json();
      const teacherData = await teacherRes.json();

      if (classRes.ok) setClasses(classData);
      if (teacherRes.ok) setTeachers(teacherData);
    } catch (error) {
      toast({
        title: "Gagal memuat data",
        description: "Tidak bisa mengambil data kelas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUnassignedStudents = async () => {
    setIsLoadingStudents(true);
    try {
      const response = await fetch("/api/students?unassigned=true");
      const data = await response.json();

      if (response.ok) {
        setUnassignedStudents(data);
      } else {
        setUnassignedStudents([]);
        toast({
          title: "Gagal memuat siswa",
          description: data?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Gagal memuat siswa",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isDialogOpen) {
      loadData();
    }
  }, [isDialogOpen]);

  useEffect(() => {
    if (isEditOpen) {
      loadUnassignedStudents();
    }
  }, [isEditOpen]);

  const openEditDialog = (kelas: ClassItem) => {
    setEditTarget(kelas);
    setEditForm({
      homeroomTeacherId: kelas.homeroomTeacher?.id ?? "none",
      studentIds: [],
      schedules: kelas.schedules.map((schedule) => ({
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        teacherId: schedule.teacherId ?? kelas.homeroomTeacher?.id ?? "",
      })),
    });
    setIsEditOpen(true);
  };

  const handleEditOpenChange = (open: boolean) => {
    setIsEditOpen(open);
    if (!open) {
      setEditTarget(null);
      setEditForm({ homeroomTeacherId: "none", studentIds: [], schedules: [] });
      setUnassignedStudents([]);
    }
  };

  const handleToggleStudent = (studentId: string, checked: CheckedState) => {
    setEditForm((prev) => {
      const selected = new Set(prev.studentIds);
      if (checked === true) {
        selected.add(studentId);
      } else {
        selected.delete(studentId);
      }
      return { ...prev, studentIds: Array.from(selected) };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name || !hasValidSchedules(form.schedules)) {
      toast({
        title: "Data belum lengkap",
        description: "Nama kelas dan minimal satu jadwal dengan jam yang valid wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          homeroomTeacherId: form.homeroomTeacherId === "none" ? null : form.homeroomTeacherId,
          schedules: form.schedules,
        }),
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
        description: "Kelas berhasil ditambahkan",
      });

      setForm({ name: "", homeroomTeacherId: "none", schedules: [] });
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

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget) return;

    if (!hasValidSchedules(editForm.schedules)) {
      toast({
        title: "Jadwal belum lengkap",
        description: "Pilih minimal satu hari dan pastikan jam selesai setelah jam mulai.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/classes/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeroomTeacherId: editForm.homeroomTeacherId === "none" ? null : editForm.homeroomTeacherId,
          studentIds: editForm.studentIds,
          schedules: editForm.schedules,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast({
          title: "Gagal memperbarui kelas",
          description: payload?.error ?? "Terjadi kesalahan",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Kelas berhasil diperbarui",
      });
      handleEditOpenChange(false);
      loadData();
    } catch (error) {
      toast({
        title: "Gagal memperbarui kelas",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/classes/${deleteTarget.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          payload?.detail && payload?.error
            ? `${payload.error}: ${payload.detail}`
            : payload?.detail ?? payload?.error ?? "Terjadi kesalahan";
        toast({
          title: "Gagal menghapus",
          description: message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Berhasil",
        description: "Kelas berhasil dihapus",
      });
      setDeleteTarget(null);
      loadData();
    } catch (error) {
      toast({
        title: "Gagal menghapus",
        description: "Tidak bisa terhubung ke server",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <DashboardLayout title="Manajemen Kelas" subtitle="Kelola data kelas dan pengajar">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari kelas atau pengajar..."
              className="pl-10"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4" />
                Tambah Kelas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Tambah Kelas Baru</DialogTitle>
                <DialogDescription>Masukkan informasi kelas baru di bawah ini.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Kelas</Label>
                  <Input
                    id="name"
                    placeholder="Contoh: TK A1"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>

                <ScheduleFields
                  schedules={form.schedules}
                  onChange={(schedules) => setForm((prev) => ({ ...prev, schedules }))}
                  idPrefix="create-schedule"
                  teachers={sortedTeachers}
                />

                <div className="space-y-2">
                  <Label>Pengajar (opsional)</Label>
                  <Select
                    value={form.homeroomTeacherId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, homeroomTeacherId: value }))}
                  >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih pengajar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum ditentukan</SelectItem>
                    {sortedTeachers.length === 0 ? (
                      <SelectItem value="empty" disabled>
                        Belum ada pengajar
                      </SelectItem>
                    ) : (
                      sortedTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.fullName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalClasses}</p>
                <p className="text-sm text-muted-foreground">Total Kelas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Siswa</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/30 flex items-center justify-center">
                <Users className="w-6 h-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.average}</p>
                <p className="text-sm text-muted-foreground">Rata-rata/Kelas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle>Daftar Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Nama Kelas</TableHead>
                  <TableHead>Pengajar</TableHead>
                  <TableHead>Jadwal Bimbel</TableHead>
                  <TableHead className="text-center">Total Siswa</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredClasses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Belum ada kelas.
                    </TableCell>
                  </TableRow>
                )}
                {filteredClasses.map((kelas, index) => (
                  <TableRow key={kelas.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-semibold text-foreground">{kelas.name}</TableCell>
                    <TableCell>{kelas.homeroomTeacher?.fullName ?? "-"}</TableCell>
                    <TableCell className="max-w-[280px] text-sm text-muted-foreground">
                      {kelas.schedules.length > 0 ? formatClassSchedules(kelas.schedules) : "Belum diatur"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-foreground font-semibold text-sm">
                        {kelas._count?.students ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(kelas)}
                          aria-label={`Edit kelas ${kelas.name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(kelas)}
                          aria-label={`Hapus kelas ${kelas.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onOpenChange={handleEditOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Kelas</DialogTitle>
            <DialogDescription>
              Atur pengajar dan tambahkan siswa baru untuk {editTarget?.name ?? "kelas ini"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Kelas</Label>
              <Input value={editTarget?.name ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Pengajar</Label>
              <Select
                value={editForm.homeroomTeacherId}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, homeroomTeacherId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pengajar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {sortedTeachers.length === 0 ? (
                    <SelectItem value="empty" disabled>
                      Belum ada pengajar
                    </SelectItem>
                  ) : (
                    sortedTeachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.fullName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <ScheduleFields
              schedules={editForm.schedules}
              onChange={(schedules) => setEditForm((prev) => ({ ...prev, schedules }))}
              idPrefix="edit-schedule"
              teachers={sortedTeachers}
            />
            <div className="space-y-2">
              <Label>Tambah Siswa (belum punya kelas)</Label>
              <ScrollArea className="h-56 rounded-md border">
                <div className="space-y-2 p-2">
                  {isLoadingStudents ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">Memuat data siswa...</p>
                  ) : unassignedStudents.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">
                      Semua siswa sudah memiliki kelas.
                    </p>
                  ) : (
                    unassignedStudents.map((student) => (
                      <label
                        key={student.id}
                        className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={editForm.studentIds.includes(student.id)}
                          onCheckedChange={(checked) => handleToggleStudent(student.id, checked)}
                        />
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{student.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {student.studentNumber ? `NIS: ${student.studentNumber}` : "NIS belum ada"} -{" "}
                            {student.gender === "MALE" ? "Laki-laki" : "Perempuan"}
                          </p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">Dipilih: {editForm.studentIds.length} siswa.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleEditOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" variant="gradient" disabled={isUpdating}>
                {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kelas</AlertDialogTitle>
            <AlertDialogDescription>
              Kelas{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span> akan dihapus. Siswa
              tetap tersimpan, tetapi tidak memiliki kelas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Kelas;
