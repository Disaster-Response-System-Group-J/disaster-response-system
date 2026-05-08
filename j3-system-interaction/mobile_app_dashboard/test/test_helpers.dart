import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_app_dashboard/screens/alerts_screen.dart';
import 'package:mobile_app_dashboard/screens/dashboard_screen.dart';
import 'package:mobile_app_dashboard/screens/login_screen.dart';
import 'package:mobile_app_dashboard/screens/map_screen.dart';
import 'package:mobile_app_dashboard/screens/reports_screen.dart';
import 'package:mobile_app_dashboard/screens/resources_screen.dart';
import 'package:mobile_app_dashboard/theme/app_theme.dart';

void configureTestFonts() {
  GoogleFonts.config.allowRuntimeFetching = false;
}

Widget buildTestApp({
  required Widget home,
  String initialRoute = '/',
}) {
  return MaterialApp(
    theme: AppTheme.darkTheme,
    initialRoute: initialRoute,
    routes: {
      '/': (_) => home,
      '/login': (_) => const LoginScreen(),
      '/dashboard': (_) => const DashboardScreen(),
      '/reports': (_) => const ReportsScreen(),
      '/map': (_) => const MapScreen(),
      '/resources': (_) => const ResourcesScreen(),
      '/alerts': (_) => const AlertsScreen(),
    },
  );
}
