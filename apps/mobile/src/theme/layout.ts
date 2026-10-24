import { Platform, StatusBar } from 'react-native';

/** Alto aproximado de la barra de estado (sin depender de safe-area-context). */
export const statusBarPad = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 56;
