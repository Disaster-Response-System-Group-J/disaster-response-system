import 'dart:async';

import 'package:flutter/material.dart';

import '../services/database_helper.dart';
import '../services/network_service.dart';

class StatusBar extends StatefulWidget {
  const StatusBar({super.key});

  @override
  State<StatusBar> createState() => _StatusBarState();
}

class _StatusBarState extends State<StatusBar> {
  final DatabaseHelper _databaseHelper = DatabaseHelper.instance;
  Timer? _timer;

  bool _isOnline = false;
  int _queueCount = 0;
  DateTime? _lastUpdated;

  @override
  void initState() {
    super.initState();
    _refreshStatus();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      _refreshStatus();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refreshStatus() async {
    final online = await NetworkService.isOnline();
    final queueCount = await _databaseHelper.getQueueCount();

    if (!mounted) {
      return;
    }

    setState(() {
      _isOnline = online;
      _queueCount = queueCount;
      _lastUpdated = DateTime.now();
    });
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _isOnline ? Colors.green : Colors.red;

    return Card(
      elevation: 0,
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(
              _isOnline ? Icons.wifi : Icons.wifi_off,
              color: statusColor,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _isOnline ? 'Online' : 'Offline',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Queue count: $_queueCount',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            if (_lastUpdated != null)
              Text(
                'Updated ${TimeOfDay.fromDateTime(_lastUpdated!).format(context)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
          ],
        ),
      ),
    );
  }
}
