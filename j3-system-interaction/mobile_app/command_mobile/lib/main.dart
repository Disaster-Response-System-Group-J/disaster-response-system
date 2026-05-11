import 'package:flutter/material.dart';
import 'package:command_mobile/screens/dashboard_screen.dart';
import 'package:command_mobile/screens/login_screen.dart';
import 'package:command_mobile/screens/alerts_screen.dart';
import 'package:command_mobile/screens/reports_screen.dart';
import 'package:command_mobile/screens/map_screen.dart';
import 'package:command_mobile/screens/resources_screen.dart';
import 'package:command_mobile/theme/app_theme.dart';

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


