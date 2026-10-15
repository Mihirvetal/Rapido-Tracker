export interface ReportMonthOption {
  id: string;
  label: string;
  year: number;
  month: number;
}

export interface ReportDayCell {
  date: string;
  day: number;
  hasEntry: boolean;
  entryId: string | null;
  expenseLabel: string | null;
  profitLabel: string | null;
  zeroEarnings: boolean;
}

export interface ReportMonthSummary {
  earningsLabel: string;
  expensesLabel: string;
  netProfitLabel: string;
  kilometresLabel: string;
  netProfitNegative: boolean;
  entryCount: number;
}

export interface ReportMonthEntry {
  id: string;
  entryDate: string;
  earningsLabel: string;
  expensesLabel: string;
  netProfitLabel: string;
  kilometresLabel: string;
  netProfitNegative: boolean;
}

export interface ReportMonthView {
  month: ReportMonthOption;
  summary: ReportMonthSummary;
  calendarStartOffset: number;
  days: ReportDayCell[];
  entries: ReportMonthEntry[];
}

export type ReportMonthsResult =
  | { ok: true; months: ReportMonthOption[] }
  | { ok: false; message: string };

export type ReportMonthDataResult =
  | { ok: true; report: ReportMonthView }
  | { ok: false; message: string };
