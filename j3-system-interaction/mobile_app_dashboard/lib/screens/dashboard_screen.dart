import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'package:mobile_app_dashboard/components/nav_bar.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    // Retrieve login arguments (currently unused in empty screen)
    // final args = ModalRoute.of(context)?.settings.arguments as Map<String, String>? ?? {};

    return Scaffold(
      body: Stack(
        children: [
          // ─── Background gradient ───
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topLeft,
                  radius: 1.8,
                  colors: [
                    Color(0x1AADC6FF),
                    AppColors.background,
                    AppColors.background,
                  ],
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: Container(color: Colors.black.withValues(alpha: 0.7)),
          ),

          Positioned.fill(child: Center(child: Text('Dashboard Placeholder', style: TextStyle(color: Colors.white54)))),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: BottomNav(
              currentIndex: currentIndex,
              onTap: (index) {
                if (index == currentIndex) return;
                setState(() {
                  currentIndex = index;
                });
                _navigateTo(context, index);
              },
            ),
          )
        ],
      ),
    );
  }



  void _navigateTo(BuildContext context, int index) {
    const routes = {
      0: '/dashboard',
      1: '/reports',
      2: '/map',
      3: '/resources',
      4: '/alerts',
    };
    final route = routes[index];
    if (route != null) {
      Navigator.pushReplacementNamed(context, route);
    }
  }
}
