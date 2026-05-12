import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../services/auth_service.dart';

class UserProfileDrawer extends StatelessWidget {
  final AppUser user;

  const UserProfileDrawer({
    super.key,
    required this.user,
  });

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          UserAccountsDrawerHeader(
            accountName: Text(user.name),
            accountEmail: Text(user.email),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.teal,
              child: Text(
                user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            decoration: const BoxDecoration(
              color: Colors.teal,
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildInfoItem(
                  context,
                  'User ID',
                  user.id,
                  Icons.person_outline,
                ),
                const SizedBox(height: 12),
                _buildInfoItem(
                  context,
                  'Role',
                  user.role,
                  Icons.security_outlined,
                ),
                if (user.serviceId != null && user.serviceId!.isNotEmpty)
                  Column(
                    children: [
                      const SizedBox(height: 12),
                      _buildInfoItem(
                        context,
                        'Service ID',
                        user.serviceId!,
                        Icons.miscellaneous_services_outlined,
                      ),
                    ],
                  ),
                if (user.zone != null && user.zone!.isNotEmpty)
                  Column(
                    children: [
                      const SizedBox(height: 12),
                      _buildInfoItem(
                        context,
                        'Zone/District',
                        user.zone!,
                        Icons.location_on_outlined,
                      ),
                    ],
                  ),
              ],
            ),
          ),
          const Divider(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Logout'),
              onTap: () {
                Navigator.pop(context);
                _showLogoutConfirm(context);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem(
    BuildContext context,
    String label,
    String value,
    IconData icon,
  ) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.teal),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showLogoutConfirm(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              AuthService.instance.logout();
            },
            child: const Text('Logout'),
          ),
        ],
      ),
    );
  }
}
