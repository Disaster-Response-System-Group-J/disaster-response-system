import 'network_service.dart';

Future<bool> canSyncQueuedEvents() async {
  final isOnline = await NetworkService.isOnline();

  if (!isOnline) {
    print('Offline - skipping sync');
    return false;
  }

  return true;
}
