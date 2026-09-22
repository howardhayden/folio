export const FROSTED_STATE_DURATION_MS = 180;

export function createFrostedStateTransition({
  cancelFrame,
  clearTimer,
  durationFor,
  initialValue,
  onDisplayed,
  onFrosted,
  onPhase,
  onSelected,
  requestFrame,
  setTimer,
}) {
  let displayed = initialValue;
  let target = initialValue;
  let timer = null;
  let frame = null;
  let disposed = false;

  const cancelPending = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    if (frame !== null) {
      cancelFrame(frame);
      frame = null;
    }
  };

  const select = (nextValue) => {
    if (disposed) return;
    target = nextValue;
    onSelected(nextValue);
    cancelPending();

    if (nextValue === displayed) {
      onFrosted(false);
      onPhase("stable");
      return;
    }

    const duration = durationFor(FROSTED_STATE_DURATION_MS);
    if (duration === 0) {
      displayed = nextValue;
      onDisplayed(nextValue);
      onFrosted(false);
      onPhase("stable");
      return;
    }

    onFrosted(true);
    onPhase("outgoing");
    timer = setTimer(() => {
      timer = null;
      displayed = target;
      onDisplayed(displayed);
      onPhase("incoming");
      frame = requestFrame(() => {
        frame = requestFrame(() => {
          frame = null;
          onFrosted(false);
          timer = setTimer(() => {
            timer = null;
            onPhase("stable");
          }, duration);
        });
      });
    }, duration);
  };

  const dispose = () => {
    disposed = true;
    cancelPending();
  };

  return Object.freeze({ dispose, select });
}
