"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { DialogTitle } from "@radix-ui/react-dialog";

interface Role {
  id: number;
  name: string;
}

interface User {
  firstName: string;
  lastName: string;
  role: Role;
}

interface EditUserModalProps {
  user: User;
  roles: Role[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: User) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, roles, isOpen, onClose, onSave }) => {
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [selectedRole, setSelectedRole] = useState(user?.role || roles[0] || { id: 0, name: "Sin Rol" });

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setSelectedRole(user.role);
    }
  }, [user]);

  const handleSave = () => {
    const updatedUser = {
      ...user,
      firstName,
      lastName,
      roleId: selectedRole.id, // Actualizamos con el id del rol
    };
    onSave(updatedUser);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Nombre</label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Apellido</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Rol</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedRole.name} <span className="ml-2">▼</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Command>
                  <CommandGroup>
                    {roles.map((role) => (
                      <CommandItem
                        key={role.id}
                        onSelect={() => setSelectedRole(role)}
                      >
                        {role.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
