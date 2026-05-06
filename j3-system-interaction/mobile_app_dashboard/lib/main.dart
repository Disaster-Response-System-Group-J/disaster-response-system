import 'package:flutter/material.dart';
import 'package:mobile_app_dashboard/screens/dashboard_screen.dart';
import 'package:mobile_app_dashboard/screens/login_screen.dart';
import 'package:mobile_app_dashboard/screens/alerts_screen.dart';
import 'package:mobile_app_dashboard/screens/reports_screen.dart';
import 'package:mobile_app_dashboard/screens/map_screen.dart';
import 'package:mobile_app_dashboard/screens/resources_screen.dart';
import 'package:mobile_app_dashboard/theme/app_theme.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Disaster Response',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/dashboard': (context) => const DashboardScreen(),
        '/reports': (context) => const ReportsScreen(),
        '/map': (context) => const MapScreen(),
        '/resources': (context) => const ResourcesScreen(),
        '/alerts': (context) => const AlertsScreen(),
      },
    );
  }
}


