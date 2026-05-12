import 'package:flutter/material.dart';

import '../services/auth_service.dart';

enum _AuthMode { login, register }

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  final _loginFormKey = GlobalKey<FormState>();
  final _registerFormKey = GlobalKey<FormState>();

  final _loginEmailController = TextEditingController();
  final _loginPasswordController = TextEditingController();

  final _nameController = TextEditingController();
  final _registerEmailController = TextEditingController();
  final _registerPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  _AuthMode _mode = _AuthMode.login;
  bool _busy = false;

  @override
  void dispose() {
    _loginEmailController.dispose();
    _loginPasswordController.dispose();
    _nameController.dispose();
    _registerEmailController.dispose();
    _registerPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submitLogin() async {
    if (!_loginFormKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _busy = true;
    });

    try {
      await AuthService.instance.login(
        email: _loginEmailController.text,
        password: _loginPasswordController.text,
      );
    } catch (e) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _submitRegister() async {
    if (!_registerFormKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _busy = true;
    });

    try {
      await AuthService.instance.register(
        name: _nameController.text,
        email: _registerEmailController.text,
        password: _registerPasswordController.text,
      );
    } catch (e) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _loginAsMockUser() async {
    setState(() {
      _busy = true;
    });

    try {
      await AuthService.instance.loginWithMockUser();
    } catch (e) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  void _switchMode(_AuthMode mode) {
    setState(() {
      _mode = mode;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Card(
                elevation: 0,
                color: theme.colorScheme.surfaceContainerHighest,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Icon(
                        Icons.shield_outlined,
                        size: 48,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'J1 Disaster Response',
                        style: theme.textTheme.headlineSmall,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Sign in to sync your local SQLite session, or create a new account for this device.',
                        style: theme.textTheme.bodyMedium,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 20),
                      SegmentedButton<_AuthMode>(
                        segments: const [
                          ButtonSegment(
                            value: _AuthMode.login,
                            label: Text('Login'),
                            icon: Icon(Icons.login),
                          ),
                          ButtonSegment(
                            value: _AuthMode.register,
                            label: Text('Register'),
                            icon: Icon(Icons.person_add_alt_1),
                          ),
                        ],
                        selected: {_mode},
                        onSelectionChanged: (selection) {
                          _switchMode(selection.first);
                        },
                      ),
                      const SizedBox(height: 20),
                      if (_mode == _AuthMode.login)
                        _LoginForm(
                          formKey: _loginFormKey,
                          emailController: _loginEmailController,
                          passwordController: _loginPasswordController,
                          busy: _busy,
                          onSubmit: _submitLogin,
                          onMockLogin: _loginAsMockUser,
                        )
                      else
                        _RegisterForm(
                          formKey: _registerFormKey,
                          nameController: _nameController,
                          emailController: _registerEmailController,
                          passwordController: _registerPasswordController,
                          confirmPasswordController: _confirmPasswordController,
                          busy: _busy,
                          onSubmit: _submitRegister,
                        ),
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surface,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: theme.colorScheme.outlineVariant,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Mock user for testing',
                              style: theme.textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            const Text('Email: mock.user@j1.local'),
                            const Text('Password: mock1234'),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                onPressed: _busy ? null : _loginAsMockUser,
                                icon: const Icon(Icons.bolt),
                                label: const Text('Continue as Mock User'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoginForm extends StatelessWidget {
  const _LoginForm({
    required this.formKey,
    required this.emailController,
    required this.passwordController,
    required this.busy,
    required this.onSubmit,
    required this.onMockLogin,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool busy;
  final Future<void> Function() onSubmit;
  final Future<void> Function() onMockLogin;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: emailController,
            decoration: const InputDecoration(
              labelText: 'Email',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.emailAddress,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Enter your email';
              }
              if (!value.contains('@')) {
                return 'Enter a valid email';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: passwordController,
            decoration: const InputDecoration(
              labelText: 'Password',
              border: OutlineInputBorder(),
            ),
            obscureText: true,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Enter your password';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy ? null : onSubmit,
            child: Text(busy ? 'Signing in...' : 'Sign In'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: busy ? null : onMockLogin,
            child: const Text('Use mock user instead'),
          ),
        ],
      ),
    );
  }
}

class _RegisterForm extends StatelessWidget {
  const _RegisterForm({
    required this.formKey,
    required this.nameController,
    required this.emailController,
    required this.passwordController,
    required this.confirmPasswordController,
    required this.busy,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController nameController;
  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController confirmPasswordController;
  final bool busy;
  final Future<void> Function() onSubmit;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: nameController,
            decoration: const InputDecoration(
              labelText: 'Full name',
              border: OutlineInputBorder(),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Enter your name';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: emailController,
            decoration: const InputDecoration(
              labelText: 'Email',
              border: OutlineInputBorder(),
            ),
            keyboardType: TextInputType.emailAddress,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Enter your email';
              }
              if (!value.contains('@')) {
                return 'Enter a valid email';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: passwordController,
            decoration: const InputDecoration(
              labelText: 'Password',
              border: OutlineInputBorder(),
            ),
            obscureText: true,
            validator: (value) {
              if (value == null || value.length < 6) {
                return 'Use at least 6 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: confirmPasswordController,
            decoration: const InputDecoration(
              labelText: 'Confirm password',
              border: OutlineInputBorder(),
            ),
            obscureText: true,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Confirm your password';
              }
              if (value != passwordController.text) {
                return 'Passwords do not match';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy ? null : onSubmit,
            child: Text(busy ? 'Creating account...' : 'Create Account'),
          ),
        ],
      ),
    );
  }
}
