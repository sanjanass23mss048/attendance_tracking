import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

String formatClassLabel(String className) {
  final text = className.trim();
  if (text.isEmpty) return text;
  final upper = text.toUpperCase();
  if (upper == 'LKG' || upper == 'UKG') return upper;
  if (RegExp(r'^\d+$').hasMatch(text)) return 'Class $text';
  if (text.toLowerCase().startsWith('class ')) return text;
  return 'Class $text';
}

int classSortRank(String name) {
  final key = name.trim().toUpperCase().replaceFirst(RegExp(r'^CLASS\s+'), '');
  if (key == 'LKG') return 0;
  if (key == 'UKG') return 1;
  final n = int.tryParse(key);
  if (n != null) return 1 + n;
  return 1000 + (key.isEmpty ? 0 : key.codeUnitAt(0));
}

int compareClassNames(String a, String b) {
  final ra = classSortRank(a);
  final rb = classSortRank(b);
  if (ra != rb) return ra.compareTo(rb);
  return a.compareTo(b);
}

String initialsFor(String? name) {
  final parts = (name ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  if (parts.length == 1) {
    final p = parts.first;
    return p.substring(0, math.min(2, p.length)).toUpperCase();
  }
  return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
}

class PastelTone {
  const PastelTone({
    required this.accent,
    required this.edge,
    required this.ring,
    required this.iconBg,
  });
  final Color accent;
  final Color edge;
  final Color ring;
  final Color iconBg;
}

const pastelTones = [
  PastelTone(accent: Color(0xFF6D28D9), edge: Color(0xFF8B5CF6), ring: Color(0xFF8B5CF6), iconBg: Color(0xFFF5F3FF)),
  PastelTone(accent: Color(0xFF0369A1), edge: Color(0xFF0EA5E9), ring: Color(0xFF0EA5E9), iconBg: Color(0xFFF0F9FF)),
  PastelTone(accent: Color(0xFF047857), edge: Color(0xFF10B981), ring: Color(0xFF10B981), iconBg: Color(0xFFECFDF5)),
  PastelTone(accent: Color(0xFFB45309), edge: Color(0xFFF59E0B), ring: Color(0xFFF59E0B), iconBg: Color(0xFFFFFBEB)),
  PastelTone(accent: Color(0xFFBE123C), edge: Color(0xFFF43F5E), ring: Color(0xFFF43F5E), iconBg: Color(0xFFFFF1F2)),
  PastelTone(accent: Color(0xFF1E3A8A), edge: Color(0xFF6366F1), ring: Color(0xFF6366F1), iconBg: Color(0xFFEEF2FF)),
];

PastelTone pastelAt(int i) => pastelTones[i.abs() % pastelTones.length];

class MobileKpi extends StatelessWidget {
  const MobileKpi({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.cardBg,
    this.hint,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final Color cardBg;
  final String? hint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final child = Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.8)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: PresenceColors.text),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: PresenceColors.muted)),
          if (hint != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(hint!, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
            ),
        ],
      ),
    );
    if (onTap == null) return child;
    return GestureDetector(onTap: onTap, child: child);
  }
}

class CircularAttendance extends StatelessWidget {
  const CircularAttendance({
    super.key,
    required this.percent,
    this.unmarked = false,
    this.color = PresenceColors.primaryDark,
    this.size = 56,
  });

  final num percent;
  final bool unmarked;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = unmarked ? 0.0 : (percent.toDouble().clamp(0, 100) / 100);
    final label = unmarked ? '—' : '${percent % 1 == 0 ? percent.toInt() : percent}%';
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _RingPainter(progress: p, color: color),
        child: Center(
          child: Text(
            label,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.color});
  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2 - 5;
    final bg = Paint()
      ..color = const Color(0xFFE5E7EB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6;
    final fg = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 6;
    canvas.drawCircle(c, r, bg);
    canvas.drawArc(Rect.fromCircle(center: c, radius: r), -math.pi / 2, 2 * math.pi * progress, false, fg);
  }

  @override
  bool shouldRepaint(covariant _RingPainter old) => old.progress != progress || old.color != color;
}

class MobileStandardCard extends StatelessWidget {
  const MobileStandardCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.present,
    required this.absent,
    required this.percent,
    required this.tone,
    this.unmarked = false,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final num present;
  final num absent;
  final num percent;
  final PastelTone tone;
  final bool unmarked;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border(
              left: BorderSide(color: tone.edge, width: 5),
              top: const BorderSide(color: Color(0xFFF3F4F6)),
              right: const BorderSide(color: Color(0xFFF3F4F6)),
              bottom: const BorderSide(color: Color(0xFFF3F4F6)),
            ),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2)),
            ],
          ),
          child: Row(
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: tone.accent),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  subtitle,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: PresenceColors.muted),
                                ),
                              ],
                            ),
                          ),
                          CircularAttendance(percent: percent, unmarked: unmarked, color: tone.ring),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Divider(height: 1, color: Color(0xFFF3F4F6)),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _metric('Present', '$present', const Color(0xFF059669)),
                          _metric('Absent', '$absent', const Color(0xFFE11D48)),
                          _metric(
                            'Attendance',
                            unmarked ? 'Not marked' : '$percent%',
                            unmarked ? PresenceColors.muted : const Color(0xFF059669),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(right: 8),
                child: Icon(Icons.chevron_right, color: Color(0xFFD1D5DB)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metric(String label, String value, Color color) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0.4, color: Color(0xFF9CA3AF)),
          ),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color)),
        ],
      ),
    );
  }
}

class PillToggle extends StatelessWidget {
  const PillToggle({super.key, required this.labels, required this.index, required this.onChanged});

  final List<String> labels;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 1)),
        ],
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(i),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(
                    color: i == index ? PresenceColors.primaryDark : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    labels[i],
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: i == index ? Colors.white : PresenceColors.primaryDark,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class PresenceBottomNav extends StatelessWidget {
  const PresenceBottomNav({
    super.key,
    required this.tabs,
    required this.location,
    required this.onSelect,
  });

  final List<({String path, String label, IconData icon})> tabs;
  final String location;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final selected = tabs.indexWhere((t) => location == t.path || location.startsWith('${t.path}/'));
    return Container(
      decoration: BoxDecoration(
        color: PresenceColors.primaryDark,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 24,
            offset: const Offset(0, -8),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 6, 4, 8),
          child: Row(
            children: [
              for (var i = 0; i < tabs.length; i++)
                Expanded(
                  child: InkWell(
                    onTap: () => onSelect(tabs[i].path),
                    borderRadius: BorderRadius.circular(12),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            tabs[i].icon,
                            size: 22,
                            color: i == selected ? PresenceColors.accent : Colors.white.withValues(alpha: 0.7),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            tabs[i].label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: i == selected ? PresenceColors.accent : Colors.white.withValues(alpha: 0.7),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
