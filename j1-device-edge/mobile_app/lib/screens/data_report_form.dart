import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';

import '../services/auth_service.dart';
import '../services/database_helper.dart';
import '../services/offline_queue_manager.dart';
import '../services/gps_service.dart';
import '../services/image_upload_service.dart';
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
  File? _selectedImageFile;

  String _selectedType = 'Flood level';
  bool _saving = false;
  bool _locating = false;
  bool _uploading = false;
  bool _gpsCaptured = false;
  Position? _currentPosition;

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

  Future<void> _pickImage() async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? pickedFile = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 85,
      );

      if (pickedFile != null) {
        setState(() {
          _selectedImageFile = File(pickedFile.path);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Image selected. It will be uploaded when you submit.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error picking image: $e')),
      );
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _saving = true;
    });

    try {
      // Upload image if one was selected
      String? mediaUrl;
      if (_selectedImageFile != null) {
        setState(() {
          _uploading = true;
        });

        mediaUrl = await ImageUploadService.uploadImage(_selectedImageFile!);

        if (!mounted) {
          return;
        }

        setState(() {
          _uploading = false;
        });

        if (mediaUrl == null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Warning: Image upload failed, but submitting without image')),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Image uploaded successfully')),
          );
        }
      }

      final payload = <String, dynamic>{
        'data_type': _selectedType,
        'description': _descriptionController.text.trim(),
        'location': _locationController.text.trim(),
        'latitude': _currentPosition?.latitude,
        'longitude': _currentPosition?.longitude,
      };

      // Include mediaUrls as array if one was uploaded
      if (mediaUrl != null) {
        payload['mediaUrls'] = [mediaUrl];
      }

      final user = AuthService.instance.currentUser;
      if (user == null) {
        throw Exception('Please sign in before submitting a report');
      }

      final deviceId = await DatabaseHelper.instance.getDeviceId();

      await OfflineQueueManager().addEvent(
        payload,
        'DATA_REPORT',
        userId: user.id,
        deviceId: deviceId,
      );

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report saved locally')),
      );

      _formKey.currentState!.reset();
      _descriptionController.clear();
      _locationController.clear();
      setState(() {
        _selectedType = _dataTypes.first;
        _gpsCaptured = false;
        _currentPosition = null;
        _saving = false;
        _selectedImageFile = null;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _saving = false;
        _uploading = false;
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
      _currentPosition = position;
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
            onChanged: (_) {
              _currentPosition = null;
              _gpsCaptured = false;
            },
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
          Text(
            'Photo',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: _uploading ? null : _pickImage,
              icon: Icon(_uploading ? Icons.cloud_upload : Icons.add_a_photo),
              label: Text(_uploading ? 'Uploading...' : 'Select Photo'),
            ),
          ),
          const SizedBox(height: 8),
          if (_selectedImageFile == null)
            const Text('No photo selected')
          else
            Container(
              width: double.infinity,
              height: 150,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.grey),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Image.file(
                      _selectedImageFile!,
                      fit: BoxFit.cover,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: GestureDetector(
                      onTap: () {
                        setState(() {
                          _selectedImageFile = null;
                        });
                      },
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                        padding: const EdgeInsets.all(6),
                        child: const Icon(
                          Icons.close,
                          size: 18,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_saving || _uploading) ? null : _submit,
              child: Text(_saving ? 'Saving...' : (_uploading ? 'Uploading...' : 'Submit Data Report')),
            ),
          ),
        ],
      ),
    );
  }
}

