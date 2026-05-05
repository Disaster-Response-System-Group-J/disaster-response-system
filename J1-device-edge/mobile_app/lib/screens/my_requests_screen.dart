import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/database_helper.dart';
import '../models/request_model.dart';
import '../widgets/offline_banner.dart';

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
        child: FutureBuilder<List<RequestModel>>(
          future: _databaseHelper.getRequests(
            userId: AuthService.instance.currentUser?.id,
          ),
          builder: (context, snapshot) {
            final List<RequestModel> requests =
                snapshot.data ?? const <RequestModel>[];

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  'My Requests',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                const OfflineBanner(),
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
                else if (requests.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Text('No requests saved yet'),
                    ),
                  )
                else
                  ...requests.map(
                    (request) => Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        title: Text(request.type),
                        subtitle: Text(
                          '${request.description}\nLocation: ${request.location}',
                        ),
                        isThreeLine: true,
                        trailing: _StatusBadge(status: request.status),
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
