import { env } from './config/env.js';
import { createApp } from './app.js';
import { scheduleSnapshotDiscovery } from './jobs/scheduleSnapshotDiscovery.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`CEO Command Center API listening on port ${env.PORT}`);
  scheduleSnapshotDiscovery();
});
