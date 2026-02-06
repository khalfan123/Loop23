/**
 * ============================================================
 * © 2025 Diploy — a brand of Bisht Technologies Private Limited
 * Original Author: BTPL Engineering Team
 * Website: https://diploy.in
 * Contact: cs@diploy.in
 *
 * Distributed under the Envato / CodeCanyon License Agreement.
 * Licensed to the purchaser for use as defined by the
 * Envato Market (CodeCanyon) Regular or Extended License.
 *
 * You are NOT permitted to redistribute, resell, sublicense,
 * or share this source code, in whole or in part.
 * Respect the author's rights and Envato licensing terms.
 * ============================================================
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Calendar as CalendarIcon, Clock, Settings, ChevronLeft, ChevronRight, AlertCircle, CalendarDays, CalendarCheck, User } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";

interface AppointmentMetadata {
  aiCollectedPhone?: string;
  verifiedPhone?: string;
  phoneDiscrepancy?: boolean;
  aiCollectedName?: string;
  verifiedName?: string;
}

interface Appointment {
  id: string;
  userId: string;
  callId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  scheduledFor: string;
  duration: number;
  serviceName: string | null;
  status: string;
  notes: string | null;
  metadata: AppointmentMetadata | null;
  createdAt: string;
}

interface AppointmentSettings {
  id: string;
  userId: string;
  allowOverlap: boolean;
  bufferTime: number;
  maxPerDay: number | null;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingDays: string[];
  createdAt: string;
  updatedAt: string;
}

const defaultSettings: Partial<AppointmentSettings> = {
  allowOverlap: false,
  bufferTime: 15,
  maxPerDay: null,
  workingHoursStart: "09:00",
  workingHoursEnd: "17:00",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
};

export default function AppointmentsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [view, setView] = useState<"day" | "week" | "month">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsData, setSettingsData] = useState<Partial<AppointmentSettings>>(defaultSettings);

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/flow-automation/appointments"],
  });

  const { data: settings } = useQuery<AppointmentSettings>({
    queryKey: ["/api/flow-automation/appointment-settings"],
  });

  useEffect(() => {
    if (settings) {
      setSettingsData(settings);
    }
  }, [settings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        allowOverlap: settingsData.allowOverlap ?? false,
        bufferTime: settingsData.bufferTime ?? 15,
        maxPerDay: settingsData.maxPerDay ?? null,
        workingHoursStart: settingsData.workingHoursStart || "09:00",
        workingHoursEnd: settingsData.workingHoursEnd || "17:00",
        workingDays: settingsData.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday"],
      };
      
      const res = await apiRequest("PUT", "/api/flow-automation/appointment-settings", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flow-automation/appointment-settings"] });
      toast({ title: t("appointments.toast.settingsSaved") });
      setSettingsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: t("appointments.toast.settingsFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter((apt) => isSameDay(new Date(apt.scheduledFor), date));
  };

  const getMonthDays = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  };

  const handlePrevious = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNext = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const toggleWorkingDay = (day: string) => {
    const workingDays = settingsData.workingDays || [];
    if (workingDays.includes(day)) {
      setSettingsData({ ...settingsData, workingDays: workingDays.filter((d) => d !== day) });
    } else {
      setSettingsData({ ...settingsData, workingDays: [...workingDays, day] });
    }
  };

  const calendarDays = [
    { key: "sun", label: t("appointments.calendar.days.sun") },
    { key: "mon", label: t("appointments.calendar.days.mon") },
    { key: "tue", label: t("appointments.calendar.days.tue") },
    { key: "wed", label: t("appointments.calendar.days.wed") },
    { key: "thu", label: t("appointments.calendar.days.thu") },
    { key: "fri", label: t("appointments.calendar.days.fri") },
    { key: "sat", label: t("appointments.calendar.days.sat") },
  ];

  const workingDayOptions = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-5 w-5 border-2 border-foreground/20 border-t-foreground/70 rounded-full" />
      </div>
    );
  }

  const totalAppointments = appointments.length;
  const upcomingCount = appointments.filter(apt => new Date(apt.scheduledFor) > new Date()).length;
  const completedCount = appointments.filter(apt => apt.status === 'completed').length;
  const cancelledCount = appointments.filter(apt => apt.status === 'cancelled').length;

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed": return "default" as const;
      case "completed": return "secondary" as const;
      case "cancelled": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
            {t("appointments.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-light">{t("appointments.subtitle")}</p>
        </div>
        <Button 
          onClick={() => setSettingsOpen(true)} 
          variant="outline" 
          size="sm"
          data-testid="button-settings"
        >
          <Settings className="h-4 w-4 mr-1.5" />
          {t("common.settings")}
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">{totalAppointments}</div>
                <div className="text-xs text-muted-foreground font-light">{t("appointments.stats.total")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">{upcomingCount}</div>
                <div className="text-xs text-muted-foreground font-light">{t("appointments.stats.upcoming")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">{completedCount}</div>
                <div className="text-xs text-muted-foreground font-light">{t("appointments.stats.completed")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-semibold tracking-tight">{cancelledCount}</div>
                <div className="text-xs text-muted-foreground font-light">{t("appointments.stats.cancelled")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between p-4 border-b flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handlePrevious} data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleToday} data-testid="button-today">
              {t("appointments.calendar.today")}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNext} data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold tracking-tight" data-testid="text-current-month">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <Tabs value={view} onValueChange={(v: any) => setView(v)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-2.5" data-testid="tab-day">{t("appointments.calendar.day")}</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-2.5" data-testid="tab-week">{t("appointments.calendar.week")}</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-2.5" data-testid="tab-month">{t("appointments.calendar.month")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="p-4">
          {view === "month" && (
            <div>
              <div className="grid grid-cols-7 mb-1">
                {calendarDays.map((day) => (
                  <div key={day.key} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day.label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {getMonthDays().map((day, index) => {
                  const dayAppointments = getAppointmentsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={index}
                      className={`min-h-[88px] p-2 border-t ${
                        !isCurrentMonth ? "opacity-40" : ""
                      }`}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div className={`text-xs font-medium mb-1 ${
                        isToday 
                          ? "bg-foreground text-background w-6 h-6 rounded-full flex items-center justify-center"
                          : ""
                      }`}>
                        {format(day, "d")}
                      </div>
                      {dayAppointments.length > 0 && (
                        <div className="space-y-0.5">
                          {dayAppointments.slice(0, 2).map((apt) => (
                            <div
                              key={apt.id}
                              className="text-[10px] leading-tight px-1.5 py-0.5 bg-primary/8 dark:bg-primary/15 text-foreground rounded truncate"
                              title={`${apt.contactName} - ${format(new Date(apt.scheduledFor), "h:mm a")}`}
                              data-testid={`appointment-${apt.id}`}
                            >
                              {format(new Date(apt.scheduledFor), "h:mm a")}
                            </div>
                          ))}
                          {dayAppointments.length > 2 && (
                            <div className="text-[10px] text-muted-foreground px-1.5">
                              {t("appointments.calendar.more", { count: dayAppointments.length - 2 })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === "week" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground font-light">{t("appointments.calendar.weekViewSoon")}</p>
            </div>
          )}

          {view === "day" && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground font-light">{t("appointments.calendar.dayViewSoon")}</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b">
          <h2 className="text-base font-semibold tracking-tight">{t("appointments.upcomingAppointments")}</h2>
          <p className="text-xs text-muted-foreground font-light mt-0.5">{t("appointments.upcomingDescription")}</p>
        </div>
        <div className="p-4">
          {(() => {
            const now = new Date();
            const upcomingAppointments = appointments
              .filter((apt) => new Date(apt.scheduledFor) >= now)
              .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
            
            if (upcomingAppointments.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-medium mb-1">{t("appointments.noAppointments")}</h3>
                  <p className="text-sm text-muted-foreground font-light text-center max-w-sm">
                    {t("appointments.noAppointmentsDescription")}
                  </p>
                </div>
              );
            }
            
            return (
              <div className="divide-y">
                {upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm" data-testid={`text-contact-name-${apt.id}`}>
                              {apt.contactName}
                            </span>
                            <Badge variant={statusBadgeVariant(apt.status)} className="text-[10px]">
                              {apt.status}
                            </Badge>
                            {apt.metadata?.phoneDiscrepancy && (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                                <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                Mismatch
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span>{apt.contactPhone}</span>
                              {apt.contactEmail && <span>· {apt.contactEmail}</span>}
                            </div>
                            {apt.metadata?.phoneDiscrepancy && apt.metadata.aiCollectedPhone && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400">
                                AI heard: {apt.metadata.aiCollectedPhone}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5 flex-wrap">
                            {apt.serviceName && (
                              <span>{apt.serviceName}</span>
                            )}
                            <span>{t("appointments.durationMinutes", { count: apt.duration })}</span>
                          </div>
                          {apt.notes && (
                            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mt-1.5">
                              {apt.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium" data-testid={`text-scheduled-time-${apt.id}`}>
                          {format(new Date(apt.scheduledFor), "MMM d")}
                        </div>
                        <div className="text-xs text-muted-foreground font-light">
                          {format(new Date(apt.scheduledFor), "h:mm a")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Card>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold" data-testid="text-settings-title">{t("appointments.settings.title")}</DialogTitle>
            <DialogDescription className="font-light">{t("appointments.settings.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="text-sm">{t("appointments.settings.allowOverlap")}</Label>
                  <p className="text-xs text-muted-foreground font-light">
                    {t("appointments.settings.allowOverlapDescription")}
                  </p>
                </div>
                <Switch
                  checked={settingsData.allowOverlap}
                  onCheckedChange={(checked) => setSettingsData({ ...settingsData, allowOverlap: checked })}
                  data-testid="switch-allow-overlap"
                />
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="buffer-time" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("appointments.settings.bufferTime")}</Label>
                <Input
                  id="buffer-time"
                  type="number"
                  value={settingsData.bufferTime}
                  onChange={(e) => setSettingsData({ ...settingsData, bufferTime: parseInt(e.target.value) || 0 })}
                  data-testid="input-buffer-time"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="max-per-day" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("appointments.settings.maxPerDay")}</Label>
                <Input
                  id="max-per-day"
                  type="number"
                  placeholder={t("appointments.settings.maxPerDayPlaceholder")}
                  value={settingsData.maxPerDay || ""}
                  onChange={(e) =>
                    setSettingsData({ ...settingsData, maxPerDay: e.target.value ? parseInt(e.target.value) : null })
                  }
                  data-testid="input-max-per-day"
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("appointments.settings.workingHours")}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="hours-start" className="text-xs text-muted-foreground">{t("appointments.settings.startTime")}</Label>
                    <Input
                      id="hours-start"
                      type="time"
                      value={settingsData.workingHoursStart}
                      onChange={(e) => setSettingsData({ ...settingsData, workingHoursStart: e.target.value })}
                      data-testid="input-hours-start"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hours-end" className="text-xs text-muted-foreground">{t("appointments.settings.endTime")}</Label>
                    <Input
                      id="hours-end"
                      type="time"
                      value={settingsData.workingHoursEnd}
                      onChange={(e) => setSettingsData({ ...settingsData, workingHoursEnd: e.target.value })}
                      data-testid="input-hours-end"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("appointments.settings.workingDays")}</Label>
                <div className="rounded-xl border divide-y">
                  {workingDayOptions.map((day) => (
                    <div
                      key={day}
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover-elevate"
                      onClick={() => toggleWorkingDay(day)}
                      data-testid={`day-option-${day}`}
                    >
                      <span className="text-sm capitalize">{t(`appointments.settings.days.${day}`)}</span>
                      <div
                        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          settingsData.workingDays?.includes(day)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {settingsData.workingDays?.includes(day) && (
                          <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)} data-testid="button-cancel-settings">
              {t("common.cancel")}
            </Button>
            <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending} data-testid="button-save-settings">
              {t("appointments.settings.saveSettings")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
