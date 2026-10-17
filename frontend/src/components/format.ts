const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" });
const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatPrice = (cents: number) => euro.format(cents / 100);

const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" });
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
