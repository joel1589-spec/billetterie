import { api } from "./client";
import type { DashboardRow, Event, NewEventInput } from "../types/domain";

export const fetchDashboard = () => api<DashboardRow[]>("/backoffice/dashboard/");
export const createEvent = (input: NewEventInput) =>
  api<Event>("/backoffice/events/", { method: "POST", body: input });
