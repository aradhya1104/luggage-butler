import { createContext, useContext, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, Loader2, LogOut, Luggage, Menu, Shield, Users, Warehouse, X } from "lucide-react";

interface AdminAuth {
  isSuperAdmin: boolean;
  email: string | null;
}

const AdminAuthContext = createContext<AdminAuth>({ isSuperAdmin: false, email: null });
export const useAdminAuth = () => useContext(AdminAuthContext);

const NAV = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/admin/bookings", label: "Bookings", icon: Luggage },
  { to: "/admin/partners", label: "Delivery Partners", icon: Users },
  { to: "/admin/storage", label: "Storage Inventory", icon: Warehouse },
];

const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
      <Shield className="w-5 h-5 text-accent-foreground" />
    </div>
    <div className="leading-tight">
      <p className="font-extrabold text-admin-foreground tracking-wide">
        LUGGO <span className="text-accent">ADMIN</span>
      </p>
      <p className="text-[10px] font-semibold tracking-[0.2em] text-admin-muted">OPERATIONS CONTROL</p>
    </div>
  </div>
);

const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
  <nav className="flex flex-col gap-1 px-3 mt-8">
    {NAV.map(({ to, label, icon: Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
            isActive
              ? "bg-accent text-accent-foreground shadow-accent"
              : "text-admin-muted hover:text-admin-foreground hover:bg-white/5"
          }`
        }
      >
        <Icon className="w-[18px] h-[18px]" />
        {label}
      </NavLink>
    ))}
  </nav>
);

const AdminLayout = () => {
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AdminAuth | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/admin");
        return;
      }
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const roles = (roleData ?? []).map((r) => r.role);
      if (!roles.includes("admin") && !roles.includes("super_admin")) {
        await supabase.auth.signOut();
        navigate("/admin");
        return;
      }
      if (!cancelled) {
        setAuth({ isSuperAdmin: roles.includes("super_admin"), email: session.user.email ?? null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const exitAdmin = async () => {
    await supabase.auth.signOut();
    navigate("/admin");
  };

  if (!auth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminAuthContext.Provider value={auth}>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[260px] bg-admin flex-col z-40">
          <div className="p-6 border-b border-white/10">
            <Logo />
          </div>
          <NavItems />
          <div className="mt-auto p-3 border-t border-white/10">
            <button
              onClick={exitAdmin}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-accent hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-[18px] h-[18px]" />
              Exit Admin Portal
            </button>
          </div>
        </aside>

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 bg-admin">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo />
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-admin-foreground hover:bg-white/10"
              aria-label="Open admin menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-[280px] bg-admin flex flex-col animate-in slide-in-from-left duration-200">
              <div className="p-6 border-b border-white/10 flex items-start justify-between">
                <Logo />
                <button onClick={() => setMobileOpen(false)} className="p-1 text-admin-muted hover:text-admin-foreground" aria-label="Close menu">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <NavItems onNavigate={() => setMobileOpen(false)} />
              <div className="mt-auto p-3 border-t border-white/10">
                <button
                  onClick={exitAdmin}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-accent hover:bg-white/5"
                >
                  <LogOut className="w-[18px] h-[18px]" />
                  Exit Admin Portal
                </button>
              </div>
            </aside>
          </div>
        )}

        <main className="lg:pl-[260px]">
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
            <Outlet />
          </div>
        </main>
      </div>
    </AdminAuthContext.Provider>
  );
};

export default AdminLayout;
