// Ownership prevents the paused talk player's effects from replacing timer controls.
let owned = false;
const listeners = new Set<() => void>();
export const timerOwnsMedia = () => owned;
export const subscribeTimerMedia = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function setTimerMediaOwner(value: boolean) {
  owned = value;
  for (const listener of listeners) listener();
}
