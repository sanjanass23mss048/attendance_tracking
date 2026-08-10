import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ClassesScreen from './src/screens/ClassesScreen';
import AttendanceScreen from './src/screens/AttendanceScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { colors } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primaryDark },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => {
          const name =
            route.name === 'Home'
              ? 'grid-outline'
              : route.name === 'Classes'
                ? 'school-outline'
                : 'settings-outline';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Classes" component={ClassesScreen} options={{ title: 'My Classes' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { booting, isLoggedIn } = useAuth();

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {isLoggedIn ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Attendance"
            component={AttendanceScreen}
            options={{
              headerStyle: { backgroundColor: colors.primaryDark },
              headerTintColor: '#fff',
            }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
