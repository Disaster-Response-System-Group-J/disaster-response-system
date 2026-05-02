import 'dart:convert';

import 'package:flutter/material.dart';

import '../services/database_helper.dart';
import '../models/event_model.dart';

class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  final DatabaseHelper _databaseHelper = DatabaseHelper.instance;

  Future<void> _refresh() async {
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<EventModel>>(
          future: _databaseHelper.getAllEvents(),
          builder: (context, snapshot) {
            final List<EventModel> events =
                snapshot.data ?? const <EventModel>[];

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'My Requests',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'All locally stored events from SQLite.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (events.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Text('No requests saved yet'),
                    ),
                  )
                else
                  ...events.map(
                    (event) => Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        title: Text(_eventTitle(event)),
                        subtitle: Text(
                          '${_summaryFor(event)}\nCreated: ${event.timestampCreated}',
                        ),
                        isThreeLine: true,
                        trailing: _StatusBadge(status: event.status),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  String _eventTitle(EventModel event) {
    return switch (event.type) {
      'HELP_REQUEST' => 'Help Request',
      'DATA_REPORT' => 'Data Report',
      _ => event.type,
    };
  }

  String _summaryFor(EventModel event) {
    try {
      final data = jsonDecode(event.data);
      if (data is Map<String, dynamic>) {
        final requestType = data['request_type'] ?? data['data_type'];
        final description = data['description'];
        final location = data['location'];

        final parts = <String>[
          if (requestType != null) 'Type: $requestType',
          if (location != null) 'Location: $location',
          if (description != null) 'Description: $description',
        ];

        if (parts.isNotEmpty) {
          return parts.join(' | ');
        }
      }
    } catch (_) {
      // Fall back to the raw payload below.
    }

    return event.data;
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (status) {
      'QUEUED' => (Colors.orange.shade100, Colors.orange.shade900),
      'SUBMITTED' => (Colors.green.shade100, Colors.green.shade900),
      'FAILED' => (Colors.red.shade100, Colors.red.shade900),
      _ => (Colors.blueGrey.shade100, Colors.blueGrey.shade900),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: fg,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
