import 'package:flutter/material.dart';

import '../../theme.dart';

class NoticeCard extends StatefulWidget {
  const NoticeCard({
    super.key,
    required this.audienceLabel,
    required this.dateLabel,
    required this.body,
    this.title,
    this.attachmentName,
    this.hasAttachment = false,
    this.onOpenAttachment,
    this.studentChips = const [],
    this.applicableChildrenChips,
    this.isSchoolAnnouncement = false,
    this.primaryChildName,
    this.primaryChildClass,
    this.primaryChildInitials,
    this.categoryTag,
  });

  final String audienceLabel;
  final String dateLabel;
  final String body;
  final String? title;
  final String? attachmentName;
  final bool hasAttachment;
  final Future<void> Function()? onOpenAttachment;
  final List<Widget> studentChips;
  final Widget? applicableChildrenChips;
  final bool isSchoolAnnouncement;
  final String? primaryChildName;
  final String? primaryChildClass;
  final String? primaryChildInitials;
  final String? categoryTag;

  @override
  State<NoticeCard> createState() => _NoticeCardState();
}

class _NoticeCardState extends State<NoticeCard> {
  bool expanded = false;
  bool opening = false;

  String get _chipLabel {
    final name = (widget.attachmentName ?? '').toLowerCase();
    if (name.endsWith('.pdf')) return 'PDF';
    if (name.endsWith('.png') ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg') ||
        name.endsWith('.webp')) {
      return 'IMG';
    }
    if (name.endsWith('.doc') || name.endsWith('.docx')) return 'DOC';
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) return 'XLS';
    return 'FILE';
  }

  Future<void> _open() async {
    if (widget.onOpenAttachment == null || opening) return;
    setState(() => opening = true);
    try {
      await widget.onOpenAttachment!();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open attachment: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final long = widget.body.length > 140;
    final shown =
        expanded || !long ? widget.body : '${widget.body.substring(0, 140).trimRight()}…';
    final showAttach = widget.hasAttachment ||
        (widget.attachmentName != null && widget.attachmentName!.trim().isNotEmpty);

    final tagLabel = widget.isSchoolAnnouncement
        ? 'SCHOOL ANNOUNCEMENT'
        : (widget.categoryTag ?? widget.audienceLabel).toUpperCase();
    final tagColor = widget.isSchoolAnnouncement
        ? const Color(0xFFEA580C)
        : PresenceColors.primaryDark;
    final iconBg = widget.isSchoolAnnouncement
        ? PresenceColors.accent
        : PresenceColors.primaryDark;
    final icon = widget.isSchoolAnnouncement
        ? Icons.campaign_rounded
        : (tagLabel.contains('STUDENT')
            ? Icons.groups_rounded
            : Icons.apartment_rounded);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: PresenceColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: long ? () => setState(() => expanded = !expanded) : null,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          CircleAvatar(
                            radius: 22,
                            backgroundColor: iconBg,
                            child: Icon(icon, color: Colors.white, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: tagColor.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    tagLabel,
                                    style: TextStyle(
                                      color: tagColor,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 10,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                if (widget.title != null &&
                                    widget.title!.trim().isNotEmpty)
                                  Text(
                                    widget.title!,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                      color: PresenceColors.primaryDark,
                                    ),
                                  ),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.calendar_today_outlined,
                                      size: 13,
                                      color: PresenceColors.muted,
                                    ),
                                    const SizedBox(width: 5),
                                    Text(
                                      widget.dateLabel,
                                      style: const TextStyle(
                                        color: PresenceColors.muted,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        shown,
                        style: const TextStyle(
                          height: 1.4,
                          color: PresenceColors.text,
                          fontSize: 13.5,
                        ),
                      ),
                      if (long)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            expanded ? 'Show less' : 'Read more',
                            style: const TextStyle(
                              color: PresenceColors.primaryDark,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      if (widget.primaryChildName != null) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 14,
                              backgroundColor: PresenceColors.primaryDark,
                              child: Text(
                                widget.primaryChildInitials ?? '?',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                [
                                  widget.primaryChildName,
                                  if (widget.primaryChildClass != null &&
                                      widget.primaryChildClass!.isNotEmpty)
                                    widget.primaryChildClass,
                                ].join(' · '),
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: PresenceColors.text,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (widget.applicableChildrenChips != null) ...[
                        const SizedBox(height: 10),
                        widget.applicableChildrenChips!,
                      ] else if (widget.studentChips.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: widget.studentChips,
                        ),
                      ],
                      if (showAttach) ...[
                        const SizedBox(height: 10),
                        InkWell(
                          onTap: widget.onOpenAttachment == null ? null : _open,
                          borderRadius: BorderRadius.circular(8),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFDBEAFE),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: opening
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : Text(
                                        _chipLabel,
                                        style: const TextStyle(
                                          color: PresenceColors.primaryDark,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  widget.attachmentName ?? 'Attachment',
                                  style: TextStyle(
                                    color: widget.onOpenAttachment == null
                                        ? PresenceColors.muted
                                        : PresenceColors.primaryDark,
                                    fontSize: 13,
                                    decoration: widget.onOpenAttachment == null
                                        ? TextDecoration.none
                                        : TextDecoration.underline,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Icon(Icons.chevron_right_rounded, color: Color(0xFFCBD5E1)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
