import 'dart:async';

import 'package:flutter/material.dart';

import '../screens/home_screen.dart';
import '../screens/my_requests_screen.dart';
import '../screens/report_screen.dart';
import '../screens/resources_screen.dart';
import '../screens/settings_screen.dart';
import '../services/auth_service.dart';
import '../services/database_helper.dart';

class MainTabController extends StatefulWidget {
  const MainTabController({super.key});

  @override
  State<MainTabController> createState() => _MainTabControllerState();
}

class _MainTabControllerState extends State<MainTabController> {
  int _selectedIndex = 0;
  final DatabaseHelper _databaseHelper = DatabaseHelper.instance;
  Timer? _timer;
  int _queueCount = 0;

  final List<Widget> _screens = const [
    HomeScreen(),
    ReportScreen(),
    MyRequestsScreen(),
    ResourcesScreen(),
    SettingsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _refreshQueueCount();
      _timer = Timer.periodic(
        const Duration(seconds: 5),
        (_) {
          _refreshQueueCount();
        },
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _onTabSelected(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  Future<void> _refreshQueueCount() async {
    final count = await _databaseHelper.getQueueCount();
    if (!mounted) {
      return;
    }
    setState(() {
      _queueCount = count;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
      valueListenable: AuthService.instance.currentUserNotifier,
      builder: (context, user, _) {
        return Scaffold(
          appBar: AppBar(
            title: Text(
              user == null ? 'J1 Disaster Response' : 'Welcome, ${user.name}',
            ),
            actions: [
              IconButton(
                tooltip: 'Sign out',
                onPressed: () {
                  AuthService.instance.logout();
                },
                icon: const Icon(Icons.logout),
              ),
            ],
          ),
          body: IndexedStack(
            index: _selectedIndex,
            children: _screens,
          ),
          bottomNavigationBar: BottomNavigationBar(
            type: BottomNavigationBarType.fixed,
            currentIndex: _selectedIndex,
            onTap: _onTabSelected,
            items: [
              const BottomNavigationBarItem(
                icon: Icon(Icons.home_outlined),
                activeIcon: Icon(Icons.home),
                label: 'Home',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: _queueCount > 0,
                  label: Text('$_queueCount'),
                  child: const Icon(Icons.edit_note_outlined),
                ),
                activeIcon: Badge(
                  isLabelVisible: _queueCount > 0,
                  label: Text('$_queueCount'),
                  child: const Icon(Icons.edit_note),
                ),
                label: 'Report',
              ),
              BottomNavigationBarItem(
                icon: Badge(
                  isLabelVisible: _queueCount > 0,
                  label: Text('$_queueCount'),
                  child: const Icon(Icons.list_alt_outlined),
                ),
                activeIcon: Badge(
                  isLabelVisible: _queueCount > 0,
                  label: Text('$_queueCount'),
                  child: const Icon(Icons.list_alt),
                ),
                label: 'My Requests',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.local_hospital_outlined),
                activeIcon: Icon(Icons.local_hospital),
                label: 'Resources',
              ),
              const BottomNavigationBarItem(
                icon: Icon(Icons.settings_outlined),
                activeIcon: Icon(Icons.settings),
                label: 'Settings',
              ),
            ],
          ),
        );
      },
    );
  }
}
