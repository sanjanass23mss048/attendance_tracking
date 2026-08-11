import 'api_client.dart';

class PresenceApi {
  PresenceApi(this.client);
  final ApiClient client;

  Future<Map<String, dynamic>> login(String email, String password) async {
    final data = await client.fetch(
      '/api/auth/login',
      method: 'POST',
      jsonBody: {
        'email': email.trim(),
        'password': password,
        'rememberMe': true,
      },
    ) as Map<String, dynamic>;
    await client.setSession(
      data['token'] as String,
      Map<String, dynamic>.from(data['user'] as Map),
    );
    return data;
  }

  Future<Map<String, dynamic>> me() async {
    final data = await client.fetch('/api/me') as Map<String, dynamic>;
    if (data['user'] is Map) {
      await client.setSession(
        client.token!,
        Map<String, dynamic>.from(data['user'] as Map),
      );
    }
    return data;
  }

  Future<void> logout() => client.clearSession();

  Future<List<dynamic>> classes() async {
    final data = await client.fetch('/api/classes') as Map<String, dynamic>;
    return (data['classes'] as List?) ?? [];
  }

  Future<Map<String, dynamic>> attendanceSummary(String date) async {
    return await client.fetch('/api/attendance/summary?date=${Uri.encodeComponent(date)}')
        as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> dailyAttendance(String sectionId, String date) async {
    final q = Uri(queryParameters: {'sectionId': sectionId, 'date': date}).query;
    return await client.fetch('/api/attendance/daily?$q') as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> saveDaily({
    required String sectionId,
    required String date,
    required List<Map<String, dynamic>> marks,
  }) async {
    final nonPresent = marks.where((m) => m['status'] != null && m['status'] != 'P').toList();
    return await client.fetch(
      '/api/attendance/daily',
      method: 'PUT',
      jsonBody: {
        'sectionId': sectionId,
        'date': date,
        'marks': nonPresent,
      },
    ) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> sendParentMessages({
    required String sectionId,
    required String date,
    required List<Map<String, dynamic>> messages,
  }) async {
    return await client.fetch(
      '/api/attendance/parent-messages',
      method: 'POST',
      jsonBody: {
        'sectionId': sectionId,
        'date': date,
        'messages': messages,
      },
    ) as Map<String, dynamic>;
  }

  Future<List<dynamic>> students({String? sectionId}) async {
    if (sectionId == null || sectionId.isEmpty) {
      // Aggregate across assigned classes
      final classes = await this.classes();
      final out = <dynamic>[];
      for (final klass in classes) {
        final map = Map<String, dynamic>.from(klass as Map);
        final className = map['name']?.toString() ?? '';
        for (final sec in (map['sections'] as List? ?? [])) {
          final s = Map<String, dynamic>.from(sec as Map);
          final sid = s['id']?.toString() ?? '';
          if (sid.isEmpty) continue;
          try {
            final data = await client.fetch(
              '/api/students?sectionId=${Uri.encodeComponent(sid)}',
            ) as Map<String, dynamic>;
            for (final st in (data['students'] as List? ?? [])) {
              final row = Map<String, dynamic>.from(st as Map);
              row['className'] ??= className;
              row['sectionName'] ??= s['name']?.toString() ?? '';
              out.add(row);
            }
          } catch (_) {
            // skip sections that fail
          }
        }
      }
      return out;
    }
    final data = await client.fetch(
      '/api/students?sectionId=${Uri.encodeComponent(sectionId)}',
    ) as Map<String, dynamic>;
    return (data['students'] as List?) ?? [];
  }

  Future<List<dynamic>> calendarEvents({required String from, required String to}) async {
    final q = Uri(queryParameters: {'from': from, 'to': to}).query;
    final data = await client.fetch('/api/calendar/events?$q');
    if (data is Map) return (data['events'] as List?) ?? [];
    if (data is List) return data;
    return [];
  }

  Future<List<dynamic>> teachers() async {
    final data = await client.fetch('/api/teachers') as Map<String, dynamic>;
    return (data['teachers'] as List?) ?? [];
  }

  Future<Map<String, dynamic>> dayWiseReport({
    required String date,
    String className = 'all',
  }) async {
    final q = Uri(queryParameters: {
      'date': date,
      'className': className,
    }).query;
    return await client.fetch('/api/reports/daily?$q') as Map<String, dynamic>;
  }

  // —— Notices (staff) ——
  Future<List<dynamic>> listNotices() async {
    final data = await client.fetch('/api/notices') as Map<String, dynamic>;
    return (data['notices'] as List?) ?? [];
  }

  Future<Map<String, dynamic>> createNotice({
    String? title,
    required String body,
    required String audienceType,
    List<String> classSectionIds = const [],
    List<String> studentClassIds = const [],
    String? attachmentName,
    String? attachmentUrl,
  }) async {
    return await client.fetch(
      '/api/notices',
      method: 'POST',
      jsonBody: {
        if (title != null) 'title': title,
        'body': body,
        'audienceType': audienceType,
        'classSectionIds': classSectionIds,
        'studentClassIds': studentClassIds,
        if (attachmentName != null) 'attachmentName': attachmentName,
        if (attachmentUrl != null) 'attachmentUrl': attachmentUrl,
      },
    ) as Map<String, dynamic>;
  }

  // —— Parent portal ——
  Future<List<dynamic>> parentChildren() async {
    final data = await client.fetch('/api/parent/children') as Map<String, dynamic>;
    return (data['children'] as List?) ?? [];
  }

  Future<List<dynamic>> parentNotices() async {
    final data = await client.fetch('/api/parent/notices') as Map<String, dynamic>;
    return (data['notices'] as List?) ?? [];
  }

  Future<List<dynamic>> parentDiary() async {
    final data = await client.fetch('/api/parent/diary') as Map<String, dynamic>;
    return (data['entries'] as List?) ?? [];
  }

  Future<Map<String, dynamic>> parentCalendar({required String from, required String to}) async {
    final q = Uri(queryParameters: {'from': from, 'to': to}).query;
    return await client.fetch('/api/parent/calendar?$q') as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> parentTimetable({String? classSectionId}) async {
    final q = classSectionId == null || classSectionId.isEmpty
        ? ''
        : '?${Uri(queryParameters: {'classSectionId': classSectionId}).query}';
    final data = await client.fetch('/api/parent/timetable$q') as Map<String, dynamic>;
    return Map<String, dynamic>.from((data['timetable'] as Map?) ?? {});
  }

  Future<void> registerDeviceToken(String token, {String platform = 'android'}) async {
    await client.fetch(
      '/api/parent/device-token',
      method: 'POST',
      jsonBody: {'token': token, 'platform': platform},
    );
  }

  Future<void> unregisterDeviceToken(String token) async {
    await client.fetch(
      '/api/parent/device-token',
      method: 'DELETE',
      jsonBody: {'token': token},
    );
  }
}
