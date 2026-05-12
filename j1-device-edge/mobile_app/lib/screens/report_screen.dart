import 'package:flutter/material.dart';

import 'data_report_form.dart';
import 'help_request_form.dart';
import '../widgets/offline_banner.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  bool _isHelpRequest = true;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Report', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const OfflineBanner(),
          Text(
            'Switch between a help request and a field data report.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          ToggleButtons(
            isSelected: [_isHelpRequest, !_isHelpRequest],
            onPressed: (index) {
              setState(() {
                _isHelpRequest = index == 0;
              });
            },
            children: const [
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text('Help Request'),
              ),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text('Data Report'),
              ),
            ],
          ),
          const SizedBox(height: 20),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            child: _isHelpRequest
                ? const HelpRequestForm(key: ValueKey('help'))
                : const DataReportForm(key: ValueKey('data')),
          ),
        ],
      ),
    );
  }
}
