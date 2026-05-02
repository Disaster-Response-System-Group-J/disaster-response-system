final isOnline = await NetworkService.isOnline();

if (!isOnline) {
  print('Offline - skipping sync');
  return;
}