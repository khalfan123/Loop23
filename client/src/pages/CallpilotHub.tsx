import { useState } from "react";
import { Cpu, Calendar, FileText, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import Callpilot from "@/pages/Callpilot";
import AppointmentsPage from "@/pages/AppointmentsPage";
import FormsPage from "@/pages/FormsPage";

type Section = "callpilot" | "appointments" | "forms";

const navItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "callpilot", label: "Call Pilot", icon: Cpu },
  { id: "appointments", label: "Appointment", icon: Calendar },
  { id: "forms", label: "Form", icon: FileText },
];

function SidebarNav({
  active,
  onSelect,
}: {
  active: Section;
  onSelect: (s: Section) => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          data-testid={`callpilot-nav-${id}`}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left w-full",
            active === id
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  );
}

export default function CallpilotHub() {
  const [active, setActive] = useState<Section>("callpilot");
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (s: Section) => {
    setActive(s);
    setMobileOpen(false);
  };

  return (
    <div className="flex w-full min-h-[calc(100vh-80px)] -mx-4 md:-mx-8 lg:-mx-12 -my-4 md:-my-6">
      <aside className="hidden md:flex flex-col w-[240px] shrink-0 border-r border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-zinc-900">
        <div className="px-4 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <h2 className="text-sm font-semibold text-foreground">Operations</h2>
        </div>
        <SidebarNav active={active} onSelect={setActive} />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex md:hidden items-center gap-2 px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-zinc-900">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="callpilot-hub-mobile-toggle">
                <PanelLeft className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] p-0 bg-white dark:bg-zinc-900">
              <div className="px-4 py-4 border-b border-black/[0.06] dark:border-white/[0.08]">
                <h2 className="text-sm font-semibold text-foreground">Operations</h2>
              </div>
              <SidebarNav active={active} onSelect={handleSelect} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium">
            {navItems.find((i) => i.id === active)?.label}
          </span>
        </div>

        <div className="flex-1 overflow-auto bg-zinc-50/80 dark:bg-zinc-950/50 px-4 md:px-8 lg:px-12 py-4 md:py-6">
          {active === "callpilot" && <Callpilot />}
          {active === "appointments" && <AppointmentsPage />}
          {active === "forms" && <FormsPage />}
        </div>
      </div>
    </div>
  );
}
