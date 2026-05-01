import 'package:flutter/material.dart';
import 'navigation/main_tab_controller.dart';
import 'services/test.dart';

void main() {
  runApp(const J1App());
  // Run the database test on app startup
  Day1DatabaseTest.runTest();
}

class J1App extends StatelessWidget {
  const J1App({super.key});


  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'J1 Disaster Response',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
      ),
      home: const MainTabController(),
    );
  }
}
