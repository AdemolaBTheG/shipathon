import { Presets, Settings } from "react-native-pulsar";

let didPreload = false;

export function preloadAppHaptics() {
  if (didPreload) return;
  didPreload = true;
  Settings.preloadPresets([
    "Pip",
    "Nudge",
    "Latch",
    "Sweep",
    "Rebound",
    "Snap",
    "Peck",
  ]);
}

export const appHaptics = {
  add() {
    Presets.latch();
  },
  back() {
    Presets.System.selection();
  },
  confirm() {
    Presets.latch();
  },
  error() {
    Presets.System.notificationError();
  },
  focus() {
    Presets.pip();
  },
  menuOpen() {
    Presets.pip();
  },
  menuSelect() {
    Presets.System.selection();
  },
  navigate() {
    Presets.System.selection();
  },
  paywall() {
    Presets.pip();
  },
  primary() {
    Presets.nudge();
  },
  shuffle() {
    Presets.sweep();
  },
  start() {
    Presets.rebound();
  },
  success() {
    Presets.System.notificationSuccess();
  },
  warning() {
    Presets.System.notificationWarning();
  },
};
