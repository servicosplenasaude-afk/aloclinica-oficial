import { useState, useEffect } from "react";
import { db } from "@/integrations/supabase/untyped";
import DashboardLayout from "@/components/dashboards/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getAdminNav } from "./adminNav";
import { AdminPageHeader } from "./AdminPageHeader";
import { AdminLoading, AdminEmpty } from "./AdminStateBlocks";
import { Search, Shield, Eye, Users as UsersIcon, Download, Bookmark, Trash2, Plus } from "lucide-react";
import { exportCSV } from "@/lib/csvExport";
import { logError } from "@/lib/logger";
import { adminRoleErrorMessage, setAdminManagedUserRoles } from "@/lib/admin-user-roles";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { useSavedFilters } from "@/hooks/useSavedFilters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const ROLE_LABELS: Record<string, string> = {
  patient: "Paciente",
  doctor: "Médico",
  clinic: "Clínica",
  admin: "Admin",
  receptionist: "Recepção",
  support: "Suporte",
  partner: "Parceiro",
  
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  doctor: "bg-secondary/10 text-secondary",
  clinic: "bg-accent text-accent-foreground",
  patient: "bg-primary/10 text-primary",
  receptionist: "bg-primary/5 text-primary",
  support: "bg-muted text-muted-foreground",
  partner: "bg-secondary/5 text-secondary",
  
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Acesso total à plataforma",
  doctor: "Pode atender consultas e prescrever",
  clinic: "Pode gerenciar médicos vinculados",
  patient: "Pode agendar e participar de consultas",
  receptionist: "Agenda multimédico, check-in e confirmações",
  support: "Logs de conexão, reset de acessos e helpdesk",
  partner: "Validação de receitas (farmácias/labs)",
  
};

interface UserWithRoles {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  cpf: string | null;
  created_at: string;
  roles: string[];
}

type SavedFilter = { search: string; roleFilter: string | null };

