const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(amount: number): string {
  return inrFormatter.format(amount);
}

export function formatKm(km: number): string {
  return `${km.toLocaleString("en-IN")} km`;
}

export function formatDisplayDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
