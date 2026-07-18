import React from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/store/auth';
import { colors } from './src/theme';
import type { RootStackParamList } from './src/nav';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import SeatsScreen from './src/screens/SeatsScreen';
import TransitSeatsScreen from './src/screens/TransitSeatsScreen';
import PassengerScreen from './src/screens/PassengerScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import ConfirmationScreen from './src/screens/ConfirmationScreen';
import TripsScreen from './src/screens/TripsScreen';
import DealsScreen from './src/screens/DealsScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import BookingDetailScreen from './src/screens/BookingDetailScreen';
import TicketDetailScreen from './src/screens/TicketDetailScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = { Home: 'home-outline', Trips: 'ticket-outline', Deals: 'pricetag-outline', Alerts: 'notifications-outline', Profile: 'person-outline' };

function Tabs() {
  return <Tab.Navigator screenOptions={({ route }) => ({
    headerShown: route.name !== 'Home', headerTitleStyle: { fontWeight: '800' },
    tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.faint,
    tabBarLabelStyle: { fontWeight: '700', fontSize: 11 }, tabBarStyle: { height: 62, paddingTop: 5, paddingBottom: 7 },
    tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name] || 'ellipse-outline'} size={size} color={color} />,
  })}>
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Trips" component={TripsScreen} options={{ title: 'My Trips' }} />
    <Tab.Screen name="Deals" component={DealsScreen} />
    <Tab.Screen name="Alerts" component={AlertsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>;
}

function RootNav() {
  const { user, ready } = useAuth();
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  return <Stack.Navigator screenOptions={{ headerTitleStyle: { fontWeight: '800' }, headerTintColor: colors.text, headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: colors.bg } }}>
    {!user ? <><Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} /><Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} /></> : <>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Available journeys' }} />
      <Stack.Screen name="Seats" component={SeatsScreen} options={{ title: 'Choose seats' }} />
      <Stack.Screen name="TransitSeats" component={TransitSeatsScreen} options={{ title: 'Seats for each bus' }} />
      <Stack.Screen name="Passenger" component={PassengerScreen} options={{ title: 'Passengers' }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Secure payment', gestureEnabled: false }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking details' }} />
      <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'E-ticket' }} />
      <Stack.Screen name="Confirmation" component={ConfirmationScreen} options={{ title: 'Confirmed', headerBackVisible: false, gestureEnabled: false }} />
    </>}
  </Stack.Navigator>;
}

const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.primary, card: '#fff', text: colors.text, border: colors.border } };
export default function App() { return <SafeAreaProvider><AuthProvider><NavigationContainer theme={navigationTheme}><StatusBar barStyle="dark-content" /><RootNav /></NavigationContainer></AuthProvider></SafeAreaProvider>; }
