import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/database_helper.dart';
import '../utills/constants.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _apiBaseUrlController = TextEditingController();
  final _databaseHelper = DatabaseHelper.instance;

  bool _notificationsEnabled = true;
  bool _offlineSyncEnabled = true;
  bool _savingApiUrl = false;
  bool _loadingApiUrl = true;
  String? _apiUrlError;

  @override
  void initState() {
    super.initState();
    _loadApiBaseUrl();
  }

  @override
  void dispose() {
    _apiBaseUrlController.dispose();
    super.dispose();
  }

  Future<void> _loadApiBaseUrl() async {
    try {
      final apiBaseUrl = await _databaseHelper.getApiBaseUrl();
      if (!mounted) {
        return;
      }
      _apiBaseUrlController.text = apiBaseUrl;
      setState(() {
        _loadingApiUrl = false;
        _apiUrlError = null;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loadingApiUrl = false;
        _apiUrlError = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _saveApiBaseUrl() async {
    setState(() {
      _savingApiUrl = true;
      _apiUrlError = null;
    });

    try {
      await _databaseHelper.setApiBaseUrl(_apiBaseUrlController.text);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Backend URL saved')),
      );
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _apiUrlError = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _savingApiUrl = false;
        });
      }
    }
  }

  Future<void> _resetApiBaseUrl() async {
    setState(() {
      _savingApiUrl = true;
      _apiUrlError = null;
    });

    try {
      await _databaseHelper.clearApiBaseUrl();
      final apiBaseUrl = await _databaseHelper.getApiBaseUrl();
      if (!mounted) {
        return;
      }
      _apiBaseUrlController.text = apiBaseUrl;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Backend URL reset to default')),
      );
    } catch (e) {
      if (!mounted) {
        return;
      }
      setState(() {
        _apiUrlError = e.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _savingApiUrl = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Settings', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Backend connection',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use your computer\'s LAN address so the phone can reach the bridge API on the same Wi-Fi network.',
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _apiBaseUrlController,
                    enabled: !_loadingApiUrl && !_savingApiUrl,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Backend API URL',
                      hintText: 'http://192.168.1.50:8000',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Default on emulators: ${AppConstants.apiBaseUrl}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (_apiUrlError != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _apiUrlError!,
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          onPressed: _loadingApiUrl || _savingApiUrl ? null : _saveApiBaseUrl,
                          child: _savingApiUrl
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Save URL'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton(
                        onPressed: _loadingApiUrl || _savingApiUrl ? null : _resetApiBaseUrl,
                        child: const Text('Reset'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          ValueListenableBuilder(
            valueListenable: AuthService.instance.currentUserNotifier,
            builder: (context, user, _) {
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Account',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(user?.name ?? 'No signed-in user'),
                      Text(user?.email ?? 'Sign in to continue'),
                      if (user?.isMock == true) ...[
                        const SizedBox(height: 8),
                        const Text('Mock user enabled'),
                      ],
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: user == null
                              ? null
                              : () {
                                  AuthService.instance.logout();
                                },
                          icon: const Icon(Icons.logout),
                          label: const Text('Sign Out'),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            title: const Text('Enable notifications'),
            value: _notificationsEnabled,
            onChanged: (value) {
              setState(() {
                _notificationsEnabled = value;
              });
            },
          ),
          SwitchListTile(
            title: const Text('Enable offline sync'),
            value: _offlineSyncEnabled,
            onChanged: (value) {
              setState(() {
                _offlineSyncEnabled = value;
              });
            },
          ),
        ],
      ),
    );
  }
}
