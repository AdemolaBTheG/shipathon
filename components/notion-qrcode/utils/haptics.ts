import { Presets } from 'react-native-pulsar';

export const hapticSoft = () => {
  Presets.System.impactSoft();
};

export const hapticLight = () => {
  Presets.System.selection();
};

export const hapticMedium = () => {
  Presets.System.impactMedium();
};

export const hapticHeavy = () => {
  Presets.System.impactHeavy();
};

export const hapticSuccess = () => {
  Presets.System.notificationSuccess();
};
