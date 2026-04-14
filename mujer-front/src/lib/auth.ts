export type UserRole =
  | "admin"
  | "centro"
  | "super_admin"
  | "owner_institucion"
  | "admin_institucion"
  | "analista"
  | "operador";

export function isAdminRole(role: string | null | undefined): boolean {
  switch (role) {
    case "admin":
    case "super_admin":
    case "owner_institucion":
    case "admin_institucion":
      return true;
    default:
      return false;
  }
}

