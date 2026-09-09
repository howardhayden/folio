export function isLatticeRetryPending(retryAt, now) {
  return retryAt !== null && retryAt > now;
}

export function latticeRetryEta(retryAt, now, locale, mode = "manual") {
  const remainingSeconds = Math.max(0, Math.ceil((retryAt - now) / 1_000));
  if (remainingSeconds === 0) {
    return mode === "automatic" ? "The run is retrying now." : "You can try again now.";
  }

  let duration;
  if (remainingSeconds < 60) {
    duration = `${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"}`;
  } else {
    const totalMinutes = Math.ceil(remainingSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    duration = hours === 0
      ? `${minutes} minute${minutes === 1 ? "" : "s"}`
      : `${hours} hour${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} minute${minutes === 1 ? "" : "s"}` : ""}`;
  }

  const sameDay = new Date(retryAt).toDateString() === new Date(now).toDateString();
  const at = new Intl.DateTimeFormat(locale, sameDay
    ? { hour: "numeric", minute: "2-digit", second: remainingSeconds < 120 ? "2-digit" : undefined }
    : { weekday: "short", hour: "numeric", minute: "2-digit" }).format(retryAt);
  const action = mode === "automatic" ? "The run will retry" : "Try again";
  return `${action} in ${duration}. Estimated local time: ${at}.`;
}
