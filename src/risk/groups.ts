// The worklist groups and the order they are shown in, apart from the rules that assign them, so the app
// can name and order them without loading the pipeline.

export type WorklistGroup = 'actNow' | 'renewals' | 'monitor' | 'winBack';

/** The order the groups are shown in. They are assigned in another order: see `groupOf` in the worklist. */
export const WORKLIST_GROUPS: WorklistGroup[] = ['actNow', 'renewals', 'monitor', 'winBack'];
