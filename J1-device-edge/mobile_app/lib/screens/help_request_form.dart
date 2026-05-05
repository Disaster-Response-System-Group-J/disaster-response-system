import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/database_helper.dart';
import '../services/offline_queue_manager.dart';
import '../services/gps_service.dart';
import '../widgets/form_widgets.dart';

class HelpRequestForm extends StatefulWidget {
  const HelpRequestForm({super.key});

  @override
  State<HelpRequestForm> createState() => _HelpRequestFormState();
}

class _HelpRequestFormState extends State<HelpRequestForm> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _peopleCountController = TextEditingController(text: '1');
  final _locationController = TextEditingController();

  String _selectedType = 'Medical help';
  bool _mobilitySupport = false;
  bool _injuries = false;
  bool _saving = false;
  bool _locating = false;

  static const List<String> _requestTypes = [
    'Medical help',
    'Food supply',
    'Water supply',
    'Shelter',
    'Evacuation',
    'Other',
  ];

  @override
  void dispose() {
    _descriptionController.dispose();
    _peopleCountController.dispose();
    _locationController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _saving = true;
    });

    try {
      final peopleCount = int.tryParse(_peopleCountController.text) ?? 1;

      final payload = <String, dynamic>{
        'request_type': _selectedType,
        'description': _descriptionController.text.trim(),
        'people_count': peopleCount,
        'mobility_support_required': _mobilitySupport,
        'injuries_reported': _injuries,
        'location': _locationController.text.trim(),
      };

      final user = AuthService.instance.currentUser;
      if (user == null) {
        throw Exception('Please sign in before submitting a request');
      }

      final deviceId = await DatabaseHelper.instance.getDeviceId();

      await OfflineQueueManager().addEvent(
        payload,
        'HELP_REQUEST',
        userId: user.id,
        deviceId: deviceId,
      );

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved locally')),
      );

      _formKey.currentState!.reset();
      _descriptionController.clear();
      _peopleCountController.text = '1';
      _locationController.clear();
      setState(() {
        _selectedType = _requestTypes.first;
        _mobilitySupport = false;
        _injuries = false;
        _saving = false;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save help request: $e')),
      );
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _locating = true;
    });

    final position = await GpsService.getCurrentPosition();

    if (!mounted) {
      return;
    }

    setState(() {
      _locating = false;
    });

    if (position == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('GPS unavailable, use manual location instead'),
        ),
      );
      return;
    }

    _locationController.text = GpsService.formatPosition(position);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Location captured from GPS')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CustomDropdown<String>(
            value: _selectedType,
            labelText: 'Request type',
            items: _requestTypes
                .map(
                  (value) => DropdownMenuItem<String>(
                    value: value,
                    child: Text(value),
                  ),
                )
                .toList(),
            onChanged: (value) {
              if (value == null) {
                return;
              }
              setState(() {
                _selectedType = value;
              });
            },
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Select a request type';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          CustomTextInput(
            controller: _descriptionController,
            labelText: 'Description',
            hintText: 'Describe the situation',
            maxLines: 3,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Enter a short description';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          CustomNumberInput(
            controller: _peopleCountController,
            labelText: 'People count',
            validator: (value) {
              final count = int.tryParse(value ?? '');
              if (count == null || count < 1) {
                return 'Enter at least 1 person';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          CustomTextInput(
            controller: _locationController,
            labelText: 'Location',
            hintText: 'Tap GPS or enter manually',
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Enter a location';
              }
              return null;
            },
            prefixIcon: Icons.location_on_outlined,
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _locating ? null : _useCurrentLocation,
              icon: Icon(_locating ? Icons.gps_fixed : Icons.my_location),
              label: Text(_locating ? 'Locating...' : 'Use Current GPS Location'),
            ),
          ),
          const SizedBox(height: 8),
          CustomToggle(
            value: _mobilitySupport,
            label: 'Mobility support needed',
            subtitle: 'Useful for wheelchair or stretcher assistance',
            onChanged: (value) {
              setState(() {
                _mobilitySupport = value;
              });
            },
          ),
          CustomToggle(
            value: _injuries,
            label: 'Injuries reported',
            subtitle: 'Marks the request as high priority',
            onChanged: (value) {
              setState(() {
                _injuries = value;
              });
            },
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _submit,
              child: Text(_saving ? 'Saving...' : 'Submit Help Request'),
            ),
          ),
        ],
      ),
    );
  }
}
