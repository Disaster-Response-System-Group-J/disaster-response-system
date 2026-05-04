import 'package:flutter/material.dart';

import '../services/offline_queue_manager.dart';
import '../services/gps_service.dart';
import '../widgets/form_widgets.dart';

class DataReportForm extends StatefulWidget {
  const DataReportForm({super.key});

  @override
  State<DataReportForm> createState() => _DataReportFormState();
}

class _DataReportFormState extends State<DataReportForm> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  final _locationController = TextEditingController();

  String _selectedType = 'Flood level';
  bool _saving = false;
  bool _locating = false;
  bool _gpsCaptured = false;

  static const List<String> _dataTypes = [
    'Flood level',
    'Road damage',
    'Power outage',
    'Medical supplies',
    'Shelter availability',
    'Other',
  ];

  @override
  void dispose() {
    _descriptionController.dispose();
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
      final payload = <String, dynamic>{
        'data_type': _selectedType,
        'description': _descriptionController.text.trim(),
        'location': _locationController.text.trim(),
      };

      await OfflineQueueManager().addEvent(payload, 'DATA_REPORT');

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saved locally')),
      );

      _formKey.currentState!.reset();
      _descriptionController.clear();
      _locationController.clear();
      setState(() {
        _selectedType = _dataTypes.first;
        _gpsCaptured = false;
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
        SnackBar(content: Text('Failed to save data report: $e')),
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
        const SnackBar(content: Text('GPS signal required for data reports')),
      );
      return;
    }

    _locationController.text = GpsService.formatPosition(position);
    setState(() {
      _gpsCaptured = true;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('GPS location captured')),
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
            labelText: 'Data type',
            items: _dataTypes
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
          ),
          const SizedBox(height: 12),
          CustomTextInput(
            controller: _descriptionController,
            labelText: 'Description',
            hintText: 'Add field observations',
            maxLines: 3,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Enter a description';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          CustomTextInput(
            controller: _locationController,
            labelText: 'Location',
            hintText: 'Captured from GPS only',
            prefixIcon: Icons.place_outlined,
            readOnly: true,
            validator: (value) {
              if (!_gpsCaptured || value == null || value.trim().isEmpty) {
                return 'Capture GPS location first';
              }
              return null;
            },
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _locating ? null : _useCurrentLocation,
              icon: Icon(_locating ? Icons.gps_fixed : Icons.my_location),
              label: Text(_locating ? 'Locating...' : 'Capture GPS Location'),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _submit,
              child: Text(_saving ? 'Saving...' : 'Submit Data Report'),
            ),
          ),
        ],
      ),
    );
  }
}
