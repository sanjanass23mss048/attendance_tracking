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
  });

  final String audienceLabel;
  final String dateLabel;
  final String body;
  final String? title;
  final String? attachmentName;
  final bool hasAttachment;
  final Future<void> Function()? onOpenAttachment;

  @override
  State<NoticeCard> createState() => _NoticeCardState();
}

class _NoticeCardState extends State<NoticeCard> {
  bool expanded = false;
  bool opening = false;

  String get _chipLabel {
    final name = (widget.attachmentName ?? '').toLowerCase();
    if (name.endsWith('.pdf')) return 'PDF';
    if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
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
    final long = widget.body.length > 160;
    final shown = expanded || !long ? widget.body : '${widget.body.substring(0, 160).trimRight()}…';
    final showAttach = widget.hasAttachment ||
        (widget.attachmentName != null && widget.attachmentName!.trim().isNotEmpty);

    return Material(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CircleAvatar(
                  radius: 22,
                  backgroundColor: PresenceColors.primaryDark,
                  child: Icon(Icons.apartment, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.audienceLabel,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: PresenceColors.text,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.calendar_today_outlined, size: 14, color: PresenceColors.muted),
                          const SizedBox(width: 6),
                          Text(
                            widget.dateLabel,
                            style: const TextStyle(color: PresenceColors.muted, fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (widget.title != null && widget.title!.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                widget.title!,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
              ),
            ],
            const SizedBox(height: 8),
            Text(
              shown,
              style: const TextStyle(height: 1.4, color: PresenceColors.text),
            ),
            if (long)
              TextButton(
                onPressed: () => setState(() => expanded = !expanded),
                style: TextButton.styleFrom(
                  foregroundColor: PresenceColors.primaryDark,
                  padding: EdgeInsets.zero,
                ),
                child: Text(expanded ? 'Less' : 'More...'),
              ),
            if (showAttach) ...[
              const SizedBox(height: 8),
              InkWell(
                onTap: widget.onOpenAttachment == null ? null : _open,
                borderRadius: BorderRadius.circular(8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
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
                    if (widget.onOpenAttachment != null)
                      const Icon(Icons.open_in_new, size: 16, color: PresenceColors.primaryDark),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
