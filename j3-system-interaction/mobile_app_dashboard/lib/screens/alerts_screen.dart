import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../components/nav_bar.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  int currentIndex = 4; // Alerts tab

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      // ─── Top App Bar ───
      appBar: AppBar(
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
            fontSize: 13,
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
          child: Container(height: 1, color: Colors.white.withValues(alpha: 0.1)),
        ),
      ),
      body: Stack(
        children: [
          // ─── Scrollable content ───
          SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ─── Page Header ───
                _buildPageHeader(),
                const SizedBox(height: 16),

                // ─── System Health Overview ───
                _buildSystemHealthCard(),
                const SizedBox(height: 16),

                // ─── Critical Alert 1: Flood Warning ───
                _buildAlertCard(
                  severity: AlertSeverity.critical,
                  icon: Icons.warning,
                  title: 'Level 3 Flood Warning: Sector Alpha',
                  description:
                      'Water levels have exceeded safety margins by 1.2m. Immediate evacuation protocols recommended for grid zones A1-A4.',
                  timestamp: '09:42:15Z',
                  metaItems: [
                    _AlertMeta(icon: Icons.group, label: '240+'),
                    _AlertMeta(icon: Icons.location_on, label: 'A1-A4'),
                  ],
                ),
                const SizedBox(height: 16),

                // ─── Critical Alert 2: Grid Failure ───
                _buildAlertCard(
                  severity: AlertSeverity.critical,
                  icon: Icons.electrical_services,
                  title: 'Grid Failure: Communications Hub 4',
                  description:
                      'Complete loss of telemetry from regional comms node. Backup generators failed to engage. Disruption expected.',
                  timestamp: '08:15:00Z',
                  metaItems: [
                    _AlertMeta(icon: Icons.router, label: 'Offline'),
                    _AlertMeta(icon: Icons.timer, label: '1h 27m'),
                  ],
                ),
                const SizedBox(height: 16),

                // ─── High Priority Alert ───
                _buildAlertCard(
                  severity: AlertSeverity.high,
                  icon: Icons.priority_high,
                  title: 'Supply Line Disruption Route 66',
                  description:
                      'Debris reported blocking main arterial route. Logistics convoy 7 delayed by estimated 4 hours.',
                  timestamp: '07:30:22Z',
                  metaItems: [
                    _AlertMeta(icon: Icons.local_shipping, label: 'C-7'),
                  ],
                ),
                const SizedBox(height: 16),

                // ─── Routine Alert ───
                _buildRoutineAlertCard(),
                const SizedBox(height: 24),
              ],
            ),
          ),

          // ─── Bottom nav (fixed) ───
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: BottomNav(
              currentIndex: currentIndex,
              onTap: (index) {
                if (index == currentIndex) return;
                setState(() {
                  currentIndex = index;
                });
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
  //  PAGE HEADER
  // ═══════════════════════════════════════
  Widget _buildPageHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Active Alerts',
          style: GoogleFonts.inter(
            fontSize: 24,
            fontWeight: FontWeight.w600,
            color: AppColors.onSurface,
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFF0B1326),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Pulsing red dot
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.4, end: 1.0),
                duration: const Duration(milliseconds: 1000),
                builder: (context, value, child) {
                  return Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.error.withValues(alpha: value),
                    ),
                  );
                },
              ),
              const SizedBox(width: 8),
              Text(
                '3 CRITICAL',
                style: GoogleFonts.spaceGrotesk(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  letterSpacing: 0.7,
                  color: AppColors.error,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════
  //  SYSTEM HEALTH CARD
  // ═══════════════════════════════════════
  Widget _buildSystemHealthCard() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0B1326),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        children: [
          // Top accent — secondary color
          Container(
            height: 2,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: AppColors.secondary,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
          Row(
            children: [
              const Icon(Icons.monitor_heart, color: AppColors.secondary, size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'System Health',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.7,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'OPERATIONAL - DEGRADED',
                      style: GoogleFonts.spaceGrotesk(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '82%',
                style: GoogleFonts.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: AppColors.secondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════
  //  ALERT CARD (Critical / High)
  // ═══════════════════════════════════════
  Widget _buildAlertCard({
    required AlertSeverity severity,
    required IconData icon,
    required String title,
    required String description,
    required String timestamp,
    required List<_AlertMeta> metaItems,
  }) {
    final bool isCritical = severity == AlertSeverity.critical;
    final Color accentColor =
        isCritical ? AppColors.error : const Color(0xFFDF7412); // tertiary-container
    final List<BoxShadow> glow = [
      BoxShadow(
        color: isCritical
            ? const Color(0x33EF4444) // red glow
            : const Color(0x33F59E0B), // amber glow
        blurRadius: 15,
      ),
    ];

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(0xFF0B1326),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        boxShadow: glow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top accent border
          Container(height: 2, color: accentColor),

          Stack(
            children: [
              // Corner decoration (critical only)
              if (isCritical)
                Positioned(
                  top: -32,
                  right: -32,
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: accentColor.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),

              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Header row: icon + badge + timestamp ──
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(icon, color: accentColor, size: 20),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: accentColor.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(2),
                              ),
                              child: Text(
                                isCritical ? 'CRITICAL' : 'HIGH',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.2,
                                  color: accentColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Text(
                          timestamp,
                          style: GoogleFonts.spaceGrotesk(
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // ── Title ──
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        height: 1.3,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // ── Description ──
                    Text(
                      description,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w400,
                        height: 1.5,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 16),

                    // ── Footer: meta + view details ──
                    Container(
                      padding: const EdgeInsets.only(top: 12),
                      decoration: const BoxDecoration(
                        border: Border(
                          top: BorderSide(
                            color: Colors.white10,
                          ),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          // Meta items
                          Row(
                            children: metaItems
                                .map(
                                  (m) => Padding(
                                    padding: const EdgeInsets.only(right: 16),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(m.icon,
                                            size: 14,
                                            color: AppColors.onSurfaceVariant),
                                        const SizedBox(width: 4),
                                        Text(
                                          m.label,
                                          style: GoogleFonts.spaceGrotesk(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w500,
                                            color: AppColors.onSurfaceVariant,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                          // View Details link
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'VIEW DETAILS',
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.2,
                                  color: accentColor,
                                ),
                              ),
                              const SizedBox(width: 2),
                              Icon(Icons.chevron_right,
                                  size: 14, color: accentColor),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════
  //  ROUTINE ALERT CARD
  // ═══════════════════════════════════════
  Widget _buildRoutineAlertCard() {
    return Opacity(
      opacity: 0.8,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF0B1326),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.info, color: AppColors.outline, size: 20),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(2),
                      ),
                      child: Text(
                        'ROUTINE',
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: AppColors.outline,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  '06:00:00Z',
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // ── Title ──
            Text(
              'Shift Handover Completed',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                height: 1.3,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 4),

            // ── Description ──
            Text(
              'Night watch duties transferred to morning shift successfully. All system logs signed off.',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                height: 1.5,
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Enums & helpers ───

enum AlertSeverity { critical, high, routine }

class _AlertMeta {
  final IconData icon;
  final String label;
  const _AlertMeta({required this.icon, required this.label});
}