const AdminUsers = () => {

  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserWithRoles | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterName, setFilterName] = useState("");
  const sel = useBulkSelection();
  const savedFilters = useSavedFilters<SavedFilter>("admin_users");

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    // Get all profiles
    const { data: profiles } = await db.from("profiles")
      .select("user_id, first_name, last_name, phone, cpf, created_at")
      .order("created_at", { ascending: false });

    // Get all roles
    const { data: roles } = await db.from("user_roles").select("user_id, role");

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach(r => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });

    setUsers((profiles ?? []).map(p => ({
      ...p,
      roles: roleMap.get(p.user_id) ?? [],
    })));
    setLoading(false);
  };

  const openDetail = (u: UserWithRoles) => {
    setSelected(u);
    setUserRoles([...u.roles]);
  };

  const toggleRole = (role: string) => {
    setUserRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const saveRoles = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await setAdminManagedUserRoles(selected.user_id, userRoles);
      toast.success("Roles atualizadas! ✅");
      setSelected(null);
      await fetchUsers();
    } catch (error) {
      logError("AdminUsers role update failed", error);
      toast.error(adminRoleErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const filtered = users.filter(u => {
    const haystack = `${u.first_name} ${u.last_name} ${u.cpf || ""} ${u.phone || ""}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.roles.includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  const handleExportCSV = () => {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `usuarios-aloclinica-${today}${roleFilter ? "-" + roleFilter : ""}.csv`;
    exportCSV(filename, filtered, [
      { key: "first_name", header: "Nome" },
      { key: "last_name", header: "Sobrenome" },
      { key: "cpf", header: "CPF" },
      { key: "phone", header: "Telefone" },
      { key: "roles", header: "Roles", format: (v: string[]) => (v ?? []).map(r => ROLE_LABELS[r] ?? r).join(", ") },
      { key: "created_at", header: "Cadastro", format: (v: string) => v ? new Date(v).toLocaleString("pt-BR") : "" },
    ]);
    toast.success(`${filtered.length} usuário${filtered.length === 1 ? "" : "s"} exportado${filtered.length === 1 ? "" : "s"}`);
  };

  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    u.roles.forEach(r => { acc[r] = (acc[r] ?? 0) + 1; });
    return acc;
  }, {});

  const selectedUsers = users.filter(u => sel.has(u.user_id));

  const bulkExport = () => {
    if (selectedUsers.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    exportCSV(`usuarios-selecionados-${today}.csv`, selectedUsers, [
      { key: "first_name", header: "Nome" },
      { key: "last_name", header: "Sobrenome" },
      { key: "cpf", header: "CPF" },
      { key: "phone", header: "Telefone" },
      { key: "roles", header: "Roles", format: (v: string[]) => (v ?? []).map(r => ROLE_LABELS[r] ?? r).join(", ") },
      { key: "created_at", header: "Cadastro", format: (v: string) => v ? new Date(v).toLocaleString("pt-BR") : "" },
    ]);
    toast.success(`${selectedUsers.length} usuário${selectedUsers.length === 1 ? "" : "s"} exportado${selectedUsers.length === 1 ? "" : "s"}`);
  };

  const bulkAddRole = async (role: string) => {
    if (selectedUsers.length === 0) return;
    const targets = selectedUsers.filter(u => !u.roles.includes(role));
    if (targets.length === 0) { toast.info("Todos já têm essa role"); return; }
    try {
      for (const target of targets) {
        await setAdminManagedUserRoles(target.user_id, [...target.roles, role]);
      }
      toast.success(`Role "${ROLE_LABELS[role] ?? role}" aplicada a ${targets.length} usuário(s)`);
      sel.clear();
      await fetchUsers();
    } catch (error) {
      logError("AdminUsers bulk role grant failed", error);
      toast.error(adminRoleErrorMessage(error));
    }
  };

  const bulkRemoveRole = async (role: string) => {
    if (selectedUsers.length === 0) return;
    const targets = selectedUsers.filter(u => u.roles.includes(role));
    if (targets.length === 0) { toast.info("Nenhum dos selecionados tem essa role"); return; }
    try {
      for (const target of targets) {
        await setAdminManagedUserRoles(target.user_id, target.roles.filter(currentRole => currentRole !== role));
      }
      toast.success(`Role removida de ${targets.length} usuário(s)`);
      sel.clear();
      await fetchUsers();
    } catch (error) {
      logError("AdminUsers bulk role revoke failed", error);
      toast.error(adminRoleErrorMessage(error));
    }
  };

  const applySavedFilter = (name: string) => {
    const f = savedFilters.apply(name);
    if (!f) return;
    setSearch(f.search);
    setRoleFilter(f.roleFilter);
    sel.clear();
    toast.success(`Filtro "${name}" aplicado`);
  };

  const handleSaveFilter = () => {
    const name = filterName.trim();
    if (!name) return;
    savedFilters.save(name, { search, roleFilter });
    setFilterName("");
    toast.success(`Filtro "${name}" salvo`);
  };

  return (
    <DashboardLayout title="Administração" nav={getAdminNav("users")}>
      <div className="w-full mx-auto max-w-5xl space-y-5 pb-24 md:pb-6">
        <AdminPageHeader
          icon={Shield}
          eyebrow="Pessoas"
          title="Usuários & Permissões"
          description="Gerencie papéis e acessos de todos os usuários da plataforma."
          accent="from-blue-500 to-indigo-600"
          badge={{ label: `${filtered.length} ${filtered.length === 1 ? "usuário" : "usuários"}`, tone: "info" }}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="gap-1.5"
            >
              <Download className="w-4 h-4" /> Exportar CSV
            </Button>
          }
        />

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, CPF ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="default" className="gap-1.5 shrink-0">
                  <Bookmark className="w-4 h-4" /> Filtros salvos {savedFilters.names.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{savedFilters.names.length}</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Salvar filtro atual</p>
                <div className="flex gap-2">
                  <Input
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    placeholder="Nome (ex: Médicos sem CPF)"
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleSaveFilter()}
                  />
                  <Button size="sm" onClick={handleSaveFilter} disabled={!filterName.trim()} className="h-8 px-3">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {savedFilters.names.length > 0 ? (
                  <>
                    <div className="h-px bg-border" />
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Salvos</p>
                    <div className="space-y-1 max-h-64 overflow-auto">
                      {savedFilters.names.map(name => (
                        <div key={name} className="flex items-center gap-1 rounded-lg hover:bg-muted/60 group">
                          <button
                            type="button"
                            onClick={() => applySavedFilter(name)}
                            className="flex-1 text-left text-sm font-medium px-2 py-1.5 truncate"
                          >
                            {name}
                          </button>
                          <button
                            type="button"
                            onClick={() => { savedFilters.remove(name); toast.success("Filtro removido"); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-opacity"
                            aria-label="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum filtro salvo ainda</p>
                )}
              </PopoverContent>
            </Popover>
          </div>
          {Object.keys(roleCounts).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 mr-1">Filtrar:</span>
              <button
                type="button"
                onClick={() => setRoleFilter(null)}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-colors ${
                  roleFilter === null ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                Todos ({users.length})
              </button>
              {Object.entries(roleCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([role, count]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                    className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-colors ${
                      roleFilter === role ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {ROLE_LABELS[role] ?? role} ({count})
                  </button>
                ))}
            </div>
          )}
        </div>

        <BulkActionBar count={sel.size} onClear={sel.clear} noun="usuários">
          <Button size="sm" variant="outline" onClick={bulkExport} className="gap-1.5 h-8">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> Adicionar role
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-[11px]">Aplicar a {sel.size} usuário(s)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["patient", "doctor", "clinic", "admin", "receptionist", "support", "partner"] as const).map(role => (
                <DropdownMenuItem key={role} onClick={() => bulkAddRole(role)}>
                  {ROLE_LABELS[role]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-destructive border-destructive/30 hover:bg-destructive/5">
                <Trash2 className="w-3.5 h-3.5" /> Remover role
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-[11px]">Remover de {sel.size} usuário(s)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["patient", "doctor", "clinic", "admin", "receptionist", "support", "partner"] as const).map(role => (
                <DropdownMenuItem key={role} onClick={() => bulkRemoveRole(role)}>
                  {ROLE_LABELS[role]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </BulkActionBar>

        {loading ? (
          <AdminLoading variant="table" count={6} />
        ) : filtered.length === 0 ? (
          <AdminEmpty
            icon={UsersIcon}
            title={search ? "Nenhum resultado" : "Nenhum usuário cadastrado"}
            description={
              search
                ? "Tente ajustar o termo de busca por nome ou CPF."
                : "Os usuários da plataforma aparecerão aqui assim que se cadastrarem."
            }
            accent="from-blue-500/20 to-indigo-500/20"
          />
        ) : (
          <div className="rounded-xl border border-border/60 overflow-hidden bg-card/50">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && sel.isAllSelected(filtered.map(u => u.user_id))}
                        onCheckedChange={() => sel.selectAll(filtered.map(u => u.user_id))}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead scope="col">Usuário</TableHead>
                    <TableHead scope="col">Telefone</TableHead>
                    <TableHead scope="col">Roles</TableHead>
                    <TableHead scope="col">Cadastro</TableHead>
                    <TableHead scope="col" className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.user_id} data-state={sel.has(u.user_id) ? "selected" : undefined}>
                      <TableCell className="w-10">
                        <Checkbox
                          checked={sel.has(u.user_id)}
                          onCheckedChange={() => sel.toggle(u.user_id)}
                          aria-label={`Selecionar ${u.first_name} ${u.last_name}`}
                        />
                      </TableCell>
                      <TableCell data-label="Usuário">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {u.first_name?.[0]}{u.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{u.first_name} {u.last_name}</span>
                        </div>
                      </TableCell>
                      <TableCell data-label="Telefone" className="text-muted-foreground">{u.phone || "—"}</TableCell>
                      <TableCell data-label="Roles">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r: string) => (
                            <Badge key={r} variant="outline" className={`text-xs ${ROLE_COLORS[r] ?? ""}`}>
                              {ROLE_LABELS[r] ?? r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell data-label="Cadastro" className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell data-label="">
                        <Button size="sm" variant="ghost" onClick={() => openDetail(u)}>
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Permissões</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-medium text-foreground">{selected.first_name} {selected.last_name}</p>
                <p className="text-muted-foreground">{selected.phone || "Sem telefone"} · {selected.cpf || "Sem CPF"}</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Roles do usuário:</p>
                {(["patient", "doctor", "clinic", "admin", "receptionist", "support", "partner"] as const).map(role => (
                  <label key={role} className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={userRoles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <div>
                      <span className="text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
                      <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={saveRoles} disabled={saving} className="bg-gradient-hero text-primary-foreground">
                  {saving ? "Salvando..." : "Salvar Roles"}
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminUsers;
