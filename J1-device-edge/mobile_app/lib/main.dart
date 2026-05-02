import 'package:flutter/material.dart';
import 'navigation/main_tab_controller.dart';
import 'services/test.dart';
import 'services/mqtt_client_service.dart';
import 'services/sync_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Day1DatabaseTest.runTest();
  final mqttService = MqttClientService();
  await mqttService.connect();
  mqttService.publish("Test message from J1");

  final syncService = SyncService();
  await syncService.start();



  runApp(const J1App());
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