export const WORKSPACE_ROLES = ['admin', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
