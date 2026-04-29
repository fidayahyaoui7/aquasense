import { createBrowserRouter } from "react-router";
import { SplashScreen } from "./components/screens/SplashScreen";
import { LoginScreen } from "./components/screens/LoginScreen";
import { RegisterScreen } from "./components/screens/RegisterScreen";
import { ResetPasswordScreen } from "./components/screens/ResetPasswordScreen";
import { OnboardingScreen } from "./components/screens/OnboardingScreen";
import { LocationScreen } from "./components/screens/LocationScreen";
import { DashboardScreen } from "./components/screens/DashboardScreen";
import { AlertsScreen } from "./components/screens/AlertsScreen";
import { HistoryScreen } from "./components/screens/HistoryScreen";
import { ProfileScreen } from "./components/screens/ProfileScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: SplashScreen,
  },
  {
    path: "/login",
    Component: LoginScreen,
  },
  {
    path: "/register",
    Component: RegisterScreen,
  },
  {
    path: "/reset-password",
    Component: ResetPasswordScreen,
  },
  {
    path: "/onboarding",
    Component: OnboardingScreen,
  },
  {
    path: "/location",
    Component: LocationScreen,
  },
  {
    path: "/dashboard",
    Component: DashboardScreen,
  },
  {
    path: "/alerts",
    Component: AlertsScreen,
  },
  {
    path: "/history",
    Component: HistoryScreen,
  },
  {
    path: "/profile",
    Component: ProfileScreen,
  },
  {
    path: "/settings",
    Component: SettingsScreen,
  },
]);