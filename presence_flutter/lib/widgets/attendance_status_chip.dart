import 'package:flutter/material.dart';

import '../config.dart';

const extraStatusOptions = [
  StatusOption('H', 'Half Day', 0xFF8B5CF6),
  StatusOption('L', 'Late', 0xFFF59E0B),
  StatusOption('OH', 'OD - Half Day', 0xFF06B6D4),
  StatusOption('OF', 'OD - Full Day', 0xFF0F766E),
];

class AttendanceStatusChip extends StatelessWidget {
  const AttendanceStatusChip({
    super.key,
    required this.status,
    required this.onChanged,
    this.enabled = true,
  });

  final String status;
  final ValueChanged<String> onChanged;
  final bool enabled;

  void _togglePresentAbsent() {
    if (!enabled) return;
    final code = statusMeta(status).code;
    if (code == 'H' || code == 'L' || code == 'OH' || code == 'OF') {
      onChanged('P');
      return;
    }
    onChanged(code == 'A' ? 'P' : 'A');
  }

  @override
  Widget build(BuildContext context) {
    final meta = statusMeta(status);
    final color = Color(meta.color);
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: Material(
        color: color,
        borderRadius: BorderRadius.circular(999),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            InkWell(
              onTap: enabled ? _togglePresentAbsent : null,
              borderRadius: const BorderRadius.horizontal(left: Radius.circular(999)),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
                child: Text(
                  meta.label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
            Container(width: 1, height: 18, color: Colors.white38),
            PopupMenuButton<String>(
              enabled: enabled,
              tooltip: 'More status options',
              padding: EdgeInsets.zero,
              offset: const Offset(0, 36),
              onSelected: enabled ? onChanged : null,
              itemBuilder: (ctx) => [
                for (final opt in extraStatusOptions)
                  PopupMenuItem(
                    value: opt.code,
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: Color(opt.color),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(opt.label),
                      ],
                    ),
                  ),
              ],
              child: const Padding(
                padding: EdgeInsets.fromLTRB(4, 8, 8, 8),
                child: Icon(Icons.keyboard_arrow_down, color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
