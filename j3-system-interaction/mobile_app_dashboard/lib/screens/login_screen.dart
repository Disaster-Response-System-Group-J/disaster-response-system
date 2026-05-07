import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import '../services/auth_service.dart';
import '../models/user.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _serviceIdController = TextEditingController();
  final _passkeyController = TextEditingController();
  bool _obscurePasskey = true;
  int _selectedRoleIndex = 0; // 0=Officer, 1=Logistics, 2=Response Officer
  bool _isLoading = false;

  late AnimationController _glowController;
  late Animation<double> _glowAnimation;

  final List<String> _roles = ['OFFICER', 'LOGISTICS', 'RESPONSE OFFICER'];

  @override
  void initState() {
    super.initState();
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _glowAnimation = Tween<double>(begin: 0.15, end: 0.35).animate(
      CurvedAnimation(parent: _glowController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _serviceIdController.dispose();
    _passkeyController.dispose();
    _glowController.dispose();
    super.dispose();
  }

  void _handleLogin() {
    final serviceId = _serviceIdController.text.trim();
    final passkey = _passkeyController.text.trim();

    if (serviceId.isEmpty || passkey.isEmpty) {
      _showError('Please enter both Service ID and Passkey');
      return;
    }

    setState(() => _isLoading = true);

    // Simulate a brief network delay and authenticate
    Future.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;

      final User? user = AuthService.authenticate(serviceId, passkey);

      setState(() => _isLoading = false);

      if (user != null) {
        Navigator.pushReplacementNamed(
          context,
          '/dashboard',
          arguments: {
            'serviceId': user.serviceId,
            'role': user.role,
            'zone': user.zone,
          },
        );
      } else {
        _showError('Invalid credentials. Access denied.');
      }
    });
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline, color: AppColors.error, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: GoogleFonts.spaceGrotesk(
                  color: AppColors.onErrorContainer,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.errorContainer,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // ─── Background gradient overlay ───
          Positioned.fill(
            child: Container(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 1.5,
                  colors: [
                    Color(0x1AADC6FF), // primary/10
                    AppColors.background,
                    AppColors.background,
                  ],
                ),
              ),
            ),
          ),
          // Dark overlay
          Positioned.fill(
            child: Container(color: Colors.black.withValues(alpha: 0.8)),
          ),

          // ─── Main content ───
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildHeader(),
                      const SizedBox(height: 32),
                      _buildLoginForm(),
                      const SizedBox(height: 24),
                      _buildFooter(),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════
  //  HEADER — Shield icon + COMMAND + subtitle
  // ═══════════════════════════════════════════════
  Widget _buildHeader() {
    return Column(
      children: [
        // Shield icon with glow
        AnimatedBuilder(
          animation: _glowAnimation,
          builder: (context, child) {
            return Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.surfaceContainer,
                border: Border.all(color: Colors.white10),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary
                        .withValues(alpha: _glowAnimation.value),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: const Icon(
                Icons.shield,
                size: 32,
                color: AppColors.primary,
              ),
            );
          },
        ),
        const SizedBox(height: 16),
        // "COMMAND"
        Text(
          'COMMAND',
          style: GoogleFonts.inter(
            fontSize: 24,
            fontWeight: FontWeight.w600,
            color: AppColors.onSurface,
            letterSpacing: 4,
          ),
        ),
        const SizedBox(height: 8),
        // "Secure Access Portal"
        Text(
          'SECURE ACCESS PORTAL',
          style: GoogleFonts.spaceGrotesk(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppColors.onSurfaceVariant,
            letterSpacing: 3,
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════
  //  LOGIN FORM PANEL
  // ═══════════════════════════════════════════════
  Widget _buildLoginForm() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white10),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top accent bar
          Container(height: 2, color: AppColors.primary.withValues(alpha: 0.5)),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Role Selection ──
                _buildSectionLabel('DESIGNATION'),
                const SizedBox(height: 8),
                _buildRoleSelector(),
                const SizedBox(height: 24),

                // ── Service ID ──
                _buildSectionLabel('SERVICE ID'),
                const SizedBox(height: 8),
                _buildServiceIdField(),
                const SizedBox(height: 24),

                // ── Secure Passkey ──
                _buildSectionLabel('SECURE PASSKEY'),
                const SizedBox(height: 8),
                _buildPasskeyField(),
                const SizedBox(height: 28),

                // ── Submit Button ──
                _buildSubmitButton(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.spaceGrotesk(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
        color: AppColors.onSurfaceVariant,
      ),
    );
  }

  // ─── Role Selector (3 buttons) ───
  Widget _buildRoleSelector() {
    return Row(
      children: List.generate(_roles.length, (index) {
        final isSelected = _selectedRoleIndex == index;
        return Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _selectedRoleIndex = index),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: EdgeInsets.only(
                left: index == 0 ? 0 : 4,
                right: index == 2 ? 0 : 4,
              ),
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.surface
                    : AppColors.surfaceVariant,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: isSelected
                      ? AppColors.primary.withValues(alpha: 0.3)
                      : Colors.white.withValues(alpha: 0.05),
                ),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          blurRadius: 15,
                        ),
                      ]
                    : null,
              ),
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    _roles[index],
                    maxLines: 1,
                    style: GoogleFonts.spaceGrotesk(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 0.7,
                      color: isSelected
                          ? AppColors.primary
                          : AppColors.onSurfaceVariant.withValues(alpha: 0.6),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  // ─── Service ID Field ───
  Widget _buildServiceIdField() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surfaceDim,
        border: Border(bottom: BorderSide(color: Colors.white10)),
      ),
      child: TextField(
        controller: _serviceIdController,
        style: GoogleFonts.spaceGrotesk(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.7,
          color: AppColors.onSurface,
        ),
        decoration: InputDecoration(
          prefixIcon: const Icon(
            Icons.badge,
            color: AppColors.outlineVariant,
            size: 20,
          ),
          hintText: 'Enter ID (e.g., CMD-049)',
          hintStyle: GoogleFonts.spaceGrotesk(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.outlineVariant,
          ),
          filled: true,
          fillColor: AppColors.surfaceDim,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }

  // ─── Passkey Field ───
  Widget _buildPasskeyField() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surfaceDim,
        border: Border(bottom: BorderSide(color: Colors.white10)),
      ),
      child: TextField(
        controller: _passkeyController,
        obscureText: _obscurePasskey,
        style: GoogleFonts.spaceGrotesk(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.7,
          color: AppColors.onSurface,
        ),
        decoration: InputDecoration(
          prefixIcon: const Icon(
            Icons.key,
            color: AppColors.outlineVariant,
            size: 20,
          ),
          suffixIcon: GestureDetector(
            onTap: () => setState(() => _obscurePasskey = !_obscurePasskey),
            child: Icon(
              _obscurePasskey ? Icons.visibility_off : Icons.visibility,
              color: AppColors.outlineVariant,
              size: 20,
            ),
          ),
          hintText: '••••••••',
          hintStyle: GoogleFonts.spaceGrotesk(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: AppColors.outlineVariant,
          ),
          filled: true,
          fillColor: AppColors.surfaceDim,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 16),
        ),
      ),
    );
  }

  // ─── Submit Button ───
  Widget _buildSubmitButton() {
    return AnimatedBuilder(
      animation: _glowAnimation,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary
                    .withValues(alpha: _glowAnimation.value * 0.6),
                blurRadius: 20,
                spreadRadius: -2,
              ),
            ],
          ),
          child: ElevatedButton(
            onPressed: _isLoading ? null : _handleLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(4),
              ),
              disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.5),
            ),
            child: _isLoading
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.onPrimary,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.login, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'INITIALIZE SESSION',
                        style: GoogleFonts.spaceGrotesk(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 3,
                        ),
                      ),
                    ],
                  ),
          ),
        );
      },
    );
  }

  // ═══════════════════════════════════════════════
  //  FOOTER — Lock icon + "Secured Connection Active"
  // ═══════════════════════════════════════════════
  Widget _buildFooter() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(Icons.lock, size: 16, color: AppColors.secondary),
        const SizedBox(width: 8),
        Text(
          'SECURED CONNECTION ACTIVE',
          style: GoogleFonts.spaceGrotesk(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: AppColors.secondary,
            letterSpacing: 3,
          ),
        ),
      ],
    );
  }
}
