import 'package:flutter/material.dart';

class MyRequestsScreen extends StatelessWidget {
  const MyRequestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const myRequests = [
      {'title': 'Medical kit needed', 'status': 'Pending'},
      {'title': 'Food supply request', 'status': 'In Progress'},
      {'title': 'Evacuation transport', 'status': 'Resolved'},
    ];

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('My Requests', style: Theme.of(context).textTheme.headlineSmall),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: myRequests.length,
              itemBuilder: (context, index) {
                final item = myRequests[index];
                return ListTile(
                  title: Text(item['title']!),
                  subtitle: Text('Status: ${item['status']}'),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
