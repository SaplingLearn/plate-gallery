export const queryKeys = {
  plates: {
    all: ['plates'] as const,
    feed: (filters: Record<string, string | undefined>) => ['plates', 'feed', filters] as const,
    byState: (stateCode: string) => ['plates', 'byState', stateCode] as const,
    detail: (id: string) => ['plate', id] as const,
  },
  leaderboard: {
    overall: (window: string) => ['leaderboard', 'overall', window] as const,
    state: (stateCode: string, window: string) => ['leaderboard', 'state', stateCode, window] as const,
  },
  map: {
    summary: ['map', 'summary'] as const,
  },
  states: {
    detail: (code: string) => ['states', code] as const,
  },
  me: {
    profile: ['me'] as const,
    plates: ['me', 'plates'] as const,
    votes: ['me', 'votes'] as const,
    favorites: ['me', 'favorites'] as const,
  },
}
