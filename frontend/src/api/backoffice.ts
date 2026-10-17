import { api } from "./client";
import type { AuditEntry, DashboardRow, Event, NewEventInput } from "../types/domain";

export const fetchDashboard = () => api<DashboardRow[]>("/backoffice/dashboard/");
export const createEvent = (input: NewEventInput) =>
  api<Event>("/backoffice/events/", { method: "POST", body: input });

export const fetchBackofficeEvents = () => api<Event[]>("/backoffice/events/");
export const fetchAudit = () => api<AuditEntry[]>("/backoffice/audit/");
