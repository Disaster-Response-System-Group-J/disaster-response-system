import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../components/nav_bar.dart';

/// Field Reports (Incoming Reports) screen.
///
/// Faithfully reproduces the HTML/Tailwind mobile design:
///  • TopAppBar with menu / COMMAND title / notifications
///  • Sticky header with "Field Reports" title and tactical filter tabs
///  • Scrollable list of report cards (SOS, Public, J1 Internal)
///  • BottomNav bar (Reports tab active)
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  int _selectedFilter = 0; // 0 = All, 1 = SOS, 2 = Public
  int _currentNavIndex = 1; // Reports tab

  final List<String> _filterLabels = ['ALL', 'SOS', 'PUBLIC'];

  // ─── Sample report data ───
  final List<_ReportData> _reports = const [
    _ReportData(
      type: _ReportType.sos,
      badgeLabel: 'SOS PRIORITY',
      timestamp: 'T-02:14',
      sector: 'SEC-DELTA',
      description:
          'Structural collapse reported at primary junction. Multiple casualties suspected. Requesting immediate heavy rescue detachment.',
    ),
    _ReportData(
      type: _ReportType.public,
      badgeLabel: 'PUBLIC INFO',
      timestamp: 'T-08:45',
      sector: 'DIST-04',
      description:
          'Water line rupture flooding secondary arterial route. Traffic significantly delayed, requesting public works assessment.',
    ),
    _ReportData(
      type: _ReportType.j1,
      badgeLabel: 'J1 INTERNAL',
      timestamp: 'T-14:22',
      sector: 'SEC-ALPHA',
      description:
          'Communications relay tower #4 reporting intermittent signal degradation. Engineering team dispatched.',
    ),
  ];

  List<_ReportData> get _filteredReports {
    if (_selectedFilter == 0) return _reports;
    if (_selectedFilter == 1) {
      return _reports.where((r) => r.type == _ReportType.sos).toList();
    }
    return _reports.where((r) => r.type == _ReportType.public).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
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
          // ─── Scrollable content ───
          Column(
            children: [
              // ─── Sticky header: title + filter tabs ───
              Container(
                color: AppColors.background,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Field Reports',
                      style: GoogleFonts.inter(
                        fontSize: 24,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 12),
                    // ── Tactical filter tabs ──
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainer,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(color: AppColors.outlineVariant),
                      ),
                      child: Row(
                        children: List.generate(_filterLabels.length, (i) {
                          final bool isActive = _selectedFilter == i;
                          return Expanded(
                            child: GestureDetector(
                              onTap: () =>
                                  setState(() => _selectedFilter = i),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: isActive
                                      ? AppColors.primary.withValues(alpha: 0.2)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(2),
                                  border: isActive
                                      ? Border.all(
                                          color: AppColors.primary
                                              .withValues(alpha: 0.3))
                                      : null,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  _filterLabels[i],
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1.2,
                                    color: isActive
                                        ? AppColors.primary
                                        : AppColors.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                  ],
                ),
              ),

              // ─── Report cards list ───
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
                  itemCount: _filteredReports.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: _buildReportCard(_filteredReports[index]),
                    );
                  },
                ),
              ),
            ],
          ),

          // ─── Bottom nav (fixed) ───
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
  //  REPORT CARD
  // ═══════════════════════════════════════
  Widget _buildReportCard(_ReportData report) {
    final Color accentColor;
    final Color badgeBg;
    final Color badgeFg;
    final bool hasBorder;

    switch (report.type) {
      case _ReportType.sos:
        accentColor = AppColors.error;
        badgeBg = AppColors.errorContainer;
        badgeFg = AppColors.onErrorContainer;
        hasBorder = false;
      case _ReportType.public:
        accentColor = AppColors.tertiary;
        badgeBg = AppColors.tertiaryContainer;
        badgeFg = AppColors.onTertiaryContainer;
        hasBorder = false;
      case _ReportType.j1:
        accentColor = AppColors.primary;
        badgeBg = AppColors.primary.withValues(alpha: 0.2);
        badgeFg = AppColors.primary;
        hasBorder = true;
    }

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.surfaceContainer,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: AppColors.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top accent border (2px coloured bar)
          Container(height: 2, color: accentColor),

          Stack(
            children: [
              // SOS: subtle red wash over the entire card
              if (report.type == _ReportType.sos)
                Positioned.fill(
                  child: Container(
                    color: AppColors.error.withValues(alpha: 0.05),
                  ),
                ),

              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Header: badge + time | sector ──
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            // Badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 3),
                              decoration: BoxDecoration(
                                color: badgeBg,
                                borderRadius: BorderRadius.circular(2),
                                border: hasBorder
                                    ? Border.all(
                                        color: accentColor
                                            .withValues(alpha: 0.3))
                                    : null,
                              ),
                              child: Text(
                                report.badgeLabel,
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.8,
                                  color: badgeFg,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            // Timestamp
                            Text(
                              report.timestamp,
                              style: GoogleFonts.spaceGrotesk(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: AppColors.outline,
                              ),
                            ),
                          ],
                        ),
                        // Sector badge
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(2),
                            border:
                                Border.all(color: AppColors.outlineVariant),
                          ),
                          child: Text(
                            report.sector,
                            style: GoogleFonts.spaceGrotesk(
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                              color: AppColors.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // ── Description ──
                    Text(
                      report.description,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w400,
                        height: 1.45,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 14),

                    // ── Action buttons: Verify | Reject ──
                    Row(
                      children: [
                        // Verify
                        Expanded(
                          child: Material(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(4),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(4),
                              onTap: () {},
                              child: Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 10),
                                alignment: Alignment.center,
                                child: Text(
                                  'VERIFY',
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 2,
                                    color: AppColors.onPrimary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        // Reject
                        Expanded(
                          child: Material(
                            color: Colors.transparent,
                            borderRadius: BorderRadius.circular(4),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(4),
                              onTap: () {},
                              child: Container(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 10),
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                      color: AppColors.outline),
                                ),
                                child: Text(
                                  'REJECT',
                                  style: GoogleFonts.spaceGrotesk(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 2,
                                    color: AppColors.onSurface,
                                  ),
                                ),
                              ),
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
        ],
      ),
    );
  }
}

// ─── Enums & data models ───

enum _ReportType { sos, public, j1 }

class _ReportData {
  final _ReportType type;
  final String badgeLabel;
  final String timestamp;
  final String sector;
  final String description;

  const _ReportData({
    required this.type,
    required this.badgeLabel,
    required this.timestamp,
    required this.sector,
    required this.description,
  });
}
