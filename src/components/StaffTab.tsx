import React, { useState } from 'react';
import { 
  Users, Plus, Calendar, Clock, ArrowRight, CheckCircle2, 
  Trash2, UserCheck, Play, Award, DollarSign, CalendarRange 
} from 'lucide-react';
import { Employee, ShiftSchedule, AttendanceLog, EmployeeRole, ShiftType } from '../types';

interface StaffTabProps {
  employees: Employee[];
  schedules: ShiftSchedule[];
  attendanceLogs: AttendanceLog[];
  onUpdateEmployees: (employees: Employee[]) => Promise<void>;
  onUpdateSchedules: (schedules: ShiftSchedule[]) => Promise<void>;
  onUpdateAttendanceLogs: (logs: AttendanceLog[]) => Promise<void>;
}

export const StaffTab: React.FC<StaffTabProps> = ({
  employees,
  schedules,
  attendanceLogs,
  onUpdateEmployees,
  onUpdateSchedules,
  onUpdateAttendanceLogs
}) => {
  // Tabs within Staff
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'schedule' | 'clock'>('clock');

  // Add Employee Form State
  const [isAddingEmp, setIsAddingEmp] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empRole, setEmpRole] = useState<EmployeeRole>('barista');
  const [empRate, setEmpRate] = useState('');

  // Add Schedule Form State
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedEmpId, setSchedEmpId] = useState('');
  const [schedDate, setSchedDate] = useState('2026-07-03');
  const [schedShift, setSchedShift] = useState<ShiftType>('morning');
  const [schedStart, setSchedStart] = useState('08:00');
  const [schedEnd, setSchedEnd] = useState('16:00');

  // Clock simulator state
  const [clockEmpId, setClockEmpId] = useState('');
  const [clockSchedId, setClockSchedId] = useState('');

  // Handle Adding Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empRate) {
      alert('Mohon isi semua field karyawan.');
      return;
    }

    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      name: empName.trim(),
      role: empRole,
      hourlyRate: parseFloat(empRate)
    };

    try {
      await onUpdateEmployees([...employees, newEmp]);
      setIsAddingEmp(false);
      setEmpName('');
      setEmpRate('');
      alert('Karyawan baru berhasil terdaftar!');
    } catch (err) {
      console.error(err);
      alert('Gagal menambahkan karyawan.');
    }
  };

  // Handle Adding Schedule
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedEmpId || !schedDate || !schedStart || !schedEnd) {
      alert('Mohon isi semua field jadwal shift.');
      return;
    }

    const newSchedule: ShiftSchedule = {
      id: `sch-${Date.now()}`,
      employeeId: schedEmpId,
      date: schedDate,
      shiftType: schedShift,
      startTime: schedStart,
      endTime: schedEnd
    };

    try {
      await onUpdateSchedules([...schedules, newSchedule]);
      setIsScheduling(false);
      alert('Jadwal shift berhasil dibuat!');
    } catch (err) {
      console.error(err);
      alert('Gagal membuat jadwal shift.');
    }
  };

  // Clock In Simulator
  const handleClockIn = async (scheduleId: string, employeeId: string) => {
    const todayStr = '2026-07-03';
    // Check if already clocked in for this schedule
    const alreadyLogged = attendanceLogs.some(log => log.scheduleId === scheduleId);
    if (alreadyLogged) {
      alert('Karyawan sudah melakukan Clock In untuk jadwal ini!');
      return;
    }

    // Capture standard timestamp relative to 2026-07-03
    const clockInTime = new Date().toISOString().replace(/T.*/, `T${new Date().toTimeString().split(' ')[0]}Z`);

    const newLog: AttendanceLog = {
      id: `log-${Date.now()}`,
      employeeId,
      scheduleId,
      date: todayStr,
      clockIn: clockInTime,
      clockOut: null,
      calculatedHours: null,
      estimatedSalary: null
    };

    try {
      await onUpdateAttendanceLogs([newLog, ...attendanceLogs]);
      alert('Berhasil Clock In shift! Barista siap menyajikan kopi.');
    } catch (err) {
      console.error(err);
      alert('Gagal merekam clock in.');
    }
  };

  // Clock Out Simulator
  const handleClockOut = async (logId: string) => {
    const log = attendanceLogs.find(l => l.id === logId);
    if (!log || !log.clockIn) return;

    // Simulate clock out time (e.g. current actual time or end of schedule)
    const clockOutTime = new Date().toISOString();
    
    // Calculate difference
    const diffMs = new Date(clockOutTime).getTime() - new Date(log.clockIn).getTime();
    let hoursWorked = diffMs / (1000 * 60 * 60);

    // If it's too small (because they clicked instantly in simulation), let's grant a realistic randomized decimal 7.5 to 8.2 hours for testing satisfaction!
    if (hoursWorked < 0.05) {
      hoursWorked = parseFloat((7.5 + Math.random() * 1).toFixed(2));
    } else {
      hoursWorked = parseFloat(hoursWorked.toFixed(2));
    }

    const employee = employees.find(e => e.id === log.employeeId);
    const hourlyRate = employee?.hourlyRate || 20000;
    const estimatedSalary = Math.round(hoursWorked * hourlyRate);

    const updatedLogs = attendanceLogs.map(l => {
      if (l.id === logId) {
        return {
          ...l,
          clockOut: clockOutTime,
          calculatedHours: hoursWorked,
          estimatedSalary
        };
      }
      return l;
    });

    try {
      await onUpdateAttendanceLogs(updatedLogs);
      alert(`Berhasil Clock Out! Jam Kerja: ${hoursWorked} jam. Gaji Shift: Rp ${estimatedSalary.toLocaleString('id-ID')}`);
    } catch (err) {
      console.error(err);
      alert('Gagal merekam clock out.');
    }
  };

  const getRoleLabel = (role: EmployeeRole) => {
    switch (role) {
      case 'barista': return 'Barista';
      case 'cashier': return 'Kasir';
      case 'cleaner': return 'Staff Kebersihan';
      case 'manager': return 'Manajer Kedai';
      default: return role;
    }
  };

  const getShiftLabel = (st: ShiftType) => {
    switch (st) {
      case 'morning': return 'Pagi';
      case 'afternoon': return 'Siang/Sore';
      case 'night': return 'Malam';
      default: return st;
    }
  };

  // Filter schedules for today: 2026-07-03
  const todayDateStr = '2026-07-03';
  const todaySchedules = schedules.filter(sch => sch.date === todayDateStr);

  return (
    <div className="space-y-4">
      {/* Sub Navigation */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-700 pb-2 gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveSubTab('clock')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'clock'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            Absensi & Jam Kerja
          </button>
          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'schedule'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            Penjadwalan Shift
          </button>
          <button
            onClick={() => setActiveSubTab('roster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === 'roster'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
            }`}
          >
            Data Karyawan
          </button>
        </div>

        {activeSubTab === 'roster' && (
          <button
            onClick={() => setIsAddingEmp(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors self-start shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Karyawan
          </button>
        )}

        {activeSubTab === 'schedule' && (
          <button
            onClick={() => setIsScheduling(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors self-start shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Buat Shift Baru
          </button>
        )}
      </div>

      {/* SUB TAB 1: CLOCK-IN/CLOCK-OUT ATTENDANCE CONSOLE */}
      {activeSubTab === 'clock' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Active Shift Simulator */}
          <div className="md:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
            <div className="mb-4">
              <span className="text-[9px] uppercase font-extrabold tracking-widest bg-slate-900 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">SIMULATOR ABSENSI</span>
              <h3 className="font-bold text-white text-sm mt-2">Mesin Absensi Shift (Hari Ini - 3 Juli 2026)</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Pilah karyawan yang terjadwal hari ini untuk mensimulasikan waktu masuk kerja dan pulang kerja.
              </p>
            </div>

            <div className="space-y-2.5">
              {todaySchedules.map((sch) => {
                const emp = employees.find(e => e.id === sch.employeeId);
                const activeLog = attendanceLogs.find(l => l.scheduleId === sch.id && l.date === todayDateStr);
                
                if (!emp) return null;

                return (
                  <div key={sch.id} className="p-3 bg-slate-900/60 rounded-lg border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-xs">{emp.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-850 text-slate-300 border border-slate-700 rounded uppercase tracking-wider">
                          {getRoleLabel(emp.role)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        <span>Shift {getShiftLabel(sch.shiftType)} ({sch.startTime} - {sch.endTime})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!activeLog ? (
                        <button
                          onClick={() => handleClockIn(sch.id, emp.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          Clock In
                        </button>
                      ) : activeLog.clockOut ? (
                        <div className="text-right">
                          <span className="text-xs text-emerald-400 font-extrabold flex items-center gap-1 justify-end uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Selesai
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {activeLog.calculatedHours} jam (Rp {activeLog.estimatedSalary?.toLocaleString('id-ID')})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-amber-400 font-extrabold animate-pulse uppercase tracking-widest">● Bekerja...</span>
                          <button
                            onClick={() => handleClockOut(activeLog.id)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow"
                          >
                            Clock Out
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {todaySchedules.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs font-semibold">
                  Tidak ada jadwal shift karyawan yang diatur untuk hari ini. Silakan buat shift di tab "Penjadwalan Shift" terlebih dahulu.
                </div>
              )}
            </div>
          </div>

          {/* Attendance History Column */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md flex flex-col h-[400px]">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Log Kehadiran & Payroll</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {attendanceLogs.map((log) => {
                const emp = employees.find(e => e.id === log.employeeId);
                if (!emp) return null;

                return (
                  <div key={log.id} className="p-2.5 bg-slate-900 rounded border border-slate-700/60 space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs text-slate-200 truncate pr-1">{emp.name}</span>
                      <span className="text-[9px] font-bold text-slate-500 font-mono">{log.date}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      In: <span className="font-bold text-slate-300 font-mono">{log.clockIn ? new Date(log.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</span> | 
                      Out: <span className="font-bold text-slate-300 font-mono">{log.clockOut ? new Date(log.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Aktif'}</span>
                    </div>
                    {log.calculatedHours && (
                      <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-dashed border-slate-700/60 mt-1 font-semibold">
                        <span className="text-slate-500">{log.calculatedHours} jam kerja</span>
                        <span className="text-emerald-400 font-mono font-bold">Rp {log.estimatedSalary?.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {attendanceLogs.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs font-semibold">Belum ada riwayat absensi.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: SHIFT SCHEDULE LIST & SCHEDULER */}
      {activeSubTab === 'schedule' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Daftar Jadwal Shift Mingguan</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400 font-bold uppercase tracking-wider text-[9px] pb-2">
                  <th className="py-2.5 px-1">Karyawan</th>
                  <th className="py-2.5 px-1">Tanggal</th>
                  <th className="py-2.5 px-1">Shift</th>
                  <th className="py-2.5 px-1">Jam Kerja</th>
                  <th className="py-2.5 px-1 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {schedules.map((sch) => {
                  const emp = employees.find(e => e.id === sch.employeeId);
                  if (!emp) return null;

                  return (
                    <tr key={sch.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="py-2.5 px-1 font-bold text-slate-100">{emp.name}</td>
                      <td className="py-2.5 px-1 font-bold text-slate-300 font-mono">{sch.date}</td>
                      <td className="py-2.5 px-1">
                        <span className="px-2 py-0.5 bg-slate-900 text-amber-400 border border-amber-500/20 text-[9px] font-extrabold rounded uppercase tracking-wider">
                          Shift {getShiftLabel(sch.shiftType)}
                        </span>
                      </td>
                      <td className="py-2.5 px-1 text-slate-300 font-mono font-bold">{sch.startTime} - {sch.endTime}</td>
                      <td className="py-2.5 px-1 text-right">
                        <button
                          onClick={async () => {
                            if (confirm('Yakin ingin membatalkan jadwal shift ini?')) {
                              const updated = schedules.filter(s => s.id !== sch.id);
                              await onUpdateSchedules(updated);
                            }
                          }}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-wider hover:underline"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB TAB 3: EMPLOYEE DATA / ROSTER */}
      {activeSubTab === 'roster' && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-md">
          <h3 className="font-bold text-white text-xs uppercase tracking-wider mb-3">Daftar Roster Karyawan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map((emp) => (
              <div key={emp.id} className="p-3.5 bg-slate-900 rounded-lg border border-slate-700 relative group">
                <h4 className="font-bold text-white text-xs">{emp.name}</h4>
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mt-0.5">
                  {getRoleLabel(emp.role)}
                </p>
                <div className="flex items-center gap-1 text-xs text-slate-300 mt-4 font-bold">
                  <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                  <span>Gaji: <strong className="text-emerald-400 font-mono">Rp {emp.hourlyRate.toLocaleString('id-ID')}</strong> <span className="text-[10px] font-normal text-slate-500">/jam</span></span>
                </div>

                <button
                  onClick={async () => {
                    if (confirm(`Yakin ingin menghapus karyawan ${emp.name}?`)) {
                      const updated = employees.filter(e => e.id !== emp.id);
                      await onUpdateEmployees(updated);
                    }
                  }}
                  className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: REGISTER EMPLOYEE */}
      {isAddingEmp && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-700 text-slate-200">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-wider mb-3">Daftarkan Karyawan Baru</h3>

            <form onSubmit={handleAddEmployee} className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                  placeholder="Contoh: Andi Pratama"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Peran / Posisi</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value as EmployeeRole)}
                  >
                    <option value="barista">Barista</option>
                    <option value="cashier">Kasir</option>
                    <option value="cleaner">Kebersihan</option>
                    <option value="manager">Manajer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gaji per Jam (Rp)</label>
                  <input
                    type="number"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="Contoh: 20000"
                    value={empRate}
                    onChange={(e) => setEmpRate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingEmp(false)}
                  className="flex-1 py-1.5 border border-slate-700 rounded text-xs font-bold text-slate-400 hover:bg-slate-900 uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow"
                >
                  Simpan Karyawan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE SHIFT SCHEDULE */}
      {isScheduling && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-xs">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-700 text-slate-200">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-wider mb-3">Buat Jadwal Shift Karyawan</h3>

            <form onSubmit={handleAddSchedule} className="space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pilih Karyawan</label>
                <select
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                  value={schedEmpId}
                  onChange={(e) => setSchedEmpId(e.target.value)}
                  required
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({getRoleLabel(e.role)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tanggal Shift</label>
                  <input
                    type="date"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipe Shift</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                    value={schedShift}
                    onChange={(e) => setSchedShift(e.target.value as ShiftType)}
                  >
                    <option value="morning">Pagi (Morning)</option>
                    <option value="afternoon">Sore (Afternoon)</option>
                    <option value="night">Malam (Night)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jam Masuk (HH:MM)</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="08:00"
                    value={schedStart}
                    onChange={(e) => setSchedStart(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jam Pulang (HH:MM)</label>
                  <input
                    type="text"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold font-mono"
                    placeholder="16:00"
                    value={schedEnd}
                    onChange={(e) => setSchedEnd(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScheduling(false)}
                  className="flex-1 py-1.5 border border-slate-700 rounded text-xs font-bold text-slate-400 hover:bg-slate-900 uppercase tracking-wider"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold uppercase tracking-wider shadow"
                >
                  Simpan Jadwal Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
