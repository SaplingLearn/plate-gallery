import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import type {
  Plate,
  PlateDetail,
  PaginatedResponse,
  MapSummaryResponse,
  StateDetail,
  LeaderboardResponse,
  VoteResponse,
  UserProfile,
  UserVote,
  UploadSignResponse,
  Comment,
} from '@/lib/types'

// Feed
export function useFeed(filters: { state?: string; sort?: string }) {
  return useInfiniteQuery({
    queryKey: queryKeys.plates.feed(filters),
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (filters.state) params.set('state', filters.state)
      if (filters.sort) params.set('sort', filters.sort)
      if (pageParam) params.set('cursor', pageParam)
      params.set('limit', '24')
      return apiFetch<PaginatedResponse<Plate>>(`/plates?${params}`)
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })
}

// Recent plates (home page)
export function useRecentPlates(limit = 8) {
  return useQuery({
    queryKey: [...queryKeys.plates.all, 'recent', limit],
    queryFn: () => apiFetch<PaginatedResponse<Plate>>(`/plates?sort=recent&limit=${limit}&status=approved`),
  })
}

// Plate detail
export function usePlateDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.plates.detail(id),
    queryFn: () => apiFetch<PlateDetail>(`/plates/${id}`),
    enabled: !!id,
  })
}

// Map
export function useMapSummary() {
  return useQuery({
    queryKey: queryKeys.map.summary,
    queryFn: () => apiFetch<MapSummaryResponse>('/map/summary'),
    staleTime: 5 * 60_000,
  })
}

// State detail
export function useStateDetail(code: string) {
  return useQuery({
    queryKey: queryKeys.states.detail(code),
    queryFn: () => apiFetch<StateDetail>(`/states/${code}`),
    enabled: !!code,
  })
}

// Leaderboard
export function useLeaderboard(window: string, limit = 50) {
  return useQuery({
    queryKey: queryKeys.leaderboard.overall(window),
    queryFn: () => apiFetch<LeaderboardResponse>(`/leaderboard/overall?window=${window}&limit=${limit}`),
  })
}

// Vote
export function useVote(plateId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (value: 1 | -1 | 0) =>
      apiFetch<VoteResponse>(`/plates/${plateId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ value }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.plates.detail(plateId), (old: PlateDetail | undefined) => {
        if (!old) return old
        return { ...old, ...data }
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.plates.all })
    },
  })
}

// Profile
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.me.profile,
    queryFn: () => apiFetch<UserProfile>('/me'),
  })
}

export function useMyPlates() {
  return useInfiniteQuery({
    queryKey: queryKeys.me.plates,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      return apiFetch<PaginatedResponse<Plate>>(`/me/plates?${params}`)
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })
}

export function useMyVotes() {
  return useInfiniteQuery({
    queryKey: queryKeys.me.votes,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      return apiFetch<PaginatedResponse<UserVote>>(`/me/votes?${params}`)
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  })
}

// Upload
export function useUploadSign() {
  return useMutation({
    mutationFn: (data: { content_type: string; file_size_bytes: number; client_hash: string }) =>
      apiFetch<UploadSignResponse>('/uploads/sign', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}

export function useCreatePlate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { upload_token: string; object_path: string; plate_text: string; state_code: string; caption?: string }) =>
      apiFetch<Plate>('/plates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plates.all })
    },
  })
}

// Comments
export function useComments(plateId: string) {
  return useInfiniteQuery({
    queryKey: ['comments', plateId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams()
      if (pageParam) params.set('cursor', pageParam)
      return apiFetch<PaginatedResponse<Comment>>(`/plates/${plateId}/comments?${params}`)
    },
    initialPageParam: '' as string,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!plateId,
  })
}

export function useCreateComment(plateId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<Comment>(`/plates/${plateId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', plateId] })
      queryClient.invalidateQueries({ queryKey: queryKeys.plates.detail(plateId) })
    },
  })
}
