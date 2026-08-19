import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/parent_child_dropdown.dart';

class ParentProfileScreen extends StatelessWidget {
  const ParentProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();

    if (students.loading && !students.loaded) {
      return const Center(child: CircularProgressIndicator());
    }
    if (students.error != null && students.children.isEmpty) {
      return Center(
        child: Text(students.error!, style: const TextStyle(color: PresenceColors.danger)),
      );
    }
    if (students.children.isEmpty) {
      return const Center(child: Text('No linked student profile.'));
    }

    final child = students.selected!;

    return RefreshIndicator(
      onRefresh: () => students.load(force: true),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 28),
        children: [
          const ParentChildDropdown(),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: _ChildDetailSection(child: child),
          ),
        ],
      ),
    );
  }
}

class _ChildDetailSection extends StatelessWidget {
  const _ChildDetailSection({required this.child});
  final Map<String, dynamic> child;

  @override
  Widget build(BuildContext context) {
    final classLabel = ParentStudentsState.displayClassLabelFor(child);
    final name = child['name']?.toString() ?? 'Student';
    final initials = ParentStudentsState.initialsFor(name);

    final rows = <_InfoItem>[
      _InfoItem(Icons.tag_rounded, 'Roll No', child['rollNo']?.toString()),
      _InfoItem(Icons.badge_outlined, 'Admission No', child['admissionNo']?.toString()),
      _InfoItem(Icons.cake_outlined, 'Date of Birth', _fmtDob(child['dob']?.toString())),
      _InfoItem(Icons.wc_outlined, 'Gender', child['gender']?.toString()),
      _InfoItem(Icons.man_outlined, "Father's Name", child['fatherName']?.toString()),
      _InfoItem(Icons.woman_outlined, "Mother's Name", child['motherName']?.toString()),
      _InfoItem(
        Icons.phone_outlined,
        'Parent Phone',
        child['parentPhone']?.toString() ?? child['fatherPhone']?.toString(),
      ),
      _InfoItem(
        Icons.home_outlined,
        'Address',
        child['address']?.toString() ?? child['addressLine1']?.toString(),
      ),
    ].where((r) => r.value != null && r.value!.trim().isNotEmpty).toList();

    return Column(
      children: [
        const SizedBox(height: 8),
        // Keep avatar fully below the app bar — no overlap / clip
        Container(
          width: 88,
          height: 88,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: PresenceColors.primaryDark,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: [
              BoxShadow(
                color: PresenceColors.primaryDark.withValues(alpha: 0.22),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Text(
            initials,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          name,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
        ),
        if (classLabel.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            classLabel,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: PresenceColors.muted,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
        ],
        const SizedBox(height: 18),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: PresenceColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            children: [
              for (var i = 0; i < rows.length; i++) ...[
                _InfoRow(item: rows[i]),
                if (i < rows.length - 1)
                  const Divider(height: 1, indent: 60, endIndent: 16),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => context.go('/parent/tc'),
            icon: const Icon(Icons.assignment_outlined),
            label: const Text('Request Transfer Certificate'),
          ),
        ),
      ],
    );
  }

  String? _fmtDob(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(raw));
    } catch (_) {
      return raw;
    }
  }
}

class _InfoItem {
  const _InfoItem(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String? value;
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.item});
  final _InfoItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: PresenceColors.primarySoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(item.icon, size: 18, color: PresenceColors.primaryDark),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: PresenceColors.muted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.value!,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
