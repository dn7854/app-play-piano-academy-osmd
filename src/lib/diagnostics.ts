import * as FileSystem from "expo-file-system/legacy";

const JS_FILE = "d8r-diagnostics-js.log";
const NATIVE_FILE = "d8r-diagnostics-native.log";
const MAX = 180_000;

let chain: Promise<void> = Promise.resolve();
let installed = false;

function filePath(name: string) {
  const dir = FileSystem.documentDirectory;
  return dir ? `${dir}${name}` : null;
}

export function diagnosticText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** Append one line. Native exceptions land in a sibling file written by the React Native patch. */
export function recordDiagnostic(kind: string, message: string) {
  const file = filePath(JS_FILE);
  if (!file) return;
  const line = `${new Date().toISOString()} [${kind}] ${message.replace(/\s+/g, " ").slice(0, 600)}\n`;
  chain = chain.then(async () => {
    try {
      const info = await FileSystem.getInfoAsync(file);
      let prev = "";
      if (info.exists) prev = await FileSystem.readAsStringAsync(file);
      let next = prev + line;
      if (next.length > MAX) next = next.slice(next.length - MAX);
      await FileSystem.writeAsStringAsync(file, next);
    } catch {
      // The log must not take down playback.
    }
  });
}

export async function readDiagnostics() {
  await chain;
  const parts: string[] = [];
  for (const name of [NATIVE_FILE, JS_FILE]) {
    const file = filePath(name);
    if (!file) continue;
    try {
      const info = await FileSystem.getInfoAsync(file);
      if (!info.exists) continue;
      const text = await FileSystem.readAsStringAsync(file);
      if (text.trim()) parts.push(text.trim());
    } catch {
      // Skip a file that cannot be read.
    }
  }
  const lines = parts.join("\n").split("\n").filter(Boolean);
  lines.sort();
  return lines.join("\n");
}

export function installDiagnostics() {
  if (installed) return;
  installed = true;
  const host = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const previous = host.ErrorUtils?.getGlobalHandler?.();
  host.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    recordDiagnostic("js", `${isFatal ? "fatal" : "error"} ${diagnosticText(error)}`);
    previous?.(error, isFatal);
  });
  try {
    const tracking = require("promise/setimmediate/rejection-tracking") as {
      enable: (options: {
        allRejections: boolean;
        onUnhandled: (id: number, rejection: unknown) => void;
        onHandled: (id: number) => void;
      }) => void;
    };
    const options = require("react-native/Libraries/promiseRejectionTrackingOptions").default as {
      onUnhandled: (id: number, rejection: unknown) => void;
      onHandled: (id: number) => void;
    };
    tracking.enable({
      allRejections: true,
      onUnhandled: (id, rejection) => {
        recordDiagnostic("rejection", diagnosticText(rejection));
        options.onUnhandled(id, rejection);
      },
      onHandled: (id) => options.onHandled(id),
    });
  } catch {
    // React Native already reports rejections when this hook is unavailable.
  }
  recordDiagnostic("app", "diagnostics ready");
}
