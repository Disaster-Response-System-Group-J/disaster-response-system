import 'dart:convert';

import 'package:flutter/material.dart';

import '../models/event_model.dart';
import '../services/auth_service.dart';
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
          future: _databaseHelper.getHelpRequests(
            excludeUserId: AuthService.instance.currentUser?.id,
          ),
          builder: (context, snapshot) {
            final requests = snapshot.data ?? const <EventModel>[];

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
                  'Open help requests from the local queue. Your own requests are hidden here.',
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

  Future<void> _claimRequest(EventModel event) async {
    final currentUser = AuthService.instance.currentUser;
    if (currentUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign in to claim a request')),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Claim request?'),
            content: Text(
              'Are you sure you want to claim "${_requestTitle(event)}"?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Claim'),
              ),
            ],
          ),
        ) ??
        false;

    if (!confirmed) {
      return;
    }

    final updated = await _databaseHelper.claimHelpRequest(
      eventId: event.eventId,
      claimedByUserId: currentUser.id,
      claimedByUserName: currentUser.name,
    );

    if (!mounted) {
      return;
    }

    if (updated == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This request was already claimed or is unavailable'),
        ),
      );
      setState(() {});
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Claimed ${_requestTitle(event)}'),
      ),
    );
    setState(() {});
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
    final latitude = _formatCoordinate(data['latitude']);
    final longitude = _formatCoordinate(data['longitude']);
    final peopleCount = data['people_count']?.toString() ?? '1';
    final mobility = data['mobility_support_required'] == true ? 'Yes' : 'No';
    final injuries = data['injuries_reported'] == true ? 'Yes' : 'No';
    final priority = injuries == 'Yes' ? 'High' : 'Medium';
    final isClaimed = event.status == 'CLAIMED';

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
                if (latitude != null) _InfoChip(label: 'Latitude', value: latitude),
                if (longitude != null) _InfoChip(label: 'Longitude', value: longitude),
                _InfoChip(label: 'People', value: peopleCount),
                _InfoChip(label: 'Mobility', value: mobility),
                _InfoChip(label: 'Injuries', value: injuries),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: isClaimed
                      ? FilledButton.icon(
                          onPressed: null,
                          icon: const Icon(Icons.check_circle_outline),
                          label: Text(
                            event.claimedByUserName == null || event.claimedByUserName!.isEmpty
                                ? 'Claimed'
                                : 'Claimed by ${event.claimedByUserName}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        )
                      : FilledButton(
                          onPressed: onClaim,
                          child: const Text('I Can Help'),
                        ),
                  ),
              ],
            ),
            if (isClaimed && event.claimedAt != null) ...[
              const SizedBox(height: 8),
              Text(
                'Claimed at ${event.claimedAt}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
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

  String? _formatCoordinate(dynamic value) {
    if (value == null) {
      return null;
    }

    if (value is num) {
      return value.toStringAsFixed(6);
    }

    final parsed = double.tryParse(value.toString());
    if (parsed == null) {
      return null;
    }
    return parsed.toStringAsFixed(6);
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
