import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/store/auth';
import { colors } from './src/theme';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TripsScreen from './src/screens/TripsScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import ManageScreen from './src/screens/ManageScreen';
import BusesScreen from './src/screens/BusesScreen';
import RoutesScreen from './src/screens/RoutesScreen';
import TransitRoutesScreen from './src/screens/TransitRoutesScreen';
import DealsScreen from './src/screens/DealsScreen';
import FillSeatsScreen from './src/screens/FillSeatsScreen';
import NotifyScreen from './src/screens/NotifyScreen';

export type OperatorStackParamList = {
  Tabs: undefined;
  Buses: undefined;
  Routes: undefined;
  TransitRoutes: undefined;
  Deals: undefined;
  FillSeats: undefined;
  Notify: undefined;
};

const Stack = createNativeStackNavigator<OperatorStackParamList>();
const Tab = createBottomTabNavigator();
const TAB_ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  Dashboard: { active: 'grid', idle: 'grid-outline' },
  Trips: { active: 'bus', idle: 'bus-outline' },
  Bookings: { active: 'briefcase', idle: 'briefcase-outline' },
  Analytics: { active: 'bar-chart', idle: 'bar-chart-outline' },
  Manage: { active: 'settings', idle: 'settings-outline' },
};

function Tabs() {
  return <Tab.Navigator screenOptions={({ route }) => ({
    headerShown: route.name !== 'Dashboard', headerTitleStyle: { fontWeight: '800' },
    tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.faint,
    tabBarLabelStyle: { fontWeight: '700', fontSize: 11, marginBottom: 2 }, tabBarStyle: { height: 78, paddingTop: 8, paddingBottom: 14 },
    tabBarIcon: ({ color, size, focused }) => {
      const icons = TAB_ICONS[route.name];
      return <Ionicons name={icons ? (focused ? icons.active : icons.idle) : 'ellipse-outline'} size={size} color={color} />;
    },
  })}>
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Trips" component={TripsScreen} options={{ title: 'Trips' }} />
    <Tab.Screen name="Bookings" component={BookingsScreen} />
    <Tab.Screen name="Analytics" component={AnalyticsScreen} />
    <Tab.Screen name="Manage" component={ManageScreen} />
  </Tab.Navigator>;
}

function RootNav() {
  const { user, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!user) return <LoginScreen />;
  return <Stack.Navigator screenOptions={{ headerTitleStyle: { fontWeight: '800' }, headerTintColor: colors.text, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: colors.bg } }}>
    <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
    <Stack.Screen name="Buses" component={BusesScreen} options={{ title: 'My buses' }} />
    <Stack.Screen name="Routes" component={RoutesScreen} options={{ title: 'My routes' }} />
    <Stack.Screen name="TransitRoutes" component={TransitRoutesScreen} options={{ title: 'Transit routes' }} />
    <Stack.Screen name="Deals" component={DealsScreen} options={{ title: 'Deals & promos' }} />
    <Stack.Screen name="FillSeats" component={FillSeatsScreen} options={{ title: 'Fill empty seats' }} />
    <Stack.Screen name="Notify" component={NotifyScreen} options={{ title: 'Message passengers' }} />
  </Stack.Navigator>;
}

const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary, card: '#fff', text: colors.text, border: colors.border } };
export default function App() {
  return <SafeAreaProvider><AuthProvider><NavigationContainer theme={navigationTheme}><StatusBar style="dark" /><RootNav /></NavigationContainer></AuthProvider></SafeAreaProvider>;
}
