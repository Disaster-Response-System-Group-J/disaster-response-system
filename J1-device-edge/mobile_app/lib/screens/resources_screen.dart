import 'package:flutter/material.dart';

import '../models/resource_model.dart';
import '../services/resource_service.dart';
import '../widgets/offline_banner.dart';

class ResourcesScreen extends StatefulWidget {
  const ResourcesScreen({super.key});

  @override
  State<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends State<ResourcesScreen> {
  final ResourceService _resourceService = ResourceService.instance;

  // Filter states
  ResourceType? _selectedType;
  String? _selectedDistrict;
  bool _availableOnly = false;

  Future<void> _refresh() async {
    // Fetch and cache resources from backend if online
    await _resourceService.fetchAndCacheResources(forceRefresh: true);
    setState(() {});
  }

  Future<List<ResourceModel>> _getFilteredResources() async {
    List<ResourceModel> resources;

    // Apply filters
    if (_availableOnly) {
      if (_selectedDistrict != null) {
        resources = await _resourceService.getAvailableResourcesByDistrict(_selectedDistrict!);
      } else {
        resources = await _resourceService.getAvailableResources();
      }
    } else {
      resources = await _resourceService.getResources();
      if (_selectedDistrict != null) {
        resources = resources.where((r) => r.district == _selectedDistrict).toList();
      }
    }

    // Filter by type
    if (_selectedType != null) {
      resources = resources.where((r) => r.type == _selectedType).toList();
    }

    return resources;
  }

  Future<Set<String>> _getDistricts() async {
    final resources = await _resourceService.getResources();
    return resources.map((r) => r.district).toSet();
  }

  String _getResourceTypeLabel(ResourceType type) {
    return ResourceModel.typeToString(type);
  }

  IconData _getResourceTypeIcon(ResourceType type) {
    return switch (type) {
      ResourceType.RESCUE_TEAM => Icons.group,
      ResourceType.BOAT => Icons.directions_boat,
      ResourceType.AMBULANCE => Icons.local_hospital,
      ResourceType.SHELTER => Icons.home,
      ResourceType.MEDICAL_TEAM => Icons.medical_services,
      ResourceType.FOOD_WATER => Icons.local_drink,
    };
  }

  Color _getStatusColor(ResourceStatus status) {
    return switch (status) {
      ResourceStatus.AVAILABLE => Colors.green,
      ResourceStatus.ASSIGNED => Colors.blue,
      ResourceStatus.BUSY => Colors.orange,
      ResourceStatus.OUT_OF_SERVICE => Colors.red,
    };
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            // Header
            Text(
              'Emergency Resources',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const OfflineBanner(),
            Text(
              'Read-only view of available emergency resources',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),

            // Filter chips
            _buildFilterSection(context),
            const SizedBox(height: 16),

            // Resources list
            FutureBuilder<List<ResourceModel>>(
              future: _getFilteredResources(),
              builder: (context, snapshot) {
                final List<ResourceModel> resources = snapshot.data ?? const <ResourceModel>[];

                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: CircularProgressIndicator(),
                    ),
                  );
                }

                if (resources.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.inbox_outlined,
                            size: 48,
                            color: Colors.grey.shade400,
                          ),
                          const SizedBox(height: 16),
                          const Text('No resources found'),
                        ],
                      ),
                    ),
                  );
                }

                return Column(
                  children: resources.map((resource) => _ResourceCard(resource: resource)).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Availability filter
        Wrap(
          spacing: 8,
          children: [
            FilterChip(
              label: const Text('Available Only'),
              selected: _availableOnly,
              onSelected: (selected) {
                setState(() => _availableOnly = selected);
              },
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Type filter
        Wrap(
          spacing: 8,
          children: [
            FilterChip(
              label: const Text('All Types'),
              selected: _selectedType == null,
              onSelected: (selected) {
                setState(() => _selectedType = null);
              },
            ),
            ...ResourceType.values.map((type) {
              return FilterChip(
                label: Text(_getResourceTypeLabel(type)),
                selected: _selectedType == type,
                onSelected: (selected) {
                  setState(() => _selectedType = selected ? type : null);
                },
              );
            }),
          ],
        ),
        const SizedBox(height: 12),

        // District filter
        FutureBuilder<Set<String>>(
          future: _getDistricts(),
          builder: (context, snapshot) {
            final districts = snapshot.data ?? <String>{};
            return Wrap(
              spacing: 8,
              children: [
                FilterChip(
                  label: const Text('All Districts'),
                  selected: _selectedDistrict == null,
                  onSelected: (selected) {
                    setState(() => _selectedDistrict = null);
                  },
                ),
                ...districts.map((district) {
                  return FilterChip(
                    label: Text(district),
                    selected: _selectedDistrict == district,
                    onSelected: (selected) {
                      setState(() => _selectedDistrict = selected ? district : null);
                    },
                  );
                }),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _ResourceCard extends StatelessWidget {
  final ResourceModel resource;

  const _ResourceCard({required this.resource});

  @override
  Widget build(BuildContext context) {
    final resourceTypeLabel = ResourceModel.typeToString(resource.type);
    final statusLabel = ResourceModel.statusToString(resource.status);
    final statusColor = _getStatusColor(resource.status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with icon and name
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  _getResourceTypeIcon(resource.type),
                  size: 32,
                  color: statusColor,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        resource.name,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        resourceTypeLabel,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Details grid
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'District',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                      ),
                      Text(
                        resource.district,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Status',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          statusLabel,
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: statusColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Capacity and location info
            if (resource.capacity != null || resource.latitude != null)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (resource.capacity != null) ...[
                    Text(
                      'Capacity / Current Load',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.grey.shade600,
                      ),
                    ),
                    LinearProgressIndicator(
                      value: resource.currentLoad != null && resource.capacity! > 0
                          ? (resource.currentLoad! / resource.capacity!).clamp(0, 1)
                          : 0,
                      minHeight: 6,
                      backgroundColor: Colors.grey.shade300,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        resource.currentLoad != null && resource.capacity != null && 
                        (resource.currentLoad! / resource.capacity!) > 0.8
                            ? Colors.orange
                            : Colors.green,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${resource.currentLoad ?? 0} / ${resource.capacity ?? '?'}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                  ],
                  if (resource.latitude != null && resource.longitude != null) ...[
                    Row(
                      children: [
                        Icon(
                          Icons.location_on,
                          size: 16,
                          color: Colors.grey.shade600,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${resource.latitude!.toStringAsFixed(4)}, ${resource.longitude!.toStringAsFixed(4)}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),

            // Last updated
            const SizedBox(height: 8),
            Text(
              'Updated: ${resource.lastUpdated.toString().split('.').first}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Colors.grey.shade600,
              ),
            ),

            // Read-only footer
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                '🔒 Read-only resource view',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Colors.blue.shade700,
                  fontSize: 11,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

extension _ResourceCardHelpers on _ResourceCard {
  Color _getStatusColor(ResourceStatus status) {
    return switch (status) {
      ResourceStatus.AVAILABLE => Colors.green,
      ResourceStatus.ASSIGNED => Colors.blue,
      ResourceStatus.BUSY => Colors.orange,
      ResourceStatus.OUT_OF_SERVICE => Colors.red,
    };
  }

  IconData _getResourceTypeIcon(ResourceType type) {
    return switch (type) {
      ResourceType.RESCUE_TEAM => Icons.group,
      ResourceType.BOAT => Icons.directions_boat,
      ResourceType.AMBULANCE => Icons.local_hospital,
      ResourceType.SHELTER => Icons.home,
      ResourceType.MEDICAL_TEAM => Icons.medical_services,
      ResourceType.FOOD_WATER => Icons.local_drink,
    };
  }
}
