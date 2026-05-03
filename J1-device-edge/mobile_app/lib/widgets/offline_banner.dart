import 'dart:async';

import 'package:flutter/material.dart';

import '../services/database_helper.dart';
import '../services/network_service.dart';

class OfflineBanner extends StatefulWidget {
  const OfflineBanner({super.key});

  @override
  State<OfflineBanner> createState() => _OfflineBannerState();
}

class _OfflineBannerState extends State<OfflineBanner> {
  final DatabaseHelper _databaseHelper = DatabaseHelper.instance;
  Timer? _timer;
  bool _isOnline = true;
  int _queueCount = 0;

  @override
  void initState() {
    super.initState();
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _refresh());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    final online = await NetworkService.isOnline();
    final queueCount = await _databaseHelper.getQueueCount();

    if (!mounted) {
      return;
    }

    setState(() {
      _isOnline = online;
      _queueCount = queueCount;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isOnline) {
      return Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.green.shade200),
        ),
        child: Row(
          children: [
            Icon(Icons.wifi, color: Colors.green.shade700, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Online. $_queueCount item${_queueCount == 1 ? '' : 's'} waiting in the queue.',
                style: TextStyle(color: Colors.green.shade900),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.wifi_off, color: Colors.orange.shade800, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Offline. $_queueCount item${_queueCount == 1 ? '' : 's'} will sync when connection returns.',
              style: TextStyle(color: Colors.orange.shade900),
            ),
          ),
        ],
      ),
    );
  }
}
