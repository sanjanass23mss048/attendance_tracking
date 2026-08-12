import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

import '../../services/parent_push_service.dart';
import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/notice_card.dart';
import '../widgets/student_identity_chip.dart';

class ParentNoticeBoardScreen extends StatefulWidget {
  const ParentNoticeBoardScreen({super.key});

  @override
  State<ParentNoticeBoardScreen> createState() => _ParentNoticeBoardScreenState();
}

class _ParentNoticeBoardScreenState extends State<ParentNoticeBoardScreen>
    with WidgetsBindingObserver {
  List<dynamic> notices = [];
  bool loading = true;
  String? error;
  String query = '';
  Timer? _refreshDebounce;
  bool _refreshQueued = false;
  ParentPushService? _push;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _push = context.read<AuthState>().push;
      _push?.addNoticeListener(_onNoticeReceived);
    });
  }

  @override
  void dispose() {
    _refreshDebounce?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _push?.removeNoticeListener(_onNoticeReceived);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _scheduleRefresh();
    }
  }

  void _onNoticeReceived() {
    // Brief delay so the API has committed the notice before we refetch.
    _scheduleRefresh(delayMs: 400);
  }

  void _scheduleRefresh({int delayMs = 0}) {
    if (!mounted) return;
    _refreshQueued = true;
    _refreshDebounce?.cancel();
    _refreshDebounce = Timer(Duration(milliseconds: delayMs), () {
      if (!mounted || !_refreshQueued) return;
      _refreshQueued = false;
      _load(silent: true);
    });
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        loading = true;
        error = null;
      });
    }
    try {
      final list = await context.read<AuthState>().api.parentNotices();
      if (!mounted) return;
      setState(() {
        notices = list;
        error = null;
      });
    } catch (e) {
      if (!mounted) return;
      if (!silent) {
        setState(() => error = e.toString());
      }
    } finally {
      if (mounted && !silent) setState(() => loading = false);
      if (mounted && silent && loading) setState(() => loading = false);
    }
  }

  Future<void> _openAttachment(Map<String, dynamic> notice) async {
    final id = notice['id']?.toString() ?? '';
    if (id.isEmpty) throw Exception('Missing notice id');
    final nameHint = notice['attachmentName']?.toString() ?? 'attachment';
    final api = context.read<AuthState>().api;
    final file = await api.downloadNoticeAttachment(id);
    final dir = await getTemporaryDirectory();
    final safeName = file.fileName.isNotEmpty ? file.fileName : nameHint;
    final out = File(p.join(dir.path, 'notice_${id}_$safeName'));
    await out.writeAsBytes(file.bytes, flush: true);
    final result = await OpenFilex.open(out.path);
    if (result.type != ResultType.done && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();

    // Combined board: all siblings, school-wide notices once (by id).
    final seenIds = <String>{};
    final filtered = <Map<String, dynamic>>[];
    for (final n in notices) {
      final m = Map<String, dynamic>.from(n as Map);
      final id = m['id']?.toString() ?? '';
      if (id.isNotEmpty && seenIds.contains(id)) continue;
      if (!students.noticeVisibleForAnyChild(m)) continue;
      if (query.trim().isNotEmpty) {
        final hay = [
          m['audienceLabel'],
          m['title'],
          m['body'],
          ...students.childrenForNotice(m).map((c) => c['name']),
        ].whereType<Object?>().join(' ').toLowerCase();
        if (!hay.contains(query.trim().toLowerCase())) continue;
      }
      if (id.isNotEmpty) seenIds.add(id);
      filtered.add(m);
    }

    return Column(
      children: [
        Container(
          color: PresenceColors.primaryDark,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: TextField(
            onChanged: (v) => setState(() => query = v),
            decoration: InputDecoration(
              hintText: 'Search all children',
              prefixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => _load(),
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                    ? ListView(
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                          ),
                        ],
                      )
                    : filtered.isEmpty
                        ? ListView(
                            children: const [
                              SizedBox(height: 80),
                              Center(child: Text('No notices yet.')),
                            ],
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            itemCount: filtered.length,
                            separatorBuilder: (_, _) => const Divider(height: 1),
                            itemBuilder: (context, i) {
                              final m = filtered[i];
                              final type = (m['audienceType']?.toString() ?? '').toUpperCase();
                              final isSchool = type == 'ALL' || type.isEmpty;
                              final matched = students.childrenForNotice(m);
                              final hasFile = (m['attachmentUrl']?.toString().isNotEmpty ?? false) ||
                                  (m['attachmentName']?.toString().isNotEmpty ?? false);
                              final canOpen = m['attachmentUrl']?.toString().isNotEmpty ?? false;

                              final chips = <Widget>[];
                              Widget? applicable;
                              if (isSchool) {
                                if (matched.length > 1) {
                                  applicable = ApplicableChildrenChips(
                                    students: students,
                                    children: matched,
                                  );
                                } else if (matched.length == 1) {
                                  chips.add(
                                    StudentIdentityChip.fromChild(students, matched.first),
                                  );
                                }
                              } else {
                                for (final child in matched) {
                                  chips.add(StudentIdentityChip.fromChild(students, child));
                                }
                              }

                              return NoticeCard(
                                audienceLabel: m['audienceLabel']?.toString() ?? 'Notice',
                                dateLabel: _fmtDate(m['date']?.toString() ?? m['createdOn']?.toString()),
                                body: m['body']?.toString() ?? '',
                                title: m['title']?.toString(),
                                attachmentName: m['attachmentName']?.toString(),
                                hasAttachment: hasFile,
                                onOpenAttachment: canOpen ? () => _openAttachment(m) : null,
                                studentChips: chips,
                                applicableChildrenChips: applicable,
                                isSchoolAnnouncement: isSchool,
                              );
                            },
                          ),
          ),
        ),
      ],
    );
  }

  String _fmtDate(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    try {
      final d = DateTime.parse(raw);
      return DateFormat('dd-MM-yyyy').format(d);
    } catch (_) {
      return raw.length >= 10 ? raw.substring(0, 10) : raw;
    }
  }
}
