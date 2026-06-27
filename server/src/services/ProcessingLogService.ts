import { ProcessingLogRepository } from '../repositories/ProcessingLogRepository.js';

export class ProcessingLogService {
  static async latest(limit = 8) {
    return ProcessingLogRepository.latest(limit);
  }
}
