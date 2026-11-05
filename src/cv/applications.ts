/** Application pipeline stages, in board order. Shared by DB schema and UI. */
export const APPLICATION_STATUSES = ['draft', 'applied', 'interview', 'offer', 'rejected', 'ghosted'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]
