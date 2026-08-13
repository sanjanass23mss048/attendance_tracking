import 'package:flutter/material.dart';
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
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          const ParentChildDropdown(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
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
    final status = child['status']?.toString() ?? 'Active';

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
      _InfoItem(Icons.verified_outlined, 'Status', status, isStatus: true),
    ].where((r) => r.value != null && r.value!.trim().isNotEmpty).toList();

    return Column(
      children: [
        const SizedBox(height: 8),
        CircleAvatar(
          radius: 40,
          backgroundColor: PresenceColors.primaryDark,
          child: Text(
            ParentStudentsState.initialsFor(name),
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          name,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
        ),
        if (classLabel.isNotEmpty)
          Text(
            classLabel,
            style: const TextStyle(
              color: PresenceColors.muted,
              fontWeight: FontWeight.w600,
            ),
          ),
        const SizedBox(height: 18),
        Card(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            child: Column(
              children: [
                for (var i = 0; i < rows.length; i++) ...[
                  _InfoRow(item: rows[i]),
                  if (i < rows.length - 1)
                    const Divider(height: 1, indent: 56, endIndent: 12),
                ],
              ],
            ),
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
  const _InfoItem(this.icon, this.label, this.value, {this.isStatus = false});
  final IconData icon;
  final String label;
  final String? value;
  final bool isStatus;
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.item});
  final _InfoItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
                if (item.isStatus)
                  Row(
                    children: [
                      Text(
                        item.value!,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: PresenceColors.success,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.check_circle, size: 16, color: PresenceColors.success),
                    ],
                  )
                else
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
