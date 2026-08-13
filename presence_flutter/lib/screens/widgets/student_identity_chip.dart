import 'package:flutter/material.dart';

import '../../state/parent_students_state.dart';

/// Palette for sibling identity chips (stable by child index).
const List<Color> kSiblingChipColors = [
  Color(0xFF059669), // emerald
  Color(0xFF2563EB), // blue
  Color(0xFFD97706), // amber
  Color(0xFFDB2777), // pink
  Color(0xFF7C3AED), // violet
  Color(0xFF0891B2), // cyan
];

Color siblingChipColorForIndex(int index) {
  if (index < 0) return kSiblingChipColors.first;
  return kSiblingChipColors[index % kSiblingChipColors.length];
}

Color siblingChipColorForChild(
  ParentStudentsState students,
  Map<String, dynamic> child,
) {
  final id = child['id']?.toString();
  final index = students.children.indexWhere((c) => c['id']?.toString() == id);
  return siblingChipColorForIndex(index < 0 ? 0 : index);
}

/// Compact colorful badge: "Name · Class 3-A"
class StudentIdentityChip extends StatelessWidget {
  const StudentIdentityChip({
    super.key,
    required this.name,
    required this.classLabel,
    required this.color,
    this.compact = false,
  });

  final String name;
  final String classLabel;
  final Color color;
  final bool compact;

  factory StudentIdentityChip.fromChild(
    ParentStudentsState students,
    Map<String, dynamic> child, {
    bool compact = false,
    Key? key,
  }) {
    final name = child['name']?.toString() ?? 'Student';
    final classLabel = ParentStudentsState.shortClassLabelFor(child);
    return StudentIdentityChip(
      key: key,
      name: name,
      classLabel: classLabel,
      color: siblingChipColorForChild(students, child),
      compact: compact,
    );
  }

  @override
  Widget build(BuildContext context) {
    final label = classLabel.isEmpty ? name : '$name · $classLabel';
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: compact ? 11 : 12,
        ),
      ),
    );
  }
}

/// Vertical identity block used on cards:
/// **Name**
/// Class 3 – A
class StudentIdentityBlock extends StatelessWidget {
  const StudentIdentityBlock({
    super.key,
    required this.name,
    required this.classLabel,
    required this.color,
  });

  final String name;
  final String classLabel;
  final Color color;

  factory StudentIdentityBlock.fromChild(
    ParentStudentsState students,
    Map<String, dynamic> child, {
    Key? key,
  }) {
    return StudentIdentityBlock(
      key: key,
      name: child['name']?.toString() ?? 'Student',
      classLabel: ParentStudentsState.displayClassLabelFor(child),
      color: siblingChipColorForChild(students, child),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 4,
          height: 36,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: color,
                ),
              ),
              if (classLabel.isNotEmpty)
                Text(
                  classLabel,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: color.withValues(alpha: 0.85),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Wrap of chips for "Applicable to" school announcements.
class ApplicableChildrenChips extends StatelessWidget {
  const ApplicableChildrenChips({
    super.key,
    required this.students,
    required this.children,
  });

  final ParentStudentsState students;
  final List<Map<String, dynamic>> children;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final child in children)
          StudentIdentityChip.fromChild(students, child, compact: true),
      ],
    );
  }
}
