"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useBranchMutations, useBranches } from "@/hooks/useBranches";
import { useBranchLogos } from "@/hooks/useBranchLogos";
import { BranchLogoUploader } from "./BranchLogoUploader";
import { getErrorMessage } from "@/lib/api";
import type { Branch, BranchEmployee } from "@/types";

/**
 * Fila de un empleado: renombrar (lápiz → guardar) y activar/desactivar. Un
 * empleado inactivo deja de aparecer al crear pedidos; los pedidos viejos lo
 * siguen mostrando.
 */
function EmployeeRow({ branch, employee }: { branch: Branch; employee: BranchEmployee }) {
  const { updateEmployee } = useBranchMutations();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee.name);

  const save = async () => {
    const next = name.trim();
    if (!next || next === employee.name) {
      setEditing(false);
      setName(employee.name);
      return;
    }
    try {
      await updateEmployee.mutateAsync({
        branchId: branch.id,
        employeeId: employee.id,
        payload: { name: next },
      });
      setEditing(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo renombrar al empleado"));
    }
  };

  const toggle = async (active: boolean) => {
    try {
      await updateEmployee.mutateAsync({
        branchId: branch.id,
        employeeId: employee.id,
        payload: { active },
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar al empleado"));
    }
  };

  return (
    <li className="flex items-center gap-3 py-2" data-testid={`employee-${employee.id}`}>
      {editing ? (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            aria-label={`Nuevo nombre de ${employee.name}`}
            maxLength={80}
            className="h-9 max-w-xs"
            autoFocus
          />
          <Button size="icon" variant="ghost" aria-label="Guardar nombre" onClick={save}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Cancelar"
            onClick={() => {
              setEditing(false);
              setName(employee.name);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className={employee.active ? "text-sm" : "text-sm text-muted-foreground line-through"}>
            {employee.name}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Renombrar a ${employee.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </>
      )}
      <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
        {employee.active ? "Activo" : "Inactivo"}
        <Switch
          checked={employee.active}
          onCheckedChange={toggle}
          aria-label={`${employee.active ? "Desactivar" : "Activar"} a ${employee.name}`}
        />
      </label>
    </li>
  );
}

function BranchCard({ branch }: { branch: Branch }) {
  const { createEmployee, updateBranch } = useBranchMutations();
  const { getLogos } = useBranchLogos();
  const logos = getLogos(branch.id);
  const [newName, setNewName] = useState("");

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createEmployee.mutateAsync({ branchId: branch.id, name });
      setNewName("");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo agregar al empleado"));
    }
  };

  return (
    <section
      className="space-y-3 rounded-2xl border border-border/60 bg-card p-4"
      aria-label={`Sucursal ${branch.name}`}
    >
      <div className="flex items-center gap-3">
        <Store className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="font-heading text-base font-semibold">{branch.name}</h3>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {branch.active ? "Sucursal activa" : "Sucursal inactiva"}
          <Switch
            checked={branch.active}
            onCheckedChange={(active) =>
              updateBranch
                .mutateAsync({ id: branch.id, payload: { active } })
                .catch((error) => toast.error(getErrorMessage(error, "No se pudo actualizar la sucursal")))
            }
            aria-label={`${branch.active ? "Desactivar" : "Activar"} la sucursal ${branch.name}`}
          />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-label">Logo</p>
        <p className="text-meta">
          Identifica en pantalla, hojas y Modo TV los pedidos que levanta esta sucursal. Sin logo se muestra el nombre.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <BranchLogoUploader
            branchId={branch.id}
            branchName={branch.name}
            variant="onLight"
            current={logos?.logoOnLight ?? null}
            hasLogo={branch.hasLogoOnLight}
          />
          <BranchLogoUploader
            branchId={branch.id}
            branchName={branch.name}
            variant="onDark"
            current={logos?.logoOnDark ?? null}
            hasLogo={branch.hasLogoOnDark}
          />
        </div>
      </div>

      <div>
        <p className="text-label">Empleados</p>
        {(branch.employees ?? []).length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Todavía no hay empleados. Agrega a quienes levantan pedidos desde la sucursal.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {(branch.employees ?? []).map((employee) => (
              <EmployeeRow key={employee.id} branch={branch} employee={employee} />
            ))}
          </ul>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre del empleado"
          aria-label={`Nuevo empleado de ${branch.name}`}
          maxLength={80}
          className="max-w-xs"
        />
        <Button type="submit" disabled={!newName.trim() || createEmployee.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Agregar empleado
        </Button>
      </form>
    </section>
  );
}

/**
 * Sucursales (ej. "Punto Madero") y sus empleados: admin crea/renombra/
 * desactiva a quienes levantan pedidos desde la cuenta compartida de la
 * sucursal. La cuenta de la sucursal se crea en la pestaña Usuarios (rol
 * "Sucursal" + sucursal).
 */
export function BranchesPanel() {
  const { data: branches, isPending } = useBranches();
  const { createBranch } = useBranchMutations();
  const [name, setName] = useState("");

  const addBranch = async () => {
    const next = name.trim();
    if (!next) return;
    try {
      await createBranch.mutateAsync({ name: next });
      setName("");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo crear la sucursal"));
    }
  };

  return (
    <div className="space-y-4">
      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : branches.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Todavía no hay sucursales"
          description="Crea la primera para dar de alta a sus empleados."
        />
      ) : (
        branches.map((branch) => <BranchCard key={branch.id} branch={branch} />)
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void addBranch();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva sucursal"
          aria-label="Nombre de la nueva sucursal"
          maxLength={80}
          className="max-w-xs"
        />
        <Button type="submit" variant="outline" disabled={!name.trim() || createBranch.isPending}>
          Nueva sucursal
        </Button>
      </form>
    </div>
  );
}
