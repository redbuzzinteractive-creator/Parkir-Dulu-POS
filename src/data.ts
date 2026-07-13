import { Product, RawMaterial, Employee, ShiftSchedule, AttendanceLog, Transaction, OperationalExpense } from './types';

export const INITIAL_RAW_MATERIALS: RawMaterial[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [
  { id: 'emp-1', name: 'Budi Hartono', role: 'barista', hourlyRate: 25000 },
  { id: 'emp-2', name: 'Siti Rahma', role: 'cashier', hourlyRate: 20000 },
  { id: 'emp-3', name: 'Rian Wijaya', role: 'barista', hourlyRate: 25000 },
  { id: 'emp-4', name: 'Dewi Lestari', role: 'manager', hourlyRate: 35000 }
];

// Seed relative dates based on current time: 2026-07-03
export const getInitialSchedulesAndLogs = () => {
  const dateStr = '2026-07-03';
  const prevDateStr1 = '2026-07-02';
  const prevDateStr2 = '2026-07-01';

  const schedules: ShiftSchedule[] = [
    // July 1
    { id: 'sch-1', employeeId: 'emp-1', date: prevDateStr2, shiftType: 'morning', startTime: '08:00', endTime: '16:00' },
    { id: 'sch-2', employeeId: 'emp-2', date: prevDateStr2, shiftType: 'morning', startTime: '08:00', endTime: '16:00' },
    { id: 'sch-3', employeeId: 'emp-3', date: prevDateStr2, shiftType: 'afternoon', startTime: '16:00', endTime: '23:00' },
    
    // July 2
    { id: 'sch-4', employeeId: 'emp-1', date: prevDateStr1, shiftType: 'morning', startTime: '08:00', endTime: '16:00' },
    { id: 'sch-5', employeeId: 'emp-2', date: prevDateStr1, shiftType: 'morning', startTime: '08:00', endTime: '16:00' },
    { id: 'sch-6', employeeId: 'emp-3', date: prevDateStr1, shiftType: 'afternoon', startTime: '16:00', endTime: '23:00' },

    // July 3 (Today)
    { id: 'sch-7', employeeId: 'emp-1', date: dateStr, shiftType: 'morning', startTime: '08:00', endTime: '16:00' },
    { id: 'sch-8', employeeId: 'emp-2', date: dateStr, shiftType: 'morning', startTime: '08:00', endTime: '16:00' },
    { id: 'sch-9', employeeId: 'emp-3', date: dateStr, shiftType: 'afternoon', startTime: '16:00', endTime: '23:00' },
    { id: 'sch-10', employeeId: 'emp-4', date: dateStr, shiftType: 'morning', startTime: '09:00', endTime: '17:00' }
  ];

  const logs: AttendanceLog[] = [
    // July 1 Logs (Completed)
    {
      id: 'log-1',
      employeeId: 'emp-1',
      scheduleId: 'sch-1',
      date: prevDateStr2,
      clockIn: `${prevDateStr2}T07:55:00Z`,
      clockOut: `${prevDateStr2}T16:05:00Z`,
      calculatedHours: 8.16,
      estimatedSalary: Math.round(8.16 * 25000)
    },
    {
      id: 'log-2',
      employeeId: 'emp-2',
      scheduleId: 'sch-2',
      date: prevDateStr2,
      clockIn: `${prevDateStr2}T08:02:00Z`,
      clockOut: `${prevDateStr2}T16:00:00Z`,
      calculatedHours: 7.96,
      estimatedSalary: Math.round(7.96 * 20000)
    },
    {
      id: 'log-3',
      employeeId: 'emp-3',
      scheduleId: 'sch-3',
      date: prevDateStr2,
      clockIn: `${prevDateStr2}T15:50:00Z`,
      clockOut: `${prevDateStr2}T23:00:00Z`,
      calculatedHours: 7.16,
      estimatedSalary: Math.round(7.16 * 25000)
    },

    // July 2 Logs (Completed)
    {
      id: 'log-4',
      employeeId: 'emp-1',
      scheduleId: 'sch-4',
      date: prevDateStr1,
      clockIn: `${prevDateStr1}T07:50:00Z`,
      clockOut: `${prevDateStr1}T16:02:00Z`,
      calculatedHours: 8.2,
      estimatedSalary: Math.round(8.2 * 25000)
    },
    {
      id: 'log-5',
      employeeId: 'emp-2',
      scheduleId: 'sch-5',
      date: prevDateStr1,
      clockIn: `${prevDateStr1}T07:58:00Z`,
      clockOut: `${prevDateStr1}T16:00:00Z`,
      calculatedHours: 8.03,
      estimatedSalary: Math.round(8.03 * 20000)
    },
    {
      id: 'log-6',
      employeeId: 'emp-3',
      scheduleId: 'sch-6',
      date: prevDateStr1,
      clockIn: `${prevDateStr1}T16:05:00Z`,
      clockOut: `${prevDateStr1}T23:05:00Z`,
      calculatedHours: 7.0,
      estimatedSalary: Math.round(7.0 * 25000)
    },

    // July 3 Logs (Active)
    {
      id: 'log-7',
      employeeId: 'emp-1',
      scheduleId: 'sch-7',
      date: dateStr,
      clockIn: `${dateStr}T07:52:00Z`,
      clockOut: null,
      calculatedHours: null,
      estimatedSalary: null
    },
    {
      id: 'log-8',
      employeeId: 'emp-2',
      scheduleId: 'sch-8',
      date: dateStr,
      clockIn: `${dateStr}T08:01:00Z`,
      clockOut: null,
      calculatedHours: null,
      estimatedSalary: null
    }
  ];

  return { schedules, logs };
};

export const getInitialTransactions = (): Transaction[] => {
  return [];
};

export const INITIAL_EXPENSES: OperationalExpense[] = [];
