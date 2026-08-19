import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../state/auth_state.dart';
import '../theme.dart';
import '../widgets/mobile_ui.dart';

const _roleLabels = {
  'INCHARGE': 'ATTENDANCE IN-CHARGE',
  'TEACHER': 'TEACHER',
  'ADMIN': 'ADMINISTRATOR',
  'HOD': 'HOD',
  'VICE_PRINCIPAL': 'VICE PRINCIPAL',
  'PRINCIPAL': 'PRINCIPAL',
  'HEADMASTER': 'HEADMASTER',
};

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? summary;
  int classCount = 0;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final auth = context.read<AuthState>();
      final date = todayYmd();
      final results = await Future.wait([
        auth.api.attendanceSummary(date),
        auth.api.classes(),
      ]);
      setState(() {
        summary = results[0] as Map<String, dynamic>;
        classCount = (results[1] as List).length;
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final fullName = (auth.user?['name'] ?? 'there').toString();
    final name = fullName.split(' ').first;
    final role = _roleLabels[auth.role] ?? (auth.role.isEmpty ? 'TEACHER' : auth.role);
    final dateChip = DateFormat('d MMM yyyy').format(DateTime.now());

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hello, $name 👋',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: PresenceColors.text),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      role,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        color: PresenceColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              CircleAvatar(
                radius: 24,
                backgroundColor: PresenceColors.primaryDark,
                child: Text(
                  initialsFor(fullName).substring(0, 1),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: PresenceColors.border),
                boxShadow: [
                  BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 1)),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.calendar_today_outlined, size: 14, color: PresenceColors.primaryDark),
                  const SizedBox(width: 6),
                  Text('Today · $dateChip', style: const TextStyle(fontSize: 12, color: PresenceColors.muted)),
                ],
              ),
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text('Could not load live stats: $error', style: const TextStyle(color: PresenceColors.danger, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          if (loading && summary == null)
            const Padding(
              padding: EdgeInsets.all(32),
              child: Center(child: CircularProgressIndicator()),
            )
          else
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.25,
              children: [
                MobileKpi(
                  label: 'Marked',
                  value: '${summary?['marked'] ?? 0}',
                  icon: Icons.fact_check_outlined,
                  iconBg: const Color(0xFFFFFBEB),
                  iconColor: const Color(0xFFD97706),
                  cardBg: const Color(0xFFFFFBEB).withValues(alpha: 0.8),
                ),
                MobileKpi(
                  label: 'Present',
                  value: '${summary?['present'] ?? 0}',
                  icon: Icons.person_outline,
                  iconBg: const Color(0xFFF0F9FF),
                  iconColor: const Color(0xFF0284C7),
                  cardBg: const Color(0xFFF0F9FF).withValues(alpha: 0.8),
                ),
                MobileKpi(
                  label: 'Absent',
                  value: '${summary?['absent'] ?? 0}',
                  icon: Icons.person_off_outlined,
                  iconBg: const Color(0xFFFFF1F2),
                  iconColor: const Color(0xFFF43F5E),
                  cardBg: const Color(0xFFFFF1F2).withValues(alpha: 0.8),
                ),
                MobileKpi(
                  label: 'Classes',
                  value: '${summary?['totalClasses'] ?? classCount}',
                  icon: Icons.menu_book_outlined,
                  iconBg: const Color(0xFFEEF2FF),
                  iconColor: const Color(0xFF4F46E5),
                  cardBg: const Color(0xFFEEF2FF).withValues(alpha: 0.7),
                ),
              ],
            ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: () => context.go('/attendance'),
            icon: const Icon(Icons.fact_check),
            label: const Text('Mark Attendance'),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(50),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => context.go('/reports'),
            icon: const Icon(Icons.bar_chart),
            label: const Text('View Reports'),
            style: OutlinedButton.styleFrom(
              foregroundColor: PresenceColors.primaryDark,
              side: const BorderSide(color: PresenceColors.primaryDark, width: 2),
              minimumSize: const Size.fromHeight(50),
              textStyle: const TextStyle(fontWeight: FontWeight.w800),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Quick Actions', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Row(
            children: [
              _Quick(Icons.calendar_month_outlined, 'Calendar', const Color(0xFFFFFBEB), const Color(0xFFD97706), () => context.go('/calendar')),
              _Quick(Icons.campaign_outlined, 'Notice', const Color(0xFFF5F3FF), const Color(0xFF7C3AED), () => context.go('/notices')),
              _Quick(Icons.notifications_outlined, 'Notifications', const Color(0xFFF0F9FF), const Color(0xFF0284C7), () => context.go('/notifications')),
              _Quick(Icons.bar_chart_outlined, 'Reports', const Color(0xFFECFDF5), const Color(0xFF059669), () => context.go('/reports')),
            ],
          ),
          const SizedBox(height: 16),
          Material(
            color: PresenceColors.accent,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              onTap: () => context.go('/notices'),
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: PresenceColors.primaryDark,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.campaign, color: Colors.white, size: 18),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Stay Updated: Check notices and upcoming events regularly.',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: PresenceColors.text),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Quick extends StatelessWidget {
  const _Quick(this.icon, this.label, this.bg, this.fg, this.onTap);
  final IconData icon;
  final String label;
  final Color bg;
  final Color fg;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 3),
        child: Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
              child: Column(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
                    child: Icon(icon, color: fg, size: 20),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, height: 1.15),
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
