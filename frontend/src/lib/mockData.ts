import { US_STATES } from './states'
import type {
  Author,
  Comment,
  FavoriteResponse,
  LeaderboardResponse,
  MapSummaryResponse,
  PaginatedResponse,
  Plate,
  PlateDetail,
  StateDetail,
  UploadSignResponse,
  UserProfile,
  UserVote,
  VoteResponse,
} from './types'

const authors: Author[] = [
  { id: 'u1', display_name: 'mackenzie', avatar_url: null },
  { id: 'u2', display_name: 'ross.b', avatar_url: null },
  { id: 'u3', display_name: 'quinn.r', avatar_url: null },
  { id: 'u4', display_name: 'devon.k', avatar_url: null },
  { id: 'u5', display_name: 'sam.pixels', avatar_url: null },
  { id: 'u6', display_name: 'alex.fox', avatar_url: null },
  { id: 'u7', display_name: 'riley.t', avatar_url: null },
  { id: 'u8', display_name: 'jesse.m', avatar_url: null },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

type Seed = [string, string, number, number, number, number, string?]
// [plate_text, state_code, upvotes, downvotes, comment_count, daysAgo, caption?]
const seeds: Seed[] = [
  ['HOWDY', 'TX', 812, 14, 23, 2, 'spotted at a BBQ joint in austin'],
  ['YOLO4U', 'CA', 1104, 32, 41, 1, 'parking lot at trader joes'],
  ['L8AGN', 'NY', 944, 18, 19, 3],
  ['GR8W8', 'FL', 612, 21, 11, 5],
  ['NOPLATE', 'OR', 1342, 9, 52, 1, 'galaxy brain energy'],
  ['404OOPS', 'WA', 988, 12, 28, 2, 'dev at the wheel'],
  ['DADJOKE', 'OH', 731, 7, 34, 4],
  ['BEEPBEEP', 'NV', 455, 19, 8, 6],
  ['NULLPTR', 'MA', 1287, 44, 61, 2, 'boston area — figures'],
  ['PHDOC', 'IL', 521, 11, 9, 8],
  ['QUIET', 'VT', 289, 4, 6, 10],
  ['SPICEE', 'NM', 634, 8, 18, 3],
  ['BKNEER', 'CO', 812, 15, 22, 4, 'mountain roads forever'],
  ['ZOOZOOM', 'GA', 402, 23, 14, 7],
  ['KAKAW', 'AZ', 372, 6, 12, 9],
  ['TXSTRNG', 'TX', 901, 88, 45, 6, 'the chrome was too much'],
  ['IMLATE', 'PA', 265, 14, 7, 11],
  ['IDRIVE', 'MI', 188, 22, 5, 13],
  ['YIPPEE', 'MT', 699, 3, 16, 5, 'wyoming border, maybe'],
  ['NOBRAKS', 'WV', 421, 5, 13, 8],
  ['FNGUY', 'MN', 567, 9, 21, 7, 'mushroom decal on the bumper'],
  ['RAD1O', 'CA', 722, 18, 15, 4],
  ['SLOMO', 'HI', 834, 4, 26, 2],
  ['EMDASH', 'NC', 511, 13, 19, 6, 'writer spotted'],
  ['HTTP200', 'WA', 1098, 21, 33, 3],
  ['OK2SPD', 'TX', 298, 41, 8, 10, 'bold claim'],
  ['SEGFLT', 'MA', 489, 15, 11, 9],
  ['REDVAN', 'CA', 621, 8, 18, 5, 'surfing mom squad'],
  ['BAD1DEA', 'NY', 812, 11, 24, 4],
  ['WAHOO', 'VA', 318, 6, 9, 12],
  ['LUVCATS', 'FL', 544, 17, 20, 7],
  ['CA5H', 'NV', 155, 33, 4, 15, 'vegas, naturally'],
  ['DRMBG', 'TN', 278, 7, 6, 14],
  ['AVLNCHE', 'CO', 688, 4, 22, 3],
  ['SUNRYZ', 'FL', 392, 9, 13, 9],
  ['ICARLY', 'CA', 612, 22, 17, 11],
  ['PIZZA2', 'NY', 877, 6, 35, 2, 'brooklyn energy'],
  ['BANJO', 'KY', 402, 8, 14, 6],
  ['TACO4L', 'CA', 1211, 14, 58, 1, 'that is the whole personality'],
  ['LEFTY', 'OR', 245, 19, 6, 13],
]

let plates: Plate[] = seeds.map(([text, code, up, down, cc, ago, caption], i) => {
  const author = authors[i % authors.length]
  return {
    id: `p${i + 1}`,
    image_url: '',
    image_thumb_url: '',
    plate_text: text,
    state_code: code,
    state_name: US_STATES[code] ?? code,
    author,
    score: up - down,
    upvotes: up,
    downvotes: down,
    user_vote: 0,
    comment_count: cc,
    caption,
    created_at: daysAgo(ago),
    is_favorited: false,
    status: 'approved',
  }
})

const commentBodies = [
  'this is the best plate i have seen all year',
  'absolute cinema',
  'my brain is not ready',
  'spotted one like this in the next state over lol',
  'chef kiss',
  'why do i feel seen',
  '10/10 no notes',
  'who hurt them',
  'iconic',
  'okay but the color combo though',
]

const commentsByPlate: Record<string, Comment[]> = {}
plates.forEach((p, idx) => {
  if (p.comment_count === 0) return
  const n = Math.min(p.comment_count, 5)
  commentsByPlate[p.id] = Array.from({ length: n }).map((_, i) => ({
    id: `c-${p.id}-${i}`,
    plate_id: p.id,
    author: authors[(idx + i + 1) % authors.length],
    body: commentBodies[(idx + i) % commentBodies.length],
    created_at: daysAgo(i + 1),
  }))
})

const currentUser: UserProfile = {
  id: 'u-me',
  email: 'you@example.com',
  display_name: 'you',
  avatar_url: null,
  created_at: daysAgo(120),
}

function sortPlates(list: Plate[], sort: string | null): Plate[] {
  const out = [...list]
  switch (sort) {
    case 'recent':
      out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      break
    case 'top_day':
    case 'top_week':
    case 'top_month':
    case 'top_all':
    default:
      out.sort((a, b) => b.score - a.score)
  }
  return out
}

function paginate<T>(list: T[], limit: number): PaginatedResponse<T> {
  return { items: list.slice(0, limit), next_cursor: null }
}

function buildPlateDetail(plate: Plate): PlateDetail {
  const related = plates
    .filter((x) => x.state_code === plate.state_code && x.id !== plate.id)
    .slice(0, 6)
  return { ...plate, related_plates: related, comments_enabled: true }
}

function mapSummary(): MapSummaryResponse {
  const counts: Record<string, { count: number; topId: string | null; topScore: number }> = {}
  for (const p of plates) {
    const entry = counts[p.state_code] ?? { count: 0, topId: null, topScore: -Infinity }
    entry.count += 1
    if (p.score > entry.topScore) {
      entry.topScore = p.score
      entry.topId = p.id
    }
    counts[p.state_code] = entry
  }
  const states = Object.keys(US_STATES).map((code) => ({
    code,
    name: US_STATES[code],
    plate_count: counts[code]?.count ?? 0,
    top_plate_id: counts[code]?.topId ?? null,
  }))
  return { states }
}

function stateDetail(code: string): StateDetail | null {
  const upper = code.toUpperCase()
  const name = US_STATES[upper]
  if (!name) return null
  const inState = plates.filter((p) => p.state_code === upper)
  const sorted = [...inState].sort((a, b) => b.score - a.score)
  return {
    state: { code: upper, name },
    hero_plate: sorted[0] ?? null,
    top_10: sorted.slice(0, 10),
    total_count: inState.length,
  }
}

function leaderboard(limit: number, window: string): LeaderboardResponse {
  const items = [...plates].sort((a, b) => b.score - a.score).slice(0, limit)
  return { items, window, generated_at: new Date().toISOString() }
}

export function isMockMode(): boolean {
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') return true
  const hasSupabase =
    Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
  const hasApiBase = Boolean(import.meta.env.VITE_API_BASE_URL)
  return !hasSupabase && !hasApiBase
}

export async function handleMockRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  await new Promise((r) => setTimeout(r, 120))

  const [rawPath, rawQuery = ''] = path.split('?')
  const query = new URLSearchParams(rawQuery)
  const method = (init.method ?? 'GET').toUpperCase()
  const body = init.body ? safeParse(init.body) : null

  // --- Feed ---
  if (method === 'GET' && rawPath === '/plates') {
    const state = query.get('state')?.toUpperCase() ?? null
    const sort = query.get('sort')
    const limit = Number(query.get('limit') ?? '24')
    let list = plates.filter((p) => p.status !== 'rejected')
    if (state) list = list.filter((p) => p.state_code === state)
    list = sortPlates(list, sort)
    return paginate(list, limit) as T
  }

  // --- Plate detail ---
  const plateDetailMatch = rawPath.match(/^\/plates\/([^/]+)$/)
  if (method === 'GET' && plateDetailMatch) {
    const plate = plates.find((p) => p.id === plateDetailMatch[1])
    if (!plate) throw mockError(404, 'not_found', 'Plate not found')
    return buildPlateDetail(plate) as T
  }

  // --- Create plate ---
  if (method === 'POST' && rawPath === '/plates') {
    const data = body as { plate_text: string; state_code: string; caption?: string }
    const id = `p-new-${plates.length + 1}`
    const newPlate: Plate = {
      id,
      image_url: '',
      image_thumb_url: '',
      plate_text: data.plate_text.toUpperCase(),
      state_code: data.state_code.toUpperCase(),
      state_name: US_STATES[data.state_code.toUpperCase()] ?? data.state_code,
      author: { id: currentUser.id, display_name: currentUser.display_name, avatar_url: null },
      score: 1,
      upvotes: 1,
      downvotes: 0,
      user_vote: 1,
      comment_count: 0,
      caption: data.caption,
      created_at: new Date().toISOString(),
      is_favorited: false,
      status: 'approved',
    }
    plates = [newPlate, ...plates]
    return newPlate as T
  }

  // --- Vote ---
  const voteMatch = rawPath.match(/^\/plates\/([^/]+)\/vote$/)
  if (method === 'POST' && voteMatch) {
    const plate = plates.find((p) => p.id === voteMatch[1])
    if (!plate) throw mockError(404, 'not_found', 'Plate not found')
    const value = (body as { value: 1 | -1 | 0 }).value
    const prev = plate.user_vote
    if (prev === 1) plate.upvotes -= 1
    if (prev === -1) plate.downvotes -= 1
    if (value === 1) plate.upvotes += 1
    if (value === -1) plate.downvotes += 1
    plate.user_vote = value
    plate.score = plate.upvotes - plate.downvotes
    const response: VoteResponse = {
      score: plate.score,
      upvotes: plate.upvotes,
      downvotes: plate.downvotes,
      user_vote: plate.user_vote,
    }
    return response as T
  }

  // --- Favorite ---
  const favMatch = rawPath.match(/^\/plates\/([^/]+)\/favorite$/)
  if (method === 'POST' && favMatch) {
    const plate = plates.find((p) => p.id === favMatch[1])
    if (!plate) throw mockError(404, 'not_found', 'Plate not found')
    plate.is_favorited = !plate.is_favorited
    const response: FavoriteResponse = { is_favorited: !!plate.is_favorited }
    return response as T
  }

  // --- Comments ---
  const commentsMatch = rawPath.match(/^\/plates\/([^/]+)\/comments$/)
  if (method === 'GET' && commentsMatch) {
    const list = commentsByPlate[commentsMatch[1]] ?? []
    return paginate(list, 50) as T
  }
  if (method === 'POST' && commentsMatch) {
    const plateId = commentsMatch[1]
    const plate = plates.find((p) => p.id === plateId)
    if (!plate) throw mockError(404, 'not_found', 'Plate not found')
    const text = (body as { body: string }).body
    const comment: Comment = {
      id: `c-${plateId}-${Date.now()}`,
      plate_id: plateId,
      author: { id: currentUser.id, display_name: currentUser.display_name, avatar_url: null },
      body: text,
      created_at: new Date().toISOString(),
    }
    commentsByPlate[plateId] = [comment, ...(commentsByPlate[plateId] ?? [])]
    plate.comment_count += 1
    return comment as T
  }

  // --- Map summary ---
  if (method === 'GET' && rawPath === '/map/summary') {
    return mapSummary() as T
  }

  // --- State detail ---
  const stateMatch = rawPath.match(/^\/states\/([^/]+)$/)
  if (method === 'GET' && stateMatch) {
    const detail = stateDetail(stateMatch[1])
    if (!detail) throw mockError(404, 'not_found', 'State not found')
    return detail as T
  }

  // --- Leaderboards ---
  if (method === 'GET' && rawPath === '/leaderboard/overall') {
    const limit = Number(query.get('limit') ?? '50')
    const window = query.get('window') ?? 'all'
    return leaderboard(limit, window) as T
  }
  const stateLeaderMatch = rawPath.match(/^\/leaderboard\/state\/([^/]+)$/)
  if (method === 'GET' && stateLeaderMatch) {
    const code = stateLeaderMatch[1].toUpperCase()
    const limit = Number(query.get('limit') ?? '10')
    const window = query.get('window') ?? 'all'
    const items = plates
      .filter((p) => p.state_code === code)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
    return { items, window, generated_at: new Date().toISOString() } as T
  }

  // --- Me ---
  if (method === 'GET' && rawPath === '/me') {
    return currentUser as T
  }
  if (method === 'GET' && rawPath === '/me/plates') {
    return paginate([], 24) as T
  }
  if (method === 'GET' && rawPath === '/me/favorites') {
    return paginate(plates.filter((p) => p.is_favorited), 24) as T
  }
  if (method === 'GET' && rawPath === '/me/votes') {
    const votes: UserVote[] = plates
      .filter((p) => p.user_vote !== 0)
      .map((p) => ({ plate: p, value: p.user_vote as 1 | -1, voted_at: new Date().toISOString() }))
    return paginate(votes, 24) as T
  }

  // --- Upload ---
  if (method === 'POST' && rawPath === '/uploads/sign') {
    const response: UploadSignResponse = {
      upload_token: 'mock-upload-token',
      signed_url: 'https://example.test/mock-upload',
      object_path: `mock/${Date.now()}.jpg`,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    }
    return response as T
  }

  throw mockError(404, 'mock_not_implemented', `Mock route not implemented: ${method} ${rawPath}`)
}

function safeParse(raw: BodyInit): unknown {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function mockError(status: number, code: string, message: string): Error & {
  status: number
  code: string
} {
  const err = new Error(message) as Error & { status: number; code: string }
  err.status = status
  err.code = code
  return err
}
