let alertFn: ((message: string, title?: string) => void) | null =
  null;

export function registerAlert(
  fn: (message: string, title?: string) => void
) {
  alertFn = fn;
}

export function alert(message: string, title?: string) {
  alertFn?.(message, title);
}
