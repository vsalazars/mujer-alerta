export function extractInstitutionSlug(pathname: string | null | undefined): string {
  const clean = String(pathname || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  if (!clean) return "";

  const [first] = clean.split("/");
  switch (first) {
    case "":
    case "admin":
    case "centro":
    case "diagnostico":
    case "resumen":
      return "";
    default:
      return first;
  }
}

export function withInstitutionSlug(
  slug: string | null | undefined,
  path: string,
): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const cleanSlug = String(slug || "").trim().replace(/^\/+|\/+$/g, "");
  if (!cleanSlug) return cleanPath;
  return `/${cleanSlug}${cleanPath}`;
}

