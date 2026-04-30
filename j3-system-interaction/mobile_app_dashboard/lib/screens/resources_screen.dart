import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../components/nav_bar.dart';

/// Resources screen — placeholder.
class ResourcesScreen extends StatefulWidget {
  const ResourcesScreen({super.key});

  @override
  State<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends State<ResourcesScreen> {
  int _currentNavIndex = 3; // Resources tab

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
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
          // ─── Content ───
          Positioned.fill(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.inventory_2_outlined,
                  size: 64,
                  color: AppColors.primary.withValues(alpha: 0.3),
                ),
                const SizedBox(height: 16),
                Text(
                  'RESOURCES',
                  style: GoogleFonts.spaceGrotesk(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 3,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Coming soon',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w400,
                    color: AppColors.outline,
                  ),
                ),
              ],
            ),
          ),
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
}
