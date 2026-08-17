import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final emailCtrl = TextEditingController();
  bool loading = false;
  bool sent = false;
  String? error;
  String? message;
  String? resetLink;

  @override
  void dispose() {
    emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      loading = true;
      error = null;
      message = null;
      resetLink = null;
    });
    try {
      final data = await context.read<AuthState>().api.forgotPassword(emailCtrl.text);
      if (!mounted) return;
      setState(() {
        sent = true;
        message = data['message']?.toString() ??
            'If that email is registered at this school, we sent a password reset link.';
        resetLink = data['resetLink']?.toString();
      });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PresenceColors.primaryDark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                children: [
                  const Text(
                    'Presence',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Forgot your password?',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            'Enter your school account email and we will send a reset link.',
                            style: TextStyle(color: PresenceColors.muted, fontSize: 13),
                          ),
                          const SizedBox(height: 16),
                          if (message != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                message!,
                                style: const TextStyle(color: PresenceColors.success),
                              ),
                            ),
                          if (resetLink != null && resetLink!.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                'Dev reset link: $resetLink',
                                style: const TextStyle(fontSize: 11, color: PresenceColors.muted),
                              ),
                            ),
                          if (error != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Text(
                                error!,
                                style: const TextStyle(color: PresenceColors.danger),
                              ),
                            ),
                          TextField(
                            controller: emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            enabled: !sent,
                            decoration: const InputDecoration(labelText: 'Email'),
                          ),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: loading || sent ? null : _submit,
                            child: loading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : Text(sent ? 'Link sent' : 'Send reset link'),
                          ),
                          TextButton(
                            onPressed: () => context.go('/login'),
                            child: const Text('Back to sign in'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
