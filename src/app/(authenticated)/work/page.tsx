// Work queue — server-first. The page is an async Server Component that reads the
// queue through the `src/data/` seam (RLS-aware SSR client) and hands plain,
// serializable rows/stages to the client island, which owns the interactive UI
// (grouping, filter, search, collapse, optimistic status moves).

import { getWorkQueue } from '@/data/work'
import { WorkQueueClient } from '@/components/work/WorkQueueClient'

export default async function WorkPage() {
  const { rows, stages } = await getWorkQueue()
  return <WorkQueueClient rows={rows} stages={stages} />
}
