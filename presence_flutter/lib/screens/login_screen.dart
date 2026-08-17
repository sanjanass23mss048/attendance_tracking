import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final emailCtrl = TextEditingController(text: 'neha.sharma@brightfuture.edu.in');
  final passCtrl = TextEditingController();
  final phoneCtrl = TextEditingController();
  final otpCtrl = TextEditingController();

  bool staffMode = false;
  bool otpSent = false;
  bool loading = false;
  bool obscure = true;
  String? error;
  String? phoneHint;
  String? devOtp;
  int resendIn = 0;
  Timer? _resendTimer;

  @override
  void dispose() {
    _resendTimer?.cancel();
    emailCtrl.dispose();
    passCtrl.dispose();
    phoneCtrl.dispose();
    otpCtrl.dispose();
    super.dispose();
  }

  void _startResendCountdown([int seconds = 45]) {
    _resendTimer?.cancel();
    setState(() => resendIn = seconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (resendIn <= 1) {
        timer.cancel();
        setState(() => resendIn = 0);
      } else {
        setState(() => resendIn -= 1);
      }
    });
  }

  Future<void> _submitStaff() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await context.read<AuthState>().login(emailCtrl.text, passCtrl.text);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _requestOtp() async {
    final phone = phoneCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (phone.length != 10) {
      setState(() => error = 'Enter a 10-digit mobile number');
      return;
    }
    setState(() {
      loading = true;
      error = null;
      devOtp = null;
    });
    try {
      final data = await context.read<AuthState>().requestParentOtp(phone);
      final echo = data['devOtp']?.toString();
      setState(() {
        otpSent = true;
        phoneHint = data['phoneHint']?.toString();
        if (echo != null && echo.isNotEmpty) {
          devOtp = echo;
          otpCtrl.text = echo;
        }
      });
      _startResendCountdown(data['retryAfterSec'] is int ? data['retryAfterSec'] as int : 45);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _verifyOtp() async {
    final phone = phoneCtrl.text.replaceAll(RegExp(r'\D'), '');
    final otp = otpCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (otp.length < 4) {
      setState(() => error = 'Enter the OTP sent to your phone');
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await context.read<AuthState>().loginWithParentOtp(phone, otp);
    } catch (e) {
      setState(() => error = e.toString());
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
                  const Text('Presence',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 36,
                        fontWeight: FontWeight.w800,
                      )),
                  const SizedBox(height: 6),
                  const Text('School attendance',
                      style: TextStyle(color: Color(0xFFBFDBFE))),
                  const SizedBox(height: 24),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text('Sign in',
                              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 14),
                          SegmentedButton<bool>(
                            segments: const [
                              ButtonSegment(value: false, label: Text('Parent')),
                              ButtonSegment(value: true, label: Text('Staff')),
                            ],
                            selected: {staffMode},
                            onSelectionChanged: (value) {
                              setState(() {
                                staffMode = value.first;
                                error = null;
                              });
                            },
                          ),
                          const SizedBox(height: 16),
                          if (staffMode) _staffForm() else _parentForm(),
                          if (error != null) ...[
                            const SizedBox(height: 10),
                            Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                          ],
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: loading
                                ? null
                                : staffMode
                                    ? _submitStaff
                                    : (otpSent ? _verifyOtp : _requestOtp),
                            child: loading
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white),
                                  )
                                : Text(staffMode
                                    ? 'Sign in'
                                    : otpSent
                                        ? 'Verify OTP'
                                        : 'Get OTP'),
                          ),
                          if (staffMode)
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: loading ? null : () => context.push('/forgot-password'),
                                child: const Text('Forgot password?'),
                              ),
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

  Widget _staffForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: emailCtrl,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Email'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: passCtrl,
          obscureText: obscure,
          decoration: InputDecoration(
            labelText: 'Password',
            suffixIcon: IconButton(
              icon: Icon(obscure ? Icons.visibility : Icons.visibility_off),
              onPressed: () => setState(() => obscure = !obscure),
            ),
          ),
          onSubmitted: (_) => _submitStaff(),
        ),
      ],
    );
  }

  Widget _parentForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: phoneCtrl,
          enabled: !otpSent,
          keyboardType: TextInputType.phone,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(10),
          ],
          decoration: const InputDecoration(
            labelText: 'Mobile number',
            prefixText: '+91  ',
            hintText: '10-digit number',
          ),
          onSubmitted: (_) {
            if (!otpSent) _requestOtp();
          },
        ),
        if (otpSent) ...[
          const SizedBox(height: 12),
          TextField(
            controller: otpCtrl,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            decoration: InputDecoration(
              labelText: 'OTP',
              hintText: '6-digit code',
              helperText: phoneHint == null ? null : 'Sent to $phoneHint',
            ),
            onSubmitted: (_) => _verifyOtp(),
          ),
          if (devOtp != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'SMS not configured — use OTP $devOtp',
                style: const TextStyle(fontSize: 12, color: PresenceColors.muted),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton(
                onPressed: loading
                    ? null
                    : () {
                        _resendTimer?.cancel();
                        setState(() {
                          otpSent = false;
                          otpCtrl.clear();
                          devOtp = null;
                          resendIn = 0;
                          error = null;
                        });
                      },
                child: const Text('Change number'),
              ),
              const Spacer(),
              TextButton(
                onPressed: loading || resendIn > 0 ? null : _requestOtp,
                child: Text(resendIn > 0 ? 'Resend in ${resendIn}s' : 'Resend OTP'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
