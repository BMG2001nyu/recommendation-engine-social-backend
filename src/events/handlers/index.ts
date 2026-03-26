import { eventBus } from '../eventBus'
import { propagateEngagement } from '../../services'

export function registerEventHandlers(): void {
  // When interest is expressed, propagate through social graph
  eventBus.subscribe('interest_expressed', async (event) => {
    if (event.venueId) {
      try {
        propagateEngagement(event.userId, event.venueId,
          (event.metadata?.level as Parameters<typeof propagateEngagement>[2]) ?? 'interested')
      } catch (err) {
        console.error('[Handler] propagation failed:', err)
      }
    }
  })

  // When plan is confirmed, emit stronger signal
  eventBus.subscribe('plan_confirmed', async (event) => {
    if (event.venueId) {
      try {
        propagateEngagement(event.userId, event.venueId, 'confirmed')
      } catch (err) {
        console.error('[Handler] plan confirmation propagation failed:', err)
      }
    }
  })
}
