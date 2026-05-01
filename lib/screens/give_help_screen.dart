import 'package:flutter/material.dart';

class GiveHelpScreen extends StatelessWidget {
  const GiveHelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const requests = [
      {'title': 'Need clean water', 'location': 'Sector A', 'priority': 'High'},
      {'title': 'First-aid support', 'location': 'Sector B', 'priority': 'Medium'},
      {'title': 'Temporary shelter', 'location': 'Sector C', 'priority': 'High'},
    ];

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('Open Help Requests', style: Theme.of(context).textTheme.headlineSmall),
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: requests.length,
              itemBuilder: (context, index) {
                final item = requests[index];
                return ListTile(
                  title: Text(item['title']!),
                  subtitle: Text('${item['location']} - Priority: ${item['priority']}'),
                  trailing: TextButton(
                    onPressed: () {},
                    child: const Text('Respond'),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
