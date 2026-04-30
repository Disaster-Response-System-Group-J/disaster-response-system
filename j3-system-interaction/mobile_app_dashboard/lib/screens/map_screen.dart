import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../components/nav_bar.dart';

/// Tactical Map screen.
///
/// Faithfully reproduces the HTML/Tailwind mobile design:
///  • Full-screen tactical satellite map with grid overlay
///  • Floating map controls (zoom, location, layers) on top-right
///  • Floating legend panel ("MATRIX") on top-left
///  • Simulated map markers (Critical, Shelter, Elevated)
///  • Bottom sheet with "Active AO Summary", bento stats, priority incident card
///  • BottomNav bar (Map tab active)
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  int _currentNavIndex = 2; // Map tab
  final MapController _mapController = MapController();
  final LatLng _center = const LatLng(34.0522, -118.2437); // Los Angeles, CA

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _zoomIn() {
    final zoom = _mapController.camera.zoom + 1;
    _mapController.move(_mapController.camera.center, zoom);
  }

  void _zoomOut() {
    final zoom = _mapController.camera.zoom - 1;
    _mapController.move(_mapController.camera.center, zoom);
  }

  void _resetZoom() {
    _mapController.move(_center, 13.0);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceDim,
      // ─── Top App Bar ───
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Colors.black.withValues(alpha: 0.8),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: Color(0xFF4D8EFF)),
          onPressed: () {},
        ),
        centerTitle: true,
        title: Text(
          'COMMAND',
          style: GoogleFonts.inter(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            letterSpacing: 4,
            color: const Color(0xFF4D8EFF),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications, color: Color(0xFF4D8EFF)),
            onPressed: () {},
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(
            height: 1,
            color: Colors.white.withValues(alpha: 0.1),
          ),
        ),
      ),
      body: Stack(
        children: [
          // ═══════════════════════════════════════
          //  TACTICAL MAP BACKGROUND & MARKERS
          // ═══════════════════════════════════════
          Positioned.fill(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _center,
                initialZoom: 13.0,
                minZoom: 3.0,
                maxZoom: 18.0,
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                  subdomains: const ['a', 'b', 'c', 'd'],
                ),
                MarkerLayer(
                  markers: [
                    // Marker 1: Critical (FLOOD-01)
                    Marker(
                      point: const LatLng(34.055, -118.25),
                      width: 80,
                      height: 80,
                      child: _buildMapMarker(
                        icon: Icons.warning,
                        bgColor: AppColors.error,
                        fgColor: AppColors.onError,
                        label: 'FLOOD-01',
                        labelColor: AppColors.error,
                        glowColor: const Color(0x33EF4444),
                      ),
                    ),
                    // Marker 2: Shelter (SHLT-COL)
                    Marker(
                      point: const LatLng(34.045, -118.23),
                      width: 80,
                      height: 80,
                      child: _buildMapMarker(
                        icon: Icons.home_work,
                        bgColor: AppColors.secondary,
                        fgColor: AppColors.onSecondary,
                        label: 'SHLT-COL',
                        labelColor: AppColors.secondary,
                        glowColor: const Color(0x334CD7F6),
                      ),
                    ),
                    // Marker 3: Elevated (landslide — no label)
                    Marker(
                      point: const LatLng(34.065, -118.26),
                      width: 40,
                      height: 40,
                      child: _buildMapMarkerIconOnly(
                        icon: Icons.landslide,
                        bgColor: AppColors.tertiaryContainer,
                        fgColor: AppColors.onTertiaryContainer,
                        glowColor: const Color(0x33DF7412),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Grid overlay (fixed over the map)
          Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(
                painter: _GridPainter(),
              ),
            ),
          ),

          // ═══════════════════════════════════════
          //  MAP CONTROLS (Top Right)
          // ═══════════════════════════════════════
          Positioned(
            top: 12,
            right: 16,
            child: Column(
              children: [
                _buildMapControlButton(Icons.add, onTap: _zoomIn),
                const SizedBox(height: 8),
                _buildMapControlButton(Icons.remove, onTap: _zoomOut),
                const SizedBox(height: 16),
                _buildMapControlButton(Icons.my_location, onTap: _resetZoom),
                const SizedBox(height: 16),
                _buildMapControlButton(Icons.layers, onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Layers menu coming soon')),
                  );
                }),
              ],
            ),
          ),

          // ═══════════════════════════════════════
          //  MAP LEGEND (Top Left)
          // ═══════════════════════════════════════
          Positioned(
            top: 12,
            left: 16,
            child: _buildLegendPanel(),
          ),

          // ═══════════════════════════════════════
          //  BOTTOM SHEET — Active AO Summary
          // ═══════════════════════════════════════
          Positioned(
            left: 0,
            right: 0,
            bottom: 64, // above the BottomNav
            child: _buildBottomSheet(),
          ),

          // ═══════════════════════════════════════
          //  BOTTOM NAV
          // ═══════════════════════════════════════
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: BottomNav(
              currentIndex: _currentNavIndex,
              onTap: (index) {
                if (index == _currentNavIndex) return;
                setState(() => _currentNavIndex = index);
                _navigateTo(context, index);
              },
            ),
          ),
        ],
      ),
    );
  }

  void _navigateTo(BuildContext context, int index) {
    const routes = {
      0: '/dashboard',
      1: '/reports',
      2: '/map',
      3: '/resources',
      4: '/alerts',
    };
    final route = routes[index];
    if (route != null) {
      Navigator.pushReplacementNamed(context, route);
    }
  }

  // ═══════════════════════════════════════
  //  MAP CONTROL BUTTON (glass panel)
  // ═══════════════════════════════════════
  Widget _buildMapControlButton(IconData icon, {VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF0B1326).withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: Icon(
              icon,
              color: AppColors.onSurface,
              size: 20,
            ),
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════
  //  LEGEND PANEL ("MATRIX")
  // ═══════════════════════════════════════
  Widget _buildLegendPanel() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          width: 160,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF0B1326).withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'MATRIX',
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 10),
              _buildLegendItem(
                color: AppColors.error,
                label: 'CRITICAL',
                hasGlow: true,
                glowColor: const Color(0x33EF4444),
              ),
              const SizedBox(height: 8),
              _buildLegendItem(
                color: AppColors.tertiaryContainer,
                label: 'ELEVATED',
                hasGlow: true,
                glowColor: const Color(0x33DF7412),
              ),
              const SizedBox(height: 8),
              _buildLegendItem(
                color: AppColors.primary,
                label: 'ACTIVE',
                hasGlow: true,
                glowColor: const Color(0x333B82F6),
              ),
              const SizedBox(height: 8),
              _buildLegendItemIcon(
                icon: Icons.home_work,
                iconColor: AppColors.secondary,
                label: 'SHELTER',
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLegendItem({
    required Color color,
    required String label,
    bool hasGlow = false,
    Color? glowColor,
  }) {
    return Row(
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            boxShadow: hasGlow && glowColor != null
                ? [BoxShadow(color: glowColor, blurRadius: 10)]
                : null,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 10,
            fontWeight: FontWeight.w500,
            color: AppColors.onSurface,
          ),
        ),
      ],
    );
  }

  Widget _buildLegendItemIcon({
    required IconData icon,
    required Color iconColor,
    required String label,
  }) {
    return Row(
      children: [
        Icon(icon, size: 14, color: iconColor),
        const SizedBox(width: 8),
        Text(
          label,
          style: GoogleFonts.spaceGrotesk(
            fontSize: 10,
            fontWeight: FontWeight.w500,
            color: AppColors.onSurface,
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════
  //  MAP MARKER (with label)
  // ═══════════════════════════════════════
  Widget _buildMapMarker({
    required IconData icon,
    required Color bgColor,
    required Color fgColor,
    required String label,
    required Color labelColor,
    required Color glowColor,
  }) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: bgColor,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
            boxShadow: [BoxShadow(color: glowColor, blurRadius: 15)],
          ),
          child: Icon(icon, size: 16, color: fgColor),
        ),
        const SizedBox(height: 4),
        // Glass label
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF0B1326).withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(4),
                border:
                    Border.all(color: Colors.white.withValues(alpha: 0.1)),
              ),
              child: Text(
                label,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: labelColor,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════
  //  MAP MARKER (icon only, no label)
  // ═══════════════════════════════════════
  Widget _buildMapMarkerIconOnly({
    required IconData icon,
    required Color bgColor,
    required Color fgColor,
    required Color glowColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        boxShadow: [BoxShadow(color: glowColor, blurRadius: 15)],
      ),
      child: Icon(icon, size: 16, color: fgColor),
    );
  }

  // ═══════════════════════════════════════
  //  BOTTOM SHEET — Active AO Summary
  // ═══════════════════════════════════════
  Widget _buildBottomSheet() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerHighest.withValues(alpha: 0.95),
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        border: const Border(
          top: BorderSide(color: Colors.white10),
        ),
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.symmetric(vertical: 8),
                width: 48,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Header: title + LIVE badge ──
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'ACTIVE AO SUMMARY',
                          style: GoogleFonts.inter(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.3,
                            color: AppColors.onSurface,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color:
                                AppColors.primary.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(
                                color: AppColors.primary
                                    .withValues(alpha: 0.3)),
                          ),
                          child: Text(
                            'LIVE',
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.8,
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // ── Bento Stats Grid ──
                    Row(
                      children: [
                        Expanded(child: _buildStatCard(
                          label: 'PERSONNEL',
                          value: '2,450',
                          valueColor: AppColors.primary,
                          delta: '+120',
                          deltaColor: AppColors.secondary,
                          glowColor: const Color(0x333B82F6),
                        )),
                        const SizedBox(width: 4),
                        Expanded(child: _buildStatCard(
                          label: 'INCIDENTS',
                          value: '47',
                          valueColor: AppColors.error,
                          delta: '+3',
                          deltaColor: AppColors.error,
                          glowColor: const Color(0x33EF4444),
                        )),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // ── Priority Incident Card ──
                    _buildPriorityIncidentCard(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ═══════════════════════════════════════
  //  STAT CARD (bento grid item)
  // ═══════════════════════════════════════
  Widget _buildStatCard({
    required String label,
    required String value,
    required Color valueColor,
    required String delta,
    required Color deltaColor,
    required Color glowColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.spaceGrotesk(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
              color: AppColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: GoogleFonts.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: valueColor,
                  shadows: [
                    Shadow(color: glowColor, blurRadius: 15),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                delta,
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: deltaColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════
  //  PRIORITY INCIDENT CARD
  // ═══════════════════════════════════════
  Widget _buildPriorityIncidentCard() {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surfaceDim,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top accent border (error red)
          Container(height: 2, color: AppColors.error),

          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: icon + zone | timestamp
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.flood,
                            size: 18, color: AppColors.error),
                        const SizedBox(width: 8),
                        Text(
                          'ZONE-ALPHA',
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.7,
                            color: AppColors.onSurface,
                          ),
                        ),
                      ],
                    ),
                    Text(
                      'T-MINUS 12M',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                        color: AppColors.error,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                // Description
                Text(
                  'Severe flooding reported. Immediate evacuation protocols initiated.',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w400,
                    height: 1.5,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 12),

                // Action row: Dispatch + Eye
                Row(
                  children: [
                    // Dispatch button
                    Expanded(
                      child: Material(
                        color: AppColors.error.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(4),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(4),
                          onTap: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Dispatching unit to ZONE-ALPHA...')),
                            );
                          },
                          child: Container(
                            padding:
                                const EdgeInsets.symmetric(vertical: 8),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                  color:
                                      AppColors.error.withValues(alpha: 0.5)),
                            ),
                            child: Text(
                              'DISPATCH',
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.5,
                                color: AppColors.error,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Visibility button
                    GestureDetector(
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Toggling incident visibility...')),
                        );
                      },
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.1)),
                        ),
                        child: const Icon(
                          Icons.visibility,
                          size: 14,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════
//  GRID PAINTER (subtle tactical overlay)
// ═══════════════════════════════════════
class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.03)
      ..strokeWidth = 1;

    const double gridSize = 40;

    // Vertical lines
    for (double x = 0; x <= size.width; x += gridSize) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    // Horizontal lines
    for (double y = 0; y <= size.height; y += gridSize) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
