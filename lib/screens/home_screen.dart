import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    const bool isOnline = true;
    const int queuedItems = 3;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('J1 Dashboard', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.circle,
                          size: 12,
                          color: isOnline ? Colors.green : Colors.red,
                        ),
                        const SizedBox(width: 8),
                        Text(isOnline ? 'Online' : 'Offline'),
                      ],
                    ),
                    Text('Queue: $queuedItems'),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Welcome to J1 disaster response. Use tabs below to report or support requests.'),
          ],
        ),
      ),
    );
  }
}
