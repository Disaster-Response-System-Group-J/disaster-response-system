import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:command_mobile/components/app_drawer.dart';
import 'package:command_mobile/components/nav_bar.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int currentIndex = 0;

  // Mock Data
  final Map<String, dynamic> mockData = {
    "alerts": 8,
    "incidents": 142,
    "readiness": 84,
    "telemetry": [
      { "time": "08:42:11", "event": "Grid Fluctuation D-A", "status": "UNRESOLVED" },
      { "time": "08:35:00", "event": "Resource Dispatch Unit 7", "status": "EN ROUTE" }
    ]
  };

  final Color bgColor = const Color(0xFF10131A);
  final Color cardColor = const Color(0xFF191B23);
  final Color borderColor = const Color(0xFF2A2D35);
  final Color textSecondary = const Color(0xFF9CA3AF);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      drawer: const AppDrawer(currentRoute: '/dashboard'),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: Colors.black.withValues(alpha: 0.8),
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu, color: Color(0xFF4D8EFF)),
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
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
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications, color: Color(0xFF4D8EFF)),
                onPressed: () {},
              ),
              Positioned(
                top: 14,
                right: 14,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Colors.redAccent,
                    shape: BoxShape.circle,
                  ),
                ),
              )
            ],
          )
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
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 90), // Bottom padding for nav bar
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildPageHeader(),
                  const SizedBox(height: 16),
                  _buildMetricCards(),
                  const SizedBox(height: 20),
                  _buildNationalStatus(),
                  const SizedBox(height: 20),
                  _buildTelemetryTable(),
                ],
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: BottomNav(
              currentIndex: currentIndex,
              onTap: (index) {
                if (index == currentIndex) return;
                setState(() => currentIndex = index);
                _navigateTo(context, index);
              },
            ),
          )
        ],
      ),
    );
  }

  Widget _buildPageHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'OPERATIONS',
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 24,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Colors.redAccent,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  'LIVE',
                  style: GoogleFonts.inter(
                    color: Colors.redAccent,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            )
          ],
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: cardColor,
            border: Border.all(color: borderColor),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            'T-MINUS 04:12:00',
            style: GoogleFonts.inter(
              color: Colors.orangeAccent,
              
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCards() {
    return Column(
      children: [
        // Primary Critical Alerts Card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF3B1010), // Tint for critical
            border: Border.all(color: Colors.redAccent.withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'CRITICAL ALERTS',
                    style: GoogleFonts.inter(color: Colors.redAccent, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${mockData["alerts"]}',
                    style: GoogleFonts.inter(color: Colors.white, fontSize: 36, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 48),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Secondary Cards
        Row(
          children: [
            Expanded(
              child: _buildSmallCard(
                title: 'ACTIVE INCIDENTS',
                value: '${mockData["incidents"]}',
                valueColor: Colors.white,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildSmallCard(
                title: 'RESOURCE READINESS',
                value: '${mockData["readiness"]}%',
                valueColor: Colors.blueAccent,
              ),
            ),
          ],
        )
      ],
    );
  }

  Widget _buildSmallCard({required String title, required String value, required Color valueColor}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardColor,
        border: Border.all(color: borderColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.inter(color: textSecondary, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.0),
          ),
          const SizedBox(height: 8),
          Text(value, style: GoogleFonts.inter(color: valueColor, fontSize: 24, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildNationalStatus() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'NATIONAL STATUS',
          style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1.5, fontSize: 14),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: cardColor,
            border: Border.all(color: borderColor),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    const Icon(Icons.map_outlined, color: Colors.blueAccent),
                    const SizedBox(width: 12),
                    Text('Geo-Visualization Active', style: GoogleFonts.inter(color: textSecondary)),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFF2A2D35)),
              _buildDistrictRow('D-Alpha', 'CRITICAL', Colors.redAccent),
              _buildDistrictRow('D-Bravo', 'ELEVATED', Colors.orangeAccent),
              _buildDistrictRow('D-Charlie', 'NOMINAL', Colors.green),
              _buildDistrictRow('D-Delta', 'NOMINAL', Colors.green),
              const SizedBox(height: 8),
            ],
          ),
        )
      ],
    );
  }

  Widget _buildDistrictRow(String name, String status, Color statusColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(name, style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.w500)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: statusColor.withValues(alpha: 0.5)),
            ),
            child: Text(
              status,
              style: GoogleFonts.inter(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.0),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildTelemetryTable() {
    final List telemetry = mockData["telemetry"];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'LATEST TELEMETRY',
          style: GoogleFonts.inter(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1.5, fontSize: 14),
        ),
        const SizedBox(height: 12),
        Container(
          decoration: BoxDecoration(
            color: cardColor,
            border: Border.all(color: borderColor),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                child: Row(
                  children: [
                    Expanded(flex: 2, child: Text('TIME', style: GoogleFonts.inter(color: textSecondary, fontSize: 11, fontWeight: FontWeight.bold))),
                    Expanded(flex: 4, child: Text('EVENT', style: GoogleFonts.inter(color: textSecondary, fontSize: 11, fontWeight: FontWeight.bold))),
                    Expanded(flex: 3, child: Text('STATUS', style: GoogleFonts.inter(color: textSecondary, fontSize: 11, fontWeight: FontWeight.bold))),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFF2A2D35)),
              ...telemetry.map((item) {
                final statusColor = item['status'] == 'UNRESOLVED' ? Colors.redAccent : Colors.blueAccent;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: Text(item['time'], style: GoogleFonts.inter(color: Colors.white70,  fontSize: 12)),
                      ),
                      Expanded(
                        flex: 4,
                        child: Text(item['event'], style: GoogleFonts.inter(color: Colors.white, fontSize: 13)),
                      ),
                      Expanded(
                        flex: 3,
                        child: Row(
                          children: [
                            Container(width: 6, height: 6, decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle)),
                            const SizedBox(width: 6),
                            Text(item['status'], style: GoogleFonts.inter(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
      ],
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
}
