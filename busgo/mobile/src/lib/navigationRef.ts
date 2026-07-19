import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../nav';

/** Root navigation handle usable outside React components (tray-notification taps). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
