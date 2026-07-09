export type SearchableWorkspaceFile = {
  name: string;
  path: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

export const filterWorkspaceFiles = <T extends SearchableWorkspaceFile>(files: T[], query: string, limit = 80): T[] => {
  const normalized = normalize(query);
  if (!normalized) return files.slice(0, limit);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return files
    .filter((file) => {
      const haystack = `${file.name} ${file.path}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
};
