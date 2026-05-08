import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';

import 'navigation/main_tab_controller.dart';
import 'screens/auth_gate.dart';
import 'services/auth_service.dart';
import 'services/database_helper.dart';
import 'services/gps_service.dart';
import 'services/network_service.dart';
import 'services/resource_service.dart';
import 'services/sync_service.dart';

void main() {
  if (kIsWeb) {
    databaseFactory = databaseFactoryFfiWeb;
  } else if (defaultTargetPlatform == TargetPlatform.windows || defaultTargetPlatform == TargetPlatform.linux || defaultTargetPlatform == TargetPlatform.macOS) {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  }
  WidgetsFlutterBinding.ensureInitialized();
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
      home: const StartupGate(),
    );
  }
}

enum _StartupPhase {
  loading,
  ready,
  error,
}

class StartupGate extends StatefulWidget {
  const StartupGate({super.key});

  @override
  State<StartupGate> createState() => _StartupGateState();
}

class _StartupGateState extends State<StartupGate> with WidgetsBindingObserver {
  _StartupPhase _phase = _StartupPhase.loading;
  String _status = 'Starting...';
  String? _error;

  SyncService? _syncService;

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addObserver(this);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initialize();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(NetworkService.checkConnection());
      unawaited(_syncService?.syncQueuedEvents() ?? Future<void>.value());
      // Refresh resources when app resumes
      unawaited(
        Future.microtask(() async {
          try {
            await ResourceService.instance.fetchAndCacheResources();
          } catch (e) {
            print('Error refreshing resources: $e');
          }
        }),
      );
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _syncService?.stop();
    super.dispose();
  }

  Future<void> _initialize() async {
    if (!mounted) {
      return;
    }

    setState(() {
      _phase = _StartupPhase.loading;
      _error = null;
      _status = 'Initializing services...';
    });

    try {
      setState(() {
        _status = 'Checking network...';
      });
      NetworkService.startListening();
      unawaited(NetworkService.checkConnection());

      setState(() {
        _status = 'Opening local database...';
      });
      await DatabaseHelper.instance.database;

      setState(() {
        _status = 'Warming up GPS...';
      });
      unawaited(GpsService.warmUp());

      setState(() {
        _status = 'Loading session...';
      });
      await AuthService.instance.initialize();

      setState(() {
        _status = 'Connecting sync service...';
      });
      _syncService ??= SyncService();
      await _syncService!.start();

      // Initialize resources (non-blocking)
      unawaited(
        Future.microtask(() async {
          try {
            await ResourceService.instance.fetchAndCacheResources();
            print('Resources initialized');
          } catch (e) {
            print('Error initializing resources: $e');
          }
        }),
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _phase = _StartupPhase.ready;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _phase = _StartupPhase.error;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_phase == _StartupPhase.ready) {
      return ValueListenableBuilder(
        valueListenable: AuthService.instance.currentUserNotifier,
        builder: (context, user, _) {
          if (user == null) {
            return const AuthGate();
          }
          return const MainTabController();
        },
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_phase == _StartupPhase.loading) ...[
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    _status,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ] else ...[
                  Text(
                    'Startup failed',
                    style: Theme.of(context).textTheme.titleLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  if (_error != null)
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _initialize,
                    child: const Text('Retry'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
