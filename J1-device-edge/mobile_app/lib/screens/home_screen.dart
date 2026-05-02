import 'package:flutter/material.dart';

import '../widgets/status_bar.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('J1 Dashboard', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          const StatusBar(),
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Welcome',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use the tabs below to report incidents, submit help requests, and review queued items.',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
