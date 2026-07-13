export type ProductCategory = 'coffee' | 'non-coffee' | 'food' | 'snack';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: ProductCategory;
  ingredients: Ingredient[];
}

export interface Ingredient {
  materialId: string;
  quantityNeeded: number; // e.g., 15 (grams of espresso)
}

export interface RawMaterial {
  id: string;
  name: string;
  stock: number;
  unit: string; // e.g., 'gram', 'ml', 'pcs'
  minStock: number; // warning threshold
  unitCost: number; // cost per unit to calculate HPP (COGS)
}

export type PaymentMethod = 'cash' | 'qris';
export type PaymentStatus = 'pending' | 'success' | 'failed';

export interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Transaction {
  id: string;
  timestamp: string; // ISO string
  items: TransactionItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentGatewayRef?: string;
  notes?: string;
}

export type EmployeeRole = 'barista' | 'cashier' | 'cleaner' | 'manager';

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  hourlyRate: number; // e.g., 15000 per hour
}

export type ShiftType = 'morning' | 'afternoon' | 'night';

export interface ShiftSchedule {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface AttendanceLog {
  id: string;
  employeeId: string;
  scheduleId: string;
  date: string; // YYYY-MM-DD
  clockIn: string | null; // ISO Timestamp or null
  clockOut: string | null; // ISO Timestamp or null
  calculatedHours: number | null; // in hours
  estimatedSalary: number | null; // calculated from hours * employee.hourlyRate
}

export type ExpenseCategory = string;

export interface OperationalExpense {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  description: string;
}
