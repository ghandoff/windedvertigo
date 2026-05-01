/**
 * Re-export shim — slot generation algorithm lives in @windedvertigo/booking.
 * This file preserves all existing import paths within site/.
 */
export type { Interval, HostBusy, Slot } from "@windedvertigo/booking";
export {
  mergeIntervals,
  subtractIntervals,
  padBusy,
  containsInterval,
  expandWorkingHours,
  ceilToStep,
  generateSlots,
} from "@windedvertigo/booking";
