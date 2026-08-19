export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === "expo-sharing") {
      return "/add?incomingShare=1";
    }

    return path;
  } catch {
    return "/";
  }
}
