type NavigatorFn = (id: string, text: string) => void;

const navigators: Partial<Record<string, NavigatorFn>> = {};

export function registerNavigator(mode: string, fn: NavigatorFn) {
  navigators[mode] = fn;
}

export function unregisterNavigator(mode: string) {
  delete navigators[mode];
}

export function navigateToHeading(id: string, text: string, currentMode: string) {
  navigators[currentMode]?.(id, text);
}
