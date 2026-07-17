import React from 'react';
import { StatusBar, Text } from 'react-native';
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

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Trips: '🎫',
  Deals: '🏷️',
  Alerts: '🔔',
  Profile: '👤',
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== 'Home',
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{TAB_ICONS[route.name] || '•'}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Trips" component={TripsScreen} options={{ title: 'My Trips' }} />
      <Tab.Screen name="Deals" component={DealsScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNav() {
  const { user, ready } = useAuth();
  if (!ready) return null;

  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleStyle: { fontWeight: '800' },
        headerTintColor: colors.text,
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Buses & journeys' }} />
          <Stack.Screen name="Seats" component={SeatsScreen} options={{ title: 'Choose seats' }} />
          <Stack.Screen name="TransitSeats" component={TransitSeatsScreen} options={{ title: 'Seats per bus' }} />
          <Stack.Screen name="Passenger" component={PassengerScreen} options={{ title: 'Passenger' }} />
          <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
          <Stack.Screen
            name="Confirmation"
            component={ConfirmationScreen}
            options={{ title: 'Confirmed', headerBackVisible: false, gestureEnabled: false }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    primary: colors.primary,
    card: '#ffffff',
    text: colors.text,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={theme}>
          <StatusBar barStyle="dark-content" />
          <RootNav />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
