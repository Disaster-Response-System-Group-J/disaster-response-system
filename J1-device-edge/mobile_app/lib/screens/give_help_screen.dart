import 'dart:convert';

import 'package:flutter/material.dart';

import '../models/event_model.dart';
import '../screens/map_view.dart';
import '../services/database_helper.dart';
import '../widgets/offline_banner.dart';

class GiveHelpScreen extends StatefulWidget {
  const GiveHelpScreen({super.key});

  @override
  State<GiveHelpScreen> createState() => _GiveHelpScreenState();
}

class _GiveHelpScreenState extends State<GiveHelpScreen> {
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
          future: _databaseHelper.getQueuedEvents(),
          builder: (context, snapshot) {
            final requests = (snapshot.data ?? const <EventModel>[])
                .where((event) => event.type == 'HELP_REQUEST')
                .toList();

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'Give Help',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                const OfflineBanner(),
                Text(
                  'Open help requests from the local queue. Tap a request to inspect it or claim it.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (context) => const MapView(),
                        ),
                      );
                    },
                    icon: const Icon(Icons.map_outlined),
                    label: const Text('Open Incident Map'),
                  ),
                ),
                const SizedBox(height: 16),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (requests.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Text('No open help requests yet'),
                    ),
                  )
                else
                  ...requests.map(
                    (event) => _HelpRequestCard(
                      event: event,
                      onClaim: () => _claimRequest(event),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }

  void _claimRequest(EventModel event) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Claimed ${_requestTitle(event)}'),
      ),
    );
  }

  String _requestTitle(EventModel event) {
    try {
      final data = jsonDecode(event.data);
      if (data is Map<String, dynamic>) {
        final type = data['request_type'] ?? 'Help request';
        return type.toString();
      }
    } catch (_) {
      // Ignore malformed JSON and fall back to type.
    }
    return event.type;
  }
}

class _HelpRequestCard extends StatelessWidget {
  const _HelpRequestCard({
    required this.event,
    required this.onClaim,
  });

  final EventModel event;
  final VoidCallback onClaim;

  @override
  Widget build(BuildContext context) {
    final data = _decodedData(event.data);
    final requestType = data['request_type']?.toString() ?? 'Help Request';
    final description = data['description']?.toString() ?? 'No description';
    final location = data['location']?.toString() ?? 'Unknown location';
    final peopleCount = data['people_count']?.toString() ?? '1';
    final mobility = data['mobility_support_required'] == true ? 'Yes' : 'No';
    final injuries = data['injuries_reported'] == true ? 'Yes' : 'No';
    final priority = injuries == 'Yes' ? 'High' : 'Medium';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        requestType,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        description,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                _PriorityChip(priority: priority),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoChip(label: 'Location', value: location),
                _InfoChip(label: 'People', value: peopleCount),
                _InfoChip(label: 'Mobility', value: mobility),
                _InfoChip(label: 'Injuries', value: injuries),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                TextButton.icon(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Viewed ${requestType.toLowerCase()}')),
                    );
                  },
                  icon: const Icon(Icons.visibility_outlined),
                  label: const Text('Inspect'),
                ),
                const Spacer(),
                FilledButton(
                  onPressed: onClaim,
                  child: const Text('I Can Help'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Map<String, dynamic> _decodedData(String payload) {
    try {
      final decoded = jsonDecode(payload);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // Ignore malformed JSON.
    }
    return <String, dynamic>{};
  }
}

class _PriorityChip extends StatelessWidget {
  const _PriorityChip({required this.priority});

  final String priority;

  @override
  Widget build(BuildContext context) {
    final color = priority == 'High' ? Colors.red.shade700 : Colors.orange.shade700;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$priority Priority',
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text('$label: $value'),
    );
  }
}
