export const rupee = (value: number, decimals = 2) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
export const compact = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
export const percent = (value: number) =>
  `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
export const dateLabel = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
